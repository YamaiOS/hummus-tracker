"""Data models for Hummus Tracker."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Float, Integer, String, Boolean, create_engine
from sqlalchemy.orm import DeclarativeBase, Session


# ── SQLAlchemy Models ────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class VesselTransit(Base):
    """A single vessel transit observation through the Hormuz bounding box."""
    __tablename__ = "vessel_transits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mmsi = Column(String, index=True, nullable=False)
    imo = Column(String, nullable=True)
    vessel_name = Column(String, nullable=True)
    vessel_type = Column(Integer, nullable=True)  # AIS type code (80-89 = tanker)
    vessel_class = Column(String, nullable=True)   # VLCC, Suezmax, Aframax, etc.
    dwt = Column(Float, nullable=True)             # Deadweight tonnage
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, nullable=True)           # SOG in knots
    course = Column(Float, nullable=True)          # COG in degrees
    heading = Column(Float, nullable=True)
    draught = Column(Float, nullable=True)         # metres
    max_draught = Column(Float, nullable=True)     # design max draught
    destination = Column(String, nullable=True)
    nav_status = Column(String, nullable=True)
    cargo_type = Column(Integer, nullable=True)
    is_loaded = Column(Boolean, nullable=True)     # inferred from draught ratio
    estimated_barrels = Column(Float, nullable=True)
    direction = Column(String, nullable=True)      # "inbound" (entering Gulf) or "outbound" (leaving Gulf)
    flag = Column(String, nullable=True)           # ISO country code or name
    observed_at = Column(DateTime, default=datetime.utcnow, index=True)


class DailyTransitSummary(Base):
    """Aggregated daily transit statistics."""
    __tablename__ = "daily_transit_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, unique=True, index=True)  # YYYY-MM-DD
    total_vessels = Column(Integer, default=0)
    tanker_count = Column(Integer, default=0)
    vlcc_count = Column(Integer, default=0)
    suezmax_count = Column(Integer, default=0)
    aframax_count = Column(Integer, default=0)
    lng_count = Column(Integer, default=0)
    other_count = Column(Integer, default=0)
    loaded_count = Column(Integer, default=0)
    ballast_count = Column(Integer, default=0)
    estimated_barrels = Column(Float, default=0.0)
    estimated_mbpd = Column(Float, default=0.0)  # million barrels per day
    brent_price = Column(Float, nullable=True)
    wti_price = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class DisruptionEvent(Base):
    """Historical and real-time disruption events in the Strait of Hormuz."""
    __tablename__ = "disruption_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    severity = Column(String, nullable=True)  # "low", "medium", "high", "critical"
    category = Column(String, default="geopolitical") # "security", "geopolitical", "operational", "weather"
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    brent_impact_pct = Column(Float, nullable=True)  # price move in %
    source = Column(String, nullable=True)


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class VesselClass(str, Enum):
    VLCC = "VLCC"            # 200,000+ DWT
    SUEZMAX = "Suezmax"      # 120,000-200,000 DWT
    AFRAMAX = "Aframax"      # 80,000-120,000 DWT
    PANAMAX = "Panamax"      # 60,000-80,000 DWT
    LNG = "LNG"
    OTHER = "Other"


class VesselPosition(BaseModel):
    mmsi: str
    imo: Optional[str] = None
    name: Optional[str] = None
    vessel_type: Optional[int] = None
    vessel_class: Optional[str] = None
    lat: float
    lon: float
    speed: Optional[float] = None
    course: Optional[float] = None
    draught: Optional[float] = None
    destination: Optional[str] = None
    is_loaded: Optional[bool] = None
    estimated_barrels: Optional[float] = None
    direction: Optional[str] = None
    flag: Optional[str] = None
    observed_at: str


class TransitSummary(BaseModel):
    date: str
    total_vessels: int = 0
    tanker_count: int = 0
    vlcc_count: int = 0
    suezmax_count: int = 0
    aframax_count: int = 0
    lng_count: int = 0
    loaded_count: int = 0
    ballast_count: int = 0
    estimated_mbpd: float = 0.0
    brent_price: Optional[float] = None
    wti_price: Optional[float] = None


class FlowEstimate(BaseModel):
    current_mbpd: float = 0.0
    eia_baseline_mbpd: float = 20.0
    deviation_pct: float = 0.0
    vessels_in_strait: int = 0
    loaded_tankers: int = 0
    ballast_tankers: int = 0


class PriceCorrelation(BaseModel):
    date: str
    brent: Optional[float] = None
    wti: Optional[float] = None
    transit_count: int = 0
    estimated_mbpd: float = 0.0


class DisruptionEventSchema(BaseModel):
    id: Optional[int] = None
    date: str
    title: str
    description: Optional[str] = None
    severity: Optional[str] = "low"
    category: Optional[str] = "geopolitical"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    brent_impact_pct: Optional[float] = 0.0
    source: Optional[str] = None


# ── Vessel classification helpers ────────────────────────────────────────────

def classify_vessel(dwt: float | None, vessel_type: int | None) -> str:
    """Classify vessel by DWT into standard tanker classes."""
    if vessel_type and vessel_type in range(71, 80):
        return "LNG"
    if dwt is None:
        return "Other"
    if dwt >= 200_000:
        return "VLCC"
    if dwt >= 120_000:
        return "Suezmax"
    if dwt >= 80_000:
        return "Aframax"
    if dwt >= 60_000:
        return "Panamax"
    return "Other"


def estimate_cargo_barrels(dwt: float | None, draught: float | None, max_draught: float | None) -> tuple[bool, float]:
    """
    Estimate if vessel is loaded and approximate cargo in barrels.

    Logic: draught / max_draught ratio indicates load:
      - > 0.75 = loaded (carrying cargo)
      - <= 0.75 = ballast (empty return)

    Crude oil: ~7.33 barrels per metric ton
    Typical load factor: 90% of DWT for laden vessels
    """
    if dwt is None or dwt <= 0:
        return False, 0.0

    if draught and max_draught and max_draught > 0:
        load_ratio = draught / max_draught
        is_loaded = load_ratio > 0.75
    else:
        # If no draught data, assume 50/50
        is_loaded = True
        load_ratio = 0.85

    if not is_loaded:
        return False, 0.0

    # Estimate barrels: DWT * load_factor * barrels_per_ton
    cargo_tons = dwt * min(load_ratio, 0.95)
    barrels = cargo_tons * 7.33  # crude oil density
    return True, barrels


# ── Hormuz bounding box ─────────────────────────────────────────────────────

# The Strait of Hormuz + approaches
HORMUZ_BBOX = {
    "lat_min": 24.5,
    "lat_max": 27.0,
    "lon_min": 55.5,
    "lon_max": 58.0,
}

# Midpoint for direction detection
# Vessels heading west (course 225-315) = inbound to Gulf
# Vessels heading east (course 45-135) = outbound from Gulf
HORMUZ_MIDPOINT_LON = 56.5


def infer_direction(course: float | None, longitude: float) -> str:
    """Infer if vessel is entering or leaving the Persian Gulf."""
    if course is not None:
        if 180 <= course <= 360 or course < 45:
            return "inbound"  # heading west/northwest into Gulf
        elif 45 <= course < 180:
            return "outbound"  # heading east/southeast out of Gulf
    # Fallback: use position relative to midpoint
    return "inbound" if longitude > HORMUZ_MIDPOINT_LON else "outbound"
