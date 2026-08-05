import pandas as pd
import numpy as np
from datetime import datetime
from dateutil.parser import parse
class BacktestEvaluator:
    """
    Calculates trading metrics (Total Return, Winrate, Max Drawdown) from signals and price data.
    Uses vectorized operations for high performance.
    """
    
    @staticmethod
    def evaluate(data: pd.DataFrame, signals: pd.Series) -> dict:
        """
        Evaluate performance metrics.
        Assumes signals are: 1 (Buy), -1 (Sell), 0 (Hold).
        """
        if data.empty or signals.empty:
            return {}

        # 1. Convert discrete signals to continuous positions
        # Replace 0 with NaN and forward fill to maintain the previous position until a new signal
        positions = signals.replace(0, np.nan).ffill().fillna(0)
        
        # 2. Calculate Returns
        # We enter at the close of the signal candle, so return is realized on the NEXT candle
        market_returns = data['close'].pct_change()
        strategy_returns = positions.shift(1) * market_returns
        strategy_returns = strategy_returns.fillna(0)
        
        # 3. Total Return
        cumulative_returns = (1 + strategy_returns).cumprod()
        total_return = cumulative_returns.iloc[-1] - 1.0 if not cumulative_returns.empty else 0.0
        
        # 4. Max Drawdown
        peak = cumulative_returns.cummax()
        drawdown = (cumulative_returns - peak) / peak
        max_drawdown = drawdown.min()
        
        # 5. Winrate and Trades
        # Identify individual trades. A trade happens when the position changes.
        trade_blocks = (positions != positions.shift(1)).cumsum()
        
        # Filter out periods where we are holding no position
        active_blocks = trade_blocks[positions != 0]
        
        if active_blocks.empty:
            return {
                "total_return": 0.0,
                "max_drawdown": 0.0,
                "winrate": 0.0,
                "total_trades": 0
            }
            
        # For each return, the trade block it belongs to is the position we held at t-1
        # So we shift the active_blocks by 1
        block_ids = active_blocks.shift(1).bfill()
        
        # For each continuous position, calculate its cumulative return
        trade_returns = strategy_returns.groupby(block_ids).apply(lambda r: (1 + r).prod() - 1)
        
        total_trades = len(trade_returns)
        winning_trades = len(trade_returns[trade_returns > 0])
        winrate = (winning_trades / total_trades) if total_trades > 0 else 0.0
        # 6. Profit Factor
        gross_profit = trade_returns[trade_returns > 0].sum()
        gross_loss = abs(trade_returns[trade_returns < 0].sum())
        profit_factor = float(gross_profit / gross_loss) if gross_loss > 0 else (float(gross_profit) if gross_profit > 0 else 0.0)
        
        # 7. Sharpe Ratio
        mean_ret = strategy_returns.mean()
        std_ret = strategy_returns.std()
        import math
        sharpe_ratio = float(mean_ret / std_ret * math.sqrt(252)) if std_ret > 0 and not np.isnan(std_ret) else 0.0
        
        return {
            "total_return": float(total_return),
            "max_drawdown": float(max_drawdown),
            "winrate": float(winrate),
            "total_trades": int(total_trades),
            "profit_factor": float(profit_factor),
            "sharpe_ratio": float(sharpe_ratio)
        }

    @staticmethod
    def extract_trades(data: pd.DataFrame, signals: pd.Series) -> list:
        if data.empty or signals.empty:
            return []
            
        positions = signals.replace(0, np.nan).ffill().fillna(0)
        trades = []
        current_trade = None
        
        for i in range(1, len(positions)):
            prev_pos = positions.iloc[i-1]
            curr_pos = positions.iloc[i]
            
            # Position changed
            if prev_pos != curr_pos:
                if current_trade is not None:
                    exit_price = data['close'].iloc[i]
                    if 'timestamp' in data.columns:
                        exit_time = data['timestamp'].iloc[i]
                    else:
                        exit_time = str(data.index[i])
                        
                    current_trade['exitTime'] = exit_time
                    current_trade['exitPrice'] = float(exit_price)
                    
                    if current_trade['type'] == 'long':
                        profit = (exit_price - current_trade['entryPrice']) / current_trade['entryPrice']
                    else:
                        profit = (current_trade['entryPrice'] - exit_price) / current_trade['entryPrice']
                        
                    current_trade['profit'] = float(profit)
                    trades.append(current_trade)
                    current_trade = None
                    
                if curr_pos != 0:
                    entry_price = data['close'].iloc[i]
                    if 'timestamp' in data.columns:
                        entry_time = data['timestamp'].iloc[i]
                    else:
                        entry_time = str(data.index[i])
                        
                    current_trade = {
                        'type': 'long' if curr_pos > 0 else 'short',
                        'entryTime': entry_time,
                        'entryPrice': float(entry_price),
                        'exitTime': None,
                        'exitPrice': None,
                        'profit': None
                    }
                    
        # Close open trade at the end
        if current_trade is not None:
            last_idx = len(positions) - 1
            exit_price = data['close'].iloc[last_idx]
            if 'timestamp' in data.columns:
                exit_time = data['timestamp'].iloc[last_idx]
            else:
                exit_time = str(data.index[last_idx])
                
            current_trade['exitTime'] = exit_time
            current_trade['exitPrice'] = float(exit_price)
            if current_trade['type'] == 'long':
                profit = (exit_price - current_trade['entryPrice']) / current_trade['entryPrice']
            else:
                profit = (current_trade['entryPrice'] - exit_price) / current_trade['entryPrice']
            current_trade['profit'] = float(profit)
            trades.append(current_trade)
            
        return trades

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
                    # Assume milliseconds or seconds if large enough
                    time_val = t / 1000 if t > 2e9 else t
                    
                if time_val is not None:
                    if curr_pos > 0:
                        markers.append({
                            'time': time_val,
                            'position': 'belowBar',
                            'color': '#0ECB81',
                            'shape': 'arrowUp',
                            'text': 'Buy'
                        })
                    elif curr_pos < 0:
                        markers.append({
                            'time': time_val,
                            'position': 'aboveBar',
                            'color': '#F6465D',
                            'shape': 'arrowDown',
                            'text': 'Sell'
                        })
        return markers
