import pytest
import httpx
import asyncio
from src.infrastructure.database.config import engine, Base
import src.infrastructure.database.models

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)

def test_api_import_and_root():
    async def _test():
        from src.main import app
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/")
            assert response.status_code == 200
            assert response.json() == {"message": "Welcome to Crypto Strategy Lab API"}
    asyncio.run(_test())

def test_strategies_endpoint():
    async def _test():
        from src.main import app
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/strategies")
            assert response.status_code == 200
            data = response.json()
            assert "strategies" in data
            assert len(data["strategies"]) >= 4
    asyncio.run(_test())

def test_leaderboard_endpoint():
    async def _test():
        from src.main import app
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/leaderboard")
            assert response.status_code == 200
            data = response.json()
            assert "leaderboard" in data
    asyncio.run(_test())

def test_news_sources_endpoint():
    async def _test():
        from src.main import app
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/news/sources")
            assert response.status_code == 200
            data = response.json()
            assert "sources" in data
    asyncio.run(_test())

def test_ai_strategy_generation_endpoint():
    async def _test():
        from src.main import app
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/custom-strategies/generate-from-prompt",
                json={"prompt": "Fast MA Crossover short 15 long 60 combined with RSI below 25, Stop Loss 2%, Take Profit 4%"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "name" in data
            assert len(data["strategies"]) >= 2
    asyncio.run(_test())
