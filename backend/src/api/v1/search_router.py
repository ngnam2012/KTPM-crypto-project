from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.strategies.registry import StrategyRegistry
from src.infrastructure.adapters.binance_adapter import BinanceAdapter
from src.services.search.random_search import RandomSearch
from src.services.search.genetic_search import GeneticSearch
from src.services.search.continuous_loop import ContinuousSearchLoop

router = APIRouter(prefix="/api/v1/search", tags=["Strategy Search"])

# ------------------------------------------------------------------ #
#  Shared singleton state
# ------------------------------------------------------------------ #
registry = StrategyRegistry()
adapter = BinanceAdapter()
_search_engine = None
_continuous_loop: Optional[ContinuousSearchLoop] = None


def _get_engine(algorithm: str = "random"):
    global _search_engine
    if _search_engine is None:
        if algorithm == "genetic":
            _search_engine = GeneticSearch(registry, adapter)
        else:
            _search_engine = RandomSearch(registry, adapter)
    return _search_engine

def _get_continuous_loop() -> ContinuousSearchLoop:
    global _continuous_loop
    if _continuous_loop is None:
        _continuous_loop = ContinuousSearchLoop(registry, adapter)
    return _continuous_loop


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

@router.post("/start", status_code=202)
async def start_search(request: SearchRequest, background_tasks: BackgroundTasks):
    """
    Launch a random strategy search in the background.
    Returns immediately with 202 Accepted.
    """
    engine = _get_engine(request.algorithm)

    if engine.state.status == "running":
        raise HTTPException(
            status_code=409,
            detail="A search is already running. Stop it first or wait for completion.",
        )

    # Reset engine for a fresh run
    global _search_engine
    if request.algorithm == "genetic":
        _search_engine = GeneticSearch(registry, adapter)
        background_tasks.add_task(
            _search_engine.search,
            symbol=request.symbol,
            timeframe=request.timeframe,
            limit=request.limit,
            population_size=request.population_size,
            generations=request.generations,
            mutation_rate=request.mutation_rate,
            top_k=request.top_k,
        )
    else:
        _search_engine = RandomSearch(registry, adapter)
        background_tasks.add_task(
            _search_engine.search,
            symbol=request.symbol,
            timeframe=request.timeframe,
            limit=request.limit,
            n_candidates=request.n_candidates,
            top_k=request.top_k,
        )
        
    engine = _search_engine

    return {
        "message": "Search started",
        "config": {
            "algorithm": request.algorithm,
            "symbol": request.symbol,
            "timeframe": request.timeframe,
            "n_candidates": request.n_candidates,
            "top_k": request.top_k,
            "population_size": request.population_size,
            "generations": request.generations,
            "mutation_rate": request.mutation_rate,
        },
    }


@router.get("/status")
async def get_search_status():
    """Return current search state (status, progress, results count)."""
    engine = _get_engine()
    return engine.state.to_dict()


@router.post("/stop")
async def stop_search():
    """Signal the running search to stop after the current iteration."""
    engine = _get_engine()

    if engine.state.status != "running":
        raise HTTPException(
            status_code=400,
            detail=f"No search is currently running (status: {engine.state.status}).",
        )

    engine.stop()
    return {"message": "Stop signal sent. Search will halt after the current candidate."}


@router.get("/results")
async def get_search_results():
    """Return the current top-k results (available even while the search is still running)."""
    engine = _get_engine()
    return {
        "status": engine.state.status,
        "results": [r.to_dict() for r in engine.state.results],
    }

# --- Continuous Loop Endpoints ---

@router.post("/loop/start", status_code=202)
async def start_continuous_loop(request: LoopStartRequest, background_tasks: BackgroundTasks):
    loop_engine = _get_continuous_loop()
    
    if loop_engine.get_state()["status"] == "running":
        raise HTTPException(status_code=409, detail="A continuous loop is already running.")
        
    global _continuous_loop
    _continuous_loop = ContinuousSearchLoop(registry, adapter)
    loop_engine = _continuous_loop
    
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
    loop_engine = _get_continuous_loop()
    if loop_engine.get_state()["status"] != "running":
        raise HTTPException(status_code=400, detail="No continuous loop is currently running.")
    loop_engine.stop()
    return {"message": "Stop signal sent to the continuous loop."}

@router.get("/loop/status")
async def get_continuous_loop_status():
    loop_engine = _get_continuous_loop()
    return loop_engine.get_state()
