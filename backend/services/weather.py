"""Terminal Weather Service — monitor Shamal winds via Open-Meteo API."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
import httpx

from sqlalchemy import desc
from ..database import SessionLocal
from ..models import TerminalWeather
from .activity import log_activity
from .alerts import send_alert

logger = logging.getLogger(__name__)

# Key loading terminals and their operational coordinates
WEATHER_TERMINALS = {
    "Ras Tanura (SA)": {"lat": 26.64, "lon": 50.12},
    "Al Basrah (IQ)": {"lat": 29.68, "lon": 48.81},
    "Kharg Island (IR)": {"lat": 29.24, "lon": 50.31},
    "Das Island (UAE)": {"lat": 25.15, "lon": 52.87},
}

# General threshold for suspension of loading operations
SHUTDOWN_THRESHOLD_KNOTS = 30.0
WARNING_THRESHOLD_KNOTS = 22.0

async def fetch_terminal_weather():
    """
    Fetch current wind speed and gusts from Open-Meteo for key terminals.
    Detects Shamal wind events and logs alerts.
    """
    today = datetime.now(timezone.utc)
    
    async with httpx.AsyncClient() as client:
        for name, coords in WEATHER_TERMINALS.items():
            try:
                # Open-Meteo Marine/Standard API for 10m wind speed in knots
                url = f"https://api.open-meteo.com/v1/forecast"
                params = {
                    "latitude": coords["lat"],
                    "longitude": coords["lon"],
                    "current": "wind_speed_10m,wind_gusts_10m",
                    "wind_speed_unit": "kn",
                    "timezone": "auto"
                }
                
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    logger.warning(f"Failed to fetch weather for {name}: {resp.status_code} - {resp.text}")
                    continue
                    
                data = resp.json()
                current = data.get("current", {})
                wind_speed = current.get("wind_speed_10m", 0.0)
                wind_gusts = current.get("wind_gusts_10m", 0.0)
                
                is_alert = wind_speed >= WARNING_THRESHOLD_KNOTS or wind_gusts >= SHUTDOWN_THRESHOLD_KNOTS
                
                with SessionLocal() as db:
                    # Update or create
                    existing = db.query(TerminalWeather).filter(TerminalWeather.terminal_name == name).first()
                    
                    # Check if alert state changed from False to True
                    new_alert_triggered = is_alert and (not existing or not existing.is_alert_active)
                    
                    if existing:
                        existing.wind_speed_knots = wind_speed
                        existing.wind_gusts_knots = wind_gusts
                        existing.is_alert_active = is_alert
                        existing.updated_at = today
                    else:
                        db.add(TerminalWeather(
                            terminal_name=name,
                            latitude=coords["lat"],
                            longitude=coords["lon"],
                            wind_speed_knots=wind_speed,
                            wind_gusts_knots=wind_gusts,
                            is_alert_active=is_alert,
                            updated_at=today
                        ))
                    db.commit()
                    
                    if new_alert_triggered:
                        severity = "critical" if wind_speed >= SHUTDOWN_THRESHOLD_KNOTS else "warning"
                        msg = f"WEATHER ALERT: Shamal winds at {name}. Sustained: {wind_speed}kt, Gusts: {wind_gusts}kt. Operations may be suspended."
                        log_activity(
                            event_type="weather_alert",
                            message=msg,
                            severity=severity,
                            metadata={"terminal": name, "wind_speed": wind_speed, "gusts": wind_gusts}
                        )
                        await send_alert(
                            alert_type="weather_shutdown",
                            message=msg,
                            unique_id=f"weather_{name}_{today.strftime('%Y%m%d')}",
                            severity=severity
                        )
                        logger.warning(msg)
                        
            except Exception as e:
                logger.error(f"Error processing weather for {name}: {e}")

async def get_latest_weather() -> List[Dict]:
    """Retrieve the latest weather conditions for all terminals."""
    with SessionLocal() as db:
        rows = db.query(TerminalWeather).order_by(TerminalWeather.terminal_name).all()
        return [
            {
                "terminal_name": r.terminal_name,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "wind_speed_knots": r.wind_speed_knots,
                "wind_gusts_knots": r.wind_gusts_knots,
                "is_alert_active": r.is_alert_active,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            } for r in rows
        ]
