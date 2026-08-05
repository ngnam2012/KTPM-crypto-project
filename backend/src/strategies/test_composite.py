import sys
import os
# Add backend root to path to allow importing src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

import pandas as pd
import numpy as np
from src.strategies.implementations.ma_strategy import MovingAverageCrossoverStrategy
from src.strategies.implementations.rsi_strategy import RSIStrategy
from src.strategies.composite import CompositeStrategy

def test():
    # 1. Generate fake OHLCV data
    np.random.seed(42)
    # Simulate a price path
    closes = 100 + np.cumsum(np.random.randn(200))
    data = pd.DataFrame({'close': closes})
    
    # Instantiate strategies
    ma = MovingAverageCrossoverStrategy()
    rsi = RSIStrategy()
    
    # Override default params for faster triggering in short data
    params = {
        "ma_crossover": {"short_window": 3, "long_window": 10},
        "rsi": {"window": 7, "overbought": 65, "oversold": 35}
    }
    
    ma_signals = ma.generate_signals(data, params["ma_crossover"])
    rsi_signals = rsi.generate_signals(data, params["rsi"])
    
    composite_and = CompositeStrategy([ma, rsi], logic="AND")
    composite_or = CompositeStrategy([ma, rsi], logic="OR")
    composite_weighted = CompositeStrategy([ma, rsi], logic="WEIGHTED", weights=[0.6, 0.4])
    
    and_signals = composite_and.generate_signals(data, params)
    or_signals = composite_or.generate_signals(data, params)
    weighted_signals = composite_weighted.generate_signals(data, params)
    
    # Combine into a single dataframe to view
    results = pd.DataFrame({
        'Close': data['close'],
        'MA_Signal': ma_signals,
        'RSI_Signal': rsi_signals,
        'AND_Signal': and_signals,
        'OR_Signal': or_signals,
        'WEIGHTED_Signal': weighted_signals
    })
    
    # Print the rows where there is at least one signal
    active_rows = results[(results['MA_Signal'] != 0) | (results['RSI_Signal'] != 0)]
    print("--- Composite Strategy Test Results ---")
    print(active_rows.head(20).to_string())
    print("---------------------------------------")
    
    # Verify AND logic mathematically
    for _, row in active_rows.iterrows():
        ma_sig = row['MA_Signal']
        rsi_sig = row['RSI_Signal']
        and_sig = row['AND_Signal']
        or_sig = row['OR_Signal']
        
        # Verify AND logic
        expected_and = 1 if ma_sig == 1 and rsi_sig == 1 else (-1 if ma_sig == -1 and rsi_sig == -1 else 0)
        assert and_sig == expected_and, f"AND logic failed: {ma_sig}, {rsi_sig} -> {and_sig}"
        
        # Verify OR logic
        expected_or = 0
        if ma_sig == 1 or rsi_sig == 1:
            expected_or = 1
        if ma_sig == -1 or rsi_sig == -1:
            if expected_or == 1:
                expected_or = 0 # Conflict resolution
            else:
                expected_or = -1
        assert or_sig == expected_or, f"OR logic failed: {ma_sig}, {rsi_sig} -> {or_sig}"
        
        # Verify WEIGHTED logic
        weighted_sum = (ma_sig * 0.6) + (rsi_sig * 0.4)
        expected_weighted = 0
        if weighted_sum > 0.5:
            expected_weighted = 1
        elif weighted_sum < -0.5:
            expected_weighted = -1
        assert row['WEIGHTED_Signal'] == expected_weighted, f"WEIGHTED logic failed: {ma_sig}, {rsi_sig} -> {row['WEIGHTED_Signal']}, expected {expected_weighted}"
        
    print("All logic verification assertions passed!")

if __name__ == "__main__":
    test()
