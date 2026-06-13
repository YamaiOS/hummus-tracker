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

SNAPSHOT_DIR = Path(__file__).parent.parent / "snapshots"

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


async def run() -> None:
    started = datetime.now(timezone.utc)
    logger.info("=== Snapshot run starting ===")
    await _refresh_data()
    written = await _dump_endpoints()

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    (SNAPSHOT_DIR / "_meta.json").write_text(json.dumps({
        "generated_at": started.isoformat(),
        "endpoints_written": written,
        "ais_sample_seconds": AIS_SAMPLE_SECONDS,
    }))
    logger.info("=== Snapshot complete: %s/%s endpoints written ===", written, len(ENDPOINTS))


if __name__ == "__main__":
    asyncio.run(run())
