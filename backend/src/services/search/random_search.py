import math
import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

from src.strategies.registry import StrategyRegistry
from src.strategies.composite import CompositeStrategy
from src.infrastructure.adapters.binance_adapter import BinanceAdapter
from src.services.backtest.evaluator import BacktestEvaluator
from src.services.search.strategy_generator import StrategyCandidate, StrategyGenerator
from src.infrastructure.message_broker.event_bus import event_bus
from src.infrastructure.message_broker.events import EventType


@dataclass
class SearchResult:
    """One evaluated candidate with its backtest metrics and overall score."""
    candidate: StrategyCandidate
    metrics: Dict[str, Any]
    overall_score: float

    def to_dict(self) -> dict:
        return {
            "candidate": self.candidate.to_dict(),
            "metrics": self.metrics,
            "overall_score": round(self.overall_score, 6),
        }


@dataclass
class SearchState:
    """Mutable state object shared between the background task and API layer."""
    status: str = "idle"          # idle | running | completed | stopped | error
    total: int = 0
    evaluated: int = 0
    top_k: int = 10
    results: List[SearchResult] = field(default_factory=list)
    error: Optional[str] = None
    start_time: float = 0.0

    @property
    def progress(self) -> float:
        return (self.evaluated / self.total * 100) if self.total > 0 else 0.0

    def to_dict(self) -> dict:
        import time
        elapsed = time.time() - self.start_time if self.start_time > 0 and self.status == "running" else 0
        if self.status == "completed" or self.status == "stopped":
            elapsed = 0 # Optional: store end time if we want to show total time
            
        best_score = self.results[0].overall_score if self.results else 0.0

        return {
            "status": self.status,
            "progress": round(self.progress, 1),
            "evaluated": self.evaluated,
            "total": self.total,
            "results_count": len(self.results),
            "best_score": best_score,
            "time_elapsed": elapsed,
        }


class RandomSearch:
    """
    Generates random strategy candidates, backtests each one, and ranks
    the results by a weighted overall score.

    Score formula (all components normalised to roughly [0, 1]):
        overall = 0.4 * norm_return
                + 0.3 * winrate
                + 0.2 * (1 + max_drawdown)   # mdd is negative, so 1+mdd ∈ [0,1]
                + 0.1 * norm_sharpe
    """

    def __init__(self, registry: StrategyRegistry, adapter: BinanceAdapter):
        self.registry = registry
        self.adapter = adapter
        self.generator = StrategyGenerator(registry)
        self.state = SearchState()
        self._stop_flag = False

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def search(
        self,
        symbol: str = "BTC/USDT",
        timeframe: str = "1h",
        limit: int = 2000,
        n_candidates: int = 100,
        top_k: int = 10,
    ) -> List[SearchResult]:
        """Run a full random search.  Updates *self.state* in-place."""
        import time
        self._stop_flag = False
        self.state = SearchState(status="running", total=n_candidates, top_k=top_k, start_time=time.time())

        try:
            # 1. Fetch market data once
            df = self.adapter.fetch_ohlcv(symbol, timeframe, limit)
            if df.empty:
                self.state.status = "error"
                self.state.error = "Could not fetch market data."
                return []

            # 2. Generate candidates
            candidates = self.generator.generate_candidates(n_candidates)

            # 3. Evaluate each candidate
            all_results: List[SearchResult] = []

            for candidate in candidates:
                if self._stop_flag:
                    self.state.status = "stopped"
                    break

                result = self._evaluate_candidate(candidate, df)
                if result is not None:
                    all_results.append(result)

                self.state.evaluated += 1

                # Keep a running top_k for live polling
                all_results.sort(key=lambda r: r.overall_score, reverse=True)
                self.state.results = all_results[:top_k]

            if self.state.status == "running":
                self.state.status = "completed"

            return self.state.results

        except Exception as e:
            self.state.status = "error"
            self.state.error = str(e)
            return []

    def stop(self):
        """Signal the running search to stop after the current iteration."""
        self._stop_flag = True

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    def _evaluate_candidate(
        self, candidate: StrategyCandidate, df: pd.DataFrame
    ) -> Optional[SearchResult]:
        """Backtest a single candidate and compute its overall score."""
        try:
            # Build strategy instance(s)
            instances = []
            for sid in candidate.strategy_ids:
                instance = self.registry.get_strategy(sid)
                instances.append(instance)

            # Generate signals
            if len(instances) == 1:
                inst = instances[0]
                signals = inst.generate_signals(df, candidate.params.get(inst.id, {}))
            else:
                composite = CompositeStrategy(instances, logic=candidate.logic)
                signals = composite.generate_signals(df, candidate.params)

            # Evaluate via BacktestEvaluator
            metrics = BacktestEvaluator.evaluate(df, signals)
            if not metrics:
                return None

            # Compute Sharpe Ratio inline from strategy returns
            sharpe = self._compute_sharpe(df, signals)
            metrics["sharpe_ratio"] = sharpe

            # Compute overall score
            score = self._compute_score(metrics)
            
            # Push to leaderboard
            if len(instances) == 1:
                strat_name = instances[0].name
            else:
                strat_name = composite.name
                
            event_bus.publish(
                EventType.BACKTEST_COMPLETED,
                {
                    "strategy_name": strat_name,
                    "config": candidate.to_dict(),
                    "metrics": metrics
                }
            )

            return SearchResult(
                candidate=candidate,
                metrics=metrics,
                overall_score=score,
            )
        except Exception:
            # Skip candidates that fail (e.g. bad param combos)
            return None

    @staticmethod
    def _compute_sharpe(data: pd.DataFrame, signals: pd.Series) -> float:
        """Compute annualised Sharpe Ratio from positions and market returns."""
        positions = signals.replace(0, np.nan).ffill().fillna(0)
        market_returns = data["close"].pct_change()
        strategy_returns = (positions.shift(1) * market_returns).fillna(0)

        mean_ret = strategy_returns.mean()
        std_ret = strategy_returns.std()

        if std_ret == 0 or np.isnan(std_ret):
            return 0.0

        return float(mean_ret / std_ret * math.sqrt(252))

    @staticmethod
    def _compute_score(metrics: dict) -> float:
        """
        Weighted score with components normalised to roughly [0, 1].
          0.4 * tanh(total_return)          — maps return to (-1, 1)
          0.3 * winrate                     — already [0, 1]
          0.2 * (1 + max_drawdown)          — mdd ∈ [-1, 0] → (1+mdd) ∈ [0, 1]
          0.1 * tanh(sharpe / 3)            — maps sharpe to (-1, 1)
        """
        norm_return = math.tanh(metrics.get("total_return", 0))
        winrate = metrics.get("winrate", 0)
        mdd_component = 1 + metrics.get("max_drawdown", 0)  # mdd is negative
        norm_sharpe = math.tanh(metrics.get("sharpe_ratio", 0) / 3)

        score = (
            0.4 * norm_return
            + 0.3 * winrate
            + 0.2 * mdd_component
            + 0.1 * norm_sharpe
        )
        return score
