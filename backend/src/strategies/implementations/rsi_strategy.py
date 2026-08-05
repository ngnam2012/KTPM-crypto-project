import pandas as pd
import numpy as np
from typing import Dict, Any
from src.strategies.base import BaseStrategy

class RSIStrategy(BaseStrategy):
    @property
    def id(self) -> str:
        return "rsi"
        
    @property
    def name(self) -> str:
        return "Relative Strength Index"
        
    @property
    def description(self) -> str:
        return "Buys when RSI is oversold and sells when RSI is overbought."
        
    @property
    def default_params(self) -> Dict[str, Any]:
        return {
            "window": 14,
            "overbought": 70,
            "oversold": 30
        }
        
    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        p = self.get_params(params)
        window = p["window"]
        ob = p["overbought"]
        os = p["oversold"]
        
        # Calculate RSI
        delta = data['close'].diff()
        
        # Make two series: one for lower closes and one for higher closes
        up = delta.clip(lower=0)
        down = -1 * delta.clip(upper=0)
        
        # Calculate the EWMA
        roll_up = up.ewm(com=window-1, adjust=False).mean()
        roll_down = down.ewm(com=window-1, adjust=False).mean()
        
        # Calculate RSI
        rs = roll_up / roll_down
        rsi = 100.0 - (100.0 / (1.0 + rs))
        
        # Initialize signals
        signals = pd.Series(0, index=data.index)
        
        # Buy condition: RSI < oversold
        signals[rsi < os] = 1
        
        # Sell condition: RSI > overbought
        signals[rsi > ob] = -1
        
        return signals
