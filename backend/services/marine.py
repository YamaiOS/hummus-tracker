"""Marine Conditions Service — Open-Meteo Marine API for Strait of Hormuz.

Queries the narrows at lat 26.5, lon 56.3 (central chokepoint).
Provides wave height, swell, and wind-wave forecasts for 48 h.
No API key required.  Model resolution ~8 km (indicative only).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-module cache (~1 h)
# ---------------------------------------------------------------------------
_cache: dict[str, Any] = {}
_CACHE_TTL_SECONDS = 3600
_CACHE_KEY = "marine:hormuz"

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"

# Strait of Hormuz narrows
_LAT = 26.5
_LON = 56.3

_SAFE_SHAPE: dict[str, Any] = {
    "current": {
        "wave_height": None,
        "swell_wave_height": None,
        "wind_wave_height": None,
        "time": None,
    },
    "hourly": [],
    "max_wave_24h": None,
    "source": "Open-Meteo Marine (~8km model; indicative)",
    "updated_at": None,
}


def _is_stale() -> bool:
    entry = _cache.get(_CACHE_KEY)
    if entry is None:
        return True
    age = (datetime.now(timezone.utc) - entry["_cached_at"]).total_seconds()
    return age > _CACHE_TTL_SECONDS


def _safe_float(value: Any) -> float | None:
    """Return float or None; swallow errors and non-finite values."""
    if value is None:
        return None
    try:
        v = float(value)
        import math
        return None if (math.isnan(v) or math.isinf(v)) else v
    except Exception:
        return None


async def get_marine_conditions() -> dict:
    """Return marine wave conditions at the Strait of Hormuz narrows.

    Never raises — returns safe shape on any failure.
    Serves stale cache if live fetch fails.
    """
    now = datetime.now(timezone.utc)

    # Serve fresh cache
    if not _is_stale():
        return _cache[_CACHE_KEY]["data"]

    params = {
        "latitude": _LAT,
        "longitude": _LON,
        "hourly": "wave_height,swell_wave_height,wind_wave_height",
        "forecast_days": 2,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(MARINE_URL, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        logger.warning("marine: fetch failed (%s); returning %s",
                       exc, "stale cache" if _CACHE_KEY in _cache else "safe shape")
        if _CACHE_KEY in _cache:
            return _cache[_CACHE_KEY]["data"]
        return {**_SAFE_SHAPE, "updated_at": now.isoformat()}

    try:
        hourly = raw.get("hourly") or {}
        times: list[str] = hourly.get("time") or []
        wave_heights: list = hourly.get("wave_height") or []
        swell_heights: list = hourly.get("swell_wave_height") or []
        wind_wave_heights: list = hourly.get("wind_wave_height") or []

        # Build hourly list (up to 48 entries, next ~48 h)
        hourly_list: list[dict] = []
        for i, t in enumerate(times):
            wh = _safe_float(wave_heights[i]) if i < len(wave_heights) else None
            sh = _safe_float(swell_heights[i]) if i < len(swell_heights) else None
            ww = _safe_float(wind_wave_heights[i]) if i < len(wind_wave_heights) else None
            hourly_list.append({
                "time": t,
                "wave_height": wh,
                "swell_wave_height": sh,
                "wind_wave_height": ww,
            })

        # Pick "current" = entry nearest to now (ISO strings, lexicographic compare works)
        now_str = now.strftime("%Y-%m-%dT%H:%M")
        current_entry: dict | None = None
        if times:
            # Find closest by string distance (times are ISO format YYYY-MM-DDTHH:MM)
            best_idx = 0
            best_diff = abs(_parse_iso_minutes(times[0], now_str))
            for idx, t in enumerate(times[1:], start=1):
                diff = abs(_parse_iso_minutes(t, now_str))
                if diff < best_diff:
                    best_diff = diff
                    best_idx = idx
            current_entry = hourly_list[best_idx] if best_idx < len(hourly_list) else None

        if current_entry is None and hourly_list:
            current_entry = hourly_list[0]

        current: dict[str, Any] = {
            "wave_height": current_entry["wave_height"] if current_entry else None,
            "swell_wave_height": current_entry["swell_wave_height"] if current_entry else None,
            "wind_wave_height": current_entry["wind_wave_height"] if current_entry else None,
            "time": current_entry["time"] if current_entry else None,
        }

        # Max wave height over next 24 h (first 24 entries)
        next_24 = hourly_list[:24]
        wave_24 = [e["wave_height"] for e in next_24 if e["wave_height"] is not None]
        max_wave_24h = max(wave_24) if wave_24 else None

        result: dict[str, Any] = {
            "current": current,
            "hourly": hourly_list,
            "max_wave_24h": max_wave_24h,
            "source": "Open-Meteo Marine (~8km model; indicative)",
            "updated_at": now.isoformat(),
        }
    except Exception as exc:
        logger.error("marine: parse error (%s); returning safe shape", exc)
        if _CACHE_KEY in _cache:
            return _cache[_CACHE_KEY]["data"]
        return {**_SAFE_SHAPE, "updated_at": now.isoformat()}

    _cache[_CACHE_KEY] = {"data": result, "_cached_at": now}
    return result


def _parse_iso_minutes(iso: str, ref: str) -> int:
    """Return difference in 'minutes equivalent' between two ISO strings (rough)."""
    try:
        # Compare as strings: YYYY-MM-DDTHH:MM → convert to comparable int
        # Strip to 16 chars: '2024-06-16T14:00'
        a = iso[:16].replace("-", "").replace("T", "").replace(":", "")
        b = ref[:16].replace("-", "").replace("T", "").replace(":", "")
        return int(a) - int(b)
    except Exception:
        return 999999
