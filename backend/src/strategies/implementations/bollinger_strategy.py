import pandas as pd
from typing import Dict, Any
from src.strategies.base import BaseStrategy

class BollingerBandsStrategy(BaseStrategy):
    @property
    def id(self) -> str:
        return "bollinger_bands"
        
    @property
    def name(self) -> str:
        return "Bollinger Bands"
        
    @property
    def description(self) -> str:
        return "A mean-reversion strategy that buys when price touches or crosses below the lower Bollinger Band, and sells when price touches or crosses above the upper Bollinger Band."
        
    @property
    def default_params(self) -> Dict[str, Any]:
        return {
            "period": 20,
            "std_dev": 2
        }
        
    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        p = self.get_params(params)
        period = p["period"]
        std_dev = p["std_dev"]
        
        close = data['close']
        
        # Calculate Bollinger Bands
        middle_band = close.rolling(window=period, min_periods=1).mean()
        rolling_std = close.rolling(window=period, min_periods=1).std()
        upper_band = middle_band + std_dev * rolling_std
        lower_band = middle_band - std_dev * rolling_std
        
        # Initialize signals
        signals = pd.Series(0, index=data.index)
        
        # Buy condition: price touches or crosses below lower band
        signals[close <= lower_band] = 1
        
        # Sell condition: price touches or crosses above upper band
        signals[close >= upper_band] = -1
        
        return signals
