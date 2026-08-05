import pandas as pd
from typing import Dict, Any
from src.strategies.base import BaseStrategy

class MovingAverageCrossoverStrategy(BaseStrategy):
    @property
    def id(self) -> str:
        return "ma_crossover"
        
    @property
    def name(self) -> str:
        return "Moving Average Crossover"
        
    @property
    def description(self) -> str:
        return "A simple strategy that buys when short MA crosses above long MA, and sells when short MA crosses below long MA."
        
    @property
    def default_params(self) -> Dict[str, Any]:
        return {
            "short_window": 50,
            "long_window": 200
        }
        
    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        p = self.get_params(params)
        short_window = p["short_window"]
        long_window = p["long_window"]
        
        # Calculate moving averages
        short_ma = data['close'].rolling(window=short_window, min_periods=1).mean()
        long_ma = data['close'].rolling(window=long_window, min_periods=1).mean()
        
        # Initialize signals
        signals = pd.Series(0, index=data.index)
        
        # Buy condition: Short MA crosses above Long MA (Simplified logic)
        signals[short_ma > long_ma] = 1
        
        # Sell condition: Short MA crosses below Long MA
        signals[short_ma < long_ma] = -1
        
        return signals
