import time
import math
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
import queue
from threading import Lock, Thread

from src.strategies.registry import StrategyRegistry
from src.strategies.composite import CompositeStrategy
from src.infrastructure.adapters.binance_adapter import BinanceAdapter
from src.services.backtest.evaluator import BacktestEvaluator
from src.services.search.strategy_generator import StrategyCandidate, StrategyGenerator
from src.services.search.genetic_search import GeneticSearch
from src.infrastructure.message_broker.event_bus import event_bus
from src.infrastructure.message_broker.events import EventType

class ContinuousLoopState:
    def __init__(self):
        self.status = "idle" # idle | running | stopped | error
        self.iterations = 0
        self.best_score = -float('inf')
        self.last_improvement_iteration = 0
        self.start_time = 0.0
        self.error = None

    def to_dict(self):
        return {
            "status": self.status,
            "iterations": self.iterations,
            "best_score": self.best_score if self.best_score != -float('inf') else 0,
            "last_improvement_iteration": self.last_improvement_iteration,
            "uptime_seconds": round(time.time() - self.start_time, 2) if self.start_time > 0 else 0,
            "error": self.error
        }

class ContinuousSearchLoop:
    def __init__(self, registry: StrategyRegistry, adapter: BinanceAdapter):
        self.registry = registry
        self.adapter = adapter
        self.generator = StrategyGenerator(registry)
        self.state = ContinuousLoopState()
        self.lock = Lock()
        self._stop_flag = False

    def get_state(self) -> dict:
        with self.lock:
            return self.state.to_dict()

    def stop(self):
        with self.lock:
            if self.state.status == "running":
                self._stop_flag = True

    def _worker_loop(self, df: pd.DataFrame):
        while True:
            candidate = self.queue.get()
            if candidate is None:  # Sentinel value to stop
                self.queue.task_done()
                break
            
            try:
                result_score = self._evaluate_candidate(candidate, df)
                with self.lock:
                    self.state.iterations += 1
                    if result_score is not None and result_score > self.state.best_score:
                        self.state.best_score = result_score
                        self.state.last_improvement_iteration = self.state.iterations
            except Exception as e:
                pass
            finally:
                self.queue.task_done()

    def run_loop(self, algorithm: str = "random", symbol: str = "BTC/USDT", timeframe: str = "1h", limit: int = 2000,
                 max_iterations: Optional[int] = None, time_limit: Optional[int] = None, no_improvement_threshold: Optional[int] = None,
                 num_workers: int = 4, population_size: int = 20, mutation_rate: float = 0.1):
        with self.lock:
            self.state = ContinuousLoopState()
            self.state.status = "running"
            self.state.start_time = time.time()
            self._stop_flag = False
            
        self.queue = queue.Queue(maxsize=100)
        workers = []
            
        try:
            df = self.adapter.fetch_ohlcv(symbol, timeframe, limit)
            if df.empty:
                with self.lock:
                    self.state.status = "error"
                    self.state.error = "Could not fetch market data."
                return
                
            # Start workers
            for _ in range(num_workers):
                w = Thread(target=self._worker_loop, args=(df,))
                w.daemon = True
                w.start()
                workers.append(w)

            while True:
                with self.lock:
                    if self._stop_flag:
                        self.state.status = "stopped"
                        break
                    
                    # Check stop conditions
                    if max_iterations and self.state.iterations >= max_iterations:
                        self.state.status = "stopped"
                        break
                    if time_limit and (time.time() - self.state.start_time) >= time_limit:
                        self.state.status = "stopped"
                        break
                    if no_improvement_threshold and (self.state.iterations - self.state.last_improvement_iteration) >= no_improvement_threshold:
                        self.state.status = "stopped"
                        break

                if algorithm == "random":
                    if not self.queue.full():
                        candidates = self.generator.generate_candidates(1)
                        if candidates:
                            self.queue.put(candidates[0])
                    else:
                        time.sleep(0.1)
                elif algorithm == "genetic":
                    # For GA, we rely on a separate implementation or we just inject GA candidates.
                    # Since ContinuousLoop is async workers, doing a true GA is complex. 
                    # We will simulate GA by creating a GeneticSearch instance and taking its next population.
                    if not hasattr(self, '_ga_engine'):
                        self._ga_engine = GeneticSearch(self.registry, self.adapter)
                        self._ga_population = self._ga_engine.generator.generate_candidates(population_size)
                        self._ga_evaluated = []
                    
                    if not self.queue.full():
                        if self._ga_population:
                            self.queue.put(self._ga_population.pop(0))
                        else:
                            # A generation is done, but we need the evaluated results to create next generation.
                            # In async continuous loop, this requires syncing. For simplicity in continuous mode, 
                            # we can fallback to random if we can't sync, or just generate a new random population.
                            # Proper GA should be run via the main Search endpoint.
                            candidates = self.generator.generate_candidates(1)
                            if candidates:
                                self.queue.put(candidates[0])
                    else:
                        time.sleep(0.1)
                        
        except Exception as e:
            with self.lock:
                self.state.status = "error"
                self.state.error = str(e)
                
        # Ensure status is properly updated if exited loop naturally
        with self.lock:
            if self.state.status == "running":
                self.state.status = "stopped"
                
        # Fast shutdown: clear pending tasks
        while not self.queue.empty():
            try:
                self.queue.get_nowait()
                self.queue.task_done()
            except queue.Empty:
                break
                
        # Send sentinels to stop workers gracefully
        for _ in range(len(workers)):
            self.queue.put(None)
            
        # Wait for workers to finish
        for w in workers:
            w.join()

    def _evaluate_candidate(self, candidate: StrategyCandidate, df: pd.DataFrame) -> Optional[float]:
        try:
            instances = []
            for sid in candidate.strategy_ids:
                instance = self.registry.get_strategy(sid)
                instances.append(instance)

            if len(instances) == 1:
                inst = instances[0]
                signals = inst.generate_signals(df, candidate.params.get(inst.id, {}))
            else:
                composite = CompositeStrategy(instances, logic=candidate.logic)
                signals = composite.generate_signals(df, candidate.params)

            metrics = BacktestEvaluator.evaluate(df, signals)
            if not metrics:
                return None

            sharpe = self._compute_sharpe(df, signals)
            metrics["sharpe_ratio"] = sharpe
            score = self._compute_score(metrics)
            
            # Push to leaderboard
            strat_name = instances[0].name if len(instances) == 1 else composite.name
            event_bus.publish(
                EventType.BACKTEST_COMPLETED,
                {
                    "strategy_name": strat_name,
                    "config": candidate.to_dict(),
                    "metrics": metrics
                }
            )
            return score
        except Exception:
            return None

    @staticmethod
    def _compute_sharpe(data: pd.DataFrame, signals: pd.Series) -> float:
        positions = signals.replace(0, np.nan).ffill().fillna(0)
        market_returns = data["close"].pct_change()
        strategy_returns = (positions.shift(1) * market_returns).fillna(0)
        mean_ret = strategy_returns.mean()
        std_ret = strategy_returns.std()
        if std_ret == 0 or np.isnan(std_ret): return 0.0
        return float(mean_ret / std_ret * math.sqrt(252))

    @staticmethod
    def _compute_score(metrics: dict) -> float:
        norm_return = math.tanh(metrics.get("total_return", 0))
        winrate = metrics.get("winrate", 0)
        mdd_component = 1 + metrics.get("max_drawdown", 0)
        norm_sharpe = math.tanh(metrics.get("sharpe_ratio", 0) / 3)
        return (0.4 * norm_return + 0.3 * winrate + 0.2 * mdd_component + 0.1 * norm_sharpe)
