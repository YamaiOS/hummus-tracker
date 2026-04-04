"""Dark Vessel Detection Service — track tankers that disappear from AIS."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from ..database import SessionLocal
from ..models import VesselTransit, DarkVessel, HORMUZ_BBOX
from .activity import log_activity
from .alerts import send_alert

logger = logging.getLogger(__name__)

EXIT_MARGIN = 0.1  # degrees from bbox edge


async def detect_dark_vessels():
    """Identify vessels last seen in the bbox with no AIS updates for > 1 minute."""
    with SessionLocal() as db:
        try:
            now = datetime.utcnow()
            one_minute_ago = now - timedelta(minutes=1)

            # Re-check existing dark vessels: have they reappeared?
            active_dark = db.query(DarkVessel).filter(DarkVessel.is_active == True).all()
            for dv in active_dark:
                reappeared = db.execute(
                    select(VesselTransit)
                    .where(VesselTransit.mmsi == dv.mmsi)
                    .where(VesselTransit.observed_at > dv.last_observed_at)
                ).scalars().first()

                if reappeared:
                    dv.is_active = False
                    dv.resolved_at = reappeared.observed_at
                    log_activity(
                        event_type="dark_vessel_resolved",
                        message=f"Vessel {dv.vessel_name or dv.mmsi} reappeared on AIS",
                        severity="info",
                        metadata={"mmsi": dv.mmsi}
                    )
                    logger.info("Vessel %s reappeared. Resolved.", dv.mmsi)

            # Find new candidates: last seen 1-10 minutes ago
            ten_minutes_ago = now - timedelta(minutes=10)

            subq = (
                select(VesselTransit.mmsi, func.max(VesselTransit.observed_at).label("max_ts"))
                .where(VesselTransit.observed_at >= ten_minutes_ago)
                .group_by(VesselTransit.mmsi)
                .subquery()
            )

            latest_transits = db.execute(
                select(VesselTransit)
                .join(subq, (VesselTransit.mmsi == subq.c.mmsi) & (VesselTransit.observed_at == subq.c.max_ts))
            ).scalars().all()

            for t in latest_transits:
                if not (t.vessel_type and t.vessel_type in range(70, 90)):
                    continue

                if t.observed_at < one_minute_ago:
                    # Check if near bbox boundary (likely just exited normally)
                    near_edge = (
                        abs(t.longitude - HORMUZ_BBOX["lon_min"]) < EXIT_MARGIN or
                        abs(t.longitude - HORMUZ_BBOX["lon_max"]) < EXIT_MARGIN or
                        abs(t.latitude - HORMUZ_BBOX["lat_max"]) < EXIT_MARGIN or
                        abs(t.latitude - HORMUZ_BBOX["lat_min"]) < EXIT_MARGIN
                    )

                    if not near_edge:
                        exists = db.query(DarkVessel).filter(
                            DarkVessel.mmsi == t.mmsi,
                            DarkVessel.is_active == True,
                        ).first()
                        if not exists:
                            db.add(DarkVessel(
                                mmsi=t.mmsi,
                                vessel_name=t.vessel_name,
                                vessel_class=t.vessel_class,
                                last_lat=t.latitude,
                                last_lon=t.longitude,
                                last_speed=t.speed,
                                last_course=t.course,
                                is_loaded=t.is_loaded,
                                last_observed_at=t.observed_at,
                                is_active=True,
                            ))
                            log_activity(
                                event_type="dark_vessel_detected",
                                message=f"ALERT: Vessel {t.vessel_name or t.mmsi} gone dark mid-transit",
                                severity="warning",
                                metadata={"mmsi": t.mmsi, "lat": t.latitude, "lon": t.longitude}
                            )
                            await send_alert(
                                alert_type="dark_vessel",
                                message=f"Vessel {t.vessel_name or t.mmsi} has stopped transmitting AIS mid-transit in the Strait.",
                                unique_id=t.mmsi,
                                severity="warning"
                            )
                            logger.warning("DARK VESSEL: %s (%s)", t.vessel_name, t.mmsi)

            db.commit()
        except Exception as e:
            db.rollback()
            logger.error("Error in dark vessel detection: %s", e)


async def get_active_dark_vessels() -> list[dict]:
    """Return currently active dark vessels as dicts."""
    with SessionLocal() as db:
        rows = (
            db.query(DarkVessel)
            .filter(DarkVessel.is_active == True)
            .order_by(DarkVessel.last_observed_at.desc())
            .all()
        )
        return [
            {
                "mmsi": r.mmsi,
                "vessel_name": r.vessel_name,
                "vessel_class": r.vessel_class,
                "last_lat": r.last_lat,
                "last_lon": r.last_lon,
                "last_speed": r.last_speed,
                "last_course": r.last_course,
                "is_loaded": r.is_loaded,
                "last_observed_at": r.last_observed_at.isoformat() if r.last_observed_at else None,
                "detected_at": r.detected_at.isoformat() if r.detected_at else None,
                "is_active": r.is_active,
            }
            for r in rows
        ]
