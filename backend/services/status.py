"""Strait Status Service — calculate composite health score."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict

from sqlalchemy import select, func
from ..database import SessionLocal
from ..models import DarkVessel, STSEvent, MarketData, VesselTransit, DisruptionEvent
from .eia import fetch_hormuz_flow

logger = logging.getLogger(__name__)

async def get_strait_status() -> Dict:
    """
    Calculate composite health score (0-100).
    Weights: 
    - Flow deviation: 40%
    - Dark vessels: 20%
    - STS events: 10%
    - EFS deviation: 20%
    - Disruptions: 10%
    """
    with SessionLocal() as db:
        try:
            score = 100.0
            reasons = []

            # 1. Flow Deviation (40%)
            # Baseline: ~20 mbpd
            baseline_data = await fetch_hormuz_flow()
            baseline = baseline_data["baseline_mbpd"]
            
            # Current 24h flow — deduplicate by MMSI (take latest observation per vessel)
            cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)
            from sqlalchemy.orm import aliased
            latest_subq = (
                select(
                    VesselTransit.mmsi,
                    func.max(VesselTransit.observed_at).label("latest_time")
                )
                .where(VesselTransit.observed_at >= cutoff_24h)
                .where(VesselTransit.direction == "outbound")
                .where(VesselTransit.is_loaded == True)
                .group_by(VesselTransit.mmsi)
                .subquery()
            )
            obs_barrels = db.execute(
                select(func.coalesce(func.sum(VesselTransit.estimated_barrels), 0))
                .join(
                    latest_subq,
                    (VesselTransit.mmsi == latest_subq.c.mmsi) &
                    (VesselTransit.observed_at == latest_subq.c.latest_time)
                )
            ).scalar() or 0.0
            current_flow = obs_barrels / 1_000_000
            
            flow_pct = (current_flow / baseline) if baseline > 0 else 1.0
            if flow_pct < 0.90:
                deduction = min(40, (0.90 - flow_pct) * 200) # 10% drop = 20 points
                score -= deduction
                reasons.append(f"Flow at {round(flow_pct*100)}% of baseline")

            # 2. Dark Vessels (20%)
            dark_count = db.query(func.count(DarkVessel.id)).filter(DarkVessel.is_active == True).scalar() or 0
            if dark_count > 0:
                deduction = min(20, dark_count * 5) # 5 points per dark vessel
                score -= deduction
                reasons.append(f"{dark_count} dark vessels detected")

            # 3. STS Events (10%)
            sts_count = db.query(func.count(STSEvent.id)).filter(STSEvent.is_active == True).scalar() or 0
            if sts_count > 0:
                deduction = min(10, sts_count * 5)
                score -= deduction
                reasons.append(f"{sts_count} active STS transfers")

            # 4. EFS Deviation (20%)
            # Compare current EFS vs 30-day mean
            latest_market = db.query(MarketData).order_by(MarketData.date.desc()).first()
            if latest_market:
                avg_efs = db.execute(
                    select(func.avg(MarketData.brent_dubai_efs))
                    .where(MarketData.date >= (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d"))
                ).scalar() or latest_market.brent_dubai_efs
                
                deviation = abs(latest_market.brent_dubai_efs - avg_efs)
                if deviation > 1.0: # $1.00 deviation is significant
                    deduction = min(20, (deviation - 1.0) * 10)
                    score -= deduction
                    reasons.append("EFS spread widening")

            # 5. Disruptions (10%)
            # Recent (last 7 days) disruptions
            recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
            disruptions = db.query(DisruptionEvent).filter(DisruptionEvent.date >= recent_cutoff).all()
            if disruptions:
                max_severity = 0
                for d in disruptions:
                    val = 10 if d.severity == "critical" else 5 if d.severity == "high" else 2
                    max_severity = max(max_severity, val)
                score -= max_severity
                reasons.append("Recent geopolitical disruption")

            score = max(0, min(100, score))
            
            level = "green"
            if score < 60: level = "red"
            elif score < 85: level = "amber"

            summary = "Strait operating normally" if not reasons else " — ".join(reasons)

            return {
                "level": level,
                "score": round(score),
                "summary": summary,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"Error calculating strait status: {e}")
            return {"level": "green", "score": 100, "summary": "Status monitoring active"}
