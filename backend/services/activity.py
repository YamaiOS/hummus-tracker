"""Activity Feed Service — log and retrieve intelligence events."""
from __future__ import annotations

import logging
import json
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, desc
from ..database import SessionLocal
from ..models import ActivityEvent

logger = logging.getLogger(__name__)

def log_activity(
    event_type: str, 
    message: str, 
    severity: str = "info", 
    metadata: Optional[dict] = None
):
    """Log an event to the activity feed."""
    with SessionLocal() as db:
        try:
            event = ActivityEvent(
                event_type=event_type,
                message=message,
                severity=severity,
                metadata_json=json.dumps(metadata) if metadata else None,
                timestamp=datetime.now(timezone.utc)
            )
            db.add(event)
            db.commit()
            logger.info(f"Activity logged: [{event_type}] {message}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error logging activity: {e}")

async def get_recent_activity(limit: int = 50) -> List[dict]:
    """Retrieve recent activity events."""
    with SessionLocal() as db:
        rows = db.query(ActivityEvent).order_by(desc(ActivityEvent.timestamp)).limit(limit).all()
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "event_type": r.event_type,
                "severity": r.severity,
                "message": r.message,
                "metadata_json": r.metadata_json,
            }
            for r in rows
        ]
