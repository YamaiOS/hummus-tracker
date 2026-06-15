"""FRED API client — fetch global gas/LNG prices (JKM, TTF/EU, Henry Hub)."""
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

# FRED monthly gas price series (USD/MMBtu)
JKM_SERIES = "PNGASJPUSDM"    # Asia LNG (JKM proxy)
EU_SERIES = "PNGASEUUSDM"     # EU gas (TTF proxy)
HH_SERIES = "PNGASUSUSDM"     # Henry Hub (US)

_cache: Dict[str, tuple] = {}  # cache_key -> (data, fetched_at)
_CACHE_TTL = 3600  # 1 hour


async def get_gas_prices(months: int = 24) -> dict:
    """Return global gas/LNG price picture from FRED monthly series.

    Returns a dict with:
      - series: list of {date, jkm, eu_gas, henry_hub} aligned by month, last `months`
      - latest: most recent {jkm, eu_gas, henry_hub, jkm_hh_spread, date}
      - source: attribution string
      - updated_at: ISO timestamp of this fetch
    """
    if not _API_KEY:
        logger.warning("FRED_API_KEY not set — returning empty gas prices")
        return _empty_response()

    # Fetch a bit more than needed to ensure we have `months` of aligned data
    start = (datetime.now() - timedelta(days=months * 31 + 62)).strftime("%Y-%m-%d")

    jkm_raw, eu_raw, hh_raw = await _fetch_all_series(start)

    jkm_map = {r["date"]: r["value"] for r in jkm_raw}
    eu_map = {r["date"]: r["value"] for r in eu_raw}
    hh_map = {r["date"]: r["value"] for r in hh_raw}

    all_dates = sorted(set(jkm_map) | set(eu_map) | set(hh_map))

    series: List[Dict] = []
    for d in all_dates:
        j = jkm_map.get(d)
        e = eu_map.get(d)
        h = hh_map.get(d)
        if j is not None or e is not None or h is not None:
            series.append({"date": d, "jkm": j, "eu_gas": e, "henry_hub": h})

    # Trim to last `months` entries
    series = series[-months:] if len(series) > months else series

    # Build latest
    latest_jkm: Optional[float] = None
    latest_eu: Optional[float] = None
    latest_hh: Optional[float] = None
    latest_date: Optional[str] = None

    # Walk backwards through series to pick most recent non-None for each
    for row in reversed(series):
        if latest_jkm is None and row["jkm"] is not None:
            latest_jkm = row["jkm"]
        if latest_eu is None and row["eu_gas"] is not None:
            latest_eu = row["eu_gas"]
        if latest_hh is None and row["henry_hub"] is not None:
            latest_hh = row["henry_hub"]
        if latest_date is None and any(v is not None for v in (row["jkm"], row["eu_gas"], row["henry_hub"])):
            latest_date = row["date"]
        if latest_jkm is not None and latest_eu is not None and latest_hh is not None:
            break

    spread: Optional[float] = None
    if latest_jkm is not None and latest_hh is not None:
        spread = round(latest_jkm - latest_hh, 4)

    return {
        "series": series,
        "latest": {
            "jkm": latest_jkm,
            "eu_gas": latest_eu,
            "henry_hub": latest_hh,
            "jkm_hh_spread": spread,
            "date": latest_date,
        },
        "source": "FRED / IMF Primary Commodity Prices (monthly, lags spot)",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


def _empty_response() -> dict:
    return {
        "series": [],
        "latest": {
            "jkm": None,
            "eu_gas": None,
            "henry_hub": None,
            "jkm_hh_spread": None,
            "date": None,
        },
        "source": "FRED / IMF Primary Commodity Prices (monthly, lags spot)",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


async def _fetch_all_series(start_date: str):
    """Concurrently fetch all three gas series."""
    import asyncio
    results = await asyncio.gather(
        _fetch_series(JKM_SERIES, start_date),
        _fetch_series(EU_SERIES, start_date),
        _fetch_series(HH_SERIES, start_date),
        return_exceptions=True,
    )
    out = []
    for r in results:
        if isinstance(r, Exception):
            logger.error("Gas series fetch failed: %s", r)
            out.append([])
        else:
            out.append(r)
    return out[0], out[1], out[2]


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
