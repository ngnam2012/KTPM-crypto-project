import sys
import os
import time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

import pandas as pd
import numpy as np
from src.services.backtest.evaluator import BacktestEvaluator

def test_metrics():
    # 1. Create a dummy price series
    prices = [100.0, 110.0, 120.0, 110.0, 100.0, 110.0, 120.0]
    data = pd.DataFrame({'close': prices})
    
    # Perfect signals: Buy at 100, Sell at 120, Buy at 100
    signals = pd.Series([1, 0, -1, 0, 1, 0, -1])
    
    # Evaluate
    metrics = BacktestEvaluator.evaluate(data, signals)
    print("--- Perfect Trade Metrics ---")
    for k, v in metrics.items():
        print(f"{k}: {v}")
    
def test_performance():
    # Generate 100,000 candles
    num_candles = 100000
    np.random.seed(42)
    closes = 100 + np.cumsum(np.random.randn(num_candles))
    data = pd.DataFrame({'close': closes})
    
    # Generate random signals: mostly 0, occasionally 1 or -1
    signals = pd.Series(np.random.choice([0, 1, -1], size=num_candles, p=[0.9, 0.05, 0.05]))
    
    start = time.time()
    metrics = BacktestEvaluator.evaluate(data, signals)
    end = time.time()
    
    print(f"\n--- Performance Test ({num_candles} candles) ---")
    print(f"Time taken: {(end - start) * 1000:.2f} ms")
    print(f"Total Trades: {metrics['total_trades']}")

if __name__ == "__main__":
    test_metrics()
    test_performance()
