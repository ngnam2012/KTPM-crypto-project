import pandas as pd
import numpy as np
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any


@dataclass
class TradeRecord:
    """Represents a single completed trade with full financial details."""
    trade_id: int
    symbol: str              # "BTC/USDT"
    trade_type: str          # "LONG" or "SHORT"
    entry_time: str
    entry_price: float
    exit_time: str
    exit_price: float
    volume_usd: float        # Position size in USD (e.g. 100.0)
    stop_loss: Optional[float]
    take_profit: Optional[float]
    fee: float               # Transaction cost (USD)
    slippage: float          # Slippage / spread cost (USD)
    profit_usd: float        # Net profit/loss in USD
    profit_pct: float        # Net percentage profit/loss of this trade

    def to_dict(self) -> dict:
        return asdict(self)


class TradeSimulator:
    """
    Simulates trades from OHLCV data and a signal Series.
    Signals: 1 = BUY/LONG, -1 = SELL/SHORT, 0 = HOLD.

    Trade lifecycle:
    - A position is opened when a non-zero signal appears while flat.
    - A position is closed when the opposite signal appears, or when
      the signal returns to 0, or upon triggering SL/TP/Trailing Stop.
    """

    @staticmethod
    def simulate(
        data: pd.DataFrame, 
        signals: pd.Series, 
        symbol: str = "BTC/USDT",
        initial_capital: float = 100.0,
        tp_pct: Optional[float] = None, 
        sl_pct: Optional[float] = None, 
        trailing_pct: Optional[float] = None,
        fee_pct: float = 0.05,        # 0.05% fee per side
        slippage_bps: float = 5.0     # 5 bps = 0.05% slippage simulation
    ) -> List[TradeRecord]:
        """
        Walk through each bar, track position state, and record completed trades.
        """
        if data.empty or signals.empty:
            return []

        trades: List[TradeRecord] = []
        trade_id = 0

        # Current position state
        in_position = False
        trade_type: Optional[str] = None
        entry_price: float = 0.0
        entry_time: Optional[str] = None
        trailing_stop_price: Optional[float] = None
        position_sl: Optional[float] = None
        position_tp: Optional[float] = None

        volume_usd = float(initial_capital)
        fee_rate = float(fee_pct) / 100.0           # e.g. 0.0005
        slippage_rate = float(slippage_bps) / 10000.0 # e.g. 0.0005 (5 bps)

        for i in range(len(data)):
            signal = signals.iloc[i]
            close = float(data['close'].iloc[i])
            high = float(data['high'].iloc[i]) if 'high' in data.columns else close
            low = float(data['low'].iloc[i]) if 'low' in data.columns else close
            timestamp = str(data.index[i])

            if not in_position:
                # Look for entry signal
                if signal == 1:
                    in_position = True
                    trade_type = "LONG"
                    entry_price = close
                    entry_time = timestamp
                    trailing_stop_price = entry_price * (1 - trailing_pct / 100) if trailing_pct else None
                    position_sl = round(entry_price * (1 - sl_pct / 100), 2) if sl_pct else None
                    position_tp = round(entry_price * (1 + tp_pct / 100), 2) if tp_pct else None
                elif signal == -1:
                    in_position = True
                    trade_type = "SHORT"
                    entry_price = close
                    entry_time = timestamp
                    trailing_stop_price = entry_price * (1 + trailing_pct / 100) if trailing_pct else None
                    position_sl = round(entry_price * (1 + sl_pct / 100), 2) if sl_pct else None
                    position_tp = round(entry_price * (1 - tp_pct / 100), 2) if tp_pct else None
            else:
                # Already in a position — check for exit
                should_exit = False
                actual_exit_price = close

                # Update Trailing Stop
                if trailing_pct:
                    if trade_type == "LONG":
                        new_stop = high * (1 - trailing_pct / 100)
                        if trailing_stop_price is None or new_stop > trailing_stop_price:
                            trailing_stop_price = new_stop
                    else:
                        new_stop = low * (1 + trailing_pct / 100)
                        if trailing_stop_price is None or new_stop < trailing_stop_price:
                            trailing_stop_price = new_stop

                # 1. Check Fixed Stop Loss (Highest Priority)
                if sl_pct and position_sl is not None:
                    if trade_type == "LONG":
                        if low <= position_sl:
                            should_exit = True
                            actual_exit_price = position_sl
                    else:
                        if high >= position_sl:
                            should_exit = True
                            actual_exit_price = position_sl

                # 2. Check Trailing Stop
                if not should_exit and trailing_stop_price:
                    if trade_type == "LONG" and low <= trailing_stop_price:
                        should_exit = True
                        actual_exit_price = trailing_stop_price
                    elif trade_type == "SHORT" and high >= trailing_stop_price:
                        should_exit = True
                        actual_exit_price = trailing_stop_price

                # 3. Check Take Profit
                if not should_exit and tp_pct and position_tp is not None:
                    if trade_type == "LONG":
                        if high >= position_tp:
                            should_exit = True
                            actual_exit_price = position_tp
                    else:
                        if low <= position_tp:
                            should_exit = True
                            actual_exit_price = position_tp

                # 4. Check Reverse Signal / Neutral Signal
                if not should_exit:
                    if trade_type == "LONG" and signal == -1:
                        should_exit = True
                        actual_exit_price = close
                    elif trade_type == "SHORT" and signal == 1:
                        should_exit = True
                        actual_exit_price = close
                    elif signal == 0 and (i > 0 and signals.iloc[i - 1] != 0):
                        should_exit = True
                        actual_exit_price = close

                if should_exit:
                    # Calculate profit
                    if trade_type == "LONG":
                        gross_pct = ((actual_exit_price - entry_price) / entry_price) * 100
                    else:  # SHORT
                        gross_pct = ((entry_price - actual_exit_price) / entry_price) * 100

                    # Cost calculations (round-trip fee + slippage)
                    fee_cost = round(volume_usd * fee_rate * 2, 4)
                    slippage_cost = round(volume_usd * slippage_rate * 2, 4)
                    gross_profit_usd = (gross_pct / 100.0) * volume_usd
                    net_profit_usd = round(gross_profit_usd - fee_cost - slippage_cost, 4)
                    net_profit_pct = round((net_profit_usd / volume_usd) * 100.0, 4)

                    trade_id += 1
                    trades.append(TradeRecord(
                        trade_id=trade_id,
                        symbol=symbol,
                        trade_type=trade_type,
                        entry_time=entry_time,
                        entry_price=round(float(entry_price), 4),
                        exit_time=timestamp,
                        exit_price=round(float(actual_exit_price), 4),
                        volume_usd=round(volume_usd, 2),
                        stop_loss=position_sl,
                        take_profit=position_tp,
                        fee=fee_cost,
                        slippage=slippage_cost,
                        profit_usd=net_profit_usd,
                        profit_pct=net_profit_pct
                    ))

                    # Reset or switch position
                    if signal == 1 and trade_type == "SHORT":
                        in_position = True
                        trade_type = "LONG"
                        entry_price = close
                        entry_time = timestamp
                        trailing_stop_price = entry_price * (1 - trailing_pct / 100) if trailing_pct else None
                        position_sl = round(entry_price * (1 - sl_pct / 100), 2) if sl_pct else None
                        position_tp = round(entry_price * (1 + tp_pct / 100), 2) if tp_pct else None
                    elif signal == -1 and trade_type == "LONG":
                        in_position = True
                        trade_type = "SHORT"
                        entry_price = close
                        entry_time = timestamp
                        trailing_stop_price = entry_price * (1 + trailing_pct / 100) if trailing_pct else None
                        position_sl = round(entry_price * (1 + sl_pct / 100), 2) if sl_pct else None
                        position_tp = round(entry_price * (1 - tp_pct / 100), 2) if tp_pct else None
                    else:
                        in_position = False

        # Close any open position at the last bar
        if in_position:
            last_close = float(data['close'].iloc[-1])
            last_time = str(data.index[-1])

            if trade_type == "LONG":
                gross_pct = ((last_close - entry_price) / entry_price) * 100
            else:
                gross_pct = ((entry_price - last_close) / entry_price) * 100

            fee_cost = round(volume_usd * fee_rate * 2, 4)
            slippage_cost = round(volume_usd * slippage_rate * 2, 4)
            gross_profit_usd = (gross_pct / 100.0) * volume_usd
            net_profit_usd = round(gross_profit_usd - fee_cost - slippage_cost, 4)
            net_profit_pct = round((net_profit_usd / volume_usd) * 100.0, 4)

            trade_id += 1
            trades.append(TradeRecord(
                trade_id=trade_id,
                symbol=symbol,
                trade_type=trade_type,
                entry_time=entry_time,
                entry_price=round(float(entry_price), 4),
                exit_time=last_time,
                exit_price=round(float(last_close), 4),
                volume_usd=round(volume_usd, 2),
                stop_loss=position_sl,
                take_profit=position_tp,
                fee=fee_cost,
                slippage=slippage_cost,
                profit_usd=net_profit_usd,
                profit_pct=net_profit_pct
            ))

        return trades
