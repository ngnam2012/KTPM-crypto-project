from abc import ABC, abstractmethod
import pandas as pd
from typing import Dict, Any

class IStrategy(ABC):
    """
    Core interface for all trading strategies.
    Any new strategy must implement this interface to be recognized by the StrategyRegistry.
    """
    
    @property
    @abstractmethod
    def id(self) -> str:
        """Unique identifier for the strategy (e.g., 'ma_crossover')"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the strategy"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Brief description of how the strategy works"""
        pass

    @property
    @abstractmethod
    def default_params(self) -> Dict[str, Any]:
        """Default parameters required by the strategy"""
        pass

    @abstractmethod
    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        """
        Takes OHLCV dataframe and returns a Series of signals.
        Signal values: 1 (Buy), -1 (Sell), 0 (Hold)
        """
        pass
