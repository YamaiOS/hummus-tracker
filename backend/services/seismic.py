"""Seismic Service — USGS FDSN earthquake data for Gulf region.

Flags seismic risk near Gulf oil/LNG terminals:
  - Bandar Abbas (Iran) — key tanker transit port at Hormuz narrows
  - Kharg Island (Iran) — largest crude export terminal in the world

Bounding box: 22–37°N, 44–62°E covers the Arabian Peninsula, Iran, and southern Gulf.
No API key required.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-module cache (~1 h)
# ---------------------------------------------------------------------------
_cache: dict[str, Any] = {}
_CACHE_TTL_SECONDS = 3600

USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

_SAFE_SHAPE: dict[str, Any] = {
    "events": [],
    "count": 0,
    "max_mag": None,
    "window_days": 14,
    "source": "USGS FDSN",
    "updated_at": None,
}


def _cache_key(days: int) -> str:
    return f"seismic:{days}"


def _is_stale(key: str) -> bool:
    entry = _cache.get(key)
    if entry is None:
        return True
    age = (datetime.now(timezone.utc) - entry["_cached_at"]).total_seconds()
    return age > _CACHE_TTL_SECONDS


async def get_regional_seismicity(days: int = 14) -> dict:
    """Return Gulf-region earthquakes (M≥4.0) from USGS FDSN.

    Never raises — returns safe shape on any failure.
    Serves stale cache if live fetch fails.
    """
    key = _cache_key(days)

    # Serve fresh cache
    if not _is_stale(key):
        return _cache[key]["data"]

    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(days=days)).strftime("%Y-%m-%d")

    params = {
        "format": "geojson",
        "minlatitude": 22,
        "maxlatitude": 37,
        "minlongitude": 44,
        "maxlongitude": 62,
        "minmagnitude": 4.0,
        "starttime": start_time,
        "orderby": "time",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(USGS_URL, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        logger.warning("seismic: fetch failed (%s); returning %s",
                       exc, "stale cache" if key in _cache else "safe shape")
        # Serve stale if available
        if key in _cache:
            return _cache[key]["data"]
        result = {**_SAFE_SHAPE, "window_days": days, "updated_at": now.isoformat()}
        return result

    try:
        features = raw.get("features") or []
        events: list[dict] = []
        for f in features:
            try:
                props = f.get("properties") or {}
                geom = f.get("geometry") or {}
                coords = geom.get("coordinates") or [None, None, None]
                lon = coords[0] if len(coords) > 0 else None
                lat = coords[1] if len(coords) > 1 else None
                depth = coords[2] if len(coords) > 2 else None

                epoch_ms = props.get("time")
                iso_time: str | None = None
                if epoch_ms is not None:
                    try:
                        iso_time = datetime.fromtimestamp(
                            epoch_ms / 1000.0, tz=timezone.utc
                        ).isoformat()
                    except Exception:
                        iso_time = None

                mag = props.get("mag")
                events.append({
                    "mag": float(mag) if mag is not None else None,
                    "place": props.get("place") or "",
                    "time": iso_time,
                    "lat": float(lat) if lat is not None else None,
                    "lon": float(lon) if lon is not None else None,
                    "depth_km": float(depth) if depth is not None else None,
                    "url": props.get("url") or "",
                })
            except Exception as inner:
                logger.debug("seismic: skipping malformed feature: %s", inner)
                continue

        # Already ordered by time (desc) from USGS; confirm sort just in case
        events.sort(key=lambda e: e["time"] or "", reverse=True)

        mags = [e["mag"] for e in events if e["mag"] is not None]
        max_mag = max(mags) if mags else None

        result: dict[str, Any] = {
            "events": events,
            "count": len(events),
            "max_mag": max_mag,
            "window_days": days,
            "source": "USGS FDSN",
            "updated_at": now.isoformat(),
        }
    except Exception as exc:
        logger.error("seismic: parse error (%s); returning safe shape", exc)
        if key in _cache:
            return _cache[key]["data"]
        result = {**_SAFE_SHAPE, "window_days": days, "updated_at": now.isoformat()}

    _cache[key] = {"data": result, "_cached_at": now}
    return result
