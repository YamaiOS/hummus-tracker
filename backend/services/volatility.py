"""FRED API client — fetch CBOE Crude Oil Volatility Index (OVX)."""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_API_KEY = os.getenv("FRED_API_KEY", "")
_BASE = "https://api.stlouisfed.org/fred/series/observations"

OVX_SERIES = "OVXCLS"  # CBOE Crude Oil Volatility Index (daily close)

_cache: Dict[str, tuple] = {}  # cache_key -> (data, fetched_at)
_CACHE_TTL = 3600  # 1 hour

_FETCH_DAYS = 400   # enough to compute 252-day mean/std plus buffer
_HISTORY_DAYS = 180  # sparkline history


async def get_oil_volatility() -> dict:
    """Return OVX crude oil volatility regime data from FRED.

    Returns a dict with:
      - ovx: latest OVX value (float|None)
      - ovx_date: date of latest value (str|None)
      - mean_252: 252-day rolling mean (float|None)
      - zscore: (latest - mean_252) / std_252 (float|None)
      - regime: "low" | "elevated" | "high" | "unknown"
      - history: last 180 days of [{date, ovx}] for sparkline
      - source: attribution string
      - updated_at: ISO timestamp of this fetch
    """
    if not _API_KEY:
        logger.warning("FRED_API_KEY not set — returning empty volatility data")
        return _empty_response()

    start = (datetime.now() - timedelta(days=_FETCH_DAYS + 30)).strftime("%Y-%m-%d")
    raw = await _fetch_series(OVX_SERIES, start)

    if not raw:
        return _empty_response()

    values = [r["value"] for r in raw]
    dates = [r["date"] for r in raw]

    latest_val: Optional[float] = values[-1] if values else None
    latest_date: Optional[str] = dates[-1] if dates else None

    # 252-day window (trading days)
    window = values[-252:] if len(values) >= 252 else values
    mean_252: Optional[float] = None
    std_252: Optional[float] = None
    zscore: Optional[float] = None
    regime = "unknown"

    if len(window) >= 2:
        mean_252 = sum(window) / len(window)
        variance = sum((x - mean_252) ** 2 for x in window) / len(window)
        std_252 = variance ** 0.5

    if mean_252 is not None and std_252 is not None and std_252 > 0 and latest_val is not None:
        zscore = (latest_val - mean_252) / std_252
        if zscore < 0.5:
            regime = "low"
        elif zscore < 1.5:
            regime = "elevated"
        else:
            regime = "high"
    elif latest_val is not None and mean_252 is not None:
        # std is 0 — constant series edge case; treat as low
        regime = "low"
        zscore = 0.0

    # Sparkline history: last 180 calendar-day entries (already sorted asc)
    history = [{"date": r["date"], "ovx": r["value"]} for r in raw[-_HISTORY_DAYS:]]

    return {
        "ovx": round(latest_val, 4) if latest_val is not None else None,
        "ovx_date": latest_date,
        "mean_252": round(mean_252, 4) if mean_252 is not None else None,
        "zscore": round(zscore, 4) if zscore is not None else None,
        "regime": regime,
        "history": history,
        "source": "FRED OVXCLS (CBOE Crude Oil Volatility)",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


def _empty_response() -> dict:
    return {
        "ovx": None,
        "ovx_date": None,
        "mean_252": None,
        "zscore": None,
        "regime": "unknown",
        "history": [],
        "source": "FRED OVXCLS (CBOE Crude Oil Volatility)",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


async def _fetch_series(series_id: str, start_date: str) -> List[Dict]:
    """Fetch a FRED time series with 1h cache; returns [] on failure (never throws)."""
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
        # Serve stale cache if available
        if cache_key in _cache:
            data, _ = _cache[cache_key]
            logger.warning("Serving stale cache for %s", series_id)
            return data
        return []

    observations = payload.get("observations", [])
    result = []
    for obs in observations:
        val = obs.get("value", ".")
        if val == ".":
            continue
        try:
            result.append({"date": obs["date"], "value": float(val)})
        except (ValueError, KeyError):
            continue

    _cache[cache_key] = (result, time.time())
    return result
