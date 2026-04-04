"""Bunker Fuel Prices Service — Fujairah VLSFO and HSFO."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import random

from sqlalchemy import desc
from ..database import SessionLocal
from ..models import BunkerPrice

logger = logging.getLogger(__name__)

async def fetch_bunker_prices():
    """
    Fetch bunker prices (mocked for prototype, real impl would use Ship & Bunker API).
    Simulates high volatility and war risk premiums.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    with SessionLocal() as db:
        try:
            exists = db.query(BunkerPrice).filter(BunkerPrice.date == today).first()
            if exists:
                return exists
            
            # Get yesterday's price or seed defaults
            last = db.query(BunkerPrice).order_by(desc(BunkerPrice.date)).first()
            
            if last:
                # Add some volatility
                vlsfo = last.vlsfo_price + random.uniform(-15.0, 20.0)
                hsfo = last.hsfo_price + random.uniform(-10.0, 15.0)
            else:
                # April 2026 pre-seeded values based on search
                vlsfo = 878.50
                hsfo = 810.00
                
            spread = vlsfo - hsfo
            
            new_price = BunkerPrice(
                date=today,
                vlsfo_price=round(vlsfo, 2),
                hsfo_price=round(hsfo, 2),
                spread=round(spread, 2)
            )
            db.add(new_price)
            db.commit()
            logger.info(f"Bunker prices updated for {today}")
            return new_price
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching bunker prices: {e}")
            return None

def seed_bunker_history():
    """Seed last 30 days of bunker prices showing the recent surge."""
    with SessionLocal() as db:
        try:
            count = db.query(BunkerPrice).count()
            if count > 0:
                return
                
            logger.info("Seeding bunker price history...")
            
            # Start from a lower baseline 30 days ago (e.g., $650 VLSFO)
            # and ramp up to current ~$875 to show the 80%+ increase
            base_vlsfo = 650.0
            base_hsfo = 580.0
            
            for i in range(30, -1, -1):
                date = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
                
                # Gradual ramp up with noise, steeper towards the end
                progress = (30 - i) / 30.0
                spike = 200.0 * (progress ** 2) # Exponential-ish curve
                
                vlsfo = base_vlsfo + spike + random.uniform(-5.0, 5.0)
                hsfo = base_hsfo + (spike * 0.9) + random.uniform(-5.0, 5.0)
                
                db.add(BunkerPrice(
                    date=date,
                    vlsfo_price=round(vlsfo, 2),
                    hsfo_price=round(hsfo, 2),
                    spread=round(vlsfo - hsfo, 2)
                ))
            db.commit()
            logger.info("Bunker history seeded.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding bunker history: {e}")

async def get_latest_bunker_prices() -> Optional[Dict]:
    """Retrieve the most recent bunker prices."""
    with SessionLocal() as db:
        r = db.query(BunkerPrice).order_by(desc(BunkerPrice.date)).first()
        if not r:
            return None
        return {
            "date": r.date,
            "vlsfo_price": r.vlsfo_price,
            "hsfo_price": r.hsfo_price,
            "spread": r.spread
        }

async def get_bunker_history(days: int = 30) -> List[Dict]:
    """Retrieve bunker price history."""
    with SessionLocal() as db:
        rows = db.query(BunkerPrice).order_by(desc(BunkerPrice.date)).limit(days).all()
        return [
            {
                "date": r.date,
                "vlsfo_price": r.vlsfo_price,
                "hsfo_price": r.hsfo_price,
                "spread": r.spread
            } for r in reversed(rows)
        ]
