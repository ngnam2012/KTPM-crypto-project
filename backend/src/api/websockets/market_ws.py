import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, List, Set

from src.infrastructure.adapters.binance_ws_adapter import binance_ws_adapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSockets"])

class ConnectionManager:
    def __init__(self):
        # Maps stream_id to a set of active WebSocket clients
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, stream_id: str):
        await websocket.accept()
        if stream_id not in self.active_connections:
            self.active_connections[stream_id] = set()
        self.active_connections[stream_id].add(websocket)
        logger.info(f"Client connected to {stream_id}. Total: {len(self.active_connections[stream_id])}")

    def disconnect(self, websocket: WebSocket, stream_id: str):
        if stream_id in self.active_connections:
            self.active_connections[stream_id].discard(websocket)
            logger.info(f"Client disconnected from {stream_id}. Total: {len(self.active_connections[stream_id])}")
            
    async def broadcast(self, stream_id: str, message: dict):
        if stream_id in self.active_connections:
            dead_connections = set()
            # Need to iterate over a copy or catch disconnects
            for connection in self.active_connections[stream_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to send to client on {stream_id}: {e}")
                    dead_connections.add(connection)
            
            # Cleanup dead connections
            for dead in dead_connections:
                self.disconnect(dead, stream_id)

manager = ConnectionManager()

@router.websocket("/market")
async def market_websocket(
    websocket: WebSocket,
    symbol: str = Query("BTC/USDT", description="Trading pair symbol"),
    interval: str = Query("1m", description="Kline interval (e.g. 1m, 15m, 1h)")
):
    """
    WebSocket endpoint for live market data.
    Clients connect here, and the backend forwards data from Binance.
    """
    stream_id = binance_ws_adapter.get_stream_id(symbol, interval)
    await manager.connect(websocket, stream_id)
    
    # Callback to push data from Binance WS to frontend clients
    async def on_new_candle(candle: dict):
        await manager.broadcast(stream_id, {"type": "candle", "data": candle})

    # Subscribe to Binance WS (multiplexed)
    await binance_ws_adapter.subscribe(symbol, interval, on_new_candle)

    try:
        # Keep connection open and listen for client messages (e.g., ping)
        while True:
            data = await websocket.receive_text()
            # Just log or handle simple ping/pong if needed
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error on {stream_id}: {e}")
    finally:
        # Client disconnected
        manager.disconnect(websocket, stream_id)
        # Unsubscribe callback from Binance WS. 
        # If no clients left, binance_ws_adapter shuts down the background stream.
        binance_ws_adapter.unsubscribe(symbol, interval, on_new_candle)
