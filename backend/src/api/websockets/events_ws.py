import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set

from src.infrastructure.message_broker.event_bus import event_bus
from src.infrastructure.message_broker.events import EventType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["Events"])

class SystemEventsManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        
        # Subscribe to all relevant system events to broadcast them to clients
        event_bus.subscribe(EventType.LEADERBOARD_UPDATED, self.handle_leaderboard_updated)
        event_bus.subscribe(EventType.STRATEGY_GENERATED, self.handle_strategy_generated)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Client connected to System Events. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"Client disconnected from System Events. Total: {len(self.active_connections)}")
            
    async def broadcast(self, message: dict):
        dead_connections = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send event to client: {e}")
                dead_connections.add(connection)
        
        for dead in dead_connections:
            self.disconnect(dead)

    async def handle_leaderboard_updated(self, data: dict):
        await self.broadcast({"event": EventType.LEADERBOARD_UPDATED.value, "data": data})
        
    async def handle_strategy_generated(self, data: dict):
        await self.broadcast({"event": EventType.STRATEGY_GENERATED.value, "data": data})

system_events_manager = SystemEventsManager()

@router.websocket("/events")
async def events_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for system-wide events (e.g. Leaderboard updates).
    """
    await system_events_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error on system events: {e}")
    finally:
        system_events_manager.disconnect(websocket)
