"""Daily Intelligence Brief Service — auto-generate morning summaries."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import desc
from ..database import SessionLocal
from ..models import IntelligenceBrief, DarkVessel, STSEvent, MarketData, ActivityEvent
from .status import get_strait_status
from .alerts import send_alert

logger = logging.getLogger(__name__)

async def generate_daily_brief(date_str: Optional[str] = None):
    """
    Generate a concise markdown summary of the last 24h.
    Content: Flow vs baseline, new Dark/STS, EFS change, Active disruptions.
    """
    if not date_str:
        date_str = datetime.utcnow().strftime("%Y-%m-%d")

    status = await get_strait_status()
    
    with SessionLocal() as db:
        try:
            # 1. Gather stats for the brief
            cutoff = datetime.utcnow() - timedelta(hours=24)
            
            # New dark vessels in last 24h
            new_dark = db.query(DarkVessel).filter(DarkVessel.detected_at >= cutoff).all()
            
            # New STS events in last 24h
            new_sts = db.query(STSEvent).filter(STSEvent.detected_at >= cutoff).all()
            
            # Latest market move
            latest_m = db.query(MarketData).order_by(MarketData.date.desc()).first()
            prev_m = db.query(MarketData).order_by(MarketData.date.desc()).offset(1).first()
            efs_move = (latest_m.brent_dubai_efs - prev_m.brent_dubai_efs) if latest_m and prev_m else 0.0
            efs_val = latest_m.brent_dubai_efs if latest_m else 0.0

            # 2. Format the Markdown
            lines = [
                f"# 🌅 Hormuz Intelligence Brief — {date_str}",
                f"**Strait Health Score: {status['score']}% ({status['level'].upper()})**",
                f"> {status['summary']}",
                "",
                "### 🚢 Maritime Anomalies (Last 24h)",
                f"- **Dark Vessels:** {len(new_dark)} new detections" + (f" ({', '.join([v.vessel_name or v.mmsi for v in new_dark])})" if new_dark else ""),
                f"- **STS Transfers:** {len(new_sts)} suspicious proximities flagged",
                "",
                "### 🛢️ Market Structure",
                f"- **Brent-Dubai EFS:** ${efs_val:.2f}/bbl",
                f"- **24h Move:** {'📈' if efs_move > 0 else '📉'} ${abs(efs_move):.2f}" if efs_move != 0 else "- **24h Move:** Unchanged",
                "",
                "### ⚠️ Notable Alerts",
            ]
            
            recent_alerts = db.query(ActivityEvent).filter(
                ActivityEvent.timestamp >= cutoff,
                ActivityEvent.severity.in_(["warning", "critical"])
            ).limit(3).all()
            
            if recent_alerts:
                for a in recent_alerts:
                    lines.append(f"- {a.message}")
            else:
                lines.append("- No critical alerts in the last 24 hours.")

            content = "\n".join(lines)

            # 3. Persist
            exists = db.query(IntelligenceBrief).filter(IntelligenceBrief.date == date_str).first()
            if exists:
                exists.content_markdown = content
            else:
                db.add(IntelligenceBrief(date=date_str, content_markdown=content))
            
            db.commit()
            logger.info(f"Generated daily brief for {date_str}")

            # 4. Broadcast via Alert Channels
            alert_msg = f"*Daily Intelligence Brief — {date_str}*\n\nScore: {status['score']}% ({status['level'].upper()})\n\n{status['summary']}\n\n[Open Dashboard](https://hummus-trackerz.fly.dev)"
            await send_alert("daily_brief", alert_msg, severity="info")
            
            return content
        except Exception as e:
            db.rollback()
            logger.error(f"Error generating daily brief: {e}")
            return None

async def get_latest_brief() -> Optional[dict]:
    """Retrieve the most recent brief."""
    with SessionLocal() as db:
        r = db.query(IntelligenceBrief).order_by(desc(IntelligenceBrief.date)).first()
        if not r:
            return None
        return {
            "date": r.date,
            "content_markdown": r.content_markdown,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
