import math
import hashlib
import json
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any

from src.infrastructure.message_broker.event_bus import event_bus
from src.infrastructure.message_broker.events import EventType
from src.infrastructure.database.config import SessionLocal
from src.infrastructure.database.repositories import BacktestRepository, LeaderboardRepository

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
    Singleton service to keep track of the best performing strategies.
    Stores entries in a DB-backed memory cache.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LeaderboardService, cls).__new__(cls)
            cls._instance._entries: Dict[str, LeaderboardEntry] = {}
            cls._instance._load_from_db()
        return cls._instance

    def _load_from_db(self):
        try:
            with SessionLocal() as db:
                repo = LeaderboardRepository()
                top_entries = repo.get_top_k(db, k=100)
                for entry in top_entries:
                    if entry.backtest_result:
                        bt = entry.backtest_result
                        strat = bt.strategy_definition
                        entry_id = self._generate_id(strat.name, strat.params_json)
                        self._entries[entry_id] = LeaderboardEntry(
                            id=entry_id,
                            strategy_name=strat.name,
                            strategy_config=strat.params_json,
                            metrics=bt.metrics_json,
                            overall_score=entry.score,
                            timestamp=entry.updated_at.isoformat() if entry.updated_at else datetime.utcnow().isoformat()
                        )
        except Exception as e:
            print(f"Failed to load leaderboard from DB: {e}")

    @staticmethod
    def _compute_score(metrics: dict) -> float:
        """
        Weighted score formula for ranking.
        """
        norm_return = math.tanh(metrics.get("total_return", 0))
        winrate = metrics.get("winrate", 0)
        mdd_component = 1 + metrics.get("max_drawdown", 0)
        norm_sharpe = math.tanh(metrics.get("sharpe_ratio", 0) / 3)

        score = (
            0.4 * norm_return
            + 0.3 * winrate
            + 0.2 * mdd_component
            + 0.1 * norm_sharpe
        )
        return score

    @staticmethod
    def _generate_id(strategy_name: str, config: dict) -> str:
        """Generate a unique ID based on strategy config to prevent duplicate entries."""
        config_str = json.dumps({"name": strategy_name, "config": config}, sort_keys=True)
        return hashlib.md5(config_str.encode()).hexdigest()

    def add_result(self, strategy_name: str, config: dict, metrics: dict, score: float = None):
        """Add a backtest result to the leaderboard and persist to DB."""
        if score is None:
            score = self._compute_score(metrics)

        entry_id = self._generate_id(strategy_name, config)
        
        # Only update if the new score is strictly better (or it doesn't exist)
        existing = self._entries.get(entry_id)
        if existing and existing.overall_score >= score:
            return

        timestamp = datetime.utcnow()
        
        # Persist to DB
        try:
            with SessionLocal() as db:
                bt_repo = BacktestRepository()
                lb_repo = LeaderboardRepository()
                
                strategy_data = {
                    "name": strategy_name,
                    "type": "composite" if "logic" in config else "single",
                    "params_json": config
                }
                
                # Note: symbol/timeframe might not be in config directly depending on event structure, 
                # but we use defaults if missing.
                backtest_data = {
                    "symbol": config.get("symbol", "BTC/USDT"),
                    "timeframe": config.get("timeframe", "1h"),
                    "metrics_json": metrics,
                    "overall_score": score
                }
                
                # Save strategy and backtest without detailed trades
                bt_result = bt_repo.create_with_trades(db, backtest_data, [], strategy_data)
                
                # Save to Leaderboard
                lb_repo.create(db, {
                    "backtest_result_id": bt_result.id,
                    "score": score
                })
        except Exception as e:
            print(f"Failed to persist leaderboard entry to DB: {e}")

        # Update Memory Cache
        entry = LeaderboardEntry(
            id=entry_id,
            strategy_name=strategy_name,
            strategy_config=config,
            metrics=metrics,
            overall_score=score,
            timestamp=timestamp.isoformat()
        )
        self._entries[entry_id] = entry
        
        # Publish event
        event_bus.publish(EventType.LEADERBOARD_UPDATED, entry.to_dict())

    def handle_backtest_completed(self, data: dict):
        """Event handler for BACKTEST_COMPLETED"""
        strategy_name = data.get("strategy_name")
        config = data.get("config")
        metrics = data.get("metrics")
        if strategy_name and config and metrics:
            self.add_result(strategy_name, config, metrics)

    def get_top_k(self, k: int = 10, sort_by: str = "overall_score", order: str = "desc") -> List[LeaderboardEntry]:
        return self.get_all(sort_by, order)[:k]

    def get_all(self, sort_by: str = "overall_score", order: str = "desc") -> List[LeaderboardEntry]:
        """Return all entries sorted."""
        entries = list(self._entries.values())
        
        reverse = order.lower() == "desc"
        
        if sort_by == "overall_score":
            entries.sort(key=lambda x: x.overall_score, reverse=reverse)
        elif sort_by in ["total_return", "winrate", "max_drawdown", "sharpe_ratio"]:
            entries.sort(key=lambda x: x.metrics.get(sort_by, 0), reverse=reverse)
        elif sort_by == "timestamp":
            entries.sort(key=lambda x: x.timestamp, reverse=reverse)
            
        return entries
