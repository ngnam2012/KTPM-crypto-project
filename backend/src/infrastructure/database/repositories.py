from typing import Type, TypeVar, Generic, List, Optional, Any
from sqlalchemy.orm import Session
from src.infrastructure.database.config import Base
from src.infrastructure.database.models import (
    CandleModel,
    BacktestResultModel,
    LeaderboardEntryModel,
    StrategyDefinitionModel,
    TradeRecordModel
)

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: dict) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ModelType, obj_in: dict) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: Any) -> bool:
        obj = self.get(db, id)
        if obj:
            db.delete(obj)
            db.commit()
            return True
        return False


class CandleRepository(BaseRepository[CandleModel]):
    def __init__(self):
        super().__init__(CandleModel)
        
    def get_by_symbol_timeframe(self, db: Session, symbol: str, timeframe: str, limit: int = 100) -> List[CandleModel]:
        return db.query(self.model).filter(
            self.model.symbol == symbol,
            self.model.timeframe == timeframe
        ).order_by(self.model.timestamp.desc()).limit(limit).all()


class BacktestRepository(BaseRepository[BacktestResultModel]):
    def __init__(self):
        super().__init__(BacktestResultModel)
        
    def create_with_trades(self, db: Session, backtest_data: dict, trades_data: List[dict], strategy_data: dict) -> BacktestResultModel:
        # First, ensure strategy definition exists or create it
        # For simplicity, we just create a new strategy definition record for each run 
        # or you could query for an existing one based on params_json
        strategy_def = StrategyDefinitionModel(**strategy_data)
        db.add(strategy_def)
        db.flush() # Get ID without committing
        
        # Create backtest result
        backtest_data["strategy_definition_id"] = strategy_def.id
        backtest = self.model(**backtest_data)
        db.add(backtest)
        db.flush()
        
        # Create trades
        for trade_in in trades_data:
            trade_in["backtest_result_id"] = backtest.id
            trade = TradeRecordModel(**trade_in)
            db.add(trade)
            
        db.commit()
        db.refresh(backtest)
        return backtest


class LeaderboardRepository(BaseRepository[LeaderboardEntryModel]):
    def __init__(self):
        super().__init__(LeaderboardEntryModel)
        
    def get_top_k(self, db: Session, k: int = 10) -> List[LeaderboardEntryModel]:
        return db.query(self.model).order_by(self.model.score.desc()).limit(k).all()
