import asyncio
import json
import logging
import os
import inspect
from typing import Callable, Dict, List, Any

from src.infrastructure.message_broker.events import EventType

logger = logging.getLogger(__name__)


class EventBus:
    """
    Pub/Sub Event Bus backed by Redis Streams (XADD / XREADGROUP / XACK).

    - Messages are persisted to disk by Redis and survive server restarts.
    - Consumer Groups allow multiple workers to share the load and each
      message is only delivered to one consumer per group.
    - XACK ensures at-least-once delivery: unacknowledged messages stay in
      the Pending-Entry-List and can be reclaimed with XPENDING/XCLAIM.

    Falls back to an in-process fire-and-forget bus when Redis is unavailable
    (e.g. during unit tests without a Redis instance).
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EventBus, cls).__new__(cls)
            cls._instance._subscribers: Dict[str, List[Callable]] = {}
            cls._instance._redis = None
            cls._instance._group_name = "backend_group"
            cls._instance._redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            cls._instance._consumer_tasks: List[asyncio.Task] = []
        return cls._instance

    # ------------------------------------------------------------------ #
    #  Initialisation
    # ------------------------------------------------------------------ #

    async def init_redis(self):
        """
        Connect to Redis and start Stream consumer loops for every
        event type that already has in-process subscribers.
        """
        try:
            from redis.asyncio import Redis
            self._redis = Redis.from_url(self._redis_url, decode_responses=True)
            await self._redis.ping()
            logger.info("EventBus connected to Redis Streams backend.")

            # Restart consumer loops for existing subscriptions
            for event_type, handlers in self._subscribers.items():
                for idx, handler in enumerate(handlers):
                    consumer_name = f"{event_type}_consumer_{idx}"
                    self._start_consumer_task(event_type, handler, consumer_name)

        except Exception as e:
            logger.warning(
                f"Redis EventBus unavailable ({e}). "
                "Falling back to in-process fire-and-forget bus."
            )
            self._redis = None

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def subscribe(self, event_type: str, handler: Callable):
        """
        Register *handler* to be called when *event_type* is published.

        If Redis is already connected a Stream consumer loop is started
        immediately; otherwise the handler is stored and the loop is
        started later by :meth:`init_redis`.
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler '{handler.__name__}' to event '{event_type}'")

        if self._redis is not None:
            idx = len(self._subscribers[event_type]) - 1
            consumer_name = f"{event_type}_consumer_{idx}"
            self._start_consumer_task(event_type, handler, consumer_name)

    def publish(self, event_type: str, data: Any = None):
        """
        Publish *event_type* with *data*.

        When Redis is connected the message is written via **XADD** to a
        Redis Stream so it is persisted to disk and fan-out to consumer
        groups.  In-process subscribers are also notified directly for
        low-latency local use-cases (e.g. unit tests).
        """
        # --- In-process (always, for local speed / test compatibility) ---
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                self._dispatch_local(handler, event_type, data)

        # --- Redis Streams (XADD) ---
        if self._redis is not None:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._xadd(event_type, data))
            except RuntimeError:
                pass  # No running loop; skip Redis publish

    # ------------------------------------------------------------------ #
    #  Redis Streams internals
    # ------------------------------------------------------------------ #

    async def _ensure_consumer_group(self, stream_key: str):
        """Create the Consumer Group if it does not exist yet."""
        try:
            from redis.exceptions import ResponseError
            # id="$" → only consume *new* messages from this point on
            await self._redis.xgroup_create(
                stream_key, self._group_name, id="$", mkstream=True
            )
        except Exception as exc:
            if "BUSYGROUP Consumer Group name already exists" not in str(exc):
                raise

    async def _xadd(self, event_type: str, data: Any):
        """Write one message to the Redis Stream for *event_type*."""
        if not self._redis:
            return
        try:
            stream_key = f"event:{event_type}"
            payload = {"data": json.dumps(data, default=str)}
            message_id = await self._redis.xadd(stream_key, payload)
            logger.debug(f"XADD {stream_key}: {message_id}")
        except Exception as exc:
            logger.error(f"Redis XADD error for '{event_type}': {exc}")

    async def _consume_loop(
        self, event_type: str, handler: Callable, consumer_name: str
    ):
        """
        Blocking consumer loop that reads from a Redis Stream using
        XREADGROUP and acknowledges each message with XACK after the
        handler completes successfully.
        """
        stream_key = f"event:{event_type}"
        await self._ensure_consumer_group(stream_key)
        logger.info(
            f"Stream consumer '{consumer_name}' started on '{stream_key}'"
        )

        while True:
            try:
                # XREADGROUP: block 2 s, pick up to 1 undelivered message
                messages = await self._redis.xreadgroup(
                    groupname=self._group_name,
                    consumername=consumer_name,
                    streams={stream_key: ">"},
                    count=1,
                    block=2000,
                )

                if not messages:
                    continue

                for _stream, message_list in messages:
                    for message_id, payload in message_list:
                        raw = payload.get("data")
                        parsed = json.loads(raw) if raw else {}

                        # Dispatch to handler
                        try:
                            if inspect.iscoroutinefunction(handler):
                                await handler(parsed)
                            else:
                                await asyncio.to_thread(handler, parsed)
                        except Exception as handler_exc:
                            logger.error(
                                f"Handler '{handler.__name__}' failed for "
                                f"message {message_id} on {stream_key}: {handler_exc}"
                            )
                            # Do NOT ack → message stays in PEL for retry
                            continue

                        # XACK: mark as successfully processed
                        await self._redis.xack(
                            stream_key, self._group_name, message_id
                        )
                        logger.debug(
                            f"XACK {stream_key} {message_id} by '{consumer_name}'"
                        )

            except asyncio.CancelledError:
                logger.info(f"Consumer '{consumer_name}' cancelled.")
                break
            except Exception as exc:
                logger.error(
                    f"Error in consumer '{consumer_name}' on '{stream_key}': {exc}"
                )
                # Back-off before retrying to avoid tight error loops
                await asyncio.sleep(1)

    def _start_consumer_task(
        self, event_type: str, handler: Callable, consumer_name: str
    ):
        task = asyncio.create_task(
            self._consume_loop(event_type, handler, consumer_name)
        )
        self._consumer_tasks.append(task)

    # ------------------------------------------------------------------ #
    #  In-process dispatch (fallback / low-latency)
    # ------------------------------------------------------------------ #

    def _dispatch_local(self, handler: Callable, event_type: str, data: Any):
        try:
            if inspect.iscoroutinefunction(handler):
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self._run_async_handler(handler, event_type, data))
                except RuntimeError:
                    asyncio.run(handler(data))
            else:
                handler(data)
        except Exception as exc:
            logger.error(
                f"Error dispatching handler '{handler.__name__}' "
                f"for event '{event_type}': {exc}"
            )

    async def _run_async_handler(
        self, handler: Callable, event_type: str, data: Any
    ):
        try:
            await handler(data)
        except Exception as exc:
            logger.error(
                f"Async handler '{handler.__name__}' raised for "
                f"event '{event_type}': {exc}"
            )

    # ------------------------------------------------------------------ #
    #  Shutdown
    # ------------------------------------------------------------------ #

    async def close(self):
        for task in self._consumer_tasks:
            task.cancel()
        if self._redis:
            await self._redis.aclose()


# Global singleton
event_bus = EventBus()
