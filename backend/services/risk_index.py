"""Hormuz Risk Index — transparent composite 0-100 score (higher = more risk/disruption)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Component weights — must sum to 1.0
_WEIGHTS = {
    "strait_flow":   0.30,  # flow vs EIA baseline
    "weather":       0.15,  # Shamal wind severity
    "dark_vessels":  0.20,  # AIS-dark tanker count
    "sts_events":    0.10,  # ship-to-ship transfer count
    "insurance":     0.15,  # war-risk premium multiplier
    "disruptions":   0.10,  # recent disruption severity / recency
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


async def compute_risk_index() -> dict:
    """Return a transparent 0-100 Hormuz Risk Index.

    Higher score = more risk/disruption.  Each component returns a 0-100
    sub-score; the weighted sum forms the overall score.
    """
    components: list[dict] = []
    total_score = 0.0

    # ── 1. Strait flow vs EIA baseline (30%) ────────────────────────────────
    flow_score = 0.0
    flow_detail = "No flow data available"
    try:
        from .eia import fetch_hormuz_flow
        from ..database import SessionLocal
        from ..models import VesselTransit
        from sqlalchemy import select, func

        baseline_data = await fetch_hormuz_flow()
        baseline = float(baseline_data.get("baseline_mbpd") or 20.0)

        cutoff_24h = datetime.utcnow() - timedelta(hours=24)
        with SessionLocal() as db:
            latest_subq = (
                select(
                    VesselTransit.mmsi,
                    func.max(VesselTransit.observed_at).label("latest_time"),
                )
                .where(VesselTransit.observed_at >= cutoff_24h)
                .where(VesselTransit.direction == "outbound")
                .where(VesselTransit.is_loaded == True)
                .group_by(VesselTransit.mmsi)
                .subquery()
            )
            obs_barrels = db.execute(
                select(func.coalesce(func.sum(VesselTransit.estimated_barrels), 0))
                .join(
                    latest_subq,
                    (VesselTransit.mmsi == latest_subq.c.mmsi)
                    & (VesselTransit.observed_at == latest_subq.c.latest_time),
                )
            ).scalar() or 0.0

        current_flow = obs_barrels / 1_000_000  # convert to mbpd
        if baseline > 0:
            flow_ratio = current_flow / baseline
            # 100% of baseline → risk 0; 0% flow → risk 100
            # Risk rises steeply below 85% of baseline
            if flow_ratio >= 0.85:
                flow_score = 0.0
            elif flow_ratio >= 0.60:
                flow_score = _clamp((0.85 - flow_ratio) / 0.25 * 60)
            else:
                flow_score = _clamp(60 + (0.60 - flow_ratio) / 0.60 * 40)
            flow_detail = (
                f"{current_flow:.2f} mbpd vs {baseline:.1f} mbpd baseline "
                f"({flow_ratio * 100:.0f}%)"
            )
        else:
            flow_score = 0.0
            flow_detail = "Baseline unavailable"
    except Exception as exc:
        logger.warning("risk_index flow component failed: %s", exc)
        flow_score = 0.0
        flow_detail = f"Error: {exc}"

    components.append({
        "name": "Strait Flow",
        "score_0_100": round(flow_score, 1),
        "weight": _WEIGHTS["strait_flow"],
        "detail": flow_detail,
    })
    total_score += flow_score * _WEIGHTS["strait_flow"]

    # ── 2. Shamal wind (15%) ─────────────────────────────────────────────────
    weather_score = 0.0
    weather_detail = "No weather data available"
    try:
        from ..database import SessionLocal
        from ..models import TerminalWeather

        with SessionLocal() as db:
            terminals = db.query(TerminalWeather).all()

        if terminals:
            max_wind = max((t.wind_speed_knots or 0.0) for t in terminals)
            alert_count = sum(1 for t in terminals if t.is_alert_active)
            # <22kn = 0 risk; 22kn = moderate; >=30kn (shutdown) = 100
            if max_wind < 22:
                weather_score = 0.0
            elif max_wind < 30:
                weather_score = _clamp((max_wind - 22) / 8 * 60)
            else:
                weather_score = _clamp(60 + (max_wind - 30) / 20 * 40)
            weather_detail = (
                f"Max wind {max_wind:.1f} kn across {len(terminals)} terminals"
                + (f"; {alert_count} alert(s) active" if alert_count else "")
            )
    except Exception as exc:
        logger.warning("risk_index weather component failed: %s", exc)
        weather_score = 0.0
        weather_detail = f"Error: {exc}"

    components.append({
        "name": "Shamal Wind",
        "score_0_100": round(weather_score, 1),
        "weight": _WEIGHTS["weather"],
        "detail": weather_detail,
    })
    total_score += weather_score * _WEIGHTS["weather"]

    # ── 3. Dark vessels (20%) ────────────────────────────────────────────────
    dark_score = 0.0
    dark_detail = "No dark vessel data"
    try:
        from ..database import SessionLocal
        from ..models import DarkVessel
        from sqlalchemy import func

        with SessionLocal() as db:
            dark_count = (
                db.query(func.count(DarkVessel.id))
                .filter(DarkVessel.is_active == True)
                .scalar()
                or 0
            )
        # 0 = 0 risk; each vessel adds 15 points, cap at 100
        dark_score = _clamp(dark_count * 15.0)
        dark_detail = f"{dark_count} active dark vessel(s) detected"
    except Exception as exc:
        logger.warning("risk_index dark_vessels component failed: %s", exc)
        dark_detail = f"Error: {exc}"

    components.append({
        "name": "Dark Vessels",
        "score_0_100": round(dark_score, 1),
        "weight": _WEIGHTS["dark_vessels"],
        "detail": dark_detail,
    })
    total_score += dark_score * _WEIGHTS["dark_vessels"]

    # ── 4. STS events (10%) ──────────────────────────────────────────────────
    sts_score = 0.0
    sts_detail = "No STS data"
    try:
        from ..database import SessionLocal
        from ..models import STSEvent
        from sqlalchemy import func

        with SessionLocal() as db:
            sts_count = (
                db.query(func.count(STSEvent.id))
                .filter(STSEvent.is_active == True)
                .scalar()
                or 0
            )
        sts_score = _clamp(sts_count * 20.0)
        sts_detail = f"{sts_count} active STS transfer event(s)"
    except Exception as exc:
        logger.warning("risk_index sts component failed: %s", exc)
        sts_detail = f"Error: {exc}"

    components.append({
        "name": "STS Events",
        "score_0_100": round(sts_score, 1),
        "weight": _WEIGHTS["sts_events"],
        "detail": sts_detail,
    })
    total_score += sts_score * _WEIGHTS["sts_events"]

    # ── 5. Insurance / war-risk multiplier (15%) ─────────────────────────────
    ins_score = 0.0
    ins_detail = "No insurance data"
    try:
        from .insurance import get_insurance_status

        ins = await get_insurance_status()
        multiplier = float(ins.get("multiplier") or 1.0)
        premium_bps = float(ins.get("premium_bps") or 15.0)
        baseline_bps = float(ins.get("baseline_bps") or 15.0)
        # multiplier 1x = 0 risk; 7x+ = 100 risk (linear scale)
        ins_score = _clamp((multiplier - 1.0) / 6.0 * 100)
        ins_detail = (
            f"Premium {premium_bps:.0f} bps ({multiplier:.1f}x baseline); "
            f"JWC: {ins.get('jwc_status', 'unknown')}"
        )
    except Exception as exc:
        logger.warning("risk_index insurance component failed: %s", exc)
        ins_detail = f"Error: {exc}"

    components.append({
        "name": "War Risk Insurance",
        "score_0_100": round(ins_score, 1),
        "weight": _WEIGHTS["insurance"],
        "detail": ins_detail,
    })
    total_score += ins_score * _WEIGHTS["insurance"]

    # ── 6. Recent disruptions weighted by recency + impact (10%) ─────────────
    dis_score = 0.0
    dis_detail = "No recent disruption events"
    try:
        from ..database import SessionLocal
        from ..models import DisruptionEvent

        cutoff = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        with SessionLocal() as db:
            events = (
                db.query(DisruptionEvent)
                .filter(DisruptionEvent.date >= cutoff)
                .all()
            )

        if events:
            today = datetime.utcnow().date()
            severity_map = {"critical": 1.0, "high": 0.7, "medium": 0.4, "low": 0.15}
            weighted_sum = 0.0
            for ev in events:
                try:
                    ev_date = datetime.strptime(ev.date, "%Y-%m-%d").date()
                    days_ago = max(0, (today - ev_date).days)
                except Exception:
                    days_ago = 15
                recency_weight = max(0.1, 1.0 - days_ago / 30.0)
                sev = severity_map.get(str(ev.severity).lower(), 0.2)
                impact = abs(float(ev.brent_impact_pct or 0)) / 15.0  # 15% impact = 1.0
                combined = (sev * 0.5 + recency_weight * 0.3 + min(impact, 1.0) * 0.2)
                weighted_sum = max(weighted_sum, combined)

            dis_score = _clamp(weighted_sum * 100)
            dis_detail = f"{len(events)} disruption event(s) in last 30 days"
    except Exception as exc:
        logger.warning("risk_index disruptions component failed: %s", exc)
        dis_detail = f"Error: {exc}"

    components.append({
        "name": "Disruption Events",
        "score_0_100": round(dis_score, 1),
        "weight": _WEIGHTS["disruptions"],
        "detail": dis_detail,
    })
    total_score += dis_score * _WEIGHTS["disruptions"]

    # ── Final score + level label ────────────────────────────────────────────
    score = int(round(_clamp(total_score)))
    if score < 20:
        level = "low"
    elif score < 45:
        level = "elevated"
    elif score < 70:
        level = "high"
    else:
        level = "severe"

    top_driver = max(components, key=lambda c: c["score_0_100"] * c["weight"])
    if score < 20:
        summary = "Strait of Hormuz operating within normal parameters."
    else:
        summary = f"Risk elevated — primary driver: {top_driver['name']} ({top_driver['detail']})"

    return {
        "score": score,
        "level": level,
        "summary": summary,
        "components": components,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
