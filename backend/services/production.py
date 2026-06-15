"""OPEC/Gulf crude production from EIA International API v2.

Fetches total petroleum & other liquids production (activityId=1, productId=53)
for SAU, IRN, IRQ, ARE, KWT, QAT and the OPEC region aggregate.
Caches 6 hours. Fully defensive — never raises; returns empty producers list on failure.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

_API_KEY = os.getenv("EIA_API_KEY", "")
_BASE = "https://api.eia.gov/v2"

_cache: Dict[str, tuple] = {}
_CACHE_TTL = 21600  # 6 hours

_COUNTRY_CODES = ["SAU", "IRN", "IRQ", "ARE", "KWT", "QAT", "OPEC"]

_CODE_TO_NAME: Dict[str, str] = {
    "SAU": "Saudi Arabia",
    "IRN": "Iran",
    "IRQ": "Iraq",
    "ARE": "UAE",
    "KWT": "Kuwait",
    "QAT": "Qatar",
    "OPEC": "OPEC total",
}

_OPEC_IS_AGGREGATE = {"OPEC"}


def _build_params(api_key: str) -> list[tuple[str, str]]:
    """Build query params as list of tuples to allow repeated keys."""
    params: list[tuple[str, str]] = [
        ("api_key", api_key),
        ("frequency", "monthly"),
        ("facets[activityId][]", "1"),    # Production
        ("facets[productId][]", "53"),    # Total petroleum & other liquids
        ("data[0]", "value"),
        ("sort[0][column]", "period"),
        ("sort[0][direction]", "desc"),
        ("length", "200"),               # generous window to ensure all countries appear
    ]
    for code in _COUNTRY_CODES:
        params.append(("facets[countryRegionId][]", code))
    return params


def _pick_latest(rows: list[dict]) -> dict[str, dict]:
    """Return the most recent non-null row per countryRegionId."""
    latest: dict[str, dict] = {}
    for row in rows:
        code = row.get("countryRegionId", "")
        if code not in _CODE_TO_NAME:
            continue
        val = row.get("value")
        if val is None:
            continue
        try:
            float(val)
        except (TypeError, ValueError):
            continue
        # rows are sorted desc by period; first occurrence per code is the latest
        if code not in latest:
            latest[code] = row
    return latest


async def get_producer_output() -> dict:
    """Fetch OPEC/Gulf producer output from EIA International API v2.

    Returns a dict with 'producers' list ordered by mbpd descending,
    'opec_total_mbpd', 'source', and 'updated_at'. Defensive — never raises.
    """
    cache_key = "production:opec_gulf"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    updated_at = datetime.now(timezone.utc).isoformat()
    _empty = {
        "producers": [],
        "opec_total_mbpd": None,
        "source": "EIA International (production, total petroleum & other liquids)",
        "updated_at": updated_at,
    }

    if not _API_KEY:
        logger.warning("EIA_API_KEY not set — skipping production fetch")
        return _empty

    url = f"{_BASE}/international/data/"
    params = _build_params(_API_KEY)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:
        logger.error("EIA production fetch failed: %s", exc)
        # serve stale if available
        stale = _cache.get(cache_key)
        if stale and stale[0].get("producers"):
            logger.warning("Serving stale production cache after failure.")
            return stale[0]
        return _empty

    rows = payload.get("response", {}).get("data", [])
    latest = _pick_latest(rows)

    producers: List[Dict] = []
    opec_total: Optional[float] = None

    for code, row in latest.items():
        try:
            mbpd = round(float(row["value"]) / 1000, 3)
        except (TypeError, ValueError, KeyError):
            continue

        name = _CODE_TO_NAME.get(code, code)
        period = row.get("period", "")
        is_aggregate = code in _OPEC_IS_AGGREGATE

        entry: Dict = {
            "country": name,
            "code": code,
            "mbpd": mbpd,
            "period": period,
            "is_aggregate": is_aggregate,
        }
        producers.append(entry)

        if code == "OPEC":
            opec_total = mbpd

    # Sort by mbpd desc (put OPEC aggregate last regardless of value)
    producers.sort(key=lambda x: (x["is_aggregate"], -x["mbpd"]))

    result = {
        "producers": producers,
        "opec_total_mbpd": opec_total,
        "source": "EIA International (production, total petroleum & other liquids)",
        "updated_at": updated_at,
    }

    _cache[cache_key] = (result, time.time())
    return result
