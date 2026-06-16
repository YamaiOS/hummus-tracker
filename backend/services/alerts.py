"""Alert Service — send notifications to Telegram and Discord."""
from __future__ import annotations

import json
import logging
import os
import httpx
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

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


# ─────────────────────────────────────────────────────────────────────────────
# Daily digest — once-per-day Telegram distribution push.
# Reuses the same TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID env + httpx sender as
# send_alert(). No-ops gracefully when Telegram is not configured; never raises.
# ─────────────────────────────────────────────────────────────────────────────
DIGEST_SITE_URL = "https://oil.yieldwise.my"


async def _send_telegram(text: str) -> bool:
    """Send a raw Markdown message to the configured Telegram chat.

    Returns True on a successful send, False if Telegram is not configured or
    the send fails. Never raises.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not bot_token or not chat_id:
        logger.info("Telegram not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID unset) — skipping send")
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown",
                    "disable_web_page_preview": True,
                },
            )
            resp.raise_for_status()
        return True
    except Exception as e:  # noqa: BLE001
        logger.error(f"Error sending Telegram digest: {e}")
        return False


def _digest_load(snapshot_dir: Path, name: str) -> Any:
    """Read+parse a snapshot JSON file. Returns None on any problem."""
    try:
        path = Path(snapshot_dir) / name
        if not path.is_file():
            return None
        text = path.read_text(encoding="utf-8")
        if not text.strip():
            return None
        return json.loads(text)
    except Exception:  # noqa: BLE001
        return None


def _md_escape(value: Any) -> str:
    """Light escaping for Telegram (legacy) Markdown special chars in inline text."""
    s = "" if value is None else str(value)
    for ch in ("_", "*", "`", "["):
        s = s.replace(ch, "\\" + ch)
    return s


def _compose_digest(snapshot_dir: Path) -> str:
    """Compose a concise Markdown digest from snapshot JSON files. Never raises."""
    snapshot_dir = Path(snapshot_dir)
    lines: list[str] = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── Hormuz Risk score + level + top driver (risk-index.json) ─────────────
    score_txt, level_txt = "n/a", "UNKNOWN"
    driver = ""
    risk = _digest_load(snapshot_dir, "risk-index.json")
    if isinstance(risk, dict):
        s = risk.get("score")
        try:
            score_txt = str(int(round(float(s))))
        except (TypeError, ValueError):
            score_txt = "n/a"
        lvl = risk.get("level")
        if isinstance(lvl, str) and lvl.strip():
            level_txt = lvl.upper()
        summ = risk.get("summary")
        if isinstance(summ, str) and summ.strip():
            driver = summ.strip()
        else:
            comps = risk.get("components")
            if isinstance(comps, list) and comps and isinstance(comps[0], dict):
                driver = comps[0].get("detail") or comps[0].get("name") or ""
    lines.append(f"🛢️ *Hormuz Risk: {_md_escape(score_txt)}/100 ({_md_escape(level_txt)})*")
    if driver:
        if len(driver) > 160:
            driver = driver[:159].rstrip() + "…"
        lines.append(f"_{_md_escape(driver)}_")

    # ── Day's headline from the latest brief (brief__latest.json) ────────────
    brief = _digest_load(snapshot_dir, "brief__latest.json")
    if isinstance(brief, dict):
        content = brief.get("content_markdown") or ""
        headline = ""
        if isinstance(content, str):
            for raw in content.splitlines():
                ln = raw.strip().lstrip("#").strip()
                if ln:
                    headline = ln
                    break
        if headline:
            if len(headline) > 160:
                headline = headline[:159].rstrip() + "…"
            lines.append(f"📋 {_md_escape(headline)}")

    # ── Most severe recent incident (incidents.json) ─────────────────────────
    inc_data = _digest_load(snapshot_dir, "incidents.json")
    incidents: list = []
    if isinstance(inc_data, dict):
        incidents = inc_data.get("incidents") or inc_data.get("items") or []
    elif isinstance(inc_data, list):
        incidents = inc_data
    if isinstance(incidents, list) and incidents:
        _sev_rank = {"critical": 0, "high": 1, "warning": 2, "medium": 3, "low": 4, "info": 5}

        def _key(i: Any):
            if not isinstance(i, dict):
                return (9, 99999)
            sev = (i.get("severity") or "").lower()
            age = i.get("age_hours")
            age = age if isinstance(age, (int, float)) else 99999
            return (_sev_rank.get(sev, 8), age)

        worst = min((i for i in incidents if isinstance(i, dict)), key=_key, default=None)
        if isinstance(worst, dict):
            title = worst.get("title") or worst.get("description") or "incident"
            sev = (worst.get("severity") or "").upper()
            title = str(title)
            if len(title) > 140:
                title = title[:139].rstrip() + "…"
            prefix = f"[{sev}] " if sev else ""
            lines.append(f"⚠️ {_md_escape(prefix + title)}")

    # ── Hormuz transit pct-of-baseline (chokepoints.json) ────────────────────
    chk = _digest_load(snapshot_dir, "chokepoints.json")
    chokepoints: list = []
    if isinstance(chk, dict):
        chokepoints = chk.get("chokepoints") or chk.get("items") or []
    elif isinstance(chk, list):
        chokepoints = chk
    if isinstance(chokepoints, list):
        hormuz = next(
            (c for c in chokepoints if isinstance(c, dict) and "Hormuz" in (c.get("name") or "")),
            None,
        )
        if isinstance(hormuz, dict):
            pct = hormuz.get("pct_of_baseline")
            if isinstance(pct, (int, float)):
                lines.append(f"🚢 Hormuz transits: {pct:.0f}% of baseline")

    lines.append(f"[Open dashboard]({DIGEST_SITE_URL})")
    header = f"📰 *Hummus Tracker — Daily Digest* ({today})"
    return header + "\n\n" + "\n".join(lines)


async def send_daily_digest(snapshot_dir) -> bool:
    """Compose and push a once-per-day Telegram digest from the snapshot files.

    - No-ops (returns False) if Telegram env vars are unset.
    - Deduped to once per UTC day via a `.last_digest_date` state file in
      ``snapshot_dir``; a second call the same day returns False.
    - Never raises.
    """
    try:
        snapshot_dir = Path(snapshot_dir)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Fast no-op if Telegram unconfigured — don't touch the dedupe file.
        if not (os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID")):
            logger.info("Daily digest skipped — Telegram not configured")
            return False

        # Once-per-day dedupe.
        state_path = snapshot_dir / ".last_digest_date"
        try:
            if state_path.is_file() and state_path.read_text(encoding="utf-8").strip() == today:
                logger.info("Daily digest already sent for %s — skipping", today)
                return False
        except Exception:  # noqa: BLE001
            pass

        text = _compose_digest(snapshot_dir)
        sent = await _send_telegram(text)
        if sent:
            try:
                snapshot_dir.mkdir(parents=True, exist_ok=True)
                state_path.write_text(today, encoding="utf-8")
            except Exception as e:  # noqa: BLE001
                logger.warning("Daily digest sent but failed to write dedupe state: %s", e)
            logger.info("Daily digest sent for %s", today)
        return sent
    except Exception as e:  # noqa: BLE001
        logger.error("Daily digest failed unexpectedly: %s", e)
        return False
