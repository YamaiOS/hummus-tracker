"""Database setup for Hummus Tracker."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .models import Base, DisruptionEvent

_DB_PATH = Path(__file__).parent.parent / "data" / "hummus.db"
_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{_DB_PATH}", echo=False)
SessionLocal = sessionmaker(bind=engine)


def init_db() -> None:
    """Create tables and seed disruption events."""
    Base.metadata.create_all(engine)
    _seed_disruptions()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seed_disruptions() -> None:
    """Seed historical disruption events if table is empty."""
    with SessionLocal() as db:
        if db.query(DisruptionEvent).count() > 0:
            return

        events = [
            DisruptionEvent(
                date="2019-05-12",
                title="Fujairah port sabotage",
                description="Four commercial vessels sabotaged near Fujairah port, UAE. Suspected Iranian-linked limpet mines.",
                severity="high",
                category="security",
                latitude=25.1,
                longitude=56.3,
                brent_impact_pct=1.5,
                source="Reuters",
            ),
            DisruptionEvent(
                date="2019-06-13",
                title="Gulf of Oman tanker attacks",
                description="Japanese-owned Kokuka Courageous and Norwegian-owned Front Altair attacked near Strait of Hormuz.",
                severity="critical",
                category="security",
                latitude=25.5,
                longitude=57.2,
                brent_impact_pct=3.8,
                source="BBC",
            ),
            DisruptionEvent(
                date="2019-09-14",
                title="Abqaiq-Khurais attack",
                description="Drone/missile attack on Saudi Aramco facilities. 5.7 mbpd production halted.",
                severity="critical",
                category="security",
                latitude=25.9,
                longitude=49.6,
                brent_impact_pct=14.6,
                source="EIA",
            ),
            DisruptionEvent(
                date="2025-05-18",
                title="GPS Jamming in Strait",
                description="Widespread reports of GPS interference affecting commercial shipping lanes. Several tankers report navigation difficulties.",
                severity="medium",
                category="security",
                latitude=26.6,
                longitude=56.4,
                brent_impact_pct=0.4,
                source="Maritime Alert",
            ),
            DisruptionEvent(
                date="2026-03-15",
                title="Tanker Collision Near Bandar Abbas",
                description="Minor collision between an outbound VLCC and a cargo ship. Inbound channel closed for 12 hours.",
                severity="medium",
                category="operational",
                latitude=27.1,
                longitude=56.2,
                brent_impact_pct=0.9,
                source="Port Authority",
            ),
            DisruptionEvent(
                date="2026-04-01",
                title="Increased Patrol Activity",
                description="Surge in patrol boat activity in the Eastern approach. Heightened security state declared.",
                severity="low",
                category="geopolitical",
                latitude=26.4,
                longitude=56.8,
                brent_impact_pct=0.3,
                source="Security Report",
            ),
        ]
        db.add_all(events)
        db.commit()
