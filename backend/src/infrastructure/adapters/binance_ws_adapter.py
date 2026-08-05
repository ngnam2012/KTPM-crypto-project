import asyncio
import json
import logging
import websockets
from typing import Callable, Coroutine, Dict, Any

logger = logging.getLogger(__name__)

class BinanceWSAdapter:
    """
    Connects to Binance WebSocket streams and parses kline (candlestick) data.
    """
    BINANCE_WS_URL = "wss://stream.binance.com:9443/ws"

    def __init__(self):
        # Maps stream_id (e.g. btcusdt_1m) to asyncio Tasks
        self._active_tasks: Dict[str, asyncio.Task] = {}
        # Maps stream_id to list of callback functions
        self._callbacks: Dict[str, list[Callable[[dict], Coroutine]]] = {}

    def get_stream_id(self, symbol: str, interval: str) -> str:
        """Generate a canonical stream ID (e.g. btcusdt_1m)"""
        symbol_fmt = symbol.replace("/", "").lower()
        return f"{symbol_fmt}_{interval}"

    async def subscribe(self, symbol: str, interval: str, callback: Callable[[dict], Coroutine]):
        """
        Subscribe to a kline stream.
        If the stream is already running, just add the callback.
        """
        stream_id = self.get_stream_id(symbol, interval)
        symbol_lower = symbol.replace("/", "").lower()
        stream_name = f"{symbol_lower}@kline_{interval}"
        
        if stream_id not in self._callbacks:
            self._callbacks[stream_id] = []
            
        self._callbacks[stream_id].append(callback)

        if stream_id not in self._active_tasks or self._active_tasks[stream_id].done():
            # Start the background listener task
            task = asyncio.create_task(self._listen(stream_name, stream_id))
            self._active_tasks[stream_id] = task
            logger.info(f"Started Binance WS listener for {stream_id}")

    def unsubscribe(self, symbol: str, interval: str, callback: Callable[[dict], Coroutine]):
        """Remove a callback from a stream. If no callbacks left, cancel the task."""
        stream_id = self.get_stream_id(symbol, interval)
        if stream_id in self._callbacks:
            try:
                self._callbacks[stream_id].remove(callback)
            except ValueError:
                pass
            
            if not self._callbacks[stream_id]:
                # No more listeners, shut down the stream
                task = self._active_tasks.get(stream_id)
                if task and not task.done():
                    task.cancel()
                    logger.info(f"Cancelled Binance WS listener for {stream_id}")
                self._active_tasks.pop(stream_id, None)
                self._callbacks.pop(stream_id, None)

    async def _listen(self, stream_name: str, stream_id: str):
        """Background task connecting to Binance and reading messages."""
        url = f"{self.BINANCE_WS_URL}/{stream_name}"
        backoff = 1

        while True:
            try:
                async with websockets.connect(url) as ws:
                    logger.info(f"Connected to {url}")
                    backoff = 1 # Reset backoff on successful connect
                    
                    async for message in ws:
                        data = json.loads(message)
                        if 'e' in data and data['e'] == 'kline':
                            parsed_candle = self._parse_kline(data)
                            # Broadcast to all registered callbacks
                            callbacks = self._callbacks.get(stream_id, [])
                            for cb in callbacks:
                                try:
                                    await cb(parsed_candle)
                                except Exception as e:
                                    logger.error(f"Error in callback for {stream_id}: {e}")
            
            except asyncio.CancelledError:
                logger.info(f"Stream {stream_id} intentionally stopped.")
                break
            except Exception as e:
                logger.error(f"Binance WS {stream_id} disconnected with error: {e}. Reconnecting in {backoff}s...")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60) # Exponential backoff capped at 60s

    def _parse_kline(self, data: dict) -> dict:
        """Parse raw Binance kline JSON to a standard OHLCV dict."""
        k = data['k']
        # Convert timestamp to ISO format for frontend
        import datetime
        timestamp_ms = k['t']
        dt = datetime.datetime.fromtimestamp(timestamp_ms / 1000.0, tz=datetime.timezone.utc)
        
        return {
            "timestamp": dt.isoformat(),
            "open": float(k['o']),
            "high": float(k['h']),
            "low": float(k['l']),
            "close": float(k['c']),
            "volume": float(k['v']),
            "is_closed": k['x'] # True if candle is closed
        }

# Singleton instance
binance_ws_adapter = BinanceWSAdapter()
