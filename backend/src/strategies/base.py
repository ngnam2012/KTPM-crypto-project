from src.domain.interfaces import IStrategy
import pandas as pd
from typing import Dict, Any

class BaseStrategy(IStrategy):
    """
    Base class providing common utilities for strategies.
    """
    
    def get_params(self, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Merge provided params with default_params"""
        if params is None:
            return self.default_params
        merged = self.default_params.copy()
        merged.update(params)
        return merged
