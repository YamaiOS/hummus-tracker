"""Fujairah Inventory Service — weekly inventory reports.

Real data comes from FEDCom/S&P Global Platts (paid API).
This implementation seeds realistic historical data with variance
so the dashboard chart shows meaningful trends.
"""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import desc
from ..database import SessionLocal
from ..models import FujairahInventory

logger = logging.getLogger(__name__)


def seed_fujairah_history(weeks: int = 26) -> None:
    """Seed weekly Fujairah inventory data with realistic variance.

    Typical Fujairah ranges (in '000 barrels):
      - Light distillates: 5,500 - 8,500
      - Middle distillates: 2,000 - 6,000
      - Heavy/residues: 8,000 - 15,000
    """
    with SessionLocal() as db:
        existing_count = db.query(FujairahInventory).count()
        if existing_count >= weeks:
            return

        now = datetime.utcnow()
        # Find most recent Wednesday
        days_since_wed = (now.weekday() - 2) % 7
        latest_wed = now - timedelta(days=days_since_wed)

        # Start values (mid-range)
        light = 7000.0
        middle = 3500.0
        heavy = 11000.0

        rows = []
        for i in range(weeks - 1, -1, -1):
            wed = latest_wed - timedelta(weeks=i)
            date_str = wed.strftime("%Y-%m-%d")
            
            if db.query(FujairahInventory).filter(FujairahInventory.date == date_str).first():
                continue

            # Random walk with higher variance
            light += random.uniform(-600, 600)
            light = max(5000, min(9000, light))

            middle += random.uniform(-500, 500)
            middle = max(1800, min(6500, middle))

            heavy += random.uniform(-800, 800)
            heavy = max(7000, min(16000, heavy))

            total = light + middle + heavy
            rows.append(FujairahInventory(
                date=date_str,
                light_distillates=round(light),
                middle_distillates=round(middle),
                heavy_distillates_residues=round(heavy),
                total_inventory=round(total),
            ))

        db.add_all(rows)
        db.commit()
        logger.info("Seeded/Updated Fujairah inventory data.")


async def get_fujairah_history(limit: int = 52) -> List[dict]:
    """Return historical weekly inventory data as dicts."""
    with SessionLocal() as db:
        rows = (
            db.query(FujairahInventory)
            .order_by(desc(FujairahInventory.date))
            .limit(limit)
            .all()
        )
        return [
            {
                "date": r.date,
                "light_distillates": r.light_distillates,
                "middle_distillates": r.middle_distillates,
                "heavy_distillates_residues": r.heavy_distillates_residues,
                "total_inventory": r.total_inventory,
            }
            for r in rows
        ]


async def get_latest_fujairah_report() -> Optional[dict]:
    """Return the single most recent inventory report as dict."""
    with SessionLocal() as db:
        r = db.query(FujairahInventory).order_by(desc(FujairahInventory.date)).first()
        if not r:
            return None
        return {
            "date": r.date,
            "light_distillates": r.light_distillates,
            "middle_distillates": r.middle_distillates,
            "heavy_distillates_residues": r.heavy_distillates_residues,
            "total_inventory": r.total_inventory,
        }
