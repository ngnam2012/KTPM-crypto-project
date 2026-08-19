import os
import json
import logging
from src.services.search.celery_app import celery_app
from src.strategies.registry import StrategyRegistry
from src.infrastructure.adapters.binance_adapter import BinanceAdapter
from src.services.search.random_search import RandomSearch
from src.services.search.genetic_search import GeneticSearch

logger = logging.getLogger(__name__)

@celery_app.task(bind=True)
def run_search_task(
    self,
    algorithm: str = "random",
    symbol: str = "BTC/USDT",
    timeframe: str = "1h",
    limit: int = 2000,
    n_candidates: int = 100,
    top_k: int = 10,
    population_size: int = 20,
    generations: int = 5,
    mutation_rate: float = 0.1
):
    registry = StrategyRegistry()
    adapter = BinanceAdapter()
    
    if algorithm == "genetic":
        engine = GeneticSearch(registry, adapter)
        results = engine.search(
            symbol=symbol,
            timeframe=timeframe,
            limit=limit,
            population_size=population_size,
            generations=generations,
            mutation_rate=mutation_rate,
            top_k=top_k
        )
    else:
        engine = RandomSearch(registry, adapter)
        results = engine.search(
            symbol=symbol,
            timeframe=timeframe,
            limit=limit,
            n_candidates=n_candidates,
            top_k=top_k
        )
        
    return {
        "status": engine.state.status,
        "results": [r.to_dict() for r in results]
    }
