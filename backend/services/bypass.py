"""Hormuz bypass capacity model — static supply-gap analysis.

Sources: EIA World Oil Transit Chokepoints / CNBC reporting.
No API calls; pure computation. Safe to call synchronously or as async.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List


def get_bypass_capacity() -> Dict:
    """Return static bypass-pipeline capacity model for Strait of Hormuz."""

    hormuz_throughput_mbpd: float = 20.9

    routes: List[Dict] = [
        {
            "name": "East-West Petroline (Petroline)",
            "operator": "Saudi Aramco",
            "capacity_mbpd": 7.0,
            "in_use_mbpd": 2.0,
        },
        {
            "name": "Habshan-Fujairah Pipeline",
            "operator": "UAE ADNOC",
            "capacity_mbpd": 1.8,
            "in_use_mbpd": 1.1,
        },
        {
            "name": "Goreh-Jask Pipeline",
            "operator": "Iran NIOC",
            "capacity_mbpd": 0.35,
            "in_use_mbpd": 0.1,
        },
    ]

    for route in routes:
        route["spare_mbpd"] = round(
            max(0.0, route["capacity_mbpd"] - route["in_use_mbpd"]), 4
        )

    total_bypass_capacity: float = round(sum(r["capacity_mbpd"] for r in routes), 4)
    total_spare: float = round(sum(r["spare_mbpd"] for r in routes), 4)
    at_risk_mbpd: float = round(max(0.0, hormuz_throughput_mbpd - total_spare), 4)
    bypass_coverage_pct: float = round(total_spare / hormuz_throughput_mbpd * 100, 2)

    return {
        "hormuz_throughput_mbpd": hormuz_throughput_mbpd,
        "routes": routes,
        "total_bypass_capacity_mbpd": total_bypass_capacity,
        "total_spare_mbpd": total_spare,
        "at_risk_mbpd": at_risk_mbpd,
        "bypass_coverage_pct": bypass_coverage_pct,
        "note": "UAE plans to expand Fujairah to ~3.3 mbpd by 2027",
        "source": "EIA World Oil Transit Chokepoints / CNBC",
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
