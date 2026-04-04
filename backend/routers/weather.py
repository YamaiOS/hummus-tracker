"""Terminal Weather API — Shamal wind conditions."""
from __future__ import annotations

from typing import List
from fastapi import APIRouter
from ..services.weather import get_latest_weather
from ..models import TerminalWeatherSchema

router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/latest", response_model=List[TerminalWeatherSchema])
async def get_latest():
    """Current weather conditions at key loading terminals."""
    return await get_latest_weather()
