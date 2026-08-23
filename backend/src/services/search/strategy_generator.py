import random
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

from src.strategies.registry import StrategyRegistry


@dataclass
class StrategyCandidate:
    """A randomly generated strategy combination to be backtested."""
    strategy_ids: List[str]
    params: Dict[str, Dict[str, Any]]          # {strategy_id: {param_name: value}}
    logic: str = "AND"                          # "AND" | "OR" | "WEIGHTED"
    weights: Optional[List[float]] = None      # [0.4, 0.3, 0.3] for WEIGHTED

    def to_dict(self) -> dict:
        d = asdict(self)
        d["label"] = self.format_label()
        return d

    def format_label(self) -> str:
        """Format candidate into a concise, professional title (e.g. MA20/50 + RSI14 [AND])."""
        parts = []
        for idx, sid in enumerate(self.strategy_ids):
            p = self.params.get(sid, {})
            w = f" ({int(round(self.weights[idx]*100))}%)" if self.weights and idx < len(self.weights) else ""
            
            if sid == "ma_crossover":
                s_str = f"MA{p.get('short_window', 20)}/{p.get('long_window', 50)}"
            elif sid == "rsi":
                s_str = f"RSI{p.get('window', 14)}"
            elif sid == "bollinger_bands":
                s_str = f"BB{p.get('period', 20)}"
            elif sid == "support_resistance":
                s_str = f"SR{p.get('lookback', 20)}"
            elif sid == "news_sentiment":
                thresh = p.get('sentiment_threshold', 0.3)
                s_str = f"Sentiment(>{thresh})"
            elif sid == "smc":
                s_str = f"SMC{p.get('swing_length', 5)}"
            else:
                s_str = sid.replace("_", " ").title()
                
            parts.append(f"{s_str}{w}")

        if len(parts) == 1:
            return parts[0]
        
        joined = " + ".join(parts)
        return f"{joined} [{self.logic}]"


# Sensible parameter ranges for random generation, keyed by strategy ID.
# Each param maps to (min, max, type) where type is 'int' or 'float'.
PARAM_RANGES: Dict[str, Dict[str, tuple]] = {
    "ma_crossover": {
        "short_window": (10, 50, "int"),
        "long_window": (50, 200, "int"),
    },
    "rsi": {
        "window": (7, 21, "int"),
        "overbought": (65, 80, "int"),
        "oversold": (20, 35, "int"),
    },
    "bollinger_bands": {
        "period": (14, 30, "int"),
        "std_dev": (1.5, 2.5, "float"),
    },
    "support_resistance": {
        "lookback": (10, 40, "int"),
        "tolerance": (0.01, 0.03, "float"),
    },
    "smc": {
        "swing_length": (3, 8, "int"),
        "ob_threshold": (0.002, 0.008, "float"),
    },
    "news_sentiment": {
        "lookback_hours": (1, 24, "int"),
        "sentiment_threshold": (0.1, 0.6, "float"),
    },
}


class StrategyGenerator:
    """
    Generates random strategy candidates by picking 1-3 strategies,
    randomising their parameters within sensible ranges, and choosing
    a combination logic (AND, OR, WEIGHTED).
    """

    def __init__(
        self,
        registry: StrategyRegistry,
        allowed_ids: Optional[List[str]] = None,
        allowed_logics: Optional[List[str]] = None
    ):
        self.registry = registry
        all_ids = [s["id"] for s in registry.get_all_strategies()]
        if allowed_ids:
            self._available_ids = [sid for sid in allowed_ids if sid in all_ids]
            if not self._available_ids:
                self._available_ids = all_ids
        else:
            self._available_ids = all_ids

        self._allowed_logics = allowed_logics or ["AND", "OR", "WEIGHTED"]

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

        # Choose combination logic
        if len(chosen_ids) == 1:
            logic = "AND"
            weights = None
        else:
            logic = random.choice(self._allowed_logics)
            if logic == "WEIGHTED":
                # Generate random weights summing to 1.0
                raw = [random.randint(10, 50) for _ in range(len(chosen_ids))]
                total = sum(raw)
                weights = [round(w / total, 2) for w in raw]
                # Adjust last element so exact sum is 1.0
                diff = round(1.0 - sum(weights[:-1]), 2)
                weights[-1] = diff
            else:
                weights = None

        return StrategyCandidate(
            strategy_ids=chosen_ids,
            params=params,
            logic=logic,
            weights=weights,
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
                result[param_name] = round(random.uniform(lo, hi), 2)

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
