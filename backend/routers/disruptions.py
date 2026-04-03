"""Disruption events API — historical Hormuz incidents."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DisruptionEvent

router = APIRouter(prefix="/disruptions", tags=["disruptions"])


@router.get("/")
def get_disruptions(db: Session = Depends(get_db)):
    """All historical disruption events."""
    events = db.query(DisruptionEvent).order_by(DisruptionEvent.date.desc()).all()
    return {
        "events": [
            {
                "date": e.date,
                "title": e.title,
                "description": e.description,
                "severity": e.severity,
                "category": e.category,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "brent_impact_pct": e.brent_impact_pct,
                "source": e.source,
            }
            for e in events
        ],
        "count": len(events),
    }
