"""Global chokepoint comparison — IMF PortWatch ArcGIS FeatureServer.

Fetches multiple chokepoints concurrently to give systemic context
(is Hormuz an isolated shock or a global shipping disruption?).
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

_CHOKEPOINT_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services"
    "/Daily_Chokepoints_Data/FeatureServer/0/query"
)

# Known static portids for Hormuz and Suez
_KNOWN_CHOKEPOINTS: Dict[str, str] = {
    "chokepoint6": "Strait of Hormuz",
    "chokepoint1": "Suez Canal",
}

# Keywords to discover Bab-el-Mandeb and Malacca from the distinct portid list
_DISCOVER_KEYWORDS: Dict[str, str] = {
    "bab": "Bab-el-Mandeb",
    "mandeb": "Bab-el-Mandeb",
    "malacca": "Strait of Malacca",
}

_cache: Dict[str, Tuple] = {}
_CACHE_TTL = 3600


def _parse_date(date_val: object) -> Optional[str]:
    """Parse ArcGIS date — epoch-ms int or ISO string. Return YYYY-MM-DD or None."""
    if date_val in (None, ""):
        return None
    try:
        if isinstance(date_val, (int, float)):
            return datetime.fromtimestamp(date_val / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        return str(date_val)[:10]
    except Exception:
        return None


async def _discover_extra_chokepoints() -> Dict[str, str]:
    """Query distinct portid/portname values and pick Bab-el-Mandeb + Malacca."""
    cache_key = "chokepoints:discover"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL * 24:  # discover less often
            return data

    params = {
        "where": "1=1",
        "outFields": "portid,portname",
        "returnDistinctValues": "true",
        "resultRecordCount": 200,
        "f": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(_CHOKEPOINT_URL, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:
        logger.warning("Chokepoint discovery failed: %s", exc)
        return {}

    if "error" in payload:
        logger.warning("Chokepoint discovery ArcGIS error: %s", payload["error"])
        return {}

    discovered: Dict[str, str] = {}
    seen_names: set = set()  # avoid double-matching bab/mandeb to same portid
    for feat in payload.get("features", []):
        attrs = feat.get("attributes", {})
        portid = attrs.get("portid") or ""
        portname = (attrs.get("portname") or "").lower()
        if not portid:
            continue
        # Skip already-known
        if portid in _KNOWN_CHOKEPOINTS:
            continue
        for keyword, friendly_name in _DISCOVER_KEYWORDS.items():
            if keyword in portname and friendly_name not in seen_names:
                discovered[portid] = friendly_name
                seen_names.add(friendly_name)
                break

    _cache[cache_key] = (discovered, time.time())
    return discovered


async def _fetch_one_chokepoint(
    portid: str,
    name: str,
    rows: int = 35,
) -> Dict:
    """Fetch recent rows for one chokepoint. Never raises — returns partial on failure."""
    cache_key = f"chokepoints:single:{portid}:{rows}"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    params = {
        "where": f"portid='{portid}'",
        "outFields": "date,n_total,n_tanker,capacity_tanker",
        "orderByFields": "date DESC",
        "resultRecordCount": rows,
        "f": "json",
    }

    payload = None
    last_err: Optional[Exception] = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(_CHOKEPOINT_URL, params=params)
                resp.raise_for_status()
                payload = resp.json()
            if "error" in payload:
                last_err = Exception(str(payload["error"]))
                payload = None
            else:
                break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
        if attempt < 2:
            await asyncio.sleep(1.5 * (attempt + 1))

    if payload is None:
        stale = _cache.get(cache_key)
        if stale and stale[0]:
            logger.warning("Stale data for %s (%s)", name, last_err)
            return stale[0]
        logger.error("No data for chokepoint %s/%s: %s", portid, name, last_err)
        return _empty_result(portid, name)

    rows_data: List[Dict] = []
    for feat in payload.get("features", []):
        attrs = feat.get("attributes", {})
        date_str = _parse_date(attrs.get("date"))
        if not date_str:
            continue
        n_total = attrs.get("n_total")
        n_tanker = attrs.get("n_tanker")
        rows_data.append({
            "date": date_str,
            "n_total": n_total,
            "n_tanker": n_tanker,
        })

    # rows are DESC; latest is first
    latest = rows_data[0] if rows_data else {}
    latest_total = latest.get("n_total")
    latest_tanker = latest.get("n_tanker")
    latest_date = latest.get("date")

    # 30-day trailing baseline from rows 1..30 (exclude the very latest to avoid
    # partial-day noise), fallback to all rows if fewer than 2
    baseline_rows = rows_data[1:31] if len(rows_data) > 1 else rows_data
    valid_totals = [r["n_total"] for r in baseline_rows if r.get("n_total") is not None]
    baseline_total_30d: Optional[float] = (
        sum(valid_totals) / len(valid_totals) if valid_totals else None
    )

    pct_of_baseline: Optional[float] = None
    if baseline_total_30d and baseline_total_30d > 0 and latest_total is not None:
        pct_of_baseline = round(latest_total / baseline_total_30d * 100, 1)

    result = {
        "id": portid,
        "name": name,
        "date": latest_date,
        "latest_total": latest_total,
        "latest_tanker": latest_tanker,
        "baseline_total_30d": round(baseline_total_30d, 2) if baseline_total_30d is not None else None,
        "pct_of_baseline": pct_of_baseline,
    }
    _cache[cache_key] = (result, time.time())
    return result


def _empty_result(portid: str, name: str) -> Dict:
    return {
        "id": portid,
        "name": name,
        "date": None,
        "latest_total": None,
        "latest_tanker": None,
        "baseline_total_30d": None,
        "pct_of_baseline": None,
    }


async def get_chokepoint_comparison() -> Dict:
    """Return transit metrics for multiple global chokepoints concurrently."""
    # Step 1: discover Bab-el-Mandeb / Malacca portids
    extra = await _discover_extra_chokepoints()

    all_chokepoints = {**_KNOWN_CHOKEPOINTS, **extra}

    # Step 2: fetch all concurrently
    tasks = [
        _fetch_one_chokepoint(portid, name)
        for portid, name in all_chokepoints.items()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    chokepoint_list: List[Dict] = []
    for res in results:
        if isinstance(res, Exception):
            logger.error("Chokepoint fetch exception: %s", res)
        elif isinstance(res, dict):
            chokepoint_list.append(res)

    return {
        "chokepoints": chokepoint_list,
        "source": "IMF PortWatch",
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
