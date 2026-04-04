"""FRED API client — fetch Brent/WTI crude oil prices."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_API_KEY = os.getenv("FRED_API_KEY", "")
_BASE = "https://api.stlouisfed.org/fred/series/observations"

# FRED series IDs
BRENT_SERIES = "DCOILBRENTEU"  # Daily Europe Brent Spot Price
WTI_SERIES = "DCOILWTICO"      # Daily WTI Spot Price

_cache: Dict[str, tuple] = {}  # series_id -> (data, fetched_at)
_CACHE_TTL = 3600  # 1 hour


async def fetch_oil_prices(
    days: int = 365,
) -> List[Dict]:
    """Fetch daily Brent and WTI prices for the last N days."""
    if not _API_KEY:
        logger.warning("FRED_API_KEY not set")
        return []

    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    brent = await _fetch_series(BRENT_SERIES, start)
    wti = await _fetch_series(WTI_SERIES, start)

    # Full outer merge by date
    brent_map = {r["date"]: r["value"] for r in brent}
    wti_map = {r["date"]: r["value"] for r in wti}
    all_dates = sorted(set(brent_map) | set(wti_map))
    result = []
    for d in all_dates:
        b = brent_map.get(d)
        w = wti_map.get(d)
        if b is not None or w is not None:
            result.append({"date": d, "brent": b, "wti": w})
    return result


async def get_latest_prices() -> Dict[str, Optional[float]]:
    """Get most recent Brent and WTI prices from FRED."""
    prices = await fetch_oil_prices(days=14)
    if not prices:
        return {"brent": None, "wti": None}
    latest = prices[-1]
    return {"brent": latest.get("brent"), "wti": latest.get("wti")}


async def _fetch_series(series_id: str, start_date: str) -> List[Dict]:
    """Fetch a FRED time series."""
    import time

    cache_key = f"{series_id}:{start_date}"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    params = {
        "series_id": series_id,
        "api_key": _API_KEY,
        "file_type": "json",
        "observation_start": start_date,
        "sort_order": "asc",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(_BASE, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        logger.error("FRED fetch %s failed: %s", series_id, e)
        return []

    observations = payload.get("observations", [])
    result = []
    for obs in observations:
        val = obs.get("value", ".")
        if val == ".":
            continue
        try:
            result.append({
                "date": obs["date"],
                "value": float(val),
            })
        except (ValueError, KeyError):
            continue

    _cache[cache_key] = (result, time.time())
    return result
