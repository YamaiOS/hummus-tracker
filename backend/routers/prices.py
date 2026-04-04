"""Oil price and correlation API."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..services.fred import fetch_oil_prices, get_latest_prices
from ..services.eia import fetch_petroleum_prices
from ..services.market_data import fetch_market_metrics, get_efs_history
from ..services.bunkers import get_latest_bunker_prices, get_bunker_history

router = APIRouter(prefix="/prices", tags=["prices"])

@router.get("/bunkers/latest")
async def get_latest_bunkers():
    """Current Fujairah bunker fuel prices."""
    return await get_latest_bunker_prices()

@router.get("/bunkers/history")
async def get_bunkers_hist(days: int = Query(30, ge=7, le=90)):
    """Fujairah bunker fuel price history."""
    history = await get_bunker_history(days=days)
    return {
        "history": history,
        "count": len(history)
    }

@router.get("/efs-history")
async def get_efs_time_series(days: int = Query(90, ge=7, le=365)):
    """Historical Brent-Dubai EFS spread for charting."""
    history = await get_efs_history(days=days)
    return {
        "history": history,
        "count": len(history)
    }


@router.get("/market-metrics")
async def get_market_metrics():
    """Detailed Brent and Dubai crude prices, spreads, and curve data."""
    metrics = await fetch_market_metrics()
    return {
        "metrics": metrics,
        "source": "Yahoo Finance (ICE/CME)",
    }


@router.get("/oil")
async def get_oil_prices(days: int = Query(365, ge=7, le=3650)):
    """Daily Brent and WTI crude prices from FRED."""
    prices = await fetch_oil_prices(days=days)
    latest = prices[-1] if prices else {}
    return {
        "prices": prices,
        "latest": latest,
        "count": len(prices),
        "source": "FRED (St. Louis Fed)",
    }


@router.get("/latest")
async def get_latest():
    """Most recent oil prices."""
    return await get_latest_prices()


@router.get("/eia")
async def get_eia_prices(days: int = Query(90, ge=7, le=365)):
    """Oil prices from EIA API."""
    prices = await fetch_petroleum_prices(days=days)
    return {
        "prices": prices,
        "count": len(prices),
        "source": "EIA",
    }
