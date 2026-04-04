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


async def get_latest_prices() -> Dict[str, any]:
    """Get both FRED spot and yfinance futures Brent prices.

    FRED DCOILBRENTEU = physical spot (EIA/Refinitiv), lags 1-5 biz days.
    yfinance BZ=F    = ICE front-month futures, near-real-time.
    """
    from .market_data import fetch_market_metrics

    # 1. yfinance futures (live)
    futures_price = None
    futures_date = None
    try:
        metrics = await fetch_market_metrics()
        if metrics:
            futures_price = metrics.get("brent_m1")
            futures_date = metrics.get("date")
    except Exception:
        pass

    # 2. FRED spot (lagged)
    prices = await fetch_oil_prices(days=14)
    fred_brent = None
    fred_brent_date = None
    wti_val = None
    wti_date = None
    fred_stale = False

    if prices:
        latest = prices[-1]
        fred_brent = latest.get("brent")
        fred_brent_date = latest.get("date")
        wti_val = latest.get("wti")
        wti_date = latest.get("date")

        if fred_brent_date:
            try:
                dt = datetime.strptime(fred_brent_date, "%Y-%m-%d")
                if (datetime.utcnow() - dt).days > 3:
                    fred_stale = True
            except Exception:
                pass

    return {
        # FRED spot
        "brent": fred_brent,
        "brent_date": fred_brent_date,
        "is_stale": fred_stale,
        # ICE futures
        "brent_futures": futures_price,
        "brent_futures_date": futures_date,
        # WTI
        "wti": wti_val,
        "wti_date": wti_date,
    }


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
