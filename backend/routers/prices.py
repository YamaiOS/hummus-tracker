"""Oil price and correlation API."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..services.fred import fetch_oil_prices, get_latest_prices
from ..services.eia import fetch_petroleum_prices

router = APIRouter(prefix="/prices", tags=["prices"])


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
