import asyncio
import logging
import uuid
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

# Strategy registry & exchange adapter singletons
registry = StrategyRegistry()
adapter = BinanceAdapter()

# Active jobs tracking dictionary
_active_searches: Dict[str, Any] = {}
_active_loops: Dict[str, ContinuousSearchLoop] = {}


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
#  Endpoints
# ------------------------------------------------------------------ #

@router.post("/start", status_code=202, response_model=SearchStartResponse)
async def start_search(request: SearchRequest, background_tasks: BackgroundTasks):
    """
    Launch a strategy search in the background.
    Returns immediately with job_id and 202 Accepted.
    """
    try:
        job_id = str(uuid.uuid4())[:8]

        if request.algorithm == "genetic":
            engine = GeneticSearch(registry, adapter)
            background_tasks.add_task(
                engine.search,
                symbol=request.symbol,
                timeframe=request.timeframe,
                limit=request.limit,
                population_size=request.population_size,
                generations=request.generations,
                mutation_rate=request.mutation_rate,
                top_k=request.top_k,
            )
        else:
            engine = RandomSearch(registry, adapter)
            background_tasks.add_task(
                engine.search,
                symbol=request.symbol,
                timeframe=request.timeframe,
                limit=request.limit,
                n_candidates=request.n_candidates,
                top_k=request.top_k,
            )

        _active_searches[job_id] = engine
        _active_searches["latest"] = engine

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
    """Return current search state (status, progress, results count)."""
    target_id = job_id or "latest"
    engine = _active_searches.get(target_id)
    if not engine:
        return SearchStatusResponse(
            job_id=job_id,
            status="idle",
            progress=0.0,
            evaluated=0,
            total=0,
            results_count=0,
            best_score=0.0,
            time_elapsed=0.0
        )
    st = engine.state.to_dict()
    st["job_id"] = target_id
    return SearchStatusResponse(**st)


@router.post("/stop")
async def stop_search(job_id: Optional[str] = None):
    """Signal the running search to stop after the current iteration."""
    target_id = job_id or "latest"
    engine = _active_searches.get(target_id)
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
    engine = _active_searches.get(target_id)
    if not engine:
        return SearchResultsResponse(status="idle", results=[])

    return SearchResultsResponse(
        status=engine.state.status,
        results=[r.to_dict() for r in engine.state.results]
    )


# --- Continuous Loop Endpoints ---

@router.post("/loop/start", status_code=202)
async def start_continuous_loop(request: LoopStartRequest, background_tasks: BackgroundTasks):
    loop_id = "main_loop"
    existing = _active_loops.get(loop_id)
    if existing and existing.get_state()["status"] == "running":
        raise HTTPException(status_code=409, detail="A continuous loop is already running.")

    loop_engine = ContinuousSearchLoop(registry, adapter)
    _active_loops[loop_id] = loop_engine

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
    loop_engine = _active_loops.get("main_loop")
    if not loop_engine or loop_engine.get_state()["status"] != "running":
        raise HTTPException(status_code=400, detail="No continuous loop is currently running.")
    loop_engine.stop()
    return {"message": "Stop signal sent to the continuous loop."}


@router.get("/loop/status")
async def get_continuous_loop_status():
    loop_engine = _active_loops.get("main_loop")
    if not loop_engine:
        return {"status": "idle", "iterations": 0, "best_score": 0.0, "last_improvement_iteration": 0, "uptime_seconds": 0, "error": None}
    return loop_engine.get_state()

