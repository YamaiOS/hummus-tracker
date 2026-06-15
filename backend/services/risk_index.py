"""Hormuz Risk Index v2 — transparent composite 0-100 (higher = more risk).

Aggregation: 0.65·weighted-arithmetic-mean + 0.35·worst-component over AVAILABLE
components only (missing inputs are dropped; weights renormalized to those present).
This compounds multiple stresses while ensuring one severe dimension (e.g. an active
attack surge) is never masked by a calm one (e.g. benign seas). Pure geometric mean
was rejected — it lets a near-zero component crush the index and understate real risk.
"""
from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _aggregate(items: list[tuple[float, float]]) -> float:
    """Risk-appropriate weighted aggregation: items = [(score, weight), ...].

    Blends the weighted arithmetic mean (compounding effect of multiple stresses)
    with the single worst component (so one severe dimension — e.g. an active
    attack surge — is NOT masked by a calm dimension like benign seas). A pure
    geometric mean was rejected here: it lets a near-zero component crush the
    index even when other dimensions signal crisis, which understates risk.

        score = 0.65 * weighted_mean + 0.35 * max_component
    """
    if not items:
        return 0.0
    total_w = sum(w for _, w in items)
    if total_w <= 0:
        return 0.0
    weighted_mean = sum(s * w for s, w in items) / total_w
    worst = max(s for s, _ in items)
    return 0.65 * weighted_mean + 0.35 * worst


async def compute_risk_index() -> dict:
    """Return a transparent 0-100 Hormuz Risk Index (v2).

    Each component is scored 0-100 (higher = more risk).  Missing inputs are
    dropped from the aggregation (not treated as 0).  Weights are renormalized
    to available components only.
    """

    # ── Gather all inputs concurrently ──────────────────────────────────────
    async def _safe(coro):
        try:
            return await coro
        except Exception as exc:
            logger.warning("risk_index: upstream gather failed: %s", exc)
            return None

    (
        chokepoint_data,
        volatility_data,
        news_data,
        seismic_data,
        insurance_data,
        gpr_data,
    ) = await asyncio.gather(
        _safe(_get_chokepoint()),
        _safe(_get_volatility()),
        _safe(_get_news()),
        _safe(_get_seismic()),
        _safe(_get_insurance()),
        _safe(_get_gpr()),
    )

    components: list[dict] = []

    # ── 1. Flow disruption (weight .22, tier LIVE) ───────────────────────────
    # Source: IMF PortWatch via get_chokepoint_comparison -> Hormuz pct_of_baseline
    flow_result = _score_flow(chokepoint_data)
    if flow_result is not None:
        s, detail = flow_result
        components.append({
            "name": "Strait Flow",
            "score_0_100": round(s, 1),
            "weight": 0.22,
            "tier": "LIVE",
            "source": "IMF PortWatch",
            "detail": detail,
        })

    # ── 2. Oil volatility (weight .18, tier LIVE) ────────────────────────────
    # Source: FRED OVX
    vol_result = _score_volatility(volatility_data)
    if vol_result is not None:
        s, detail = vol_result
        components.append({
            "name": "Oil Volatility",
            "score_0_100": round(s, 1),
            "weight": 0.18,
            "tier": "LIVE",
            "source": "FRED OVX",
            "detail": detail,
        })

    # ── 3. News pressure (weight .18, tier LIVE) ─────────────────────────────
    # Source: Google News
    news_result = _score_news(news_data)
    if news_result is not None:
        s, detail = news_result
        components.append({
            "name": "News Pressure",
            "score_0_100": round(s, 1),
            "weight": 0.18,
            "tier": "LIVE",
            "source": "Google News",
            "detail": detail,
        })

    # ── 4. Weather / Shamal (weight .12, tier LIVE) ──────────────────────────
    # Source: Open-Meteo
    weather_result = _score_weather()
    if weather_result is not None:
        s, detail = weather_result
        components.append({
            "name": "Shamal Wind",
            "score_0_100": round(s, 1),
            "weight": 0.12,
            "tier": "LIVE",
            "source": "Open-Meteo",
            "detail": detail,
        })

    # ── 5. Insurance / war-risk (weight .12, tier EST) ───────────────────────
    # Source: seeded / JWC-proxy
    ins_result = _score_insurance(insurance_data)
    if ins_result is not None:
        s, detail = ins_result
        components.append({
            "name": "War Risk Insurance",
            "score_0_100": round(s, 1),
            "weight": 0.12,
            "tier": "EST",
            "source": "seeded/JWC-proxy",
            "detail": detail,
        })

    # ── Geopolitical risk: Caldara-Iacoviello GPR (weight .10, tier LIVE) ─────
    # Source: GPR index (peer-reviewed, backtested) — a structural geopolitical
    # signal complementing the faster-moving News Pressure component.
    gpr_result = _score_gpr(gpr_data)
    if gpr_result is not None:
        s, detail = gpr_result
        components.append({
            "name": "Geopolitical (GPR)",
            "score_0_100": round(s, 1),
            "weight": 0.10,
            "tier": "LIVE",
            "source": "Caldara-Iacoviello GPR",
            "detail": detail,
        })

    # ── 6. Seismic (weight .06, tier LIVE) ───────────────────────────────────
    # Source: USGS
    seis_result = _score_seismic(seismic_data)
    if seis_result is not None:
        s, detail = seis_result
        components.append({
            "name": "Seismic Activity",
            "score_0_100": round(s, 1),
            "weight": 0.06,
            "tier": "LIVE",
            "source": "USGS FDSN",
            "detail": detail,
        })

    # ── 7. Anomaly vessels: dark + STS (weight .12, tier SIM) ────────────────
    # Source: simulated AIS
    anm_result = _score_anomaly_vessels()
    if anm_result is not None:
        s, detail = anm_result
        components.append({
            "name": "Anomaly Vessels",
            "score_0_100": round(s, 1),
            "weight": 0.12,
            "tier": "SIM",
            "source": "simulated AIS",
            "detail": detail,
        })

    # ── Aggregate (0.65·weighted-mean + 0.35·worst; renormalized) ───
    agg_input = [(c["score_0_100"], c["weight"]) for c in components]
    raw = _aggregate(agg_input)
    score = int(round(_clamp(raw)))

    if score < 25:
        level = "low"
    elif score < 50:
        level = "elevated"
    elif score < 75:
        level = "high"
    else:
        level = "severe"

    if not components:
        summary = "Risk index unavailable — all data sources failed."
    elif score < 25:
        summary = "Strait of Hormuz operating within normal parameters."
    else:
        top = max(components, key=lambda c: c["score_0_100"] * c["weight"])
        summary = f"Risk {level} — primary driver: {top['name']} ({top['detail']})"

    return {
        "score": score,
        "level": level,
        "summary": summary,
        "components": components,
        "methodology": (
            "0.65·weighted-mean + 0.35·worst-component over available components; "
            "weights renormalized; higher=more risk"
        ),
        "version": 2,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Per-component scoring helpers ────────────────────────────────────────────
# Each returns (score_0_100, detail_str) or None if no usable data.


def _score_flow(chokepoint_data: Optional[dict]) -> Optional[tuple[float, str]]:
    """Score = clamp(100 - pct_of_baseline, 0, 100) for Hormuz."""
    try:
        if not chokepoint_data:
            return None
        chokepoints = chokepoint_data.get("chokepoints", [])
        hormuz = next(
            (c for c in chokepoints if "hormuz" in (c.get("name") or "").lower()),
            None,
        )
        if hormuz is None:
            return None
        pct = hormuz.get("pct_of_baseline")
        if pct is None:
            return None
        score = _clamp(100.0 - float(pct))
        latest = hormuz.get("latest_total")
        date = hormuz.get("date") or ""
        detail = (
            f"{pct:.1f}% of 30-day baseline"
            + (f" ({latest} transits, {date})" if latest is not None else "")
        )
        return score, detail
    except Exception as exc:
        logger.warning("_score_flow failed: %s", exc)
        return None


def _score_volatility(vol: Optional[dict]) -> Optional[tuple[float, str]]:
    """Map OVX zscore or regime to 0-100."""
    try:
        if not vol:
            return None
        zscore = vol.get("zscore")
        regime = vol.get("regime", "unknown")
        ovx = vol.get("ovx")

        if zscore is not None:
            score = _clamp(50.0 + 25.0 * float(zscore))
        elif regime == "low":
            score = 30.0
        elif regime == "elevated":
            score = 60.0
        elif regime == "high":
            score = 85.0
        else:
            return None

        ovx_str = f"OVX {ovx:.1f}" if ovx is not None else "OVX n/a"
        z_str = f", z={zscore:.2f}" if zscore is not None else ""
        detail = f"{ovx_str}{z_str}, regime={regime}"
        return score, detail
    except Exception as exc:
        logger.warning("_score_volatility failed: %s", exc)
        return None


def _score_news(articles: Optional[list]) -> Optional[tuple[float, str]]:
    """Weight 48h articles by topic; normalize to 0-100 (cap at raw=20)."""
    try:
        if articles is None:
            return None

        TOPIC_WEIGHT = {
            "attack": 3.0,
            "sanctions": 2.0,
            "geopolitics": 1.5,
            "shipping": 1.0,
            "energy": 0.5,
        }
        CAP = 20.0  # raw weighted sum at which score = 100

        raw = 0.0
        recent_count = 0
        for a in articles:
            if float(a.get("age_hours", 999)) <= 48:
                topic = a.get("topic", "energy")
                raw += TOPIC_WEIGHT.get(topic, 0.5)
                recent_count += 1

        if recent_count == 0 and not articles:
            return None  # no data at all

        score = _clamp(raw / CAP * 100.0)
        detail = f"{recent_count} articles in 48h (weighted pressure {raw:.1f})"
        return score, detail
    except Exception as exc:
        logger.warning("_score_news failed: %s", exc)
        return None


def _score_weather() -> Optional[tuple[float, str]]:
    """Read TerminalWeather from DB; map max wind to 0-100."""
    try:
        from ..database import SessionLocal
        from ..models import TerminalWeather

        with SessionLocal() as db:
            terminals = db.query(TerminalWeather).all()

        if not terminals:
            return None

        max_wind = max((t.wind_speed_knots or 0.0) for t in terminals)
        alert_count = sum(1 for t in terminals if t.is_alert_active)

        if max_wind < 22:
            score = 0.0
        elif max_wind < 30:
            score = _clamp((max_wind - 22) / 8 * 60)
        else:
            score = _clamp(60 + (max_wind - 30) / 20 * 40)

        detail = (
            f"Max wind {max_wind:.1f} kn across {len(terminals)} terminals"
            + (f"; {alert_count} alert(s)" if alert_count else "")
        )
        return score, detail
    except Exception as exc:
        logger.warning("_score_weather failed: %s", exc)
        return None


def _score_insurance(ins: Optional[dict]) -> Optional[tuple[float, str]]:
    """Map insurance multiplier (1x-7x) to 0-100."""
    try:
        if not ins:
            return None
        multiplier = float(ins.get("multiplier") or 1.0)
        premium_bps = float(ins.get("premium_bps") or 15.0)
        score = _clamp((multiplier - 1.0) / 6.0 * 100)
        detail = (
            f"Premium {premium_bps:.0f} bps ({multiplier:.1f}x baseline); "
            f"JWC: {ins.get('jwc_status', 'unknown')}"
        )
        return score, detail
    except Exception as exc:
        logger.warning("_score_insurance failed: %s", exc)
        return None


def _score_seismic(seis: Optional[dict]) -> Optional[tuple[float, str]]:
    """Map max_mag to 0-100: <4=0, 4-5=30, 5-6=60, 6+=85."""
    try:
        if not seis:
            return None
        max_mag = seis.get("max_mag")
        count = seis.get("count", 0)
        window = seis.get("window_days", 14)

        if max_mag is None:
            score = 0.0
            detail = f"No M≥4 events in last {window}d"
        else:
            mag = float(max_mag)
            if mag < 4.0:
                score = 0.0
            elif mag < 5.0:
                score = 30.0
            elif mag < 6.0:
                score = 60.0
            else:
                score = 85.0
            detail = f"M{mag:.1f} max, {count} event(s) in last {window}d"

        return score, detail
    except Exception as exc:
        logger.warning("_score_seismic failed: %s", exc)
        return None


def _score_anomaly_vessels() -> Optional[tuple[float, str]]:
    """Dark + STS counts from DB; each dark vessel +15, each STS +20, cap 100."""
    try:
        from ..database import SessionLocal
        from ..models import DarkVessel, STSEvent
        from sqlalchemy import func

        with SessionLocal() as db:
            dark_count = (
                db.query(func.count(DarkVessel.id))
                .filter(DarkVessel.is_active == True)
                .scalar()
                or 0
            )
            sts_count = (
                db.query(func.count(STSEvent.id))
                .filter(STSEvent.is_active == True)
                .scalar()
                or 0
            )

        score = _clamp(dark_count * 15.0 + sts_count * 20.0)
        detail = f"{dark_count} dark vessel(s), {sts_count} STS event(s) (simulated)"
        return score, detail
    except Exception as exc:
        logger.warning("_score_anomaly_vessels failed: %s", exc)
        return None


# ── Thin async wrappers for concurrent gather ────────────────────────────────

async def _get_chokepoint() -> dict:
    from .chokepoints import get_chokepoint_comparison
    return await get_chokepoint_comparison()


async def _get_volatility() -> dict:
    from .volatility import get_oil_volatility
    return await get_oil_volatility()


async def _get_news() -> list:
    from .news import fetch_strait_news
    return await fetch_strait_news()


async def _get_seismic() -> dict:
    from .seismic import get_regional_seismicity
    return await get_regional_seismicity()


async def _get_gpr() -> dict:
    from .gpr import get_gpr
    return await get_gpr()


def _score_gpr(gpr_data: Optional[dict]) -> Optional[tuple[float, str]]:
    """Score from the GPR index normalized_0_100 field."""
    try:
        if not gpr_data:
            return None
        norm = gpr_data.get("normalized_0_100")
        if norm is None:
            return None
        latest = gpr_data.get("latest") or {}
        gpr_val = latest.get("gpr")
        regime = gpr_data.get("regime", "")
        detail = f"GPR {round(gpr_val)} ({regime})" if gpr_val else f"GPR risk {round(float(norm))}/100"
        return _clamp(float(norm)), detail
    except Exception as exc:
        logger.warning("_score_gpr failed: %s", exc)
        return None


async def _get_insurance() -> dict:
    from .insurance import get_insurance_status
    return await get_insurance_status()
