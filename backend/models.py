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
    crude_grade = Column(String, nullable=True)    # inferred from loading port (e.g., Arab Light)
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
    total_dwt_outbound = Column(Float, default=0.0) # Total tonnage leaving Gulf
    ton_mile_index = Column(Float, default=0.0)    # barrels * distance
    brent_price = Column(Float, nullable=True)
    wti_price = Column(Float, nullable=True)
    dubai_price = Column(Float, nullable=True)
    brent_dubai_spread = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class MarketData(Base):
    """Detailed daily market indicators (spreads, curves)."""
    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, unique=True, index=True)  # YYYY-MM-DD
    brent_m1 = Column(Float)
    brent_m2 = Column(Float)
    brent_m6 = Column(Float)
    dubai_m1 = Column(Float)
    dubai_m2 = Column(Float)
    dubai_m6 = Column(Float)
    brent_dubai_efs = Column(Float)  # Brent M1 - Dubai M1
    brent_m1_m2 = Column(Float)      # Brent Time Spread 1-2
    brent_m1_m6 = Column(Float)      # Brent Time Spread 1-6
    dubai_m1_m2 = Column(Float)      # Dubai Time Spread 1-2
    updated_at = Column(DateTime, default=datetime.utcnow)


class FloatingStorage(Base):
    """Vessels identified as floating storage (stationary + loaded)."""
    __tablename__ = "floating_storage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mmsi = Column(String, index=True)
    vessel_name = Column(String)
    vessel_class = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    duration_hrs = Column(Float)
    estimated_barrels = Column(Float)
    last_observed_at = Column(DateTime)
    is_active = Column(Boolean, default=True)


class FloatingStorageSummary(Base):
    """Daily aggregated floating storage metrics."""
    __tablename__ = "floating_storage_summary"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, unique=True, index=True)  # YYYY-MM-DD
    vessel_count = Column(Integer)
    total_barrels = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow)


class DarkVessel(Base):
    """Vessels that have disappeared from AIS mid-transit (gone dark)."""
    __tablename__ = "dark_vessels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mmsi = Column(String, index=True)
    vessel_name = Column(String)
    vessel_class = Column(String)
    last_lat = Column(Float)
    last_lon = Column(Float)
    last_speed = Column(Float)
    last_course = Column(Float)
    is_loaded = Column(Boolean)
    last_observed_at = Column(DateTime)
    detected_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    resolved_at = Column(DateTime, nullable=True)


class STSEvent(Base):
    """Potential Ship-to-Ship (STS) transfer events."""
    __tablename__ = "sts_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vessel_a_mmsi = Column(String, index=True)
    vessel_a_name = Column(String)
    vessel_b_mmsi = Column(String, index=True)
    vessel_b_name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    distance_m = Column(Float)
    detected_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    resolved_at = Column(DateTime, nullable=True)


class FujairahInventory(Base):
    """Weekly Fujairah oil inventory data (FEDCom/S&P Global)."""
    __tablename__ = "fujairah_inventory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, unique=True, index=True)  # YYYY-MM-DD (typically a Monday or Wednesday)
    light_distillates = Column(Float)
    middle_distillates = Column(Float)
    heavy_distillates_residues = Column(Float)
    total_inventory = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow)


class OPECQuota(Base):
    """OPEC+ production quotas for key exporters."""
    __tablename__ = "opec_quotas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    country = Column(String, unique=True, index=True)
    quota_mbpd = Column(Float)
    is_exempt = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow)


class PortCongestion(Base):
    """Wait times and congestion metrics for major terminals."""
    __tablename__ = "port_congestion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    terminal_name = Column(String, index=True)
    avg_wait_hrs = Column(Float)
    vessel_count = Column(Integer)
    date = Column(String, index=True)  # YYYY-MM-DD
    updated_at = Column(DateTime, default=datetime.utcnow)


class ActivityEvent(Base):
    """Timestamped intelligence events for the activity feed."""
    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    event_type = Column(String, index=True) # e.g., "dark_vessel", "sts_event", "flow_threshold"
    severity = Column(String) # "info", "warning", "critical"
    message = Column(String)
    metadata_json = Column(String, nullable=True)


class IntelligenceBrief(Base):
    """Daily auto-generated intelligence summaries."""
    __tablename__ = "intelligence_briefs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, unique=True, index=True) # YYYY-MM-DD
    content_markdown = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class InsuranceMarket(Base):
    """War risk insurance premiums and JWC status."""
    __tablename__ = "insurance_market"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jwc_status = Column(String) # e.g., "JWLA-033"
    is_listed_area = Column(Boolean, default=True)
    premium_bps = Column(Float) # Basis points (100 bps = 1%)
    baseline_bps = Column(Float, default=15.0)
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


class BunkerPrice(Base):
    """Fujairah bunker fuel prices (VLSFO, HSFO)."""
    __tablename__ = "bunker_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, index=True) # YYYY-MM-DD
    vlsfo_price = Column(Float)
    hsfo_price = Column(Float)
    spread = Column(Float) # VLSFO - HSFO (Hi-5 spread)
    updated_at = Column(DateTime, default=datetime.utcnow)


class TerminalWeather(Base):
    """Real-time weather data at key terminals (Shamal wind detection)."""
    __tablename__ = "terminal_weather"

    id = Column(Integer, primary_key=True, autoincrement=True)
    terminal_name = Column(String, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    wind_speed_knots = Column(Float)
    wind_gusts_knots = Column(Float)
    wave_height_m = Column(Float, nullable=True)
    is_alert_active = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow)


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
    crude_grade: Optional[str] = None
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
    dubai: Optional[float] = None
    brent_dubai_spread: Optional[float] = None
    transit_count: int = 0
    estimated_mbpd: float = 0.0


class MarketMetrics(BaseModel):
    date: str
    brent_m1: float
    brent_m2: float
    brent_m6: float
    dubai_m1: float
    dubai_m2: float
    dubai_m6: float
    brent_dubai_efs: float
    brent_m1_m2: float
    brent_m1_m6: float
    dubai_m1_m2: float


class FloatingStorageSchema(BaseModel):
    mmsi: str
    vessel_name: Optional[str] = None
    vessel_class: Optional[str] = None
    latitude: float
    longitude: float
    duration_hrs: float
    estimated_barrels: float
    last_observed_at: str
    is_active: bool


class FloatingStorageSummarySchema(BaseModel):
    date: str
    vessel_count: int
    total_barrels: float


class DarkVesselSchema(BaseModel):
    mmsi: str
    vessel_name: Optional[str] = None
    vessel_class: Optional[str] = None
    last_lat: float
    last_lon: float
    last_speed: Optional[float] = None
    last_course: Optional[float] = None
    is_loaded: bool
    last_observed_at: str
    detected_at: str
    is_active: bool


class STSEventSchema(BaseModel):
    vessel_a_mmsi: str
    vessel_a_name: Optional[str] = None
    vessel_b_mmsi: str
    vessel_b_name: Optional[str] = None
    latitude: float
    longitude: float
    distance_m: float
    detected_at: str
    is_active: bool


class FujairahInventorySchema(BaseModel):
    date: str
    light_distillates: float
    middle_distillates: float
    heavy_distillates_residues: float
    total_inventory: float


class OPECQuotaSchema(BaseModel):
    country: str
    quota_mbpd: float
    is_exempt: bool


class ComplianceRecord(BaseModel):
    country: str
    quota_mbpd: float
    observed_mbpd: float
    delta: float
    compliance_pct: float
    is_exempt: bool


class PortCongestionSchema(BaseModel):
    terminal_name: str
    avg_wait_hrs: float
    vessel_count: int
    date: str


class ActivityEventSchema(BaseModel):
    id: int
    timestamp: str
    event_type: str
    severity: str
    message: str
    metadata_json: Optional[str] = None


class IntelligenceBriefSchema(BaseModel):
    date: str
    content_markdown: str
    created_at: str


class InsuranceMarketSchema(BaseModel):
    jwc_status: str
    is_listed_area: bool
    premium_bps: float
    baseline_bps: float
    multiplier: float


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


class BunkerPriceSchema(BaseModel):
    date: str
    vlsfo_price: float
    hsfo_price: float
    spread: float


class TerminalWeatherSchema(BaseModel):
    terminal_name: str
    latitude: float
    longitude: float
    wind_speed_knots: float
    wind_gusts_knots: float
    wave_height_m: Optional[float] = None
    is_alert_active: bool


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
