import pandas as pd
from typing import Dict, Any, List
from src.domain.interfaces import IStrategy

class CompositeStrategy(IStrategy):
    """
    A strategy that combines multiple child strategies using AND/OR logic.
    """
    def __init__(self, children: List[IStrategy], logic: str = "AND", weights: List[float] = None):
        if not children:
            raise ValueError("CompositeStrategy requires at least one child strategy.")
        self.children = children
        self.logic = logic.upper()
        if self.logic not in ["AND", "OR", "WEIGHTED"]:
            raise ValueError("Logic must be 'AND', 'OR', or 'WEIGHTED'")
        
        self.weights = weights
        if self.logic == "WEIGHTED":
            if not self.weights:
                raise ValueError("weights must be provided when logic is 'WEIGHTED'")
            if len(self.weights) != len(self.children):
                raise ValueError("Length of weights must equal length of children")
            if not abs(sum(self.weights) - 1.0) < 1e-6:
                raise ValueError("Sum of weights must be 1.0")

    @property
    def id(self) -> str:
        child_ids = "_".join(c.id for c in self.children)
        return f"composite_{self.logic.lower()}_{child_ids}"

    @property
    def name(self) -> str:
        child_names = f" {self.logic} ".join(c.name for c in self.children)
        return f"Composite: {child_names}"

    @property
    def description(self) -> str:
        return f"Combines {len(self.children)} strategies using {self.logic} logic."

    @property
    def default_params(self) -> Dict[str, Any]:
        """
        For a composite strategy, params passed to generate_signals should be a dict of {child_id: params_dict}.
        """
        return {}

    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        if params is None:
            params = {}
            
        # Collect signals from all children
        all_signals = []
        for child in self.children:
            child_params = params.get(child.id, None)
            signals = child.generate_signals(data, child_params)
            all_signals.append(signals)
            
        # Combine into a single DataFrame for fast vectorized operations
        # Each column is a strategy's signals
        signals_df = pd.concat(all_signals, axis=1)
        
        num_strategies = len(self.children)
        
        # Initialize output
        final_signals = pd.Series(0, index=data.index)
        
        if self.logic == "AND":
            # BUY (1) only if ALL are 1. Sum must equal num_strategies
            final_signals[signals_df.sum(axis=1) == num_strategies] = 1
            # SELL (-1) only if ALL are -1. Sum must equal -num_strategies
            final_signals[signals_df.sum(axis=1) == -num_strategies] = -1
        
        elif self.logic == "OR":
            # BUY (1) if AT LEAST ONE is 1. Max == 1
            has_buy = signals_df.max(axis=1) == 1
            # SELL (-1) if AT LEAST ONE is -1. Min == -1
            has_sell = signals_df.min(axis=1) == -1
            
            # Apply Buy
            final_signals[has_buy] = 1
            # Apply Sell
            final_signals[has_sell] = -1
            
            # Handle conflict (Buy and Sell at the same time) -> Hold (0)
            conflict = has_buy & has_sell
            final_signals[conflict] = 0
            
        elif self.logic == "WEIGHTED":
            # Multiply each strategy's signals by its corresponding weight
            weighted_sum = (signals_df * self.weights).sum(axis=1)
            
            # BUY if weighted sum > threshold (0.5)
            final_signals[weighted_sum > 0.5] = 1
            # SELL if weighted sum < -threshold (-0.5)
            final_signals[weighted_sum < -0.5] = -1
            
        return final_signals
