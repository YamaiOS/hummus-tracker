"""Port Congestion API — terminal waiting times."""
from __future__ import annotations

from fastapi import APIRouter, Query
from ..services.congestion import get_latest_congestion, get_congestion_history

router = APIRouter(prefix="/congestion", tags=["congestion"])


@router.get("/latest")
async def get_latest():
    """Most recent average wait times for all terminals."""
    return await get_latest_congestion()


@router.get("/history")
async def get_history(terminal: str, days: int = Query(30, ge=7, le=90)):
    """Wait time history for a specific terminal."""
    return await get_congestion_history(terminal, days=days)
