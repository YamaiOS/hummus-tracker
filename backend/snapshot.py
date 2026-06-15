"""Hourly snapshot generator for Hummus Tracker.

Runs the FULL data pipeline ONCE — seeds the DB, samples the AIS stream for a
bounded window, runs every aggregation/detection job, then calls every API
endpoint the frontend uses and dumps the JSON responses to ``snapshots/*.json``.

The web process (``backend.serve``) only ever reads those static JSON files, so
the always-on AIS websocket and the multi-job scheduler are gone — refresh is a
single batch job run at boot and hourly thereafter.

Run with:  ``python -m backend.snapshot``
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from httpx import ASGITransport

# Load .env BEFORE any service module reads os.getenv at import time (FRED/EIA/AIS keys).
load_dotenv(Path(__file__).parent.parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Snapshot] %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Written under the persistent volume (DATA_DIR, e.g. /data on Fly) so snapshots
# survive machine stop under scale-to-zero; falls back to the repo for local dev.
_DATA_DIR = Path(os.getenv("DATA_DIR") or (Path(__file__).parent.parent))
SNAPSHOT_DIR = _DATA_DIR / "snapshots"

# How long to listen to the AIS stream each run (seconds). Bounded so this is a
# batch job, not an always-on consumer. Override with AIS_SAMPLE_SECONDS.
AIS_SAMPLE_SECONDS = int(os.getenv("AIS_SAMPLE_SECONDS", "75"))

# Every endpoint path the frontend calls, with the widest query params any
# component uses (the serve layer ignores query strings, so we bake the
# superset once). Keyed by the slug the serve layer will look up.
ENDPOINTS: list[str] = [
    "/api/overview",
    "/api/status",
    "/api/activity?limit=20",
    "/api/brief/latest",
    "/api/flow/freight",
    "/api/flow/opec-compliance",
    "/api/flow/impact",
    "/api/flow/estimate",
    "/api/flow/baseline",
    "/api/flow/insurance",
    "/api/flow/daily?days=30",
    "/api/flow/imf?days=180",
    "/api/vessels/live",
    "/api/vessels/dark",
    "/api/vessels/sts",
    "/api/vessels/floating-storage",
    "/api/prices/oil?days=180",
    "/api/prices/market-metrics",
    "/api/prices/efs-history?days=90",
    "/api/prices/bunkers/latest",
    "/api/prices/bunkers/history?days=30",
    "/api/fujairah/latest",
    "/api/fujairah/history?limit=12",
    "/api/congestion/latest",
    "/api/weather/latest",
    "/api/disruptions/",
    "/api/risk-index",
    "/api/history/series?days=90",
    "/api/news",
    "/api/gas-prices",
    "/api/volatility",
    "/api/chokepoints",
    "/api/bypass",
    "/api/seismic",
    "/api/marine",
    "/api/gpr",
    "/api/production",
    "/api/integrity",
]


def slug_for(path: str) -> str:
    """Map an /api/... path (query stripped) to a snapshot filename stem."""
    p = path.split("?", 1)[0]
    p = p[len("/api/"):] if p.startswith("/api/") else p.lstrip("/")
    p = p.strip("/")
    return p.replace("/", "__") or "index"


async def _sample_ais() -> None:
    """Populate the in-memory vessel cache + DB by listening for a bounded window."""
    from .services.ais_stream import run_ais_stream, get_stream_status

    logger.info("Sampling AIS stream for %ss...", AIS_SAMPLE_SECONDS)
    try:
        await asyncio.wait_for(run_ais_stream(), timeout=AIS_SAMPLE_SECONDS)
    except asyncio.TimeoutError:
        pass  # expected — the stream runs forever, we only wanted a window
    except Exception as e:  # noqa: BLE001
        logger.warning("AIS sample ended early: %s", e)
    logger.info("AIS sample done: %s", get_stream_status())


async def _refresh_data() -> None:
    """Seed + run every aggregation/detection job once (mirrors old startup tasks)."""
    from .database import init_db
    from .services.compliance import seed_quotas
    from .services.insurance import seed_insurance_data
    from .services.fujairah import seed_fujairah_history
    from .services.bunkers import seed_bunker_history, fetch_bunker_prices
    from .services.weather import fetch_terminal_weather
    from .services.congestion import update_port_congestion
    from .services.market_data import persist_daily_market_metrics
    from .services.storage import update_floating_storage_detections
    from .services.dark_vessels import detect_dark_vessels
    from .services.sts_detection import detect_sts_events
    from .services.daily_brief import generate_daily_brief
    from .services.scheduler import backfill_daily_transits, aggregate_daily_transits

    init_db()
    seed_quotas()
    seed_insurance_data()
    seed_fujairah_history()
    seed_bunker_history()
    logger.info("DB seeded.")

    await _sample_ais()

    # Each job is independent — isolate failures so one bad feed never blanks the snapshot.
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    jobs = [
        ("weather", fetch_terminal_weather()),
        ("congestion", update_port_congestion()),
        ("market_metrics", persist_daily_market_metrics()),
        ("bunkers", fetch_bunker_prices()),
        ("imf_backfill", backfill_daily_transits(30)),
        ("floating_storage", update_floating_storage_detections()),
        ("dark_vessels", detect_dark_vessels()),
        ("sts_events", detect_sts_events()),
        ("daily_aggregate", aggregate_daily_transits(today)),
        ("daily_brief", generate_daily_brief()),
    ]
    for name, coro in jobs:
        try:
            await coro
            logger.info("job ok: %s", name)
        except Exception as e:  # noqa: BLE001
            logger.warning("job failed: %s — %s", name, e)


async def _dump_endpoints() -> int:
    """Call every endpoint in-process via ASGI and write the JSON to disk."""
    from .main import app

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://snapshot") as client:
        for path in ENDPOINTS:
            slug = slug_for(path)
            try:
                resp = await client.get(path)
                resp.raise_for_status()
                payload = resp.json()
            except Exception as e:  # noqa: BLE001
                logger.warning("endpoint failed: %s — %s (keeping previous snapshot)", path, e)
                continue
            (SNAPSHOT_DIR / f"{slug}.json").write_text(json.dumps(payload))
            written += 1
    return written


async def _evaluate_alerts() -> None:
    """Evaluate threshold conditions against just-written snapshot JSONs and fire alerts.

    Each check is wrapped in its own try/except so one bad read never aborts the others.
    unique_id is keyed by date+condition for per-day deduplication via the cooldown cache.
    """
    from .services.alerts import send_alert
    from .services.activity import log_activity

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logger.info("Evaluating alert thresholds...")

    # ── 1. Shamal wind shutdown risk ─────────────────────────────────────────
    try:
        weather_path = SNAPSHOT_DIR / "weather__latest.json"
        if weather_path.exists():
            terminals: list[dict] = json.loads(weather_path.read_text())
            for t in terminals:
                name = t.get("terminal_name", "Unknown terminal")
                wind = t.get("wind_speed_knots") or 0
                alert_active = t.get("is_alert_active", False)
                if wind >= 30 or alert_active:
                    uid = f"{today}:shamal:{name}"
                    msg = (
                        f"Shamal wind shutdown risk at {name}: "
                        f"{wind:.1f} kn wind speed"
                        + (" (alert active)" if alert_active else "")
                    )
                    await send_alert("shamal_wind", msg, unique_id=uid, severity="critical")
                    log_activity("shamal_wind", msg, severity="critical",
                                 metadata={"terminal": name, "wind_speed_knots": wind})
                    logger.warning("ALERT [shamal_wind] %s", msg)
        else:
            logger.info("weather__latest.json not found — skipping shamal check")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Alert check failed (shamal_wind): %s", exc)

    # ── 2. Dark vessels detected ──────────────────────────────────────────────
    try:
        dark_path = SNAPSHOT_DIR / "vessels__dark.json"
        if dark_path.exists():
            dark_data: dict = json.loads(dark_path.read_text())
            dark_count = dark_data.get("count", 0)
            if dark_count > 0:
                uid = f"{today}:dark_vessels"
                msg = f"{dark_count} dark vessel(s) detected in the Strait of Hormuz region"
                await send_alert("dark_vessels", msg, unique_id=uid, severity="warning")
                log_activity("dark_vessels", msg, severity="warning",
                             metadata={"count": dark_count})
                logger.warning("ALERT [dark_vessels] %s", msg)
            else:
                logger.info("Alert check ok (dark_vessels): count=0")
        else:
            logger.info("vessels__dark.json not found — skipping dark vessel check")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Alert check failed (dark_vessels): %s", exc)

    # ── 3. Low strait flow vs EIA baseline ───────────────────────────────────
    try:
        flow_path = SNAPSHOT_DIR / "flow__estimate.json"
        if flow_path.exists():
            flow: dict = json.loads(flow_path.read_text())
            estimated = flow.get("estimated_mbpd") or 0.0
            baseline = flow.get("eia_baseline_mbpd") or 0.0
            if baseline > 0:
                pct = (estimated / baseline) * 100
                if pct < 85:
                    uid = f"{today}:strait_flow:critical"
                    msg = (
                        f"CRITICAL: Strait flow at {pct:.1f}% of EIA baseline "
                        f"({estimated:.2f} mbpd vs {baseline:.1f} mbpd baseline)"
                    )
                    await send_alert("strait_flow", msg, unique_id=uid, severity="critical")
                    log_activity("strait_flow", msg, severity="critical",
                                 metadata={"estimated_mbpd": estimated, "baseline_mbpd": baseline, "pct": round(pct, 1)})
                    logger.warning("ALERT [strait_flow/critical] %s", msg)
                elif pct < 92:
                    uid = f"{today}:strait_flow:warning"
                    msg = (
                        f"WARNING: Strait flow at {pct:.1f}% of EIA baseline "
                        f"({estimated:.2f} mbpd vs {baseline:.1f} mbpd baseline)"
                    )
                    await send_alert("strait_flow", msg, unique_id=uid, severity="warning")
                    log_activity("strait_flow", msg, severity="warning",
                                 metadata={"estimated_mbpd": estimated, "baseline_mbpd": baseline, "pct": round(pct, 1)})
                    logger.warning("ALERT [strait_flow/warning] %s", msg)
                else:
                    logger.info("Alert check ok (strait_flow): %.1f%% of baseline", pct)
            else:
                logger.info("strait flow baseline is zero — skipping flow check")
        else:
            logger.info("flow__estimate.json not found — skipping flow check")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Alert check failed (strait_flow): %s", exc)

    # ── 4. Active STS events ─────────────────────────────────────────────────
    try:
        sts_path = SNAPSHOT_DIR / "vessels__sts.json"
        if sts_path.exists():
            sts_data: dict = json.loads(sts_path.read_text())
            sts_count = sts_data.get("count", 0)
            if sts_count > 0:
                uid = f"{today}:sts_events"
                msg = f"{sts_count} active ship-to-ship (STS) transfer event(s) detected"
                await send_alert("sts_events", msg, unique_id=uid, severity="warning")
                log_activity("sts_events", msg, severity="warning",
                             metadata={"count": sts_count})
                logger.info("ALERT [sts_events] %s", msg)
            else:
                logger.info("Alert check ok (sts_events): count=0")
        else:
            logger.info("vessels__sts.json not found — skipping STS check")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Alert check failed (sts_events): %s", exc)

    logger.info("Alert threshold evaluation complete.")


async def run() -> None:
    started = datetime.now(timezone.utc)
    logger.info("=== Snapshot run starting ===")
    await _refresh_data()

    # Record metric history row BEFORE dumping endpoints so the series endpoint
    # reflects the current run when it is serialised to disk.
    try:
        from .services.history import record_metric_snapshot
        await record_metric_snapshot()
        logger.info("job ok: record_metric_snapshot")
    except Exception as _e:  # noqa: BLE001
        logger.warning("job failed: record_metric_snapshot — %s", _e)

    written = await _dump_endpoints()
    await _evaluate_alerts()

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    (SNAPSHOT_DIR / "_meta.json").write_text(json.dumps({
        "generated_at": started.isoformat(),
        "endpoints_written": written,
        "ais_sample_seconds": AIS_SAMPLE_SECONDS,
    }))
    logger.info("=== Snapshot complete: %s/%s endpoints written ===", written, len(ENDPOINTS))


if __name__ == "__main__":
    asyncio.run(run())
