"""Minimal static serving app for Hummus Tracker (scale-to-zero friendly).

This process does NO live work on a normal request: every ``/api/...`` GET is
answered from a pre-generated JSON file under the persistent volume
(``SNAPSHOT_DIR``), so the machine can sleep when idle and serve instantly on
wake without recomputing anything.

Refresh is driven EXTERNALLY (e.g. an hourly GitHub Actions cron) by POSTing to
``/api/internal/refresh`` with the ``X-Refresh-Token`` header. That runs the
snapshot job in a subprocess and holds the request open until it finishes, which
keeps Fly from stopping the machine mid-refresh. A lock prevents overlapping runs.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .snapshot import SNAPSHOT_DIR, slug_for

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Serve] %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_STATIC_DIR = Path(__file__).parent.parent / "static"
_REFRESH_TOKEN = os.getenv("REFRESH_TOKEN", "")
_REPO_ROOT = Path(__file__).parent.parent

# Serialize refreshes so an overlapping trigger can never pile up two heavy jobs.
_refresh_lock = asyncio.Lock()


async def _run_snapshot() -> dict:
    """Run the snapshot job as an isolated subprocess and wait for it to finish."""
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "backend.snapshot",
        cwd=str(_REPO_ROOT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=600)
    except asyncio.TimeoutError:
        proc.kill()
        logger.error("Snapshot subprocess timed out after 600s; killed.")
        return {"ok": False, "error": "timeout"}
    code = proc.returncode
    if out:
        logger.info("snapshot output tail: %s", out.decode(errors="replace")[-500:])
    meta_file = SNAPSHOT_DIR / "_meta.json"
    meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
    return {"ok": code == 0, "returncode": code, "snapshot": meta}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Self-heal: if the volume has no snapshot yet (first ever boot), seed one in
    # the background so the dashboard isn't blank. Normal wakes skip this.
    if not (SNAPSHOT_DIR / "overview.json").exists():
        logger.warning("No snapshot found at boot — seeding one in the background.")

        async def _seed():
            async with _refresh_lock:
                await _run_snapshot()

        asyncio.create_task(_seed())
    yield


app = FastAPI(title="Hummus Tracker (static)", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"https://.*(\.vercel\.app|\.onrender\.app|\.netlify\.app|\.fly\.dev|\.yieldwise\.my)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    meta_file = SNAPSHOT_DIR / "_meta.json"
    meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
    return {"status": "ok", "service": "hummus-tracker", "snapshot": meta}


@app.post("/api/internal/refresh")
async def refresh(x_refresh_token: str = Header(default="")):
    """Trigger a snapshot regeneration. Auth via X-Refresh-Token. Runs synchronously."""
    if not _REFRESH_TOKEN or x_refresh_token != _REFRESH_TOKEN:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if _refresh_lock.locked():
        return JSONResponse({"status": "already running"}, status_code=409)
    async with _refresh_lock:
        logger.info("Refresh triggered via /api/internal/refresh")
        result = await _run_snapshot()
    return JSONResponse(result, status_code=200 if result.get("ok") else 500)


@app.get("/feed.xml")
def rss_feed():
    """Syndicated RSS feed (risk level, daily brief, recent incidents) — distribution."""
    from .services.syndication import build_rss
    return Response(build_rss(SNAPSHOT_DIR), media_type="application/rss+xml")


@app.get("/card.svg")
def risk_card():
    """Shareable social card rendering the current Hormuz Risk Index (dynamic SVG)."""
    from .services.syndication import build_risk_card_svg
    return Response(build_risk_card_svg(SNAPSHOT_DIR), media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=900"})


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
