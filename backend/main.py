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

from .database import init_db, SessionLocal
from .models import DailyTransitSummary
from .routers import vessels, flow, prices, disruptions, fujairah, congestion, weather
from .services.ais_stream import run_ais_stream
from .services.scheduler import start_scheduler, aggregate_daily_transits, backfill_daily_transits
from .services.compliance import seed_quotas
from .services.insurance import seed_insurance_data
from .services.bunkers import seed_bunker_history
from .services.fujairah import seed_fujairah_history
from .services.weather import fetch_terminal_weather
from .services.market_data import persist_daily_market_metrics
from .services.status import get_strait_status
from .services.activity import get_recent_activity
from .services.daily_brief import get_latest_brief, generate_daily_brief
from .services.dark_vessels import detect_dark_vessels
from .services.sts_detection import detect_sts_events
from .services.congestion import update_port_congestion

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [Hummus] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start AIS stream consumer and background scheduler on app startup."""
    init_db()
    seed_quotas()
    seed_insurance_data()
    seed_fujairah_history()
    seed_bunker_history()
    logger.info("Database initialized, quotas, insurance, bunker and Fujairah history seeded.")

    # Start AIS WebSocket consumer as background task
    ais_task = asyncio.create_task(run_ais_stream())
    logger.info("AIS stream consumer started.")

    # Start background scheduler for aggregation
    scheduler = start_scheduler()
    
    # Run initial data fetch and analysis in the background (staggered to avoid DB locks)
    async def run_startup_tasks():
        await asyncio.sleep(2) # let the stream/scheduler settle
        asyncio.create_task(fetch_terminal_weather())
        await asyncio.sleep(1)
        asyncio.create_task(update_port_congestion())
        await asyncio.sleep(1)
        asyncio.create_task(persist_daily_market_metrics())
        await asyncio.sleep(1)
        asyncio.create_task(backfill_daily_transits(30))
        await asyncio.sleep(1)
        asyncio.create_task(detect_dark_vessels())
        await asyncio.sleep(1)
        asyncio.create_task(detect_sts_events())
        await asyncio.sleep(1)
        asyncio.create_task(aggregate_daily_transits(datetime.now().strftime("%Y-%m-%d")))
        await asyncio.sleep(1)
        asyncio.create_task(generate_daily_brief())

    asyncio.create_task(run_startup_tasks())

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
app.include_router(fujairah.router, prefix="/api")
app.include_router(congestion.router, prefix="/api")
app.include_router(weather.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "hummus-tracker"}


@app.get("/api/status")
async def status():
    """Composite health status of the Strait of Hormuz."""
    return await get_strait_status()


@app.get("/api/activity")
async def activity(limit: int = 50):
    """Recent intelligence events for the activity feed."""
    return await get_recent_activity(limit=limit)


@app.get("/api/brief/latest")
async def latest_brief():
    """Most recent auto-generated daily intelligence brief."""
    return await get_latest_brief()


@app.get("/api/overview")
async def overview():
    """Dashboard overview — key metrics for the Hormuz strait.

    Falls back to the latest DailyTransitSummary from DB when live AIS
    data hasn't accumulated yet (cold boot / machine resume).
    """
    from .services.ais_stream import get_live_vessels, get_stream_status
    from .services.fred import get_latest_prices
    from .services.eia import fetch_hormuz_flow
    from .services.imf_portwatch import fetch_hormuz_summary
    from sqlalchemy import desc

    from .services.dark_vessels import get_active_dark_vessels
    from .services.sts_detection import get_active_sts_events
    
    vessels = get_live_vessels()
    dark_vessels = await get_active_dark_vessels()
    sts_events = await get_active_sts_events()
    
    tankers = [v for v in vessels if v.get("vessel_type", 0) in range(70, 90)]
    loaded_outbound = [v for v in tankers if v.get("is_loaded") and v.get("direction") == "outbound"]
    ballast_inbound = [v for v in tankers if not v.get("is_loaded") and v.get("direction") == "inbound"]

    # If live data is available, use it
    if len(tankers) > 0:
        strait_status = {
            "vessels_tracked": len(vessels),
            "tankers_active": len(tankers),
            "loaded_tankers": len(loaded_outbound),
            "ballast_tankers": len(ballast_inbound),
            "dark_vessel_count": len(dark_vessels),
            "sts_event_count": len(sts_events),
            "total_dwt_outbound": sum(v.get("dwt", 0) or 0 for v in loaded_outbound),
            "inbound_outbound_ratio": (len(loaded_outbound) / len(ballast_inbound)) if len(ballast_inbound) > 0 else 1.0,
            "source": "live",
        }
    else:
        # Cold boot fallback — serve last cached daily summary from DB
        with SessionLocal() as db:
            summary = db.query(DailyTransitSummary).order_by(desc(DailyTransitSummary.date)).first()
        if summary:
            strait_status = {
                "vessels_tracked": summary.total_vessels or 0,
                "tankers_active": summary.tanker_count or 0,
                "loaded_tankers": summary.loaded_count or 0,
                "ballast_tankers": summary.ballast_count or 0,
                "dark_vessel_count": 0,
                "sts_event_count": 0,
                "total_dwt_outbound": summary.total_dwt_outbound or 0,
                "inbound_outbound_ratio": (summary.loaded_count / summary.ballast_count) if summary.ballast_count else 1.0,
                "source": "cached",
                "cached_date": summary.date,
            }
        else:
            strait_status = {
                "vessels_tracked": 0,
                "tankers_active": 0,
                "loaded_tankers": 0,
                "ballast_tankers": 0,
                "total_dwt_outbound": 0,
                "inbound_outbound_ratio": 1.0,
                "source": "no_data",
            }

    oil_prices = await get_latest_prices()
    baseline = await fetch_hormuz_flow()
    imf = await fetch_hormuz_summary()
    stream = get_stream_status()

    return {
        "strait_status": strait_status,
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
