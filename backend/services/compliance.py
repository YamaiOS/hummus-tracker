"""OPEC+ Compliance Service — compare observed exports vs quotas.

Uses vessel destination field to infer the EXPORTING country from
known loading port names, NOT vessel flag (which is almost always
a flag-of-convenience like Liberia, Panama, Marshall Islands).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import select, func
from ..database import SessionLocal
from ..models import OPECQuota, VesselTransit, ComplianceRecord

logger = logging.getLogger(__name__)

# April 2026 OPEC+ production quotas (mbpd) — these are PRODUCTION not export
# Export is typically production minus domestic refinery consumption
QUOTAS_2026 = {
    "Saudi Arabia": {"quota": 10.166, "exempt": False},
    "Iraq": {"quota": 4.299, "exempt": False},
    "UAE": {"quota": 3.429, "exempt": False},
    "Kuwait": {"quota": 2.596, "exempt": False},
    "Iran": {"quota": 0.0, "exempt": True},
    "Qatar": {"quota": 0.0, "exempt": True},  # LNG mostly
}

# Map known loading port keywords in destination field -> exporting country
# AIS destination field often contains the LAST or NEXT port
# For outbound loaded tankers from Gulf, destination is usually the discharge port.
# We infer origin from where the vessel was loaded, which we approximate from
# the vessel's recent position near known loading terminals.
LOADING_PORT_COORDS = {
    "Saudi Arabia": [
        # Ras Tanura, Juaymah, Yanbu (Red Sea, outside bbox)
        {"name": "Ras Tanura", "lat": 26.64, "lon": 50.16, "radius_deg": 0.15},
        {"name": "Juaymah", "lat": 26.82, "lon": 50.06, "radius_deg": 0.15},
    ],
    "Iraq": [
        {"name": "Al Basrah (ABOT)", "lat": 29.68, "lon": 48.81, "radius_deg": 0.15},
    ],
    "UAE": [
        {"name": "Jebel Ali", "lat": 25.01, "lon": 55.06, "radius_deg": 0.15},
        {"name": "Das Island", "lat": 25.15, "lon": 52.87, "radius_deg": 0.10},
        {"name": "Fujairah", "lat": 25.12, "lon": 56.33, "radius_deg": 0.15},
    ],
    "Kuwait": [
        {"name": "Mina Al Ahmadi", "lat": 29.06, "lon": 48.16, "radius_deg": 0.15},
    ],
    "Iran": [
        {"name": "Kharg Island", "lat": 29.25, "lon": 50.31, "radius_deg": 0.15},
        {"name": "Bandar Abbas", "lat": 27.18, "lon": 56.28, "radius_deg": 0.15},
    ],
    "Qatar": [
        {"name": "Ras Laffan", "lat": 25.93, "lon": 51.55, "radius_deg": 0.15},
    ],
}

# Destination field keywords that hint at the loading origin
# (for outbound vessels, destination = discharge port, but sometimes
# AIS destination is set to the loading port they just left)
ORIGIN_KEYWORDS = {
    "Saudi Arabia": ["RAS TANURA", "JUAYMAH", "YANBU", "SAUDI", "SA"],
    "Iraq": ["BASRAH", "BASRA", "ABOT", "IRAQ", "KHOR AL AMAYA"],
    "UAE": ["JEBEL ALI", "DAS ISLAND", "FUJAIRAH", "RUWAIS", "ABU DHABI"],
    "Kuwait": ["AHMADI", "MINA AL", "KUWAIT", "KW"],
    "Iran": ["KHARG", "BANDAR ABBAS", "SOROUSH", "IRAN", "IR"],
    "Qatar": ["RAS LAFFAN", "QATAR", "QA"],
}


def seed_quotas():
    """Seed the database with current OPEC+ targets."""
    with SessionLocal() as db:
        try:
            for country, data in QUOTAS_2026.items():
                exists = db.query(OPECQuota).filter(OPECQuota.country == country).first()
                if exists:
                    exists.quota_mbpd = data["quota"]
                    exists.is_exempt = data["exempt"]
                else:
                    db.add(OPECQuota(
                        country=country,
                        quota_mbpd=data["quota"],
                        is_exempt=data["exempt"],
                    ))
            db.commit()
            logger.info("OPEC+ quotas seeded.")
        except Exception as e:
            db.rollback()
            logger.error("Error seeding quotas: %s", e)


def _infer_origin_from_destination(destination: str | None) -> str | None:
    """Try to match the AIS destination field to a known origin country."""
    if not destination:
        return None
    dest_upper = destination.upper().strip()
    for country, keywords in ORIGIN_KEYWORDS.items():
        for kw in keywords:
            if kw in dest_upper:
                return country
    return None


async def calculate_compliance() -> list[ComplianceRecord]:
    """Compare observed export flow for last 7 days against quotas.

    Since most tankers fly flags of convenience, we infer origin from:
    1. AIS destination field (sometimes set to loading port)
    2. For mock data, we distribute proportionally based on EIA baselines

    This is an approximation — real trading desks use Kpler/Vortexa
    for cargo-level attribution.
    """
    with SessionLocal() as db:
        try:
            quotas = db.query(OPECQuota).all()
            quota_map = {q.country: q for q in quotas}

            cutoff = datetime.now(timezone.utc) - timedelta(days=7)

            # Get unique outbound loaded tankers in last 7 days
            all_transits = (
                db.query(VesselTransit)
                .filter(VesselTransit.observed_at >= cutoff)
                .filter(VesselTransit.direction == "outbound")
                .filter(VesselTransit.is_loaded == True)
                .order_by(VesselTransit.observed_at.desc())
                .all()
            )

            # Deduplicate by MMSI
            unique = {}
            for t in all_transits:
                if t.mmsi not in unique:
                    unique[t.mmsi] = t

            # Attribute barrels to countries
            country_barrels: dict[str, float] = {c: 0.0 for c in quota_map}
            unattributed = 0.0

            for t in unique.values():
                barrels = t.estimated_barrels or 0
                origin = _infer_origin_from_destination(t.destination)
                if origin and origin in country_barrels:
                    country_barrels[origin] += barrels
                else:
                    unattributed += barrels

            # Distribute unattributed barrels proportionally by EIA baseline share
            eia_shares = {
                "Saudi Arabia": 0.31, "Iraq": 0.165, "UAE": 0.145,
                "Kuwait": 0.085, "Iran": 0.075, "Qatar": 0.22,
            }
            for country in country_barrels:
                share = eia_shares.get(country, 0)
                country_barrels[country] += unattributed * share

            results = []
            for country, q in quota_map.items():
                total_barrels = country_barrels.get(country, 0)
                obs_mbpd = (total_barrels / 7.0) / 1_000_000

                delta = obs_mbpd - q.quota_mbpd if not q.is_exempt else 0.0
                comp_pct = (obs_mbpd / q.quota_mbpd * 100) if q.quota_mbpd > 0 else 100.0

                results.append(ComplianceRecord(
                    country=country,
                    quota_mbpd=q.quota_mbpd,
                    observed_mbpd=round(obs_mbpd, 3),
                    delta=round(delta, 3),
                    compliance_pct=round(comp_pct, 1),
                    is_exempt=q.is_exempt,
                ))

            return results
        except Exception as e:
            logger.error("Error calculating compliance: %s", e)
            return []
