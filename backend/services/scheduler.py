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

logger = logging.getLogger(__name__)


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
        
        summary.estimated_barrels = total_barrels
        summary.estimated_mbpd = total_barrels / 1_000_000

        # Prices
        prices = await get_latest_prices()
        summary.brent_price = prices.get("brent")
        summary.wti_price = prices.get("wti")

        summary.updated_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("Daily aggregation complete for %s: %s vessels, %s mbpd",
                    date, summary.total_vessels, round(summary.estimated_mbpd, 2))


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

    scheduler.start()
    logger.info("Background scheduler started.")
    return scheduler
