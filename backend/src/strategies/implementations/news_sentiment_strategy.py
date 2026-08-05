import pandas as pd
import feedparser
from typing import Dict, Any

from src.strategies.base import BaseStrategy
from src.services.ML.sentiment_service import sentiment_service

class NewsSentimentStrategy(BaseStrategy):
    @property
    def id(self) -> str:
        return "news_sentiment"

    @property
    def name(self) -> str:
        return "News Sentiment Strategy"

    @property
    def description(self) -> str:
        return "Fetches live news, analyzes sentiment, and trades based on average positivity."

    @property
    def default_params(self) -> Dict[str, Any]:
        return {
            "buy_threshold": 0.6,
            "sell_threshold": 0.4,
            "lookback_hours": 24, # (mock parameter for interface matching)
        }

    def generate_signals(self, data: pd.DataFrame, params: Dict[str, Any] = None) -> pd.Series:
        params = self.get_params(params)
        buy_threshold = params["buy_threshold"]
        sell_threshold = params["sell_threshold"]

        # Initialize signals to HOLD (0)
        signals = pd.Series(0, index=data.index)
        
        if data.empty:
            return signals

        # Synchronously fetch a quick RSS feed to evaluate live sentiment
        # We use CoinTelegraph as a proxy for the strategy
        try:
            feed = feedparser.parse("https://cointelegraph.com/rss")
            texts = [entry.get('title', '') for entry in feed.entries[:10]]
            
            # Analyze sentiment
            if texts:
                results = sentiment_service.analyze_batch(texts)
                avg_score = sum(r.score for r in results) / len(results)
                
                # Apply the current sentiment signal to the MOST RECENT candle only.
                # (Historical backtesting is impossible without historical news DB).
                if avg_score > buy_threshold:
                    signals.iloc[-1] = 1
                elif avg_score < sell_threshold:
                    signals.iloc[-1] = -1
                    
                # print(f"News Sentiment Strategy: Avg Score {avg_score:.2f} -> Signal {signals.iloc[-1]}")
        except Exception as e:
            print(f"Error in NewsSentimentStrategy: {e}")

        return signals
