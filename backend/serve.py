"""Minimal static serving app for Hummus Tracker.

This process does NO live work: no AIS websocket, no external API calls at
request time, no DB compute. Every ``/api/...`` request is answered from a
pre-generated JSON file in ``snapshots/`` (written by ``backend.snapshot``).

A single in-process scheduler re-runs the snapshot job once an hour in a
subprocess, so the serving process stays light and a heavy refresh can never
stall request handling.
"""
from __future__ import annotations

import asyncio
import json
import logging
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .snapshot import SNAPSHOT_DIR, slug_for

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Serve] %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_STATIC_DIR = Path(__file__).parent.parent / "static"


def _run_snapshot_subprocess() -> None:
    """Trigger a refresh in an isolated process so serving memory stays flat."""
    logger.info("Launching hourly snapshot subprocess...")
    try:
        subprocess.Popen([sys.executable, "-m", "backend.snapshot"],
                         cwd=str(Path(__file__).parent.parent))
    except Exception as e:  # noqa: BLE001
        logger.error("Failed to launch snapshot subprocess: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # If we booted with no snapshot at all, kick one immediately so the UI isn't blank.
    if not (SNAPSHOT_DIR / "overview.json").exists():
        logger.warning("No snapshot found at boot — triggering one now.")
        await asyncio.to_thread(_run_snapshot_subprocess)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(_run_snapshot_subprocess, "interval", hours=1,
                      id="hourly_snapshot", replace_existing=True)
    scheduler.start()
    logger.info("Hourly snapshot scheduler started.")
    yield
    scheduler.shutdown()


app = FastAPI(title="Hummus Tracker (static)", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"https://.*(\.vercel\.app|\.onrender\.com|\.netlify\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    meta_file = SNAPSHOT_DIR / "_meta.json"
    meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
    return {"status": "ok", "service": "hummus-tracker", "snapshot": meta}


@app.get("/api/{path:path}")
def api(path: str):
    """Serve the pre-generated JSON for any known endpoint (query string ignored)."""
    snap = SNAPSHOT_DIR / f"{slug_for(path)}.json"
    if snap.exists():
        return FileResponse(snap, media_type="application/json")
    return JSONResponse({"error": "no snapshot yet", "path": path}, status_code=503)


# ── Serve frontend SPA ────────────────────────────────────────────────────────
if _STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file = _STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(_STATIC_DIR / "index.html")
