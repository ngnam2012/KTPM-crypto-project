import random
import math
import copy
from typing import List, Dict, Any, Optional

import pandas as pd
import numpy as np

from src.strategies.registry import StrategyRegistry
from src.infrastructure.adapters.binance_adapter import BinanceAdapter
from src.services.search.strategy_generator import StrategyCandidate, StrategyGenerator, PARAM_RANGES
from src.services.search.random_search import SearchState, SearchResult, RandomSearch

class GeneticSearch(RandomSearch):
    """
    Genetic Algorithm based search engine for strategy optimization.
    Inherits from RandomSearch to reuse evaluation and state management.
    """
    
    def __init__(self, registry: StrategyRegistry, adapter: BinanceAdapter):
        super().__init__(registry, adapter)
        # self.generator is already initialized in super()
        
    def search(
        self,
        symbol: str = "BTC/USDT",
        timeframe: str = "1h",
        limit: int = 2000,
        population_size: int = 20,
        generations: int = 5,
        mutation_rate: float = 0.1,
        top_k: int = 10,
    ) -> List[SearchResult]:
        """Run Genetic Algorithm search."""
        import time
        self._stop_flag = False
        total_evaluations = population_size * generations
        self.state = SearchState(status="running", total=total_evaluations, top_k=top_k, start_time=time.time())

        try:
            # 1. Fetch market data
            df = self.adapter.fetch_ohlcv(symbol, timeframe, limit)
            if df.empty:
                self.state.status = "error"
                self.state.error = "Could not fetch market data."
                return []

            # 2. Initialize Population
            population = self.generator.generate_candidates(population_size)
            
            all_results: List[SearchResult] = []
            
            for gen in range(generations):
                if self._stop_flag:
                    self.state.status = "stopped"
                    break
                    
                # Evaluate Population
                evaluated_population: List[SearchResult] = []
                for candidate in population:
                    if self._stop_flag:
                        break
                        
                    result = self._evaluate_candidate(candidate, df)
                    self.state.evaluated += 1
                    
                    if result is not None:
                        evaluated_population.append(result)
                        all_results.append(result)
                
                if self._stop_flag:
                    break
                    
                # Update Leaderboard
                all_results.sort(key=lambda r: r.overall_score, reverse=True)
                self.state.results = all_results[:top_k]
                
                # If it's the last generation, we don't need to create the next one
                if gen == generations - 1:
                    break
                    
                # 3. Selection, Crossover, Mutation to create next generation
                evaluated_population.sort(key=lambda r: r.overall_score, reverse=True)
                next_population: List[StrategyCandidate] = []
                
                # Elitism: Keep the best 2 candidates directly
                elite_count = min(2, len(evaluated_population))
                for i in range(elite_count):
                    next_population.append(copy.deepcopy(evaluated_population[i].candidate))
                
                # Fill the rest of the population
                while len(next_population) < population_size:
                    # Tournament selection
                    p1 = self._tournament_selection(evaluated_population)
                    p2 = self._tournament_selection(evaluated_population)
                    
                    # Crossover
                    child = self._crossover(p1.candidate, p2.candidate)
                    
                    # Mutation
                    self._mutate(child, mutation_rate)
                    
                    next_population.append(child)
                
                population = next_population

            if self.state.status == "running":
                self.state.status = "completed"

            return self.state.results

        except Exception as e:
            self.state.status = "error"
            self.state.error = str(e)
            return []

    def _tournament_selection(self, population: List[SearchResult], k: int = 3) -> SearchResult:
        """Select the best candidate out of k random candidates."""
        if not population:
            raise ValueError("Cannot select from empty population")
        k = min(k, len(population))
        tournament = random.sample(population, k)
        return max(tournament, key=lambda r: r.overall_score)

    def _crossover(self, p1: StrategyCandidate, p2: StrategyCandidate) -> StrategyCandidate:
        """Combine two parents to create a child candidate."""
        # Inherit logic
        logic = random.choice([p1.logic, p2.logic])
        
        # Inherit strategies: Random mix of both parents' strategies (up to 3)
        all_strats = list(set(p1.strategy_ids + p2.strategy_ids))
        num_strats = random.randint(1, min(3, len(all_strats)))
        child_strats = random.sample(all_strats, num_strats)
        
        # Inherit/mix parameters
        child_params = {}
        for sid in child_strats:
            in_p1 = sid in p1.strategy_ids
            in_p2 = sid in p2.strategy_ids
            
            if in_p1 and in_p2:
                # Both have it, mix parameters
                merged = {}
                for param, _ in p1.params[sid].items():
                    # 50% chance from p1, 50% from p2
                    if random.random() < 0.5:
                        merged[param] = p1.params[sid].get(param)
                    else:
                        merged[param] = p2.params[sid].get(param)
                child_params[sid] = merged
            elif in_p1:
                child_params[sid] = copy.deepcopy(p1.params[sid])
            else:
                child_params[sid] = copy.deepcopy(p2.params[sid])
                
        # Handle ma_crossover short vs long logic to prevent invalid combinations
        if "ma_crossover" in child_params:
            p = child_params["ma_crossover"]
            if p.get("short_window", 0) >= p.get("long_window", 999):
                p["short_window"], p["long_window"] = (
                    min(p["short_window"], p["long_window"]),
                    max(p["short_window"], p["long_window"]),
                )
                if p["short_window"] == p["long_window"]:
                    p["short_window"] = max(10, p["long_window"] - 20)
                
        return StrategyCandidate(strategy_ids=child_strats, params=child_params, logic=logic)

    def _mutate(self, candidate: StrategyCandidate, mutation_rate: float):
        """Randomly mutate candidate parameters with probability mutation_rate."""
        # Mutate logic
        if random.random() < mutation_rate:
            candidate.logic = "OR" if candidate.logic == "AND" else "AND"
            
        # Mutate strategies (add/remove)
        if random.random() < mutation_rate:
            available_ids = [s["id"] for s in self.registry.get_all_strategies()]
            if len(candidate.strategy_ids) > 1 and random.random() < 0.5:
                # Remove a strategy
                sid_to_remove = random.choice(candidate.strategy_ids)
                candidate.strategy_ids.remove(sid_to_remove)
                del candidate.params[sid_to_remove]
            elif len(candidate.strategy_ids) < 3:
                # Add a strategy
                sid_to_add = random.choice(available_ids)
                if sid_to_add not in candidate.strategy_ids:
                    candidate.strategy_ids.append(sid_to_add)
                    candidate.params[sid_to_add] = self.generator._random_params(sid_to_add)

        # Mutate parameters
        for sid in candidate.strategy_ids:
            ranges = PARAM_RANGES.get(sid, {})
            for param_name, (lo, hi, ptype) in ranges.items():
                if random.random() < mutation_rate:
                    if ptype == "int":
                        candidate.params[sid][param_name] = random.randint(int(lo), int(hi))
                    else:
                        candidate.params[sid][param_name] = round(random.uniform(lo, hi), 4)
                        
            # Enforce validation for ma_crossover
            if sid == "ma_crossover":
                p = candidate.params[sid]
                if p.get("short_window", 0) >= p.get("long_window", 999):
                    p["short_window"], p["long_window"] = (
                        min(p["short_window"], p["long_window"]),
                        max(p["short_window"], p["long_window"]),
                    )
                    if p["short_window"] == p["long_window"]:
                        p["short_window"] = max(10, p["long_window"] - 20)
