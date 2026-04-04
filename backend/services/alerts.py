"""Alert Service — send notifications to Telegram and Discord."""
from __future__ import annotations

import logging
import os
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Cooldown to prevent spamming the same alert
# key: alert_type + unique_id, value: timestamp
_cooldowns: dict[str, datetime] = {}
COOLDOWN_PERIOD = timedelta(hours=1)

async def send_alert(
    alert_type: str, 
    message: str, 
    unique_id: Optional[str] = None,
    severity: str = "warning"
):
    """
    Send an alert to configured channels (Telegram/Discord).
    Supports cooldown based on unique_id.
    """
    key = f"{alert_type}:{unique_id}" if unique_id else alert_type
    now = datetime.now(timezone.utc)
    
    if key in _cooldowns:
        if now - _cooldowns[key] < COOLDOWN_PERIOD:
            return # Skip

    _cooldowns[key] = now

    # 1. Telegram
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if bot_token and chat_id:
        try:
            async with httpx.AsyncClient() as client:
                # Format for Telegram
                icon = "🚨" if severity == "critical" else "⚠️" if severity == "warning" else "ℹ️"
                text = f"{icon} *Hummus Tracker ALERT*\n\n{message}\n\n_Type: {alert_type}_"
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
                )
        except Exception as e:
            logger.error(f"Error sending Telegram alert: {e}")

    # 2. Discord
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if webhook_url:
        try:
            async with httpx.AsyncClient() as client:
                color = 0xff4444 if severity == "critical" else 0xffbb33 if severity == "warning" else 0x33b5e5
                payload = {
                    "embeds": [{
                        "title": "Hummus Tracker Intelligence",
                        "description": message,
                        "color": color,
                        "fields": [
                            {"name": "Severity", "value": severity.upper(), "inline": True},
                            {"name": "Type", "value": alert_type, "inline": True}
                        ],
                        "timestamp": now.isoformat()
                    }]
                }
                await client.post(webhook_url, json=payload)
        except Exception as e:
            logger.error(f"Error sending Discord alert: {e}")

    logger.info(f"Alert sent: [{alert_type}] {message}")
