import ccxt.async_support as ccxt
import pandas as pd
import logging
from typing import Optional
from dateutil.parser import parse as parse_date
from src.infrastructure.adapters.base_exchange import IExchangeAdapter

logger = logging.getLogger(__name__)

class BinanceAdapter(IExchangeAdapter):
    def __init__(self):
        # Initialize CCXT async Binance instance
        self.exchange = ccxt.binance({
            'enableRateLimit': True,
        })
        
    async def fetch_ohlcv(
        self, 
        symbol: str, 
        timeframe: str, 
        limit: int = 500,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        try:
            since_ms = None
            if start_date:
                try:
                    dt = parse_date(start_date)
                    since_ms = int(dt.timestamp() * 1000)
                except Exception as e:
                    logger.warning(f"Could not parse start_date {start_date}: {e}")

            # Fetch raw data from Binance asynchronously
            raw_data = await self.exchange.fetch_ohlcv(symbol, timeframe, since=since_ms, limit=limit)
            
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

            # Filter by end_date if provided
            if end_date:
                try:
                    end_dt = parse_date(end_date)
                    df = df[df.index <= end_dt]
                except Exception as e:
                    logger.warning(f"Could not parse end_date {end_date}: {e}")
            
            return df
        except Exception as e:
            logger.exception(f"Error fetching data from Binance for {symbol}: {e}")
            raise e

    async def close(self):
        await self.exchange.close()
