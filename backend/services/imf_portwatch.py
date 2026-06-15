"""IMF PortWatch client — aggregate Hormuz chokepoint transit data.

Source: portwatch.imf.org — satellite AIS-based transit counts and capacity.
Uses the Daily_Chokepoints_Data ArcGIS FeatureServer.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List

import httpx

logger = logging.getLogger(__name__)

_CHOKEPOINT_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services"
    "/Daily_Chokepoints_Data/FeatureServer/0/query"
)
_HORMUZ_ID = "chokepoint6"  # Strait of Hormuz

_cache: Dict[str, tuple] = {}
_CACHE_TTL = 3600


async def fetch_hormuz_transits(days: int = 90) -> List[Dict]:
    """Fetch Hormuz chokepoint transit data from IMF PortWatch."""
    cache_key = f"imf_hormuz:{days}"
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if time.time() - ts < _CACHE_TTL:
            return data

    params = {
        "where": f"portid='{_HORMUZ_ID}'",
        "outFields": "*",
        "orderByFields": "date DESC",
        "resultRecordCount": days,
        "f": "json",
    }

    # Retry a couple of times — the ArcGIS endpoint is occasionally slow, and a
    # transient failure must NOT blank the dashboard. On total failure we fall
    # back to the last good cached result (even if the TTL has expired).
    payload = None
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(_CHOKEPOINT_URL, params=params)
                resp.raise_for_status()
                payload = resp.json()
            if "error" in payload:
                last_err = Exception(payload["error"])
                payload = None
            else:
                break
        except Exception as e:  # noqa: BLE001
            last_err = e
        if attempt < 2:
            await asyncio.sleep(1.5 * (attempt + 1))

    if payload is None:
        stale = _cache.get(cache_key)
        if stale and stale[0]:
            logger.warning("IMF PortWatch fetch failed (%s); serving stale cached data.", last_err)
            return stale[0]
        logger.error("IMF PortWatch Hormuz fetch failed with no cache: %s", last_err)
        return []

    features = payload.get("features", [])
    result = []
    for feat in features:
        attrs = feat.get("attributes", {})
        try:
            # ArcGIS may return `date` as epoch-ms (int) or an ISO string
            # ("2026-06-07") depending on the service's date-format setting.
            date_val = attrs.get("date")
            if date_val in (None, ""):
                continue
            if isinstance(date_val, (int, float)):
                date_str = datetime.fromtimestamp(
                    date_val / 1000, tz=timezone.utc
                ).strftime("%Y-%m-%d")
            else:
                date_str = str(date_val)[:10]

            n_total = attrs.get("n_total", 0)
            if n_total > 50: # Outlier filtering for Feb 28 spike
                continue

            result.append({
                "date": date_str,
                "total_transits": n_total,
                "tanker_transits": attrs.get("n_tanker", 0),
                "bulk_transits": attrs.get("n_dry_bulk", 0),
                "container_transits": attrs.get("n_container", 0),
                "capacity_total": attrs.get("capacity", 0),
                "capacity_tanker": attrs.get("capacity_tanker", 0),
            })
        except Exception:
            continue

    result.sort(key=lambda x: x["date"])
    _cache[cache_key] = (result, time.time())
    return result


async def fetch_hormuz_summary() -> Dict:
    """Get latest Hormuz transit summary for the dashboard."""
    transits = await fetch_hormuz_transits(days=30)
    if not transits:
        return {
            "source": "IMF PortWatch",
            "status": "unavailable",
            "note": "Data may take a moment to load from IMF servers",
        }

    latest = transits[-1] if transits else {}
    avg_daily = sum(t.get("total_transits", 0) for t in transits) / max(len(transits), 1)
    avg_tanker = sum(t.get("tanker_transits", 0) for t in transits) / max(len(transits), 1)

    return {
        "source": "IMF PortWatch (satellite AIS)",
        "latest_date": latest.get("date"),
        "latest_total_transits": latest.get("total_transits", 0),
        "latest_tanker_transits": latest.get("tanker_transits", 0),
        "avg_daily_transits": round(avg_daily, 1),
        "avg_daily_tankers": round(avg_tanker, 1),
        "total_capacity_30d": sum(t.get("capacity_total", 0) for t in transits),
        "days_covered": len(transits),
    }
