"""EIA API client — Strait of Hormuz oil flow data and petroleum stats."""
from __future__ import annotations

import logging
import os
import time
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_API_KEY = os.getenv("EIA_API_KEY", "")
_BASE = "https://api.eia.gov/v2"

_cache: Dict[str, tuple] = {}
_CACHE_TTL = 7200  # 2 hours


async def fetch_hormuz_flow() -> Dict:
    """Fetch Hormuz oil flow baseline data from EIA.

    Returns summary with baseline mbpd and historical context.
    EIA reports ~20 mbpd through Hormuz (2024 estimate).
    """
    # EIA doesn't have a direct Hormuz API endpoint, but we can pull
    # international petroleum data for context
    return {
        "baseline_mbpd": 20.0,
        "baseline_year": 2024,
        "pct_of_global_seaborne": 0.21,
        "pct_of_global_supply": 0.20,
        "key_exporters": [
            {"country": "Saudi Arabia", "mbpd": 6.2},
            {"country": "Iraq", "mbpd": 3.3},
            {"country": "UAE", "mbpd": 2.9},
            {"country": "Kuwait", "mbpd": 1.7},
            {"country": "Iran", "mbpd": 1.5},
            {"country": "Qatar (LNG)", "mbpd": 4.4},
        ],
        "source": "EIA World Oil Transit Chokepoints (2024)",
    }


async def fetch_petroleum_prices(days: int = 90) -> List[Dict]:
    """Fetch petroleum spot prices from EIA API v2."""
    if not _API_KEY:
        logger.warning("EIA_API_KEY not set")
        return []

    cache_key = f"eia_prices:{days}"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    # EIA API v2: Petroleum prices, spot prices
    url = f"{_BASE}/petroleum/pri/spt/data/"
    params = {
        "api_key": _API_KEY,
        "frequency": "daily",
        "data[0]": "value",
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "length": days,
        "facets[series][]": "RBRTE",  # Europe Brent Spot Price FOB
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        logger.error("EIA petroleum prices failed: %s", e)
        return []

    data = payload.get("response", {}).get("data", [])
    result = []
    for row in data:
        try:
            result.append({
                "date": row["period"],
                "brent_eia": float(row["value"]),
                "series": row.get("series-description", ""),
            })
        except (ValueError, KeyError):
            continue

    _cache[cache_key] = (result, time.time())
    return result


async def fetch_crude_production() -> List[Dict]:
    """Fetch global crude oil production data from EIA."""
    if not _API_KEY:
        return []

    cache_key = "eia_production"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    url = f"{_BASE}/international/data/"
    params = {
        "api_key": _API_KEY,
        "frequency": "monthly",
        "data[0]": "value",
        "facets[productId][]": "57",  # Crude oil + condensate
        "facets[activityId][]": "1",   # Production
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": 24,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        logger.error("EIA crude production failed: %s", e)
        return []

    data = payload.get("response", {}).get("data", [])
    result = []
    for row in data:
        try:
            result.append({
                "period": row["period"],
                "country": row.get("countryRegionName", ""),
                "value_mbpd": float(row["value"]) / 1000,  # convert to mbpd
            })
        except (ValueError, KeyError):
            continue

    _cache[cache_key] = (result, time.time())
    return result
