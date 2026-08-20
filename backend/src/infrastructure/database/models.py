from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4

from src.infrastructure.database.config import Base

def generate_uuid():
    return str(uuid4())

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="trader", nullable=False) # "trader", "analyst", "admin"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    strategies = relationship("StrategyDefinitionModel", back_populates="user")
    backtests = relationship("BacktestResultModel", back_populates="user")


class CandleModel(Base):
    __tablename__ = "candles"

    id = Column(String, primary_key=True, default=generate_uuid)
    symbol = Column(String, index=True, nullable=False)
    timeframe = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, index=True, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)


class StrategyDefinitionModel(Base):
    __tablename__ = "strategy_definitions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String, index=True, nullable=False)
    type = Column(String, nullable=False) # e.g., "single", "composite", "ai_generated"
    description = Column(Text, nullable=True)
    source_prompt = Column(Text, nullable=True) # Natural language prompt or web source
    params_json = Column(JSON, nullable=False)
    version = Column(String, default="1.0.0")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("UserModel", back_populates="strategies")
    backtests = relationship("BacktestResultModel", back_populates="strategy_definition")


class BacktestResultModel(Base):
    __tablename__ = "backtest_results"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    strategy_definition_id = Column(String, ForeignKey("strategy_definitions.id"), nullable=False)
    symbol = Column(String, index=True, nullable=False)
    timeframe = Column(String, index=True, nullable=False)
    metrics_json = Column(JSON, nullable=False)
    overall_score = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("UserModel", back_populates="backtests")
    strategy_definition = relationship("StrategyDefinitionModel", back_populates="backtests")
    trades = relationship("TradeRecordModel", back_populates="backtest_result", cascade="all, delete-orphan")
    leaderboard_entry = relationship("LeaderboardEntryModel", back_populates="backtest_result", uselist=False, cascade="all, delete-orphan")


class TradeRecordModel(Base):
    __tablename__ = "trade_records"

    id = Column(String, primary_key=True, default=generate_uuid)
    backtest_result_id = Column(String, ForeignKey("backtest_results.id"), nullable=False)
    symbol = Column(String, nullable=True)
    entry_time = Column(DateTime, nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_time = Column(DateTime, nullable=False)
    exit_price = Column(Float, nullable=False)
    volume_usd = Column(Float, nullable=True, default=100.0)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    fee = Column(Float, nullable=True, default=0.0)
    slippage = Column(Float, nullable=True, default=0.0)
    profit_usd = Column(Float, nullable=True, default=0.0)
    profit_pct = Column(Float, nullable=False)
    trade_type = Column(String, nullable=False) # "LONG" or "SHORT"

    # Relationships
    backtest_result = relationship("BacktestResultModel", back_populates="trades")


class NewsItemModel(Base):
    __tablename__ = "news_items"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    source = Column(String, nullable=False)
    url = Column(String, nullable=False)
    published_at = Column(DateTime, index=True, nullable=False)
    sentiment_score = Column(Float, nullable=True)
    sentiment_label = Column(String, nullable=True) # e.g., "positive", "neutral", "negative"


class CrawlerTagSchemaModel(Base):
    __tablename__ = "crawler_tag_schemas"

    id = Column(String, primary_key=True, default=generate_uuid)
    domain = Column(String, index=True, nullable=False)
    title_selector = Column(String, nullable=False)
    content_selector = Column(String, nullable=False)
    date_selector = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LeaderboardEntryModel(Base):
    __tablename__ = "leaderboard_entries"

    id = Column(String, primary_key=True, default=generate_uuid)
    backtest_result_id = Column(String, ForeignKey("backtest_results.id"), unique=True, nullable=False)
    rank = Column(Integer, nullable=True)
    score = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    backtest_result = relationship("BacktestResultModel", back_populates="leaderboard_entry")
