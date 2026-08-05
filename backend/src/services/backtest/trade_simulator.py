import pandas as pd
import numpy as np
from dataclasses import dataclass, asdict
from typing import List, Optional


@dataclass
class TradeRecord:
    """Represents a single completed trade."""
    trade_id: int
    trade_type: str          # "LONG" or "SHORT"
    entry_time: str
    entry_price: float
    exit_time: str
    exit_price: float
    profit_pct: float        # Percentage profit/loss of this trade

    def to_dict(self) -> dict:
        return asdict(self)


class TradeSimulator:
    """
    Simulates trades from OHLCV data and a signal Series.
    Signals: 1 = BUY/LONG, -1 = SELL/SHORT, 0 = HOLD.

    Trade lifecycle:
    - A position is opened when a non-zero signal appears while flat.
    - A position is closed when the opposite signal appears, or when
      the signal returns to 0 (exit at current close).
    """

    @staticmethod
    def simulate(data: pd.DataFrame, signals: pd.Series, 
                 tp_pct: float = None, sl_pct: float = None, trailing_pct: float = None) -> List[TradeRecord]:
        """
        Walk through each bar, track position state, and record completed trades.

        Args:
            data: DataFrame with at least 'close' column and a datetime index.
            signals: Series aligned with data index. Values: 1, -1, 0.
            tp_pct: Take Profit percentage (e.g., 5.0 for 5%)
            sl_pct: Stop Loss percentage (e.g., 2.0 for 2%)
            trailing_pct: Trailing Stop-Loss percentage (e.g., 1.5 for 1.5%)

        Returns:
            List of TradeRecord for every completed (entry + exit) trade.
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

        for i in range(len(data)):
            signal = signals.iloc[i]
            close = data['close'].iloc[i]
            high = data['high'].iloc[i] if 'high' in data.columns else close
            low = data['low'].iloc[i] if 'low' in data.columns else close
            timestamp = str(data.index[i])

            if not in_position:
                # Look for entry signal
                if signal == 1:
                    in_position = True
                    trade_type = "LONG"
                    entry_price = close
                    entry_time = timestamp
                    trailing_stop_price = entry_price * (1 - trailing_pct / 100) if trailing_pct else None
                elif signal == -1:
                    in_position = True
                    trade_type = "SHORT"
                    entry_price = close
                    entry_time = timestamp
                    trailing_stop_price = entry_price * (1 + trailing_pct / 100) if trailing_pct else None
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
                if sl_pct:
                    if trade_type == "LONG":
                        sl_price = entry_price * (1 - sl_pct / 100)
                        if low <= sl_price:
                            should_exit = True
                            actual_exit_price = sl_price
                    else:
                        sl_price = entry_price * (1 + sl_pct / 100)
                        if high >= sl_price:
                            should_exit = True
                            actual_exit_price = sl_price

                # 2. Check Trailing Stop
                if not should_exit and trailing_stop_price:
                    if trade_type == "LONG" and low <= trailing_stop_price:
                        should_exit = True
                        actual_exit_price = trailing_stop_price
                    elif trade_type == "SHORT" and high >= trailing_stop_price:
                        should_exit = True
                        actual_exit_price = trailing_stop_price

                # 3. Check Take Profit
                if not should_exit and tp_pct:
                    if trade_type == "LONG":
                        tp_price = entry_price * (1 + tp_pct / 100)
                        if high >= tp_price:
                            should_exit = True
                            actual_exit_price = tp_price
                    else:
                        tp_price = entry_price * (1 - tp_pct / 100)
                        if low <= tp_price:
                            should_exit = True
                            actual_exit_price = tp_price

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
                        profit_pct = ((actual_exit_price - entry_price) / entry_price) * 100
                    else:  # SHORT
                        profit_pct = ((entry_price - actual_exit_price) / entry_price) * 100

                    trade_id += 1
                    trades.append(TradeRecord(
                        trade_id=trade_id,
                        trade_type=trade_type,
                        entry_time=entry_time,
                        entry_price=float(entry_price),
                        exit_time=timestamp,
                        exit_price=float(actual_exit_price),
                        profit_pct=round(float(profit_pct), 4)
                    ))

                    # Decide whether to open a new position
                    # If we exited due to an opposite signal, open immediately
                    # If we exited due to SL/TP but the current signal is still active for our old direction, 
                    # we probably shouldn't immediately re-enter on the same bar.
                    if signal == 1 and trade_type == "SHORT":
                        in_position = True
                        trade_type = "LONG"
                        entry_price = close
                        entry_time = timestamp
                        trailing_stop_price = entry_price * (1 - trailing_pct / 100) if trailing_pct else None
                    elif signal == -1 and trade_type == "LONG":
                        in_position = True
                        trade_type = "SHORT"
                        entry_price = close
                        entry_time = timestamp
                        trailing_stop_price = entry_price * (1 + trailing_pct / 100) if trailing_pct else None
                    else:
                        in_position = False

        # Close any open position at the last bar
        if in_position:
            last_close = data['close'].iloc[-1]
            last_time = str(data.index[-1])

            if trade_type == "LONG":
                profit_pct = ((last_close - entry_price) / entry_price) * 100
            else:
                profit_pct = ((entry_price - last_close) / entry_price) * 100

            trade_id += 1
            trades.append(TradeRecord(
                trade_id=trade_id,
                trade_type=trade_type,
                entry_time=entry_time,
                entry_price=float(entry_price),
                exit_time=last_time,
                exit_price=float(last_close),
                profit_pct=round(float(profit_pct), 4)
            ))

        return trades
