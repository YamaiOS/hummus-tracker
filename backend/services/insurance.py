"""Insurance Service — track JWC status and war risk premiums."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict

from sqlalchemy import desc
from ..database import SessionLocal
from ..models import InsuranceMarket

logger = logging.getLogger(__name__)

# Defaults for late March 2026
CURRENT_JWC = "JWLA-033"
CURRENT_PREMIUM_BPS = 100.0 # 1.0%
BASELINE_BPS = 15.0 # ~0.15% pre-escalation

def seed_insurance_data():
    """Seed the database with initial war risk metrics."""
    with SessionLocal() as db:
        try:
            exists = db.query(InsuranceMarket).first()
            if not exists:
                db.add(InsuranceMarket(
                    jwc_status=CURRENT_JWC,
                    is_listed_area=True,
                    premium_bps=CURRENT_PREMIUM_BPS,
                    baseline_bps=BASELINE_BPS
                ))
                db.commit()
                logger.info("Insurance data seeded.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error seeding insurance data: {e}")

async def get_insurance_status() -> Dict:
    """Retrieve the latest war risk metrics."""
    with SessionLocal() as db:
        r = db.query(InsuranceMarket).order_by(desc(InsuranceMarket.updated_at)).first()
        if not r:
            return {
                "jwc_status": CURRENT_JWC,
                "is_listed_area": True,
                "premium_bps": CURRENT_PREMIUM_BPS,
                "baseline_bps": BASELINE_BPS,
                "multiplier": CURRENT_PREMIUM_BPS / BASELINE_BPS
            }
        
        return {
            "jwc_status": r.jwc_status,
            "is_listed_area": r.is_listed_area,
            "premium_bps": r.premium_bps,
            "baseline_bps": r.baseline_bps,
            "multiplier": r.premium_bps / r.baseline_bps
        }
