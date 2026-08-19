import asyncio
import logging
import inspect
import os
import json
from typing import Callable, Dict, List, Any

from src.infrastructure.message_broker.events import EventType

logger = logging.getLogger(__name__)

class EventBus:
    """
    Pub/Sub Event Bus for decoupling modules.
    Supports in-process subscribers and optional Redis Pub/Sub / Stream integration for multi-worker support.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EventBus, cls).__new__(cls)
            cls._instance._subscribers: Dict[str, List[Callable]] = {}
            cls._instance._redis = None
            cls._instance._redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        return cls._instance

    async def init_redis(self):
        """Optional initialization of Redis client for multi-worker event broadcasting."""
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
            await self._redis.ping()
            logger.info("Connected to Redis EventBus backend.")
        except Exception as e:
            logger.warning(f"Redis EventBus unavailable ({e}), using in-process event bus.")
            self._redis = None

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler {handler.__name__} to event {event_type}")

    def publish(self, event_type: str, data: Any = None):
        """
        Publish an event to all subscribers.
        If a handler is async, it is scheduled in the current asyncio loop.
        Also publishes to Redis if connected.
        """
        # Publish locally to in-process subscribers
        if event_type in self._subscribers:
            handlers = self._subscribers[event_type]
            for handler in handlers:
                try:
                    if inspect.iscoroutinefunction(handler):
                        try:
                            loop = asyncio.get_running_loop()
                            loop.create_task(self._run_async_handler(handler, event_type, data))
                        except RuntimeError:
                            # If no running loop, run in a new loop if needed
                            asyncio.run(handler(data))
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Error executing handler {handler.__name__} for event {event_type}: {e}")

        # Publish to Redis channel asynchronously if available
        if self._redis is not None:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._publish_redis(event_type, data))
            except RuntimeError:
                pass

    async def _publish_redis(self, event_type: str, data: Any):
        if self._redis:
            try:
                payload = json.dumps({"event": event_type, "data": data}, default=str)
                await self._redis.publish(f"event:{event_type}", payload)
            except Exception as e:
                logger.error(f"Redis publish error for {event_type}: {e}")

    async def _run_async_handler(self, handler: Callable, event_type: str, data: Any):
        try:
            await handler(data)
        except Exception as e:
            logger.error(f"Error in async handler {handler.__name__} for event {event_type}: {e}")

# Global singleton
event_bus = EventBus()

