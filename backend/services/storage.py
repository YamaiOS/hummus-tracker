"""Floating Storage Detection Service — identify stationary loaded tankers."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import select, desc
from ..database import SessionLocal
from ..models import VesselTransit, FloatingStorage, FloatingStorageSummary
from .activity import log_activity

logger = logging.getLogger(__name__)


async def update_floating_storage_detections():
    """Identify vessels stationary (speed < 0.5 kn) and loaded for > 48 hours."""
    with SessionLocal() as db:
        try:
            cutoff_recent = datetime.now(timezone.utc) - timedelta(hours=72)
            recent_mmsis = db.execute(
                select(VesselTransit.mmsi)
                .where(VesselTransit.observed_at >= cutoff_recent)
                .distinct()
            ).scalars().all()

            detected_count = 0
            total_barrels = 0.0

            db.query(FloatingStorage).update({FloatingStorage.is_active: False})

            for mmsi in recent_mmsis:
                observations = db.execute(
                    select(VesselTransit)
                    .where(VesselTransit.mmsi == mmsi)
                    .where(VesselTransit.observed_at >= cutoff_recent)
                    .order_by(VesselTransit.observed_at.asc())
                ).scalars().all()

                if not observations:
                    continue

                stationary_streak_start = None

                for obs in observations:
                    if (obs.speed or 0) < 0.5 and obs.is_loaded:
                        if stationary_streak_start is None:
                            stationary_streak_start = obs.observed_at

                        duration = (obs.observed_at - stationary_streak_start).total_seconds() / 3600
                        if duration >= 48:
                            last_obs = observations[-1]

                            existing = db.query(FloatingStorage).filter(FloatingStorage.mmsi == mmsi).first()
                            if existing:
                                existing.latitude = last_obs.latitude
                                existing.longitude = last_obs.longitude
                                existing.duration_hrs = duration
                                existing.last_observed_at = last_obs.observed_at
                                existing.is_active = True
                            else:
                                db.add(FloatingStorage(
                                    mmsi=mmsi,
                                    vessel_name=last_obs.vessel_name,
                                    vessel_class=last_obs.vessel_class,
                                    latitude=last_obs.latitude,
                                    longitude=last_obs.longitude,
                                    duration_hrs=duration,
                                    estimated_barrels=last_obs.estimated_barrels or 0,
                                    last_observed_at=last_obs.observed_at,
                                    is_active=True,
                                ))
                                log_activity(
                                    event_type="floating_storage_detected",
                                    message=f"INFO: Vessel {last_obs.vessel_name or mmsi} identified as floating storage",
                                    severity="info",
                                    metadata={"mmsi": mmsi, "barrels": last_obs.estimated_barrels}
                                )

                            detected_count += 1
                            total_barrels += (last_obs.estimated_barrels or 0)
                            break
                    else:
                        stationary_streak_start = None

            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            summary = db.query(FloatingStorageSummary).filter(FloatingStorageSummary.date == today).first()
            if summary:
                summary.vessel_count = detected_count
                summary.total_barrels = total_barrels
                summary.updated_at = datetime.now(timezone.utc)
            else:
                db.add(FloatingStorageSummary(
                    date=today,
                    vessel_count=detected_count,
                    total_barrels=total_barrels,
                ))

            db.commit()
            logger.info("Floating storage update: %d vessels detected.", detected_count)

        except Exception as e:
            db.rollback()
            logger.error("Error updating floating storage: %s", e)


async def get_active_floating_storage() -> list[dict]:
    """Return currently active floating storage vessels as dicts."""
    with SessionLocal() as db:
        rows = db.query(FloatingStorage).filter(FloatingStorage.is_active == True).all()
        return [
            {
                "mmsi": r.mmsi,
                "vessel_name": r.vessel_name,
                "vessel_class": r.vessel_class,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "duration_hrs": r.duration_hrs,
                "estimated_barrels": r.estimated_barrels,
                "last_observed_at": r.last_observed_at.isoformat() if r.last_observed_at else None,
                "is_active": r.is_active,
            }
            for r in rows
        ]


async def get_storage_summary() -> dict | None:
    """Return latest summary metrics as dict."""
    with SessionLocal() as db:
        r = db.query(FloatingStorageSummary).order_by(desc(FloatingStorageSummary.date)).first()
        if not r:
            return None
        return {
            "date": r.date,
            "vessel_count": r.vessel_count,
            "total_barrels": r.total_barrels,
        }
