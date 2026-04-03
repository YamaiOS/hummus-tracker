"""Oil flow estimation and transit analysis API."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import VesselTransit, DailyTransitSummary, DisruptionEvent
from ..services.eia import fetch_hormuz_flow
from ..services.imf_portwatch import fetch_hormuz_summary, fetch_hormuz_transits

router = APIRouter(prefix="/flow", tags=["flow"])


@router.get("/impact")
async def get_supply_chain_impact(db: Session = Depends(get_db)):
    """Strategic impact metrics: Insurance, Routing, and Flag-based volume."""
    # 1. Calculate Insurance Multiplier (Heuristic)
    # Base is 1.0x. Critical adds 8.5x. High adds 3.2x.
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    recent_disruptions = db.query(DisruptionEvent).filter(DisruptionEvent.date >= thirty_days_ago).all()
    
    multiplier = 1.0
    for d in recent_disruptions:
        if d.severity == "critical": multiplier += 8.5
        elif d.severity == "high": multiplier += 3.2
        elif d.severity == "medium": multiplier += 1.1
    
    # 2. Selective Transit Analysis (Volume by Flag)
    cutoff = datetime.utcnow() - timedelta(hours=24)
    all_transits = db.query(VesselTransit).filter(VesselTransit.observed_at >= cutoff).all()
    
    # Deduplicate
    unique_vessels = {}
    for t in all_transits:
        if t.mmsi not in unique_vessels: unique_vessels[t.mmsi] = t
    
    flag_stats = {}
    for v in unique_vessels.values():
        if v.direction == "outbound" and v.is_loaded:
            f = v.flag or "Unknown"
            barrels = v.estimated_barrels or 0
            if f not in flag_stats:
                flag_stats[f] = {"vessels": 0, "barrels": 0}
            flag_stats[f]["vessels"] += 1
            flag_stats[f]["barrels"] += barrels

    sorted_flags = sorted(
        [{"flag": k, **v} for k, v in flag_stats.items()],
        key=lambda x: x["barrels"],
        reverse=True
    )

    return {
        "war_risk_multiplier": round(multiplier, 1),
        "insurance_status": "CRITICAL" if multiplier > 10 else "HIGH" if multiplier > 5 else "ELEVATED" if multiplier > 2 else "NORMAL",
        "bypass_analysis": {
            "route": "Cape of Good Hope",
            "extra_days": 15,
            "extra_cost_per_vlcc_usd": 480000,
            "total_extra_fuel_tons": 2200
        },
        "selective_transits": sorted_flags,
        "global_economic_loss_est_usd_day": round(multiplier * 120000000, 0)
    }


@router.get("/freight")
async def get_freight_estimates(db: Session = Depends(get_db)):
    """Heuristic freight charge modeling based on fuel and risk premiums."""
    from ..services.fred import get_latest_prices
    prices = await get_latest_prices()
    brent = prices.get("brent") or 80.0
    
    # Calculate Risk Multiplier (same logic as impact)
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    recent_disruptions = db.query(DisruptionEvent).filter(DisruptionEvent.date >= thirty_days_ago).all()
    risk_factor = 1.0 + sum([8.0 if d.severity == "critical" else 3.0 if d.severity == "high" else 1.0 for d in recent_disruptions]) / 10.0

    # Heuristic: WS (Worldscale) baseline + Fuel adjustment + Risk premium
    # WS 100 roughly equals a baseline cost.
    fuel_adj = (brent - 70) * 0.5
    
    estimates = [
        {
            "class": "VLCC",
            "route": "MEG -> Singapore (TD3C)",
            "ws_points": round((60 + fuel_adj) * risk_factor, 1),
            "tce_day_rate_usd": round((45000 + (brent * 150)) * risk_factor, 0),
            "status": "RISING" if risk_factor > 1.2 else "STABLE"
        },
        {
            "class": "Suezmax",
            "route": "MEG -> Med (TD23)",
            "ws_points": round((75 + fuel_adj) * risk_factor, 1),
            "tce_day_rate_usd": round((35000 + (brent * 120)) * risk_factor, 0),
            "status": "RISING" if risk_factor > 1.2 else "STABLE"
        },
        {
            "class": "Aframax",
            "route": "MEG -> SE Asia (TD8)",
            "ws_points": round((110 + fuel_adj) * risk_factor, 1),
            "tce_day_rate_usd": round((30000 + (brent * 100)) * risk_factor, 0),
            "status": "STABLE"
        }
    ]
    
    return {
        "date": datetime.utcnow().date().isoformat(),
        "market_sentiment": "BULLISH" if risk_factor > 1.5 else "NEUTRAL",
        "brent_ref": brent,
        "risk_multiplier": round(risk_factor, 2),
        "estimates": estimates
    }


@router.get("/estimate")
async def get_flow_estimate(db: Session = Depends(get_db)):
    """Current oil flow estimate through Hormuz.

    Combines live AIS data with EIA baseline for context.
    """
    # Get EIA baseline
    baseline = await fetch_hormuz_flow()

    # Get all observations in last 24h
    cutoff = datetime.utcnow() - timedelta(hours=24)
    all_transits = (
        db.query(VesselTransit)
        .filter(VesselTransit.observed_at >= cutoff)
        .order_by(VesselTransit.observed_at.desc())
        .all()
    )

    # Deduplicate by MMSI in Python (keeping latest)
    unique_vessels = {}
    for t in all_transits:
        if t.mmsi not in unique_vessels:
            unique_vessels[t.mmsi] = t

    vessels_24h = list(unique_vessels.values())
    loaded_tankers = [v for v in vessels_24h if v.is_loaded and v.direction == "outbound"]
    total_barrels = sum(v.estimated_barrels or 0 for v in loaded_tankers)
    estimated_mbpd = total_barrels / 1_000_000

    return {
        "date": datetime.utcnow().date().isoformat(),
        "estimated_mbpd": round(estimated_mbpd, 2),
        "eia_baseline_mbpd": baseline["baseline_mbpd"],
        "deviation_pct": round(
            ((estimated_mbpd - baseline["baseline_mbpd"]) / baseline["baseline_mbpd"]) * 100, 1
        ) if estimated_mbpd > 0 else None,
        "vessels_tracked_24h": len(vessels_24h),
        "loaded_tankers_outbound": len(loaded_tankers),
        "total_barrels_estimate": round(total_barrels),
        "key_exporters": baseline["key_exporters"],
        "note": "Flow estimate represents the sum of unique outbound loaded tankers observed in the last 24 hours.",
    }


@router.get("/daily")
async def get_daily_summary(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Daily transit summaries with oil price overlay."""
    summaries = (
        db.query(DailyTransitSummary)
        .order_by(DailyTransitSummary.date.desc())
        .limit(days)
        .all()
    )

    return {
        "summaries": [
            {
                "date": s.date,
                "total_vessels": s.total_vessels,
                "tanker_count": s.tanker_count,
                "vlcc_count": s.vlcc_count,
                "suezmax_count": s.suezmax_count,
                "aframax_count": s.aframax_count,
                "lng_count": s.lng_count,
                "loaded_count": s.loaded_count,
                "ballast_count": s.ballast_count,
                "estimated_mbpd": s.estimated_mbpd,
                "brent_price": s.brent_price,
                "wti_price": s.wti_price,
            }
            for s in reversed(summaries)
        ],
        "days": len(summaries),
    }


@router.get("/imf")
async def get_imf_transits(days: int = Query(90, ge=7, le=365)):
    """IMF PortWatch Hormuz transit data (satellite AIS)."""
    transits = await fetch_hormuz_transits(days=days)
    summary = await fetch_hormuz_summary()
    return {
        "transits": transits,
        "summary": summary,
    }


@router.get("/baseline")
async def get_baseline():
    """EIA Hormuz baseline data and key exporter breakdown."""
    return await fetch_hormuz_flow()
