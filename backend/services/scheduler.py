"""Background scheduler for Hummus Tracker aggregation tasks.

Runs daily to summarize vessel transits and fetch latest oil prices.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func

from ..database import SessionLocal
from ..models import VesselTransit, DailyTransitSummary
from .fred import get_latest_prices
from .storage import update_floating_storage_detections
from .dark_vessels import detect_dark_vessels
from .sts_detection import detect_sts_events
from .congestion import update_port_congestion
from .market_data import persist_daily_market_metrics
from .eia import fetch_hormuz_flow
from .activity import log_activity
from .alerts import send_alert
from .daily_brief import generate_daily_brief
from .bunkers import fetch_bunker_prices
from .weather import fetch_terminal_weather

logger = logging.getLogger(__name__)

# Major Oil Port Coordinates
PORT_COORDS = {
    "NINGBO": (29.95, 121.85),
    "SINGAPORE": (1.26, 103.82),
    "ROTTERDAM": (51.94, 4.14),
    "JAMNAGAR": (22.47, 70.05),
    "ULSAN": (35.51, 129.38),
    "MUMBAI": (18.93, 72.83),
    "FUJAIRAH": (25.16, 56.36),
    "HOUSTON": (29.72, -95.27),
    "LONG BEACH": (33.75, -118.21),
    "SUEZ": (30.45, 32.35),
}

HORMUZ_CENTER = (26.0, 56.5)

def calculate_distance(p1, p2):
    """Simple Euclidean distance for ton-mile heuristic."""
    import math
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

async def backfill_daily_transits(days: int = 30):
    """Backfill historical transit summaries using IMF PortWatch data."""
    from .imf_portwatch import fetch_hormuz_transits
    
    transits = await fetch_hormuz_transits(days=days)
    if not transits:
        return

    with SessionLocal() as db:
        try:
            for t in transits:
                date_str = t["date"]
                exists = db.query(DailyTransitSummary).filter(DailyTransitSummary.date == date_str).first()
                if not exists:
                    # Map IMF fields to our DailyTransitSummary model
                    # Note: IMF doesn't give us DWT or full mbpd, so we estimate
                    # based on 1.2M bbl per tanker transit as a rough average.
                    db.add(DailyTransitSummary(
                        date=date_str,
                        total_vessels=t["total_transits"] or 0,
                        tanker_count=t["tanker_transits"] or 0,
                        loaded_count=(t["tanker_transits"] or 0) // 2, # rough guess
                        ballast_count=(t["tanker_transits"] or 0) // 2,
                        estimated_mbpd=((t["tanker_transits"] or 0) * 1.2) / 2.0, # outbound only
                        total_dwt_outbound=(t["capacity_tanker"] or 0) / 2.0,
                        brent_price=None, # will be populated if FRED history exists
                    ))
            db.commit()
            logger.info("Historical transit backfill complete for %s records.", len(transits))
        except Exception as e:
            db.rollback()
            logger.error("Error backfilling transits: %s", e)

async def aggregate_daily_transits(date: str | None = None) -> None:
    """Summarize vessel transits for a given date (default: yesterday)."""
    if not date:
        date = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info("Aggregating transits for date: %s", date)

    with SessionLocal() as db:
        # Check if already exists
        summary = db.query(DailyTransitSummary).filter(DailyTransitSummary.date == date).first()
        if not summary:
            summary = DailyTransitSummary(date=date)
            db.add(summary)

        # Count unique vessels by MMSI seen on this date
        # Subquery to get latest observation per mmsi for this date
        latest_subq = (
            db.query(
                VesselTransit.mmsi,
                func.max(VesselTransit.observed_at).label("latest_time")
            )
            .filter(func.date(VesselTransit.observed_at) == date)
            .group_by(VesselTransit.mmsi)
            .subquery()
        )

        vessels_day = (
            db.query(VesselTransit)
            .join(
                latest_subq,
                (VesselTransit.mmsi == latest_subq.c.mmsi) & 
                (VesselTransit.observed_at == latest_subq.c.latest_time)
            )
            .all()
        )

        summary.total_vessels = len(vessels_day)

        # Filtered lists for counts
        tankers = [v for v in vessels_day if v.vessel_type in range(70, 90)]
        summary.tanker_count = len(tankers)
        summary.vlcc_count = len([v for v in tankers if v.vessel_class == "VLCC"])
        summary.suezmax_count = len([v for v in tankers if v.vessel_class == "Suezmax"])
        summary.aframax_count = len([v for v in tankers if v.vessel_class == "Aframax"])
        summary.lng_count = len([v for v in tankers if v.vessel_class == "LNG"])

        summary.loaded_count = len([v for v in tankers if v.is_loaded])
        summary.ballast_count = len([v for v in tankers if not v.is_loaded])

        # Barrels (sum unique outbound loaded tankers)
        total_barrels = sum(v.estimated_barrels or 0 for v in tankers if v.is_loaded and v.direction == "outbound")
        total_dwt = sum(v.dwt or 0 for v in tankers if v.is_loaded and v.direction == "outbound")
        
        summary.estimated_barrels = total_barrels
        summary.estimated_mbpd = total_barrels / 1_000_000
        summary.total_dwt_outbound = total_dwt

        # Ton-Mile Calculation
        daily_ton_miles = 0.0
        for v in tankers:
            if v.is_loaded and v.direction == "outbound" and v.destination:
                dest = v.destination.upper()
                dist = 50.0 # Default fallback distance
                for port, coords in PORT_COORDS.items():
                    if port in dest:
                        dist = calculate_distance(HORMUZ_CENTER, coords)
                        break
                daily_ton_miles += (v.estimated_barrels or 0) * dist
        
        summary.ton_mile_index = daily_ton_miles

        # Prices
        prices = await get_latest_prices()
        summary.brent_price = prices.get("brent")
        summary.wti_price = prices.get("wti")

        summary.updated_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("Daily aggregation complete for %s: %s vessels, %s mbpd",
                    date, summary.total_vessels, round(summary.estimated_mbpd, 2))

        # Flow Deviation Check
        try:
            baseline_data = await fetch_hormuz_flow()
            baseline = baseline_data["baseline_mbpd"]
            if baseline > 0 and summary.total_vessels > 0:
                deviation_pct = (summary.estimated_mbpd / baseline) * 100
                if deviation_pct < 85:
                    msg = f"CRITICAL: Strait flow at {round(deviation_pct)}% of baseline ({round(summary.estimated_mbpd, 2)} mbpd)"
                    log_activity("flow_threshold", msg, severity="critical")
                    await send_alert("low_flow", msg, unique_id=date, severity="critical")
                elif deviation_pct < 92:
                    msg = f"WARNING: Strait flow at {round(deviation_pct)}% of baseline"
                    log_activity("flow_threshold", msg, severity="warning")
                    await send_alert("low_flow", msg, unique_id=date, severity="warning")
        except Exception as e:
            logger.error(f"Error in flow deviation check: {e}")


def start_scheduler():
    """Initialize and start the background scheduler."""
    scheduler = AsyncIOScheduler()

    # Run daily at 01:00 UTC
    scheduler.add_job(
        aggregate_daily_transits,
        "cron",
        hour=1,
        minute=0,
        id="daily_aggregation",
        replace_existing=True,
    )

    # Initial aggregation for current/previous day if needed (run every 6 hours)
    scheduler.add_job(
        lambda: aggregate_daily_transits(datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "interval",
        hours=6,
        id="partial_day_aggregation",
        replace_existing=True,
    )

    # Floating storage detection (every hour)
    scheduler.add_job(
        update_floating_storage_detections,
        "interval",
        hours=1,
        id="floating_storage_detection",
        replace_existing=True,
    )

    # Dark vessel detection (every hour)
    scheduler.add_job(
        detect_dark_vessels,
        "interval",
        hours=1,
        id="dark_vessel_detection",
        replace_existing=True,
    )

    # STS detection (every 15 minutes)
    scheduler.add_job(
        detect_sts_events,
        "interval",
        minutes=15,
        id="sts_detection",
        replace_existing=True,
    )

    # Port congestion metrics update (every 4 hours)
    scheduler.add_job(
        update_port_congestion,
        "interval",
        hours=4,
        id="port_congestion_update",
        replace_existing=True,
    )

    # Market data persistence (every 12 hours)
    scheduler.add_job(
        persist_daily_market_metrics,
        "interval",
        hours=12,
        id="market_data_persistence",
        replace_existing=True,
    )

    # Daily Intelligence Brief (06:00 UTC)
    scheduler.add_job(
        generate_daily_brief,
        "cron",
        hour=6,
        minute=0,
        id="daily_intelligence_brief",
        replace_existing=True,
    )

    # Bunker price fetch (daily)
    scheduler.add_job(
        fetch_bunker_prices,
        "cron",
        hour=2,
        minute=0,
        id="bunker_price_fetch",
        replace_existing=True,
    )

    # Terminal weather fetch (every 30 minutes)
    scheduler.add_job(
        fetch_terminal_weather,
        "interval",
        minutes=30,
        id="terminal_weather_fetch",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Background scheduler started.")
    return scheduler
