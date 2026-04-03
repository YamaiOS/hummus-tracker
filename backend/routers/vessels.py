"""Vessel tracking API — live positions and transit history."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import VesselTransit
from ..services.ais_stream import get_live_vessels, get_stream_status

router = APIRouter(prefix="/vessels", tags=["vessels"])


@router.get("/live")
def get_live():
    """Real-time vessel positions in the Hormuz strait."""
    vessels = get_live_vessels()
    tankers = [v for v in vessels if v.get("vessel_type", 0) in range(70, 90)]
    return {
        "vessels": vessels,
        "tanker_count": len(tankers),
        "total_count": len(vessels),
        "loaded_count": sum(1 for v in tankers if v.get("is_loaded")),
        "ballast_count": sum(1 for v in tankers if not v.get("is_loaded")),
        "stream_status": get_stream_status(),
    }


@router.get("/history")
def get_transit_history(
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
):
    """Recent transit observations."""
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    transits = (
        db.query(VesselTransit)
        .filter(VesselTransit.observed_at >= cutoff)
        .order_by(VesselTransit.observed_at.desc())
        .limit(500)
        .all()
    )

    # Deduplicate by MMSI (keep latest)
    seen = {}
    for t in transits:
        if t.mmsi not in seen:
            seen[t.mmsi] = {
                "mmsi": t.mmsi,
                "imo": t.imo,
                "name": t.vessel_name,
                "vessel_class": t.vessel_class,
                "lat": t.latitude,
                "lon": t.longitude,
                "speed": t.speed,
                "course": t.course,
                "draught": t.draught,
                "destination": t.destination,
                "direction": t.direction,
                "is_loaded": t.is_loaded,
                "estimated_barrels": t.estimated_barrels,
                "observed_at": t.observed_at.isoformat() if t.observed_at else None,
            }

    return {
        "vessels": list(seen.values()),
        "unique_vessels": len(seen),
        "period_hours": hours,
    }


@router.get("/stats")
def get_vessel_stats(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """Aggregate vessel statistics."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    total = db.query(func.count(func.distinct(VesselTransit.mmsi))).filter(
        VesselTransit.observed_at >= cutoff
    ).scalar() or 0

    by_class = (
        db.query(VesselTransit.vessel_class, func.count(func.distinct(VesselTransit.mmsi)))
        .filter(VesselTransit.observed_at >= cutoff)
        .group_by(VesselTransit.vessel_class)
        .all()
    )

    by_direction = (
        db.query(VesselTransit.direction, func.count(func.distinct(VesselTransit.mmsi)))
        .filter(VesselTransit.observed_at >= cutoff)
        .group_by(VesselTransit.direction)
        .all()
    )

    return {
        "period_days": days,
        "unique_vessels": total,
        "by_class": {cls or "Unknown": count for cls, count in by_class},
        "by_direction": {d or "Unknown": count for d, count in by_direction},
    }
