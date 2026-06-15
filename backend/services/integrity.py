"""GPS/AIS data-integrity signal derived from news feed.

Hormuz is known for heavy GPS spoofing and jamming that degrades AIS
position accuracy and transit counts. This module scans recent news
headlines for interference keywords and surfaces a disruption flag.

Fully defensive — never raises; returns safe defaults on any failure.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_cache: dict[str, tuple] = {}
_CACHE_TTL = 3600  # 1 hour

_KEYWORDS = [
    "gps",
    "jamming",
    "jam",
    "spoof",
    "spoofing",
    "gnss",
    "navigation interference",
    "ais manipulation",
]

_RECENT_HOURS = 7 * 24  # 7 days


def _matches(title: str) -> bool:
    t = title.lower()
    return any(kw in t for kw in _KEYWORDS)


async def get_data_integrity() -> dict:
    """Derive a GPS/AIS data-integrity signal from the Hormuz news feed.

    Returns:
        gps_disruption_active: True if >=1 headline mentioning interference
                               in the last 7 days.
        mention_count: total matching articles in the last 7 days.
        headlines: up to 5 matching articles (title, url, source, age_hours).
        note: contextual explanation.
        source: attribution string.
        updated_at: ISO timestamp.
    """
    cache_key = "integrity:gps"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    updated_at = datetime.now(timezone.utc).isoformat()

    _safe = {
        "gps_disruption_active": False,
        "mention_count": 0,
        "headlines": [],
        "note": (
            "Active GPS/GNSS interference degrades AIS positions and transit counts"
            " — vessel data may be understated."
        ),
        "source": "derived from Google News",
        "updated_at": updated_at,
    }

    try:
        # Import here to avoid circular imports at module load time
        from backend.services.news import fetch_strait_news  # noqa: PLC0415

        articles = await fetch_strait_news(limit=40)
    except Exception as exc:
        logger.error("get_data_integrity: news fetch failed: %s", exc)
        stale = _cache.get(cache_key)
        if stale:
            return stale[0]
        return _safe

    try:
        matched = []
        for article in articles:
            age = article.get("age_hours", 9999)
            if age > _RECENT_HOURS:
                continue
            if _matches(article.get("title", "")):
                matched.append(article)

        headlines = [
            {
                "title": a["title"],
                "url": a.get("url", ""),
                "source": a.get("source", ""),
                "age_hours": a.get("age_hours", 0),
            }
            for a in matched[:5]
        ]

        result = {
            "gps_disruption_active": len(matched) >= 1,
            "mention_count": len(matched),
            "headlines": headlines,
            "note": (
                "Active GPS/GNSS interference degrades AIS positions and transit counts"
                " — vessel data may be understated."
            ),
            "source": "derived from Google News",
            "updated_at": updated_at,
        }

        _cache[cache_key] = (result, time.time())
        return result

    except Exception as exc:
        logger.error("get_data_integrity: processing failed: %s", exc)
        stale = _cache.get(cache_key)
        if stale:
            return stale[0]
        return _safe
