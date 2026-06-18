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

# ── Freshness / staleness thresholds (cadence-aware) ─────────────────────────
# The Hormuz Risk Index blends inputs of very different cadence into one hourly
# score, so each component must be honest about its data age. A monthly index
# (GPR) is expected to be weeks old; a daily series stale after a few missed
# days; truly real-time inputs are never "stale".
_GPR_STALE_HOURS = 45 * 24.0      # GPR is monthly → stale only after ~45 days
_DAILY_STALE_HOURS = 60.0         # daily-cadence series → stale after ~2.5 days
# Component names that are real-time (recomputed every fetch) → never stale.
_REALTIME_COMPONENTS = frozenset({
    "News Pressure",
    "Shamal Wind",
    "Anomaly Vessels",
    "War Risk Insurance",
})


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _parse_dt(value: object) -> Optional[datetime]:
    """Best-effort parse of a date/datetime into a tz-aware UTC datetime.

    Accepts ISO strings ("2026-06-01", "2026-06-01T12:00:00+00:00",
    trailing "Z"), date-only strings, and datetime objects. Returns None on
    anything unparseable — never raises.
    """
    if value is None or value == "":
        return None
    try:
        if isinstance(value, datetime):
            dt = value
        else:
            s = str(value).strip()
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            dt = datetime.fromisoformat(s)
    except Exception:
        # Fallback: try a plain date prefix (YYYY-MM-DD)
        try:
            dt = datetime.fromisoformat(str(value).strip()[:10])
        except Exception:
            return None
    # Normalize to tz-aware UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _age_hours(as_of: Optional[datetime], now: datetime) -> Optional[float]:
    """Hours between as_of and now; None if as_of unknown. Never negative."""
    if as_of is None:
        return None
    try:
        delta = (now - as_of).total_seconds() / 3600.0
        return round(max(0.0, delta), 2)
    except Exception:
        return None


def _is_stale(name: str, age_hours: Optional[float]) -> bool:
    """Cadence-aware staleness. Real-time components are never stale; unknown
    age is treated as not-stale (we don't penalize on missing metadata)."""
    if name in _REALTIME_COMPONENTS:
        return False
    if age_hours is None:
        return False
    if name == "Geopolitical (GPR)":
        return age_hours > _GPR_STALE_HOURS
    # Strait Flow, Oil Volatility, Seismic Activity → daily cadence
    return age_hours > _DAILY_STALE_HOURS


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

    now = datetime.now(timezone.utc)
    components: list[dict] = []

    def _add(name: str, base: dict, as_of_raw: Optional[str]) -> None:
        """Attach cadence-aware freshness fields to a component and append it.

        Fully defensive: an unparseable/missing as_of yields as_of=None and
        age_hours=None (the component is simply not flagged stale)."""
        as_of_dt = _parse_dt(as_of_raw)
        age = _age_hours(as_of_dt, now)
        base["as_of"] = as_of_dt.isoformat() if as_of_dt is not None else None
        base["age_hours"] = age
        base["stale"] = _is_stale(name, age)
        components.append(base)

    # ── 1. Flow disruption (weight .22, tier LIVE) ───────────────────────────
    # Source: IMF PortWatch via get_chokepoint_comparison -> Hormuz pct_of_baseline
    flow_result = _score_flow(chokepoint_data)
    if flow_result is not None:
        s, detail, as_of = flow_result
        _add("Strait Flow", {
            "name": "Strait Flow",
            "score_0_100": round(s, 1),
            "weight": 0.22,
            "tier": "LIVE",
            "source": "IMF PortWatch",
            "detail": detail,
        }, as_of)

    # ── 2. Oil volatility (weight .18, tier LIVE) ────────────────────────────
    # Source: FRED OVX
    vol_result = _score_volatility(volatility_data)
    if vol_result is not None:
        s, detail, as_of = vol_result
        _add("Oil Volatility", {
            "name": "Oil Volatility",
            "score_0_100": round(s, 1),
            "weight": 0.18,
            "tier": "LIVE",
            "source": "FRED OVX",
            "detail": detail,
        }, as_of)

    # ── 3. News pressure (weight .18, tier LIVE) ─────────────────────────────
    # Source: Google News
    news_result = _score_news(news_data, now)
    if news_result is not None:
        s, detail, as_of = news_result
        _add("News Pressure", {
            "name": "News Pressure",
            "score_0_100": round(s, 1),
            "weight": 0.18,
            "tier": "LIVE",
            "source": "Google News",
            "detail": detail,
        }, as_of)

    # ── 4. Weather / Shamal (weight .12, tier LIVE) ──────────────────────────
    # Source: Open-Meteo
    weather_result = _score_weather()
    if weather_result is not None:
        s, detail, as_of = weather_result
        _add("Shamal Wind", {
            "name": "Shamal Wind",
            "score_0_100": round(s, 1),
            "weight": 0.12,
            "tier": "LIVE",
            "source": "Open-Meteo",
            "detail": detail,
        }, as_of)

    # ── 5. Insurance / war-risk (weight .12, tier EST) ───────────────────────
    # Source: seeded / JWC-proxy
    ins_result = _score_insurance(insurance_data)
    if ins_result is not None:
        s, detail, as_of = ins_result
        _add("War Risk Insurance", {
            "name": "War Risk Insurance",
            "score_0_100": round(s, 1),
            "weight": 0.12,
            "tier": "EST",
            "source": "seeded/JWC-proxy",
            "detail": detail,
        }, as_of)

    # ── Geopolitical risk: Caldara-Iacoviello GPR (weight .10, tier LIVE) ─────
    # Source: GPR index (peer-reviewed, backtested) — a structural geopolitical
    # signal complementing the faster-moving News Pressure component.
    gpr_result = _score_gpr(gpr_data)
    if gpr_result is not None:
        s, detail, as_of = gpr_result
        _add("Geopolitical (GPR)", {
            "name": "Geopolitical (GPR)",
            "score_0_100": round(s, 1),
            "weight": 0.10,
            "tier": "LIVE",
            "source": "Caldara-Iacoviello GPR",
            "detail": detail,
        }, as_of)

    # ── 6. Seismic (weight .06, tier LIVE) ───────────────────────────────────
    # Source: USGS
    seis_result = _score_seismic(seismic_data)
    if seis_result is not None:
        s, detail, as_of = seis_result
        _add("Seismic Activity", {
            "name": "Seismic Activity",
            "score_0_100": round(s, 1),
            "weight": 0.06,
            "tier": "LIVE",
            "source": "USGS FDSN",
            "detail": detail,
        }, as_of)

    # ── 7. Anomaly vessels: dark + STS (weight .12, tier SIM) ────────────────
    # Source: simulated AIS
    anm_result = _score_anomaly_vessels()
    if anm_result is not None:
        s, detail, as_of = anm_result
        _add("Anomaly Vessels", {
            "name": "Anomaly Vessels",
            "score_0_100": round(s, 1),
            "weight": 0.12,
            "tier": "SIM",
            "source": "simulated AIS",
            "detail": detail,
        }, as_of)

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

    # ── Freshness summary — flag when the composite leans on stale inputs ──────
    # Additive transparency only; does NOT influence the score or weights.
    known_ages = [
        c["age_hours"] for c in components if c.get("age_hours") is not None
    ]
    stale_components = [c["name"] for c in components if c.get("stale")]
    max_age = round(max(known_ages), 2) if known_ages else None
    if stale_components:
        fresh_note = (
            f"{len(stale_components)} component(s) leaning on older data: "
            + ", ".join(stale_components)
        )
    elif max_age is not None:
        fresh_note = "All components within their expected freshness windows."
    else:
        fresh_note = "Component data ages unavailable."
    freshness = {
        "max_age_hours": max_age,
        "stale_components": stale_components,
        "note": fresh_note,
    }

    return {
        "score": score,
        "level": level,
        "summary": summary,
        "components": components,
        "freshness": freshness,
        "methodology": (
            "0.65·weighted-mean + 0.35·worst-component over available components; "
            "weights renormalized; higher=more risk"
        ),
        "version": 2,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Per-component scoring helpers ────────────────────────────────────────────
# Each returns (score_0_100, detail_str) or None if no usable data.


def _score_flow(chokepoint_data: Optional[dict]) -> Optional[tuple[float, str, Optional[str]]]:
    """Score = clamp(100 - pct_of_baseline, 0, 100) for Hormuz.

    as_of = the PortWatch transit date that drove the score (daily cadence).
    """
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
        as_of = hormuz.get("date") or None
        return score, detail, as_of
    except Exception as exc:
        logger.warning("_score_flow failed: %s", exc)
        return None


def _score_volatility(vol: Optional[dict]) -> Optional[tuple[float, str, Optional[str]]]:
    """Map OVX zscore or regime to 0-100.

    as_of = ovx_date, the date of the latest OVX close (daily cadence).
    """
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
        as_of = vol.get("ovx_date") or None
        return score, detail, as_of
    except Exception as exc:
        logger.warning("_score_volatility failed: %s", exc)
        return None


def _score_news(
    articles: Optional[list],
    now: Optional[datetime] = None,
) -> Optional[tuple[float, str, Optional[str]]]:
    """Weight 48h articles by topic; normalize to 0-100 (cap at raw=20).

    as_of = timestamp of the freshest recent article (now - min age_hours),
    derived from the article ages so the news component reports how recent its
    underlying signal actually is.
    """
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
        min_age: Optional[float] = None
        for a in articles:
            try:
                age = float(a.get("age_hours", 999))
            except Exception:
                age = 999.0
            if age <= 48:
                topic = a.get("topic", "energy")
                raw += TOPIC_WEIGHT.get(topic, 0.5)
                recent_count += 1
                if min_age is None or age < min_age:
                    min_age = age

        if recent_count == 0 and not articles:
            return None  # no data at all

        score = _clamp(raw / CAP * 100.0)
        detail = f"{recent_count} articles in 48h (weighted pressure {raw:.1f})"

        as_of: Optional[str] = None
        ref = now or datetime.now(timezone.utc)
        if min_age is not None:
            try:
                from datetime import timedelta
                as_of = (ref - timedelta(hours=min_age)).isoformat()
            except Exception:
                as_of = None
        else:
            # No recent articles but the feed itself is live/current.
            as_of = ref.isoformat()
        return score, detail, as_of
    except Exception as exc:
        logger.warning("_score_news failed: %s", exc)
        return None


def _score_weather() -> Optional[tuple[float, str, Optional[str]]]:
    """Read TerminalWeather from DB; map max wind to 0-100.

    as_of = the most recent terminal observation timestamp (best-effort);
    Shamal Wind is a real-time component, so it is never flagged stale.
    """
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

        as_of: Optional[str] = None
        try:
            stamps = [t.updated_at for t in terminals if t.updated_at is not None]
            if stamps:
                as_of = max(stamps).isoformat()
        except Exception:
            as_of = None
        return score, detail, as_of
    except Exception as exc:
        logger.warning("_score_weather failed: %s", exc)
        return None


def _score_insurance(ins: Optional[dict]) -> Optional[tuple[float, str, Optional[str]]]:
    """Map insurance multiplier (1x-7x) to 0-100.

    as_of = the underlying market's updated_at if the source exposes one
    (best-effort; the proxy dict may not carry a date). War Risk Insurance is
    treated as a real-time/standing component, so it is never flagged stale.
    """
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
        # Best-effort: most fields are seeded/standing and carry no date.
        as_of = ins.get("updated_at") or ins.get("date") or None
        return score, detail, as_of
    except Exception as exc:
        logger.warning("_score_insurance failed: %s", exc)
        return None


def _score_seismic(seis: Optional[dict]) -> Optional[tuple[float, str, Optional[str]]]:
    """Map max_mag to 0-100: <4=0, 4-5=30, 5-6=60, 6+=85.

    as_of = the most recent qualifying event time. When there are no events,
    the score reflects a fresh "all-quiet" observation, so we fall back to the
    fetch's updated_at (the window is current, not stale).
    """
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

        as_of: Optional[str] = None
        try:
            events = seis.get("events") or []
            times = [e.get("time") for e in events if e.get("time")]
            if times:
                as_of = max(times)  # ISO strings sort chronologically
        except Exception:
            as_of = None
        if as_of is None:
            # No events drove the score → the observation window is current.
            as_of = seis.get("updated_at") or None
        return score, detail, as_of
    except Exception as exc:
        logger.warning("_score_seismic failed: %s", exc)
        return None


def _score_anomaly_vessels() -> Optional[tuple[float, str, Optional[str]]]:
    """Dark + STS counts from DB; each dark vessel +15, each STS +20, cap 100.

    as_of = the most recent detection timestamp (best-effort); Anomaly Vessels
    is a real-time component, so it is never flagged stale.
    """
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

            as_of: Optional[str] = None
            try:
                latest_dark = (
                    db.query(func.max(DarkVessel.detected_at))
                    .filter(DarkVessel.is_active == True)
                    .scalar()
                )
                latest_sts = (
                    db.query(func.max(STSEvent.detected_at))
                    .filter(STSEvent.is_active == True)
                    .scalar()
                )
                stamps = [s for s in (latest_dark, latest_sts) if s is not None]
                if stamps:
                    as_of = max(stamps).isoformat()
            except Exception:
                as_of = None

        score = _clamp(dark_count * 15.0 + sts_count * 20.0)
        detail = f"{dark_count} dark vessel(s), {sts_count} STS event(s) (simulated)"
        return score, detail, as_of
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


def _score_gpr(gpr_data: Optional[dict]) -> Optional[tuple[float, str, Optional[str]]]:
    """Score from the GPR index normalized_0_100 field.

    as_of = the latest GPR month (monthly cadence — expected to be weeks old).
    """
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
        as_of = latest.get("month") or None
        return _clamp(float(norm)), detail, as_of
    except Exception as exc:
        logger.warning("_score_gpr failed: %s", exc)
        return None


async def _get_insurance() -> dict:
    from .insurance import get_insurance_status
    return await get_insurance_status()
