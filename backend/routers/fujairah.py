"""Fujairah Inventory API — weekly stock reports."""
from __future__ import annotations

from fastapi import APIRouter, Query
from ..services.fujairah import get_fujairah_history, get_latest_fujairah_report

router = APIRouter(prefix="/fujairah", tags=["fujairah"])


@router.get("/latest")
async def get_latest():
    """Most recent weekly inventory report."""
    return await get_latest_fujairah_report()


@router.get("/history")
async def get_history(limit: int = Query(52, ge=4, le=104)):
    """Weekly inventory history for charting."""
    return await get_fujairah_history(limit=limit)
