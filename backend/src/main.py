import asyncio
import logging
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from src.strategies.registry import StrategyRegistry
from src.infrastructure.adapters.binance_adapter import BinanceAdapter
from src.services.backtest.evaluator import BacktestEvaluator
from src.services.backtest.trade_simulator import TradeSimulator
from src.strategies.composite import CompositeStrategy
from src.api.v1.search_router import router as search_router
from src.api.v1.leaderboard_router import router as leaderboard_router
from src.api.v1.leaderboard_router import leaderboard_service
from src.api.websockets.market_ws import router as market_ws_router
from src.api.v1.news_router import router as news_router
from src.api.v1.sentiment_router import router as sentiment_router
from src.api.websockets.events_ws import router as events_ws_router
from src.api.v1.custom_strategy_router import router as custom_strategy_router
from src.api.v1.auth_router import router as auth_router

from src.infrastructure.database.config import engine, Base
import src.infrastructure.database.models 
from src.infrastructure.message_broker.event_bus import event_bus
from src.infrastructure.message_broker.events import EventType

logger = logging.getLogger(__name__)

# Singletons & dependency injection providers
registry = StrategyRegistry()
binance_adapter = BinanceAdapter()

def get_strategy_registry() -> StrategyRegistry:
    return registry

def get_binance_adapter() -> BinanceAdapter:
    return binance_adapter

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables
    Base.metadata.create_all(bind=engine)
    
    # Safe schema migration for SQLite
    try:
        import sqlalchemy
        with engine.connect() as conn:
            for query in [
                "ALTER TABLE strategy_definitions ADD COLUMN user_id TEXT",
                "ALTER TABLE strategy_definitions ADD COLUMN description TEXT",
                "ALTER TABLE strategy_definitions ADD COLUMN source_prompt TEXT",
                "ALTER TABLE backtest_results ADD COLUMN user_id TEXT",
                "ALTER TABLE trade_records ADD COLUMN symbol TEXT",
                "ALTER TABLE trade_records ADD COLUMN volume_usd FLOAT DEFAULT 100.0",
                "ALTER TABLE trade_records ADD COLUMN stop_loss FLOAT",
                "ALTER TABLE trade_records ADD COLUMN take_profit FLOAT",
                "ALTER TABLE trade_records ADD COLUMN fee FLOAT DEFAULT 0.0",
                "ALTER TABLE trade_records ADD COLUMN slippage FLOAT DEFAULT 0.0",
                "ALTER TABLE trade_records ADD COLUMN profit_usd FLOAT DEFAULT 0.0",
            ]:
                try:
                    conn.execute(sqlalchemy.text(query))
                except Exception:
                    pass
            conn.commit()
    except Exception as e:
        logger.warning(f"Database migration notice: {e}")
        
    # Initialize Redis EventBus if available
    await event_bus.init_redis()
    
    # Wire up EventBus subscriptions
    event_bus.subscribe(EventType.BACKTEST_COMPLETED, leaderboard_service.handle_backtest_completed)
    
    yield
    
    # Cleanup on shutdown
    await binance_adapter.close()

app = FastAPI(
    title="Crypto Strategy Lab API",
    description="Backend API for Crypto Strategy Lab",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(search_router)
app.include_router(leaderboard_router)
app.include_router(market_ws_router)
app.include_router(news_router)
app.include_router(sentiment_router)
app.include_router(events_ws_router)
app.include_router(custom_strategy_router)

# Request / Response Pydantic Models
class StrategyConfig(BaseModel):
    id: str
    params: Dict[str, Any] = {}

class BacktestRequest(BaseModel):
    strategies: List[StrategyConfig]
    logic: str = "AND"
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    limit: int = 2000
    initial_capital: float = 100.0
    fee_pct: float = 0.05
    slippage_bps: float = 5.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    take_profit_pct: Optional[float] = None
    stop_loss_pct: Optional[float] = None
    trailing_stop_pct: Optional[float] = None

class OHLCVResponse(BaseModel):
    symbol: str
    timeframe: str
    data: List[Dict[str, Any]]

class BacktestResponse(BaseModel):
    symbol: str
    timeframe: str
    metrics: Dict[str, Any]

from datetime import datetime, timezone
from dateutil.parser import parse

class BacktestWithTradesResponse(BaseModel):
    symbol: str
    timeframe: str
    metrics: Dict[str, Any]
    trades: List[Dict[str, Any]]
    markers: List[Dict[str, Any]]
    ohlcv: Optional[List[Dict[str, Any]]] = None

@app.get("/")
async def root():
    return {"message": "Welcome to Crypto Strategy Lab API"}

@app.get("/api/v1/strategies")
async def get_strategies(reg: StrategyRegistry = Depends(get_strategy_registry)):
    """Returns a list of all available strategies and their metadata"""
    return {"strategies": reg.get_all_strategies()}

@app.get("/api/v1/market/ohlcv", response_model=OHLCVResponse)
async def get_ohlcv(
    symbol: str = "BTC/USDT",
    timeframe: str = "1h",
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    adapter: BinanceAdapter = Depends(get_binance_adapter)
):
    """
    Fetches OHLCV data asynchronously from Binance.
    """
    try:
        df = await adapter.fetch_ohlcv(symbol, timeframe, limit=limit, start_date=start_date, end_date=end_date)
        if df.empty:
            return OHLCVResponse(symbol=symbol, timeframe=timeframe, data=[])
            
        df_reset = df.reset_index()
        df_reset['timestamp'] = df_reset['timestamp'].astype(str)
        data = df_reset.to_dict(orient='records')
        return OHLCVResponse(symbol=symbol, timeframe=timeframe, data=data)
    except Exception as e:
        logger.exception(f"Error fetching OHLCV for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/v1/backtest/run", response_model=BacktestResponse)
async def run_backtest(
    request: BacktestRequest,
    adapter: BinanceAdapter = Depends(get_binance_adapter),
    reg: StrategyRegistry = Depends(get_strategy_registry)
):
    """
    Runs a backtest with the provided strategies and logic asynchronously.
    """
    if not request.strategies:
        raise HTTPException(status_code=400, detail="At least one strategy must be provided.")
        
    try:
        # 1. Fetch market data asynchronously
        df = await adapter.fetch_ohlcv(
            request.symbol, 
            request.timeframe, 
            limit=request.limit,
            start_date=request.start_date,
            end_date=request.end_date
        )
        if df.empty:
            raise HTTPException(status_code=400, detail="Could not fetch market data.")
            
        # 2. Instantiate strategies
        strategy_instances = []
        composite_params = {}
        for sc in request.strategies:
            try:
                instance = reg.get_strategy(sc.id)
            except ValueError:
                raise HTTPException(status_code=404, detail=f"Strategy '{sc.id}' not found.")
            strategy_instances.append(instance)
            composite_params[instance.id] = {**instance.default_params, **sc.params}
            
        # 3. Generate Signals in background thread pool
        if len(strategy_instances) == 1:
            instance = strategy_instances[0]
            signals = await asyncio.to_thread(instance.generate_signals, df, composite_params[instance.id])
        else:
            weights = None
            if request.logic == "WEIGHTED":
                raw_weights = [float(sc.params.get("weight", 1.0)) for sc in request.strategies]
                total_weight = sum(raw_weights)
                weights = [w / total_weight for w in raw_weights] if total_weight > 0 else None
                
            composite = CompositeStrategy(strategy_instances, logic=request.logic, weights=weights)
            signals = await asyncio.to_thread(composite.generate_signals, df, composite_params)
            
        # 4. Evaluate in thread pool
        metrics = await asyncio.to_thread(
            BacktestEvaluator.evaluate, 
            df, 
            signals,
            initial_capital=request.initial_capital,
            fee_pct=request.fee_pct,
            slippage_bps=request.slippage_bps
        )
        
        # 5. Push event
        strat_name = strategy_instances[0].name if len(strategy_instances) == 1 else composite.name
            
        event_bus.publish(
            EventType.BACKTEST_COMPLETED,
            {
                "strategy_name": strat_name,
                "config": {"strategies": [s.dict() for s in request.strategies], "logic": request.logic},
                "metrics": metrics
            }
        )
        
        return BacktestResponse(
            symbol=request.symbol,
            timeframe=request.timeframe,
            metrics=metrics
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Backtest error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/v1/backtest/run-with-trades", response_model=BacktestWithTradesResponse)
async def run_backtest_with_trades(
    request: BacktestRequest,
    adapter: BinanceAdapter = Depends(get_binance_adapter),
    reg: StrategyRegistry = Depends(get_strategy_registry)
):
    """
    Runs a backtest and returns metrics along with detailed trade lists and chart markers asynchronously.
    """
    if not request.strategies:
        raise HTTPException(status_code=400, detail="At least one strategy must be provided.")
        
    try:
        # 1. Fetch market data asynchronously
        df = await adapter.fetch_ohlcv(
            request.symbol, 
            request.timeframe, 
            limit=request.limit,
            start_date=request.start_date,
            end_date=request.end_date
        )
        if df.empty:
            raise HTTPException(status_code=400, detail="Could not fetch market data.")
            
        # 2. Instantiate strategies
        strategy_instances = []
        composite_params = {}
        for sc in request.strategies:
            try:
                instance = reg.get_strategy(sc.id)
            except ValueError:
                raise HTTPException(status_code=404, detail=f"Strategy '{sc.id}' not found.")
            strategy_instances.append(instance)
            composite_params[instance.id] = {**instance.default_params, **sc.params}
            
        # 3. Generate Signals in background thread pool
        if len(strategy_instances) == 1:
            instance = strategy_instances[0]
            signals = await asyncio.to_thread(instance.generate_signals, df, composite_params[instance.id])
        else:
            weights = None
            if request.logic == "WEIGHTED":
                raw_weights = [float(sc.params.get("weight", 1.0)) for sc in request.strategies]
                total_weight = sum(raw_weights)
                weights = [w / total_weight for w in raw_weights] if total_weight > 0 else None
                
            composite = CompositeStrategy(strategy_instances, logic=request.logic, weights=weights)
            signals = await asyncio.to_thread(composite.generate_signals, df, composite_params)
            
        # 4. Evaluate metrics and extract trades in thread pool
        metrics = await asyncio.to_thread(
            BacktestEvaluator.evaluate, 
            df, 
            signals,
            initial_capital=request.initial_capital,
            fee_pct=request.fee_pct,
            slippage_bps=request.slippage_bps
        )
        
        raw_trades = await asyncio.to_thread(
            TradeSimulator.simulate,
            df, 
            signals, 
            symbol=request.symbol,
            initial_capital=request.initial_capital,
            tp_pct=request.take_profit_pct, 
            sl_pct=request.stop_loss_pct, 
            trailing_pct=request.trailing_stop_pct,
            fee_pct=request.fee_pct,
            slippage_bps=request.slippage_bps
        )

        # Ensure metrics counts match the discrete simulated trades list 100%
        total_t = len(raw_trades)
        wins_t = sum(1 for t in raw_trades if t.profit_pct > 0)
        losses_t = total_t - wins_t
        winrate_t = round(wins_t / total_t, 4) if total_t > 0 else 0.0
        metrics['total_trades'] = total_t
        metrics['wins_count'] = wins_t
        metrics['losses_count'] = losses_t
        metrics['winrate'] = winrate_t

        def to_utc_timestamp(dt_val) -> Optional[int]:
            if dt_val is None:
                return None
            if isinstance(dt_val, (int, float)):
                return int(dt_val / 1000 if dt_val > 2e9 else dt_val)
            if hasattr(dt_val, 'tzinfo') and dt_val.tzinfo is not None:
                return int(dt_val.timestamp())
            if hasattr(dt_val, 'timestamp'):
                return int(dt_val.replace(tzinfo=timezone.utc).timestamp())
            if isinstance(dt_val, str):
                try:
                    parsed = parse(dt_val)
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=timezone.utc)
                    return int(parsed.timestamp())
                except Exception:
                    return None
            return None

        trades = []
        markers = []
        for t in raw_trades:
            td = t.to_dict()
            td['type'] = td.pop('trade_type')
            td['id'] = str(td.pop('trade_id'))

            # Accurate UTC epoch seconds for exact chart synchronization
            e_val = to_utc_timestamp(t.entry_time)
            x_val = to_utc_timestamp(t.exit_time)
            td['entry_timestamp'] = e_val
            td['exit_timestamp'] = x_val
            trades.append(td)

            # Generate precise LONG/SHORT visual markers
            is_win = t.profit_pct >= 0
            p_sign = "+" if is_win else ""

            if td['type'] == "LONG":
                # LONG Entry (Emerald arrow up below bar)
                if e_val is not None:
                    markers.append({
                        'time': e_val,
                        'position': 'belowBar',
                        'color': '#10B981',
                        'shape': 'arrowUp',
                        'text': f"LONG #{td['id']} @ ${t.entry_price:,.2f}"
                    })
                # LONG Exit (Above bar)
                if x_val is not None:
                    markers.append({
                        'time': x_val,
                        'position': 'aboveBar',
                        'color': '#10B981' if is_win else '#F43F5E',
                        'shape': 'arrowDown',
                        'text': f"EXIT #{td['id']} ({p_sign}{t.profit_pct:.2f}%)"
                    })
            elif td['type'] == "SHORT":
                # SHORT Entry (Coral red arrow down above bar)
                if e_val is not None:
                    markers.append({
                        'time': e_val,
                        'position': 'aboveBar',
                        'color': '#F43F5E',
                        'shape': 'arrowDown',
                        'text': f"SHORT #{td['id']} @ ${t.entry_price:,.2f}"
                    })
                # SHORT Exit (Below bar)
                if x_val is not None:
                    markers.append({
                        'time': x_val,
                        'position': 'belowBar',
                        'color': '#10B981' if is_win else '#F43F5E',
                        'shape': 'arrowUp',
                        'text': f"EXIT #{td['id']} ({p_sign}{t.profit_pct:.2f}%)"
                    })

        markers.sort(key=lambda m: m['time'])

        # OHLCV records for exact chart alignment
        ohlcv_records = []
        for idx in range(len(df)):
            raw_t = df['timestamp'].iloc[idx] if 'timestamp' in df.columns else df.index[idx]
            t_val = to_utc_timestamp(raw_t)
            ohlcv_records.append({
                "time": t_val,
                "timestamp": str(raw_t),
                "open": float(df['open'].iloc[idx]),
                "high": float(df['high'].iloc[idx]),
                "low": float(df['low'].iloc[idx]),
                "close": float(df['close'].iloc[idx]),
                "volume": float(df['volume'].iloc[idx]) if 'volume' in df.columns else 0.0,
            })
        
        # 5. Push event
        strat_name = strategy_instances[0].name if len(strategy_instances) == 1 else composite.name
            
        event_bus.publish(
            EventType.BACKTEST_COMPLETED,
            {
                "strategy_name": strat_name,
                "config": {"strategies": [s.dict() for s in request.strategies], "logic": request.logic},
                "metrics": metrics
            }
        )
        
        return BacktestWithTradesResponse(
            symbol=request.symbol,
            timeframe=request.timeframe,
            metrics=metrics,
            trades=trades,
            markers=markers,
            ohlcv=ohlcv_records
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Backtest error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
