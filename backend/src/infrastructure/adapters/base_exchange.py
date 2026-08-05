from abc import ABC, abstractmethod
import pandas as pd

class IExchangeAdapter(ABC):
    """
    Abstract Base Class for Cryptocurrency Exchange Adapters.
    """
    
    @abstractmethod
    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 500) -> pd.DataFrame:
        """
        Fetches OHLCV (Open, High, Low, Close, Volume) data.
        
        :param symbol: Trading pair symbol (e.g., 'BTC/USDT')
        :param timeframe: Timeframe (e.g., '1m', '1h', '1d')
        :param limit: Number of candles to fetch
        :return: pandas DataFrame with DatetimeIndex and columns: open, high, low, close, volume
        """
        pass
