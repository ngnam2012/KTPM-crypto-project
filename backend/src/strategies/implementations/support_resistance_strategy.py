import pandas as pd
import numpy as np
from typing import Dict, Any
from src.strategies.base import BaseStrategy

class SupportResistanceStrategy(BaseStrategy):
    @property
    def id(self) -> str:
        return "support_resistance"
        
    @property
    def name(self) -> str:
        return "Support & Resistance"
        
    @property
    def description(self) -> str:
        return "A strategy that identifies support and resistance levels using rolling min/max of recent candles, and generates buy signals near support and sell signals near resistance."
        
    @property
    def default_params(self) -> Dict[str, Any]:
        return {
            "lookback": 20,
            "tolerance": 0.02
        }
        
    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        p = self.get_params(params)
        lookback = p["lookback"]
        tolerance = p["tolerance"]
        
        close = data['close']
        low = data['low']
        high = data['high']
        
        # Calculate rolling support and resistance levels
        support = low.rolling(window=lookback, min_periods=1).min()
        resistance = high.rolling(window=lookback, min_periods=1).max()
        
        # Initialize signals
        signals = pd.Series(0, index=data.index)
        
        # Buy condition: close is within support ± tolerance%
        buy_mask = (close <= support * (1 + tolerance)) & (close >= support * (1 - tolerance))
        signals[buy_mask] = 1
        
        # Sell condition: close is within resistance ± tolerance%
        sell_mask = (close >= resistance * (1 - tolerance)) & (close <= resistance * (1 + tolerance))
        signals[sell_mask] = -1
        
        return signals
