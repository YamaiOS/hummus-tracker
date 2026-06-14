"""Metric History Service — accumulate key Hormuz metrics each snapshot run."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_MAX_SERIES_ROWS = 365  # cap returned rows at one year


async def record_metric_snapshot() -> None:
    """Gather current values from live sources + risk index, insert ONE row into metric_history."""
    from ..database import SessionLocal
    from ..models import MetricHistory

    ts = datetime.now(timezone.utc).isoformat()

    # Gather each metric defensively
    strait_flow_mbpd: Optional[float] = None
    brent: Optional[float] = None
    wti: Optional[float] = None
    transit_count: Optional[int] = None
    dark_count: Optional[int] = None
    sts_count: Optional[int] = None
    risk_score: Optional[int] = None
    shamal_max_wind: Optional[float] = None

    # 1. Prices (FRED)
    try:
        from .fred import get_latest_prices
        prices = await get_latest_prices()
        brent = prices.get("brent") or prices.get("brent_futures")
        wti = prices.get("wti")
    except Exception as exc:
        logger.warning("history: prices failed: %s", exc)

    # 2. Strait flow (24h AIS estimate)
    try:
        from datetime import timedelta
        from ..models import VesselTransit
        from ..database import SessionLocal as _SL
        from sqlalchemy import select, func

        cutoff_24h = datetime.utcnow() - timedelta(hours=24)
        with _SL() as db:
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
        strait_flow_mbpd = obs_barrels / 1_000_000
    except Exception as exc:
        logger.warning("history: strait_flow failed: %s", exc)

    # 3. IMF transit count
    try:
        from .imf_portwatch import fetch_hormuz_summary
        imf = await fetch_hormuz_summary()
        transit_count = imf.get("transit_count_7d") or imf.get("daily_transits")
        if transit_count is not None:
            transit_count = int(transit_count)
    except Exception as exc:
        logger.warning("history: imf transit_count failed: %s", exc)

    # 4. Dark vessel count
    try:
        from ..models import DarkVessel
        from sqlalchemy import func as _func
        from ..database import SessionLocal as _SL2

        with _SL2() as db:
            dark_count = (
                db.query(_func.count(DarkVessel.id))
                .filter(DarkVessel.is_active == True)
                .scalar()
                or 0
            )
    except Exception as exc:
        logger.warning("history: dark_count failed: %s", exc)

    # 5. STS count
    try:
        from ..models import STSEvent
        from sqlalchemy import func as _func2
        from ..database import SessionLocal as _SL3

        with _SL3() as db:
            sts_count = (
                db.query(_func2.count(STSEvent.id))
                .filter(STSEvent.is_active == True)
                .scalar()
                or 0
            )
    except Exception as exc:
        logger.warning("history: sts_count failed: %s", exc)

    # 6. Risk score
    try:
        from .risk_index import compute_risk_index
        idx = await compute_risk_index()
        risk_score = idx.get("score")
    except Exception as exc:
        logger.warning("history: risk_score failed: %s", exc)

    # 7. Shamal max wind
    try:
        from ..models import TerminalWeather
        from ..database import SessionLocal as _SL4

        with _SL4() as db:
            terminals = db.query(TerminalWeather).all()
        if terminals:
            shamal_max_wind = max((t.wind_speed_knots or 0.0) for t in terminals)
    except Exception as exc:
        logger.warning("history: shamal_max_wind failed: %s", exc)

    # Insert row
    try:
        with SessionLocal() as db:
            row = MetricHistory(
                ts=ts,
                strait_flow_mbpd=strait_flow_mbpd,
                brent=brent,
                wti=wti,
                transit_count=transit_count,
                dark_count=dark_count,
                sts_count=sts_count,
                risk_score=risk_score,
                shamal_max_wind=shamal_max_wind,
            )
            db.add(row)
            db.commit()
        logger.info(
            "MetricHistory row inserted: risk=%s brent=%s flow=%s",
            risk_score,
            brent,
            strait_flow_mbpd,
        )
    except Exception as exc:
        logger.error("history: failed to insert row: %s", exc)


def get_history_series(days: int = 30) -> dict:
    """Return time-series rows for the last N days, capped at _MAX_SERIES_ROWS."""
    from datetime import timedelta
    from ..database import SessionLocal
    from ..models import MetricHistory

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        with SessionLocal() as db:
            rows = (
                db.query(MetricHistory)
                .filter(MetricHistory.ts >= cutoff)
                .order_by(MetricHistory.ts.asc())
                .limit(_MAX_SERIES_ROWS)
                .all()
            )
        series = [
            {
                "ts": r.ts,
                "strait_flow_mbpd": r.strait_flow_mbpd,
                "brent": r.brent,
                "wti": r.wti,
                "transit_count": r.transit_count,
                "dark_count": r.dark_count,
                "sts_count": r.sts_count,
                "risk_score": r.risk_score,
                "shamal_max_wind": r.shamal_max_wind,
            }
            for r in rows
        ]
        return {"series": series, "count": len(series), "days": days}
    except Exception as exc:
        logger.error("get_history_series failed: %s", exc)
        return {"series": [], "count": 0, "days": days, "error": str(exc)}
