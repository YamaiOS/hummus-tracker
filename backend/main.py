"""Hummus Tracker — Strait of Hormuz Oil Tanker Intelligence.

FastAPI backend with real-time AIS vessel tracking, oil flow estimation,
price correlation, and disruption timeline.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .database import init_db
from .routers import vessels, flow, prices, disruptions
from .services.ais_stream import run_ais_stream
from .services.scheduler import start_scheduler, aggregate_daily_transits

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [Hummus] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start AIS stream consumer and background scheduler on app startup."""
    init_db()
    logger.info("Database initialized.")

    # Start AIS WebSocket consumer as background task
    ais_task = asyncio.create_task(run_ais_stream())
    logger.info("AIS stream consumer started.")

    # Start background scheduler for aggregation
    scheduler = start_scheduler()
    
    # Run an initial aggregation for today in the background
    asyncio.create_task(aggregate_daily_transits(datetime.now().strftime("%Y-%m-%d")))

    yield

    ais_task.cancel()
    scheduler.shutdown()
    logger.info("Shutting down.")


app = FastAPI(
    title="Hummus Tracker",
    description="Strait of Hormuz Oil Tanker Intelligence — Real-time AIS tracking, oil flow estimation, and price correlation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://.*(\.vercel\.app|\.onrender\.com|\.netlify\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vessels.router, prefix="/api")
app.include_router(flow.router, prefix="/api")
app.include_router(prices.router, prefix="/api")
app.include_router(disruptions.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "hummus-tracker"}


@app.get("/api/overview")
async def overview():
    """Dashboard overview — key metrics for the Hormuz strait."""
    from .services.ais_stream import get_live_vessels, get_stream_status
    from .services.fred import get_latest_prices
    from .services.eia import fetch_hormuz_flow
    from .services.imf_portwatch import fetch_hormuz_summary

    vessels = get_live_vessels()
    tankers = [v for v in vessels if v.get("vessel_type", 0) in range(70, 90)]
    loaded = [v for v in tankers if v.get("is_loaded")]

    oil_prices = await get_latest_prices()
    baseline = await fetch_hormuz_flow()
    imf = await fetch_hormuz_summary()
    stream = get_stream_status()

    return {
        "strait_status": {
            "vessels_tracked": len(vessels),
            "tankers_active": len(tankers),
            "loaded_tankers": len(loaded),
            "ballast_tankers": len(tankers) - len(loaded),
        },
        "oil_flow": {
            "eia_baseline_mbpd": baseline["baseline_mbpd"],
            "key_exporters": baseline["key_exporters"],
        },
        "imf_portwatch": imf,
        "oil_prices": oil_prices,
        "ais_stream": stream,
    }


# ── Serve frontend static files (production) ──────────────────────────────────
_STATIC_DIR = Path(__file__).parent.parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Catch-all: serve index.html for client-side routing."""
        file = _STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(_STATIC_DIR / "index.html")
