import pandas as pd
import numpy as np
import math
from datetime import datetime
from dateutil.parser import parse

class BacktestEvaluator:
    """
    Calculates trading metrics (Total Return, Winrate, Wins/Losses counts, Total Profit USD, Max Drawdown)
    from signals and price data.
    Uses vectorized operations for high performance.
    """
    
    @staticmethod
    def evaluate(
        data: pd.DataFrame, 
        signals: pd.Series,
        initial_capital: float = 100.0,
        fee_pct: float = 0.05,
        slippage_bps: float = 5.0
    ) -> dict:
        """
        Evaluate performance metrics.
        Assumes signals are: 1 (Buy), -1 (Sell), 0 (Hold).
        """
        if data.empty or signals.empty:
            return {
                "total_return": 0.0,
                "total_profit_usd": 0.0,
                "max_drawdown": 0.0,
                "winrate": 0.0,
                "wins_count": 0,
                "losses_count": 0,
                "total_trades": 0,
                "profit_factor": 0.0,
                "sharpe_ratio": 0.0,
                "initial_capital": initial_capital,
                "total_fees_usd": 0.0,
                "total_slippage_usd": 0.0
            }

        # 1. Convert discrete signals to continuous positions
        positions = signals.replace(0, np.nan).ffill().fillna(0)
        
        # 2. Calculate Returns
        market_returns = data['close'].pct_change()
        strategy_returns = positions.shift(1) * market_returns
        strategy_returns = strategy_returns.fillna(0)
        
        # 3. Identify individual trades
        trade_blocks = (positions != positions.shift(1)).cumsum()
        active_blocks = trade_blocks[positions != 0]
        
        if active_blocks.empty:
            return {
                "total_return": 0.0,
                "total_profit_usd": 0.0,
                "max_drawdown": 0.0,
                "winrate": 0.0,
                "wins_count": 0,
                "losses_count": 0,
                "total_trades": 0,
                "profit_factor": 0.0,
                "sharpe_ratio": 0.0,
                "initial_capital": initial_capital,
                "total_fees_usd": 0.0,
                "total_slippage_usd": 0.0
            }
            
        block_ids = active_blocks.shift(1).bfill()
        trade_returns = strategy_returns.groupby(block_ids).apply(lambda r: (1 + r).prod() - 1)
        
        total_trades = len(trade_returns)
        winning_trades = int((trade_returns > 0).sum())
        losing_trades = int((trade_returns <= 0).sum())
        winrate = (winning_trades / total_trades) if total_trades > 0 else 0.0

        # Cost deductions per trade
        fee_rate = (fee_pct / 100.0) * 2
        slippage_rate = (slippage_bps / 10000.0) * 2
        total_cost_per_trade = (fee_rate + slippage_rate)

        # Net trade returns
        net_trade_returns = trade_returns - total_cost_per_trade

        # Cumulative & Drawdown calculations
        cumulative_returns = (1 + net_trade_returns).cumprod()
        total_return = float(cumulative_returns.iloc[-1] - 1.0) if not cumulative_returns.empty else 0.0
        
        total_profit_usd = round(initial_capital * total_return, 2)
        total_fees_usd = round(initial_capital * fee_rate * total_trades, 2)
        total_slippage_usd = round(initial_capital * slippage_rate * total_trades, 2)

        peak = cumulative_returns.cummax()
        drawdown = (cumulative_returns - peak) / peak
        max_drawdown = float(drawdown.min()) if not drawdown.empty else 0.0
        
        # Profit Factor
        gross_profit = float(net_trade_returns[net_trade_returns > 0].sum())
        gross_loss = float(abs(net_trade_returns[net_trade_returns < 0].sum()))
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)
        
        # Sharpe Ratio
        mean_ret = net_trade_returns.mean()
        std_ret = net_trade_returns.std()
        sharpe_ratio = round(float(mean_ret / std_ret * math.sqrt(252)), 2) if std_ret > 0 and not np.isnan(std_ret) else 0.0
        
        return {
            "total_return": round(float(total_return), 4),
            "total_profit_usd": total_profit_usd,
            "max_drawdown": round(float(max_drawdown), 4),
            "winrate": round(float(winrate), 4),
            "wins_count": winning_trades,
            "losses_count": losing_trades,
            "total_trades": int(total_trades),
            "profit_factor": profit_factor,
            "sharpe_ratio": sharpe_ratio,
            "initial_capital": initial_capital,
            "total_fees_usd": total_fees_usd,
            "total_slippage_usd": total_slippage_usd
        }

    @staticmethod
    def extract_markers(data: pd.DataFrame, signals: pd.Series) -> list:
        if data.empty or signals.empty:
            return []
            
        positions = signals.replace(0, np.nan).ffill().fillna(0)
        markers = []
        
        for i in range(1, len(positions)):
            prev_pos = positions.iloc[i-1]
            curr_pos = positions.iloc[i]
            
            if prev_pos != curr_pos and curr_pos != 0:
                t = data['timestamp'].iloc[i] if 'timestamp' in data.columns else data.index[i]
                time_val = None
                
                if isinstance(t, str):
                    try:
                        time_val = parse(t).timestamp()
                    except:
                        pass
                elif hasattr(t, 'timestamp'):
                    time_val = t.timestamp()
                elif isinstance(t, (int, float)):
                    time_val = t / 1000 if t > 2e9 else t
                    
                if time_val is not None:
                    if curr_pos > 0:
                        markers.append({
                            'time': int(time_val),
                            'position': 'belowBar',
                            'color': '#0ECB81',
                            'shape': 'arrowUp',
                            'text': 'BUY'
                        })
                    elif curr_pos < 0:
                        markers.append({
                            'time': int(time_val),
                            'position': 'aboveBar',
                            'color': '#F6465D',
                            'shape': 'arrowDown',
                            'text': 'SELL'
                        })
        return markers
