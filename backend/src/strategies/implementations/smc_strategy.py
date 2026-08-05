import pandas as pd
import numpy as np
from typing import Dict, Any

from src.domain.interfaces import IStrategy

class SMCStrategy(IStrategy):
    """
    Smart Money Concepts (SMC) Strategy.
    Identifies Swing Highs/Lows, Break of Structure (BOS), and Order Blocks (OB).
    """

    @property
    def id(self) -> str:
        return "smc"

    @property
    def name(self) -> str:
        return "Smart Money Concepts"

    @property
    def description(self) -> str:
        return "Trades based on Market Structure (BOS/CHOCH) and Order Blocks."

    @property
    def default_params(self) -> Dict[str, Any]:
        return {
            "swing_length": 5,        # Bars needed to confirm a swing
            "ob_threshold": 0.005,    # Tolerance for OB entry (0.5%)
        }

    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        params = params or self.default_params
        swing_length = int(params.get("swing_length", 5))
        ob_threshold = float(params.get("ob_threshold", 0.005))

        # Initialize signals
        signals = pd.Series(0, index=data.index)
        if len(data) < swing_length * 2 + 1:
            return signals

        # Extract numpy arrays for faster looping
        # Fallback to close if high/low aren't available for some reason
        highs = data['high'].values if 'high' in data.columns else data['close'].values
        lows = data['low'].values if 'low' in data.columns else data['close'].values
        closes = data['close'].values
        opens = data['open'].values if 'open' in data.columns else data['close'].values

        last_swing_high = None
        last_swing_low = None
        
        trend = 0  # 1 for Bullish, -1 for Bearish
        
        bullish_obs = [] # List of tuples: (ob_high, ob_low)
        bearish_obs = []

        window = swing_length * 2 + 1

        # Optimization: finding swings without scanning every time
        # We'll just scan the window.
        
        for i in range(window - 1, len(data)):
            # 1. Detect Swing Highs / Lows (delayed by swing_length)
            center = i - swing_length
            
            # Check if center is Swing High
            is_sh = True
            for j in range(i - window + 1, i + 1):
                if highs[j] > highs[center]:
                    is_sh = False
                    break
            if is_sh:
                last_swing_high = highs[center]

            # Check if center is Swing Low
            is_sl = True
            for j in range(i - window + 1, i + 1):
                if lows[j] < lows[center]:
                    is_sl = False
                    break
            if is_sl:
                last_swing_low = lows[center]

            # 2. Check for BOS
            current_close = closes[i]
            
            if last_swing_high is not None and current_close > last_swing_high:
                if trend != 1:
                    trend = 1 # Shift to Bullish
                    # Find Bullish OB (last down candle before this BOS)
                    for k in range(i, max(-1, i - 20), -1):
                        if closes[k] < opens[k]:
                            bullish_obs.append((highs[k], lows[k]))
                            break
                    # Keep OB list small
                    if len(bullish_obs) > 5:
                        bullish_obs.pop(0)
                    
                # Invalidate old swing high so we don't trigger BOS again immediately
                last_swing_high = None 
            
            elif last_swing_low is not None and current_close < last_swing_low:
                if trend != -1:
                    trend = -1 # Shift to Bearish
                    # Find Bearish OB (last up candle before this BOS)
                    for k in range(i, max(-1, i - 20), -1):
                        if closes[k] > opens[k]:
                            bearish_obs.append((highs[k], lows[k]))
                            break
                    # Keep OB list small
                    if len(bearish_obs) > 5:
                        bearish_obs.pop(0)
                        
                # Invalidate old swing low
                last_swing_low = None

            # 3. Check for Entry (Mitigation)
            signal = 0
            if trend == 1:
                # Look for price dipping into a Bullish OB
                current_low = lows[i]
                for ob_idx, ob in enumerate(bullish_obs):
                    ob_high, ob_low = ob
                    entry_threshold = ob_high * (1 + ob_threshold)
                    if current_low <= entry_threshold and current_close >= ob_low:
                        signal = 1
                        bullish_obs.pop(ob_idx) # Mitigated
                        break
            elif trend == -1:
                # Look for price rallying into a Bearish OB
                current_high = highs[i]
                for ob_idx, ob in enumerate(bearish_obs):
                    ob_high, ob_low = ob
                    entry_threshold = ob_low * (1 - ob_threshold)
                    if current_high >= entry_threshold and current_close <= ob_high:
                        signal = -1
                        bearish_obs.pop(ob_idx) # Mitigated
                        break
                        
            signals.iloc[i] = signal
            
        return signals
