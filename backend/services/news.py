"""Google News RSS feed for Strait of Hormuz / Gulf oil-shipping intelligence.

Fetches multiple topic queries concurrently, dedupes, classifies, and caches
results for 1 hour. Fully defensive — never raises; returns [] on total failure.
"""
from __future__ import annotations

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import httpx

logger = logging.getLogger(__name__)

_QUERIES = [
    "Strait of Hormuz tanker",
    "Hormuz oil shipping",
    "Persian Gulf tanker attack",
    "Iran oil sanctions tanker",
    "Fujairah port oil",
]

_BASE_URL = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"

_cache: dict[str, tuple] = {}
_CACHE_TTL = 3600  # 1 hour
_MAX_AGE_DAYS = 30

# Topic keyword heuristics (checked in order; first match wins)
_TOPIC_RULES: list[tuple[str, list[str]]] = [
    ("attack", ["attack", "strike", "missile", "drone", "seized", "explosion", "blast", "hijack"]),
    ("sanctions", ["sanction", "embargo", "restrict", "ban"]),
    ("geopolitics", ["iran", "us ", "u.s.", "deal", "talks", "military", "navy", "pentagon", "irgc", "nuclear"]),
    ("shipping", ["tanker", "vessel", "transit", "freight", "insurance", "cargo", "ship", "fleet"]),
]


def _classify(title: str) -> str:
    t = title.lower()
    for topic, keywords in _TOPIC_RULES:
        if any(kw in t for kw in keywords):
            return topic
    return "energy"


def _parse_rss(xml_text: str) -> list[dict]:
    """Parse a Google News RSS XML payload into a list of article dicts."""
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning("RSS parse error: %s", e)
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

            items.append({
                "title": title,
                "url": link,
                "source": source,
                "published": published.isoformat(),
                "age_hours": age_hours,
                "topic": _classify(title),
                "_pub_dt": published,  # for sorting; stripped before return
            })
        except Exception:
            continue

    return items


async def _fetch_one(client: httpx.AsyncClient, query: str) -> list[dict]:
    """Fetch and parse a single Google News RSS query. Returns [] on any failure."""
    url = _BASE_URL.format(q=quote_plus(query))
    for attempt in range(3):
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return _parse_rss(resp.text)
        except Exception as e:
            if attempt < 2:
                await asyncio.sleep(1.5 * (attempt + 1))
            else:
                logger.warning("News fetch failed for query %r: %s", query, e)
    return []


async def fetch_strait_news(limit: int = 30) -> list[dict]:
    """Fetch, dedupe, classify, and return recent Hormuz news articles.

    Uses a 1-hour module-level cache; serves stale on failure.
    Returns [] on total failure — never raises.
    """
    cache_key = f"news:{limit}"
    cached = _cache.get(cache_key)
    if cached:
        data, ts = cached
        if time.time() - ts < _CACHE_TTL:
            return data

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            results = await asyncio.gather(
                *[_fetch_one(client, q) for q in _QUERIES],
                return_exceptions=True,
            )

        # Flatten, dedupe by normalized title
        seen_titles: set[str] = set()
        seen_urls: set[str] = set()
        merged: list[dict] = []

        for batch in results:
            if isinstance(batch, Exception):
                continue
            for article in batch:
                norm = article["title"].lower().strip()
                url = article["url"]
                if norm in seen_titles or url in seen_urls:
                    continue
                seen_titles.add(norm)
                seen_urls.add(url)
                merged.append(article)

        # Sort by published DESC, truncate
        merged.sort(key=lambda a: a["_pub_dt"], reverse=True)
        merged = merged[:limit]

        # Strip internal sort key
        for a in merged:
            a.pop("_pub_dt", None)

        _cache[cache_key] = (merged, time.time())
        return merged

    except Exception as e:  # noqa: BLE001
        logger.error("fetch_strait_news total failure: %s", e)
        # Serve stale cache if available
        stale = _cache.get(cache_key)
        if stale and stale[0]:
            logger.warning("Serving stale news cache after failure.")
            return stale[0]
        return []
