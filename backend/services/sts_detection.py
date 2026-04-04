"""STS Detection Service — identify potential Ship-to-Ship transfers."""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone

from ..database import SessionLocal
from ..models import STSEvent
from .ais_stream import get_live_vessels
from .activity import log_activity
from .alerts import send_alert

logger = logging.getLogger(__name__)


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (math.sin(dphi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(dlambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def detect_sts_events():
    """Detect pairs of vessels < 500m apart, both slow, one loaded."""
    vessels = get_live_vessels()
    tankers = [v for v in vessels if v.get("vessel_type", 0) in range(70, 90)]

    if len(tankers) < 2:
        return

    detected_pairs = set()

    for i in range(len(tankers)):
        for j in range(i + 1, len(tankers)):
            v1 = tankers[i]
            v2 = tankers[j]

            if (v1.get("speed") or 0) >= 1.0 or (v2.get("speed") or 0) >= 1.0:
                continue

            # Require one loaded, one ballast (actual STS pattern)
            if v1.get("is_loaded") == v2.get("is_loaded"):
                continue

            dist = haversine_distance(v1["lat"], v1["lon"], v2["lat"], v2["lon"])

            if dist < 500:
                pair_key = tuple(sorted([v1["mmsi"], v2["mmsi"]]))
                detected_pairs.add(pair_key)

                with SessionLocal() as db:
                    try:
                        exists = db.query(STSEvent).filter(
                            STSEvent.vessel_a_mmsi == pair_key[0],
                            STSEvent.vessel_b_mmsi == pair_key[1],
                            STSEvent.is_active == True,
                        ).first()

                        if not exists:
                            a = v1 if v1["mmsi"] == pair_key[0] else v2
                            b = v2 if v2["mmsi"] == pair_key[1] else v1
                            db.add(STSEvent(
                                vessel_a_mmsi=a["mmsi"],
                                vessel_a_name=a.get("name"),
                                vessel_b_mmsi=b["mmsi"],
                                vessel_b_name=b.get("name"),
                                latitude=(v1["lat"] + v2["lat"]) / 2,
                                longitude=(v1["lon"] + v2["lon"]) / 2,
                                distance_m=dist,
                                is_active=True,
                            ))
                            log_activity(
                                event_type="sts_detected",
                                message=f"ALERT: Potential STS transfer between {a.get('name') or a['mmsi']} & {b.get('name') or b['mmsi']}",
                                severity="warning",
                                metadata={"vessel_a": a["mmsi"], "vessel_b": b["mmsi"], "dist": dist}
                            )
                            await send_alert(
                                alert_type="sts_event",
                                message=f"Suspicious proximity detected between {a.get('name') or a['mmsi']} and {b.get('name') or b['mmsi']} (<500m). Potential STS transfer.",
                                unique_id=f"{pair_key[0]}_{pair_key[1]}",
                                severity="warning"
                            )
                            logger.warning("STS EVENT: %s & %s", a.get("name"), b.get("name"))
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        logger.error("Error in STS detection: %s", e)

    # Resolve events no longer detected
    with SessionLocal() as db:
        try:
            active_events = db.query(STSEvent).filter(STSEvent.is_active == True).all()
            for event in active_events:
                e_key = tuple(sorted([event.vessel_a_mmsi, event.vessel_b_mmsi]))
                if e_key not in detected_pairs:
                    event.is_active = False
                    event.resolved_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error("Error resolving STS events: %s", e)


async def get_active_sts_events() -> list[dict]:
    """Return currently active STS detections as dicts."""
    with SessionLocal() as db:
        rows = db.query(STSEvent).filter(STSEvent.is_active == True).all()
        return [
            {
                "id": r.id,
                "vessel_a_mmsi": r.vessel_a_mmsi,
                "vessel_a_name": r.vessel_a_name,
                "vessel_b_mmsi": r.vessel_b_mmsi,
                "vessel_b_name": r.vessel_b_name,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "distance_m": r.distance_m,
                "detected_at": r.detected_at.isoformat() if r.detected_at else None,
                "is_active": r.is_active,
            }
            for r in rows
        ]
