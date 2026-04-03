"""IMF PortWatch client — aggregate Hormuz chokepoint transit data.

Source: portwatch.imf.org — satellite AIS-based transit counts and capacity.
Uses the Daily_Chokepoints_Data ArcGIS FeatureServer.
"""
from __future__ import annotations

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

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(_CHOKEPOINT_URL, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        logger.error("IMF PortWatch Hormuz fetch failed: %s", e)
        return []

    if "error" in payload:
        logger.error("IMF PortWatch API error: %s", payload["error"])
        return []

    features = payload.get("features", [])
    result = []
    for feat in features:
        attrs = feat.get("attributes", {})
        try:
            date_ms = attrs.get("date")
            if date_ms:
                date_str = datetime.fromtimestamp(
                    date_ms / 1000, tz=timezone.utc
                ).strftime("%Y-%m-%d")
            else:
                continue

            result.append({
                "date": date_str,
                "total_transits": attrs.get("n_total", 0),
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
