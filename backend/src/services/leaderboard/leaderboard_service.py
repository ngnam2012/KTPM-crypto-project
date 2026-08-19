import math
import hashlib
import json
import logging
import os
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

from src.infrastructure.message_broker.event_bus import event_bus
from src.infrastructure.message_broker.events import EventType
from src.infrastructure.database.config import SessionLocal
from src.infrastructure.database.repositories import BacktestRepository, LeaderboardRepository

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
LEADERBOARD_KEY = "leaderboard:entries"
LEADERBOARD_TTL = 86400  # 24 hours


@dataclass
class LeaderboardEntry:
    id: str
    strategy_name: str
    strategy_config: dict
    metrics: dict
    overall_score: float
    timestamp: str

    def to_dict(self):
        return asdict(self)


class LeaderboardService:
    """
    Leaderboard service with a three-tier storage strategy:

    1. **Redis Hash** (`leaderboard:entries`) — shared across all Uvicorn
       workers; ensures every worker sees the same leaderboard.
    2. **SQLite / PostgreSQL** (via ORM) — persistent across restarts.
    3. **In-process dict** (`_entries`) — fast local read cache; populated
       on startup from DB and kept in sync with Redis writes.
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LeaderboardService, cls).__new__(cls)
            cls._instance._entries: Dict[str, LeaderboardEntry] = {}
            cls._instance._redis = None
            cls._instance._load_from_db()
        return cls._instance

    # ------------------------------------------------------------------ #
    #  Redis helpers
    # ------------------------------------------------------------------ #

    def _get_redis_sync(self):
        """Return a *synchronous* Redis client (used in sync context)."""
        if self._redis is not None:
            return self._redis
        try:
            import redis as sync_redis
            client = sync_redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            self._redis = client
            logger.info("LeaderboardService connected to Redis.")
        except Exception as exc:
            logger.warning(
                f"LeaderboardService Redis unavailable ({exc}). "
                "Using in-process dict only."
            )
            self._redis = None
        return self._redis

    def _redis_set_entry(self, entry: "LeaderboardEntry"):
        """Write one entry to the Redis Hash (HSET)."""
        r = self._get_redis_sync()
        if not r:
            return
        try:
            r.hset(LEADERBOARD_KEY, entry.id, json.dumps(entry.to_dict(), default=str))
            r.expire(LEADERBOARD_KEY, LEADERBOARD_TTL)
        except Exception as exc:
            logger.warning(f"Redis HSET leaderboard failed: {exc}")

    def _redis_load_all(self) -> Dict[str, "LeaderboardEntry"]:
        """Read all entries from the Redis Hash (HGETALL)."""
        r = self._get_redis_sync()
        if not r:
            return {}
        try:
            raw = r.hgetall(LEADERBOARD_KEY)
            entries = {}
            for entry_id, json_str in raw.items():
                data = json.loads(json_str)
                entries[entry_id] = LeaderboardEntry(**data)
            return entries
        except Exception as exc:
            logger.warning(f"Redis HGETALL leaderboard failed: {exc}")
            return {}

    # ------------------------------------------------------------------ #
    #  Startup
    # ------------------------------------------------------------------ #

    def _load_from_db(self):
        """Populate in-process cache from DB on startup."""
        try:
            with SessionLocal() as db:
                repo = LeaderboardRepository()
                top_entries = repo.get_top_k(db, k=100)
                for entry in top_entries:
                    if entry.backtest_result:
                        bt = entry.backtest_result
                        strat = bt.strategy_definition
                        entry_id = self._generate_id(strat.name, strat.params_json)
                        lb_entry = LeaderboardEntry(
                            id=entry_id,
                            strategy_name=strat.name,
                            strategy_config=strat.params_json,
                            metrics=bt.metrics_json,
                            overall_score=entry.score,
                            timestamp=(
                                entry.updated_at.isoformat()
                                if entry.updated_at
                                else datetime.utcnow().isoformat()
                            ),
                        )
                        self._entries[entry_id] = lb_entry
                        # Also warm Redis cache
                        self._redis_set_entry(lb_entry)
        except Exception as exc:
            logger.warning(f"Failed to load leaderboard from DB: {exc}")

    # ------------------------------------------------------------------ #
    #  Score / ID helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _compute_score(metrics: dict) -> float:
        norm_return = math.tanh(metrics.get("total_return", 0))
        winrate = metrics.get("winrate", 0)
        mdd_component = 1 + metrics.get("max_drawdown", 0)
        norm_sharpe = math.tanh(metrics.get("sharpe_ratio", 0) / 3)
        return (
            0.4 * norm_return
            + 0.3 * winrate
            + 0.2 * mdd_component
            + 0.1 * norm_sharpe
        )

    @staticmethod
    def _generate_id(strategy_name: str, config: dict) -> str:
        config_str = json.dumps(
            {"name": strategy_name, "config": config}, sort_keys=True
        )
        return hashlib.md5(config_str.encode()).hexdigest()

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def add_result(
        self, strategy_name: str, config: dict, metrics: dict, score: float = None
    ):
        """Add / update a backtest result in the leaderboard.

        Writes to:
          - Redis Hash (cross-worker cache)
          - SQLite / PostgreSQL (persistence)
          - Local in-process dict (fast reads)
        """
        if score is None:
            score = self._compute_score(metrics)

        entry_id = self._generate_id(strategy_name, config)

        # Skip if not an improvement
        existing = self._entries.get(entry_id)
        if existing and existing.overall_score >= score:
            return

        timestamp = datetime.utcnow()

        # --- Persist to DB ---
        try:
            with SessionLocal() as db:
                bt_repo = BacktestRepository()
                lb_repo = LeaderboardRepository()

                strategy_data = {
                    "name": strategy_name,
                    "type": "composite" if "logic" in config else "single",
                    "params_json": config,
                }
                backtest_data = {
                    "symbol": config.get("symbol", "BTC/USDT"),
                    "timeframe": config.get("timeframe", "1h"),
                    "metrics_json": metrics,
                    "overall_score": score,
                }
                bt_result = bt_repo.create_with_trades(
                    db, backtest_data, [], strategy_data
                )
                lb_repo.create(
                    db, {"backtest_result_id": bt_result.id, "score": score}
                )
        except Exception as exc:
            logger.warning(f"Failed to persist leaderboard entry to DB: {exc}")

        entry = LeaderboardEntry(
            id=entry_id,
            strategy_name=strategy_name,
            strategy_config=config,
            metrics=metrics,
            overall_score=score,
            timestamp=timestamp.isoformat(),
        )

        # --- Write to Redis (cross-worker sync) ---
        self._redis_set_entry(entry)

        # --- Update local cache ---
        self._entries[entry_id] = entry

        # Broadcast event
        event_bus.publish(EventType.LEADERBOARD_UPDATED, entry.to_dict())

    def handle_backtest_completed(self, data: dict):
        """Event handler for BACKTEST_COMPLETED."""
        strategy_name = data.get("strategy_name")
        config = data.get("config")
        metrics = data.get("metrics")
        if strategy_name and config and metrics:
            self.add_result(strategy_name, config, metrics)

    def get_top_k(
        self, k: int = 10, sort_by: str = "overall_score", order: str = "desc"
    ) -> List[LeaderboardEntry]:
        return self.get_all(sort_by, order)[:k]

    def get_all(
        self, sort_by: str = "overall_score", order: str = "desc"
    ) -> List[LeaderboardEntry]:
        """
        Return all entries sorted.

        Merges local in-process cache with Redis Hash so that entries
        written by other workers are always visible.
        """
        # Merge Redis entries into local cache (cross-worker sync)
        redis_entries = self._redis_load_all()
        for eid, entry in redis_entries.items():
            if eid not in self._entries or entry.overall_score > self._entries[eid].overall_score:
                self._entries[eid] = entry

        entries = list(self._entries.values())
        reverse = order.lower() == "desc"

        if sort_by == "overall_score":
            entries.sort(key=lambda x: x.overall_score, reverse=reverse)
        elif sort_by in ["total_return", "winrate", "max_drawdown", "sharpe_ratio"]:
            entries.sort(key=lambda x: x.metrics.get(sort_by, 0), reverse=reverse)
        elif sort_by == "timestamp":
            entries.sort(key=lambda x: x.timestamp, reverse=reverse)

        return entries


# Global singleton instance
leaderboard_service = LeaderboardService()
