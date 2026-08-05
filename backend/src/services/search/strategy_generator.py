import random
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any

from src.strategies.registry import StrategyRegistry


@dataclass
class StrategyCandidate:
    """A randomly generated strategy combination to be backtested."""
    strategy_ids: List[str]
    params: Dict[str, Dict[str, Any]]   # {strategy_id: {param_name: value}}
    logic: str                           # "AND" or "OR"

    def to_dict(self) -> dict:
        return asdict(self)


# Sensible parameter ranges for random generation, keyed by strategy ID.
# Each param maps to (min, max, type) where type is 'int' or 'float'.
PARAM_RANGES: Dict[str, Dict[str, tuple]] = {
    "ma_crossover": {
        "short_window": (10, 100, "int"),
        "long_window": (100, 300, "int"),
    },
    "rsi": {
        "window": (7, 28, "int"),
        "overbought": (65, 85, "int"),
        "oversold": (15, 35, "int"),
    },
    "bollinger_bands": {
        "period": (10, 50, "int"),
        "std_dev": (1.0, 3.0, "float"),
    },
    "support_resistance": {
        "lookback": (10, 50, "int"),
        "tolerance": (0.005, 0.05, "float"),
    },
    "smc": {
        "swing_length": (3, 10, "int"),
        "ob_threshold": (0.001, 0.01, "float"),
    },
}


class StrategyGenerator:
    """
    Generates random strategy candidates by picking 1-3 strategies,
    randomising their parameters within sensible ranges, and choosing
    a combination logic.
    """

    def __init__(self, registry: StrategyRegistry):
        self.registry = registry
        # Collect the IDs of all registered strategies
        self._available_ids = [s["id"] for s in registry.get_all_strategies()]

    def generate_candidates(self, n: int) -> List[StrategyCandidate]:
        """Generate *n* random StrategyCandidate instances."""
        candidates: List[StrategyCandidate] = []
        for _ in range(n):
            candidates.append(self._random_candidate())
        return candidates

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    def _random_candidate(self) -> StrategyCandidate:
        # Pick 1-3 strategies (without repeats)
        k = random.randint(1, min(3, len(self._available_ids)))
        chosen_ids = random.sample(self._available_ids, k)

        # Randomise params for each chosen strategy
        params: Dict[str, Dict[str, Any]] = {}
        for sid in chosen_ids:
            params[sid] = self._random_params(sid)

        # Choose combination logic (irrelevant for single strategy, but harmless)
        logic = random.choice(["AND", "OR"])

        return StrategyCandidate(
            strategy_ids=chosen_ids,
            params=params,
            logic=logic,
        )

    @staticmethod
    def _random_params(strategy_id: str) -> Dict[str, Any]:
        """Return randomised params for *strategy_id* within its defined ranges."""
        ranges = PARAM_RANGES.get(strategy_id)
        if not ranges:
            # Unknown strategy — fall back to empty (will use defaults)
            return {}

        result: Dict[str, Any] = {}
        for param_name, (lo, hi, ptype) in ranges.items():
            if ptype == "int":
                result[param_name] = random.randint(int(lo), int(hi))
            else:
                result[param_name] = round(random.uniform(lo, hi), 4)

        # Extra validation for MA: ensure short < long
        if strategy_id == "ma_crossover":
            if result.get("short_window", 0) >= result.get("long_window", 999):
                result["short_window"], result["long_window"] = (
                    min(result["short_window"], result["long_window"]),
                    max(result["short_window"], result["long_window"]),
                )
                # Still equal after swap? nudge apart
                if result["short_window"] == result["long_window"]:
                    result["short_window"] = max(10, result["long_window"] - 20)

        return result
