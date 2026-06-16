"""Structured maritime security-incident timeline from Google News RSS.

Fetches multiple incident-focused queries concurrently, dedupes, classifies
(type + severity), and caches results for 1 hour. Fully defensive — never
raises; returns empty incidents dict on total failure.

Focused ONLY on kinetic incidents: attacks, seizures, strikes, sinkings.
MARAD/UKMTO pages are WAF-blocked/PDF-only, so this uses Google News RSS
which is reliable and returns press-reported incidents promptly.
"""
from __future__ import annotations

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import httpx

logger = logging.getLogger(__name__)

_QUERIES = [
    "Strait of Hormuz tanker attacked",
    "Hormuz vessel seized",
    "Persian Gulf tanker missile drone",
    "Hormuz ship struck OR sunk",
    "Iran seizes tanker Gulf",
]

_BASE_URL = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"

_cache: dict[str, tuple] = {}
_CACHE_TTL = 3600  # 1 hour
_MAX_AGE_DAYS = 60


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

_ATTACK_KW = {"attack", "attacked", "struck", "hit", "explosion", "explode",
               "missile", "drone", "uav", "blast", "fire", "fired", "bomb",
               "detonate", "detonated"}
_SEIZURE_KW = {"seiz", "captur", "board", "detain", "hijack", "commandeer"}
_CLOSURE_KW = {"closed", "closure", "block", "halt", "suspend", "restrict"}
_SINKING_KW = {"sunk", "sink", "sank", "foundering"}
_CRITICAL_KW = {"killed", "dead", "sunk", "sink", "sank", "casualties",
                "wounded", "fatalities"}


def _classify_type(title: str) -> str:
    t = title.lower()
    words = set(t.replace("-", " ").split())
    # Check attack keywords (substring match for some)
    if any(kw in words for kw in _ATTACK_KW) or any(kw in t for kw in
            {"struck", "missile", "drone", "uav", "explosion", "blast"}):
        return "attack"
    if any(kw in t for kw in _SINKING_KW):
        return "sinking"
    if any(kw in t for kw in _SEIZURE_KW):
        return "seizure"
    if any(kw in t for kw in _CLOSURE_KW):
        return "closure"
    return "alert"


def _classify_severity(title: str, inc_type: str) -> str:
    t = title.lower()
    if inc_type in ("attack", "sinking") or any(kw in t for kw in _CRITICAL_KW):
        return "critical"
    if inc_type in ("seizure", "closure"):
        return "high"
    return "warning"


# ---------------------------------------------------------------------------
# RSS parsing
# ---------------------------------------------------------------------------

def _parse_rss(xml_text: str) -> list[dict]:
    """Parse a Google News RSS payload into incident dicts."""
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        logger.warning("Incidents RSS parse error: %s", exc)
        return items

    channel = root.find("channel")
    if channel is None:
        return items

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=_MAX_AGE_DAYS)

    for item in channel.findall("item"):
        try:
            title_el = item.find("title")
            link_el = item.find("link")
            pub_el = item.find("pubDate")
            src_el = item.find("source")

            if title_el is None or link_el is None or pub_el is None:
                continue

            title = (title_el.text or "").strip()
            link = (link_el.text or "").strip()
            pub_raw = (pub_el.text or "").strip()
            source = (src_el.text or "").strip() if src_el is not None else ""

            if not title or not link:
                continue

            # Parse RFC822 pubDate
            try:
                published = parsedate_to_datetime(pub_raw)
                if published.tzinfo is None:
                    published = published.replace(tzinfo=timezone.utc)
                published = published.astimezone(timezone.utc)
            except Exception:
                continue

            if published < cutoff:
                continue

            age_hours = round((now - published).total_seconds() / 3600, 1)
            inc_type = _classify_type(title)
            severity = _classify_severity(title, inc_type)

            items.append({
                "date": published.isoformat(),
                "title": title,
                "source": source,
                "url": link,
                "type": inc_type,
                "severity": severity,
                "age_hours": age_hours,
                "_pub_dt": published,  # internal sort key; stripped before return
            })
        except Exception:
            continue

    return items


# ---------------------------------------------------------------------------
# Fetch helpers
# ---------------------------------------------------------------------------

async def _fetch_one(client: httpx.AsyncClient, query: str) -> list[dict]:
    """Fetch and parse one RSS query. Returns [] on any failure."""
    url = _BASE_URL.format(q=quote_plus(query))
    for attempt in range(3):
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return _parse_rss(resp.text)
        except Exception as exc:
            if attempt < 2:
                await asyncio.sleep(1.5 * (attempt + 1))
            else:
                logger.warning("Incidents fetch failed for query %r: %s", query, exc)
    return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_incidents(limit: int = 20) -> dict:
    """Return a structured maritime security-incident timeline.

    Uses a 1-hour module-level cache; serves stale on failure.
    Never raises — returns empty incidents dict on total failure.
    """
    cache_key = f"incidents:{limit}"
    cached = _cache.get(cache_key)
    if cached:
        data, ts = cached
        if time.time() - ts < _CACHE_TTL:
            return data

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            results = await asyncio.gather(
                *[_fetch_one(client, q) for q in _QUERIES],
                return_exceptions=True,
            )

        # Flatten + dedupe by normalised title
        seen_titles: set[str] = set()
        seen_urls: set[str] = set()
        merged: list[dict] = []

        for batch in results:
            if isinstance(batch, Exception):
                continue
            for inc in batch:
                norm = inc["title"].lower().strip()
                url = inc["url"]
                if norm in seen_titles or url in seen_urls:
                    continue
                seen_titles.add(norm)
                seen_urls.add(url)
                merged.append(inc)

        # Sort newest-first, truncate
        merged.sort(key=lambda x: x["_pub_dt"], reverse=True)
        merged = merged[:limit]

        # Strip internal key
        for inc in merged:
            inc.pop("_pub_dt", None)

        result = {
            "incidents": merged,
            "count": len(merged),
            "source": "Google News (press-reported maritime incidents)",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        _cache[cache_key] = (result, time.time())
        return result

    except Exception as exc:  # noqa: BLE001
        logger.error("get_incidents total failure: %s", exc)
        # Serve stale cache if available
        stale = _cache.get(cache_key)
        if stale and stale[0]:
            logger.warning("Serving stale incidents cache after failure.")
            return stale[0]

        # Total failure — return empty but valid shape
        return {
            "incidents": [],
            "count": 0,
            "source": "Google News (press-reported maritime incidents)",
            "updated_at": now_iso,
        }
