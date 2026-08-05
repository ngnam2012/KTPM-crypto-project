import asyncio
import logging
import inspect
from typing import Callable, Dict, List, Any

from src.infrastructure.message_broker.events import EventType

logger = logging.getLogger(__name__)

class EventBus:
    """
    In-process Pub/Sub Event Bus for decoupling modules.
    Supports both sync and async handlers.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EventBus, cls).__new__(cls)
            cls._instance._subscribers: Dict[str, List[Callable]] = {}
        return cls._instance

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler {handler.__name__} to event {event_type}")

    def publish(self, event_type: str, data: Any = None):
        """
        Publish an event to all subscribers.
        If a handler is async, it is scheduled in the current asyncio loop.
        """
        if event_type not in self._subscribers:
            return
            
        handlers = self._subscribers[event_type]
        for handler in handlers:
            try:
                if inspect.iscoroutinefunction(handler):
                    # Fire and forget async handler
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(self._run_async_handler(handler, event_type, data))
                    except RuntimeError:
                        # If no running event loop, we can't schedule it easily without blocking.
                        # For this MVP, we assume publish is called within an async context 
                        # or we synchronously run it (not ideal, but works for tests).
                        asyncio.run(handler(data))
                else:
                    handler(data)
            except Exception as e:
                logger.error(f"Error executing handler {handler.__name__} for event {event_type}: {e}")
                
    async def _run_async_handler(self, handler: Callable, event_type: str, data: Any):
        try:
            await handler(data)
        except Exception as e:
            logger.error(f"Error in async handler {handler.__name__} for event {event_type}: {e}")

# Global singleton
event_bus = EventBus()
