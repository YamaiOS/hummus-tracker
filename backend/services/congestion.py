"""Port Congestion Service — calculate waiting/transit times at Hormuz area terminals.

Only tracks terminals INSIDE or near the AIS bounding box
(lat: 24.5-27.0, lon: 55.5-58.0). Deep-Gulf terminals like
Ras Tanura, Basrah, Kharg are outside the collection area.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import func, desc
from ..database import SessionLocal
from ..models import VesselTransit, PortCongestion

logger = logging.getLogger(__name__)

# Terminals within or near the Hormuz AIS bounding box
TERMINALS = {
    "Fujairah": {"lat": 25.12, "lon": 56.33},       # Major bunkering hub, inside bbox
    "Khor Fakkan": {"lat": 25.35, "lon": 56.35},     # Container/tanker anchorage, inside bbox
    "Sohar (Oman)": {"lat": 24.37, "lon": 56.73},    # Near south edge of bbox
    "Hormuz Anchorage E": {"lat": 26.20, "lon": 56.50},  # Eastern approach anchorage
    "Hormuz Anchorage W": {"lat": 26.50, "lon": 56.00},  # Western approach anchorage
}

# Proximity threshold: ~5.5 km
PROXIMITY_DEG = 0.05


async def update_port_congestion():
    """For each terminal area, find tankers anchoring/berthing in the last 24h.

    Wait time = time from first observation in bbox to first observation
    near the terminal at low speed.
    """
    with SessionLocal() as db:
        try:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

            for name, coords in TERMINALS.items():
                from sqlalchemy import select
                stmt = (
                    select(VesselTransit.mmsi)
                    .where(VesselTransit.observed_at >= cutoff)
                    .where(VesselTransit.speed < 2.0)
                    .where(VesselTransit.latitude.between(
                        coords["lat"] - PROXIMITY_DEG,
                        coords["lat"] + PROXIMITY_DEG,
                    ))
                    .where(VesselTransit.longitude.between(
                        coords["lon"] - PROXIMITY_DEG,
                        coords["lon"] + PROXIMITY_DEG,
                    ))
                    .distinct()
                )
                mmsis_at_port = db.execute(stmt).scalars().all()

                wait_times = []
                for mmsi in mmsis_at_port:
                    # First seen in bbox (last 7 days)
                    voyage_start = db.execute(
                        select(func.min(VesselTransit.observed_at))
                        .where(VesselTransit.mmsi == mmsi)
                        .where(VesselTransit.observed_at >= (datetime.now(timezone.utc) - timedelta(days=7)))
                    ).scalar()

                    # First seen near this terminal
                    arrival = db.execute(
                        select(func.min(VesselTransit.observed_at))
                        .where(VesselTransit.mmsi == mmsi)
                        .where(VesselTransit.observed_at >= cutoff)
                        .where(VesselTransit.latitude.between(
                            coords["lat"] - PROXIMITY_DEG,
                            coords["lat"] + PROXIMITY_DEG,
                        ))
                        .where(VesselTransit.longitude.between(
                            coords["lon"] - PROXIMITY_DEG,
                            coords["lon"] + PROXIMITY_DEG,
                        ))
                    ).scalar()

                    if voyage_start and arrival and arrival > voyage_start:
                        wait_hrs = (arrival - voyage_start).total_seconds() / 3600
                        if 1 < wait_hrs < 120:
                            wait_times.append(wait_hrs)

                if wait_times:
                    avg_wait = sum(wait_times) / len(wait_times)

                    existing = db.query(PortCongestion).filter(
                        PortCongestion.terminal_name == name,
                        PortCongestion.date == today,
                    ).first()

                    if existing:
                        existing.avg_wait_hrs = round(avg_wait, 1)
                        existing.vessel_count = len(wait_times)
                        existing.updated_at = datetime.now(timezone.utc)
                    else:
                        db.add(PortCongestion(
                            terminal_name=name,
                            avg_wait_hrs=round(avg_wait, 1),
                            vessel_count=len(wait_times),
                            date=today,
                        ))

            db.commit()
            logger.info("Port congestion update complete.")
        except Exception as e:
            db.rollback()
            logger.error("Error updating port congestion: %s", e)


async def get_latest_congestion() -> list[dict]:
    """Return latest congestion metrics for all terminals as dicts."""
    with SessionLocal() as db:
        latest_date = db.query(func.max(PortCongestion.date)).scalar()
        if not latest_date:
            return []
        rows = db.query(PortCongestion).filter(PortCongestion.date == latest_date).all()
        return [
            {
                "terminal_name": r.terminal_name,
                "avg_wait_hrs": r.avg_wait_hrs,
                "vessel_count": r.vessel_count,
                "date": r.date,
            }
            for r in rows
        ]


async def get_congestion_history(terminal: str, days: int = 30) -> list[dict]:
    """Return history for a specific terminal as dicts."""
    with SessionLocal() as db:
        rows = (
            db.query(PortCongestion)
            .filter(PortCongestion.terminal_name == terminal)
            .order_by(desc(PortCongestion.date))
            .limit(days)
            .all()
        )
        return [
            {
                "terminal_name": r.terminal_name,
                "avg_wait_hrs": r.avg_wait_hrs,
                "vessel_count": r.vessel_count,
                "date": r.date,
            }
            for r in rows
        ]
