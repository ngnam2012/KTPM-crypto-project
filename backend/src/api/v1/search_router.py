import asyncio
import logging
import uuid
import json
import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel

from src.strategies.registry import StrategyRegistry
from src.infrastructure.adapters.binance_adapter import BinanceAdapter
from src.services.search.random_search import RandomSearch
from src.services.search.genetic_search import GeneticSearch
from src.services.search.continuous_loop import ContinuousSearchLoop

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/search", tags=["Strategy Search"])

# Singletons
registry = StrategyRegistry()
adapter = BinanceAdapter()

# Redis client for cross-worker job state storage
# Falls back to None (in-process dict) if Redis is unavailable
_redis_client = None
_active_searches_local: Dict[str, Any] = {}      # Fallback RAM dict
_active_loops_local: Dict[str, ContinuousSearchLoop] = {}

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
JOB_TTL = 3600  # Job state expires after 1 hour


async def _get_redis():
    """Lazy-connect async Redis client for job state storage."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        client = aioredis.from_url(REDIS_URL, decode_responses=True)
        await client.ping()
        _redis_client = client
        logger.info("SearchRouter connected to Redis for job state storage.")
    except Exception as e:
        logger.warning(f"Redis unavailable for job state ({e}). Using in-process dict.")
        _redis_client = None
    return _redis_client


async def _set_job_state(job_id: str, state: dict):
    """Persist job state to Redis (or local dict as fallback)."""
    r = await _get_redis()
    if r:
        try:
            await r.set(f"search:job:{job_id}:state", json.dumps(state), ex=JOB_TTL)
            return
        except Exception as e:
            logger.warning(f"Redis set_job_state failed ({e}), using local dict.")
    _active_searches_local[job_id] = state


async def _get_job_state(job_id: str) -> Optional[dict]:
    """Retrieve job state from Redis (or local dict as fallback)."""
    r = await _get_redis()
    if r:
        try:
            raw = await r.get(f"search:job:{job_id}:state")
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.warning(f"Redis get_job_state failed ({e}), using local dict.")
    return _active_searches_local.get(job_id)


# ------------------------------------------------------------------ #
#  Request / Response models
# ------------------------------------------------------------------ #

class SearchRequest(BaseModel):
    algorithm: str = "random"
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    limit: int = 2000
    n_candidates: int = 100
    top_k: int = 10
    population_size: int = 20
    generations: int = 5
    mutation_rate: float = 0.1

class SearchStartResponse(BaseModel):
    job_id: str
    message: str
    config: Dict[str, Any]

class SearchStatusResponse(BaseModel):
    job_id: Optional[str] = None
    status: str
    progress: float
    evaluated: int
    total: int
    results_count: int
    best_score: float
    time_elapsed: float

class SearchResultsResponse(BaseModel):
    status: str
    results: List[Dict[str, Any]]

class LoopStartRequest(BaseModel):
    algorithm: str = "random"
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    limit: int = 2000
    max_iterations: Optional[int] = None
    time_limit: Optional[int] = None
    no_improvement_threshold: Optional[int] = None
    population_size: int = 20
    generations: int = 5
    mutation_rate: float = 0.1


# ------------------------------------------------------------------ #
#  Background runner helpers
# ------------------------------------------------------------------ #

async def _run_search_background(engine, job_id: str, search_kwargs: dict):
    """
    Run a search engine in the background and persist state to Redis
    so any worker can query progress via GET /status.
    """
    try:
        await _set_job_state(job_id, {"status": "running", "progress": 0.0,
                                       "evaluated": 0, "total": 0,
                                       "results_count": 0, "best_score": 0.0,
                                       "time_elapsed": 0.0, "results": []})
        await asyncio.to_thread(engine.search, **search_kwargs)

        # Persist final state
        st = engine.state.to_dict()
        st["results"] = [r.to_dict() for r in engine.state.results]
        await _set_job_state(job_id, st)
    except Exception as exc:
        logger.exception(f"Background search job {job_id} failed: {exc}")
        await _set_job_state(job_id, {"status": "error", "progress": 0.0,
                                       "evaluated": 0, "total": 0,
                                       "results_count": 0, "best_score": 0.0,
                                       "time_elapsed": 0.0, "results": []})


# ------------------------------------------------------------------ #
#  Endpoints
# ------------------------------------------------------------------ #

@router.post("/start", status_code=202, response_model=SearchStartResponse)
async def start_search(request: SearchRequest, background_tasks: BackgroundTasks):
    """
    Launch a strategy search in the background.
    Job state is written to Redis so any Uvicorn worker can read it.
    Returns immediately with job_id and 202 Accepted.
    """
    try:
        job_id = str(uuid.uuid4())[:8]

        if request.algorithm == "genetic":
            engine = GeneticSearch(registry, adapter)
            search_kwargs = dict(
                symbol=request.symbol, timeframe=request.timeframe,
                limit=request.limit, population_size=request.population_size,
                generations=request.generations, mutation_rate=request.mutation_rate,
                top_k=request.top_k,
            )
        else:
            engine = RandomSearch(registry, adapter)
            search_kwargs = dict(
                symbol=request.symbol, timeframe=request.timeframe,
                limit=request.limit, n_candidates=request.n_candidates,
                top_k=request.top_k,
            )

        # Keep in-process reference for same-worker status polling
        _active_searches_local[job_id] = engine

        # Launch async background task (persists state to Redis)
        background_tasks.add_task(_run_search_background, engine, job_id, search_kwargs)

        return SearchStartResponse(
            job_id=job_id,
            message="Search started",
            config={
                "algorithm": request.algorithm,
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "n_candidates": request.n_candidates,
                "top_k": request.top_k,
                "population_size": request.population_size,
                "generations": request.generations,
                "mutation_rate": request.mutation_rate,
            }
        )
    except Exception as e:
        logger.exception(f"Error starting search job: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/status", response_model=SearchStatusResponse)
async def get_search_status(job_id: Optional[str] = None):
    """
    Return current search state.
    First checks in-process cache (same worker), then falls back to
    Redis-persisted state (cross-worker compatible).
    """
    target_id = job_id or "latest"

    # 1. Check in-process engine reference (fast path, same worker)
    engine = _active_searches_local.get(target_id)
    if engine and hasattr(engine, "state"):
        st = engine.state.to_dict()
        st["job_id"] = target_id
        return SearchStatusResponse(**st)

    # 2. Check Redis state (cross-worker path)
    state = await _get_job_state(target_id)
    if state:
        return SearchStatusResponse(
            job_id=target_id,
            status=state.get("status", "unknown"),
            progress=state.get("progress", 0.0),
            evaluated=state.get("evaluated", 0),
            total=state.get("total", 0),
            results_count=state.get("results_count", 0),
            best_score=state.get("best_score", 0.0),
            time_elapsed=state.get("time_elapsed", 0.0),
        )

    # 3. Not found
    return SearchStatusResponse(
        job_id=job_id, status="idle",
        progress=0.0, evaluated=0, total=0,
        results_count=0, best_score=0.0, time_elapsed=0.0,
    )


@router.post("/stop")
async def stop_search(job_id: Optional[str] = None):
    """Signal the running search to stop after the current iteration."""
    target_id = job_id or "latest"
    engine = _active_searches_local.get(target_id)
    if not engine or engine.state.status != "running":
        raise HTTPException(
            status_code=400,
            detail="No running search job found to stop.",
        )
    engine.stop()
    return {"message": "Stop signal sent. Search will halt after the current candidate."}


@router.get("/results", response_model=SearchResultsResponse)
async def get_search_results(job_id: Optional[str] = None):
    """Return the current top-k results (available even while search is running)."""
    target_id = job_id or "latest"

    # In-process (same worker)
    engine = _active_searches_local.get(target_id)
    if engine:
        return SearchResultsResponse(
            status=engine.state.status,
            results=[r.to_dict() for r in engine.state.results]
        )

    # Redis (cross-worker)
    state = await _get_job_state(target_id)
    if state:
        return SearchResultsResponse(
            status=state.get("status", "unknown"),
            results=state.get("results", [])
        )

    return SearchResultsResponse(status="idle", results=[])


# --- Continuous Loop Endpoints ---

@router.post("/loop/start", status_code=202)
async def start_continuous_loop(request: LoopStartRequest, background_tasks: BackgroundTasks):
    loop_id = "main_loop"
    existing = _active_loops_local.get(loop_id)
    if existing and existing.get_state()["status"] == "running":
        raise HTTPException(status_code=409, detail="A continuous loop is already running.")

    loop_engine = ContinuousSearchLoop(registry, adapter)
    _active_loops_local[loop_id] = loop_engine

    background_tasks.add_task(
        loop_engine.run_loop,
        algorithm=request.algorithm,
        symbol=request.symbol,
        timeframe=request.timeframe,
        limit=request.limit,
        max_iterations=request.max_iterations,
        time_limit=request.time_limit,
        no_improvement_threshold=request.no_improvement_threshold,
        population_size=request.population_size,
        mutation_rate=request.mutation_rate
    )

    return {"message": "Continuous loop started", "config": request.dict()}


@router.post("/loop/stop")
async def stop_continuous_loop():
    loop_engine = _active_loops_local.get("main_loop")
    if not loop_engine or loop_engine.get_state()["status"] != "running":
        raise HTTPException(status_code=400, detail="No continuous loop is currently running.")
    loop_engine.stop()
    return {"message": "Stop signal sent to the continuous loop."}


@router.get("/loop/status")
async def get_continuous_loop_status():
    loop_engine = _active_loops_local.get("main_loop")
    if not loop_engine:
        return {"status": "idle", "iterations": 0, "best_score": 0.0,
                "last_improvement_iteration": 0, "uptime_seconds": 0, "error": None}
    return loop_engine.get_state()
