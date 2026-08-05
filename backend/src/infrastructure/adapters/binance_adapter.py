import ccxt
import pandas as pd
from src.infrastructure.adapters.base_exchange import IExchangeAdapter

class BinanceAdapter(IExchangeAdapter):
    def __init__(self):
        # Initialize CCXT Binance instance
        self.exchange = ccxt.binance({
            'enableRateLimit': True,
        })
        
    def fetch_ohlcv(self, symbol: str, timeframe: str, limit: int = 500) -> pd.DataFrame:
        try:
            # Fetch raw data from Binance
            raw_data = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            
            if not raw_data:
                return pd.DataFrame()
                
            # Convert to pandas DataFrame
            df = pd.DataFrame(raw_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            
            # Convert timestamp from milliseconds to datetime
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            # Set timestamp as index
            df.set_index('timestamp', inplace=True)
            
            # Ensure float types for numeric columns
            numeric_cols = ['open', 'high', 'low', 'close', 'volume']
            df[numeric_cols] = df[numeric_cols].astype(float)
            
            return df
        except Exception as e:
            print(f"Error fetching data from Binance for {symbol}: {e}")
            raise e
