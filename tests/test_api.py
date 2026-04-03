import pytest
from httpx import ASGITransport, AsyncClient
from backend.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "hummus-tracker"}

@pytest.mark.asyncio
async def test_overview_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/overview")
    assert response.status_code == 200
    data = response.json()
    assert "strait_status" in data
    assert "oil_flow" in data
    assert "oil_prices" in data

@pytest.mark.asyncio
async def test_daily_aggregation_logic():
    from backend.services.scheduler import aggregate_daily_transits
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    # This just ensures it runs without crashing, as there might not be data in the test DB
    await aggregate_daily_transits(today)
    
    from backend.database import SessionLocal
    from backend.models import DailyTransitSummary
    with SessionLocal() as db:
        summary = db.query(DailyTransitSummary).filter(DailyTransitSummary.date == today).first()
        assert summary is not None
        assert summary.date == today
