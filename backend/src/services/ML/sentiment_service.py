import logging
from typing import List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class SentimentResult:
    label: str  # POSITIVE, NEGATIVE, NEUTRAL
    score: float # 0.0 to 1.0 (normalized)

class SentimentService:
    def __init__(self):
        self._model = None
        self._tokenizer = None
        self._use_fallback = False
        self._initialized = False

    def _initialize(self):
        if self._initialized:
            return
            
        try:
            from transformers import pipeline
            # Use a lightweight financial model if available, otherwise general sentiment
            logger.info("Loading Transformers pipeline for sentiment analysis...")
            self._model = pipeline("sentiment-analysis", model="mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis")
            logger.info("Transformers pipeline loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to load transformers model, falling back to TextBlob: {e}")
            self._use_fallback = True
            
        self._initialized = True

    def analyze(self, text: str) -> SentimentResult:
        if not text:
            return SentimentResult(label="NEUTRAL", score=0.5)
            
        if not self._initialized:
            self._initialize()

        if self._use_fallback:
            return self._analyze_fallback(text)
            
        try:
            # Result format: [{'label': 'positive', 'score': 0.99}]
            result = self._model(text[:512])[0] # Truncate to 512 chars for safety
            label = result['label'].upper()
            score = result['score']
            
            # Normalize label
            if label not in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
                if label in ["LABEL_2", "1", "POSITIVE"]:
                    label = "POSITIVE"
                elif label in ["LABEL_0", "-1", "NEGATIVE"]:
                    label = "NEGATIVE"
                else:
                    label = "NEUTRAL"
                    
            return SentimentResult(label=label, score=score)
        except Exception as e:
            logger.error(f"Transformers inference failed: {e}")
            return self._analyze_fallback(text)

    def _analyze_fallback(self, text: str) -> SentimentResult:
        """Fallback using TextBlob which is lightweight and fast."""
        try:
            from textblob import TextBlob
            analysis = TextBlob(text)
            polarity = analysis.sentiment.polarity # -1.0 to 1.0
            
            # Normalize to 0-1 score
            score = (polarity + 1.0) / 2.0
            
            if polarity > 0.1:
                label = "POSITIVE"
            elif polarity < -0.1:
                label = "NEGATIVE"
            else:
                label = "NEUTRAL"
                
            return SentimentResult(label=label, score=score)
        except ImportError:
            # Extremely naive fallback if even textblob is missing
            lower_text = text.lower()
            pos = sum(word in lower_text for word in ['good', 'bull', 'up', 'high', 'surge', 'buy'])
            neg = sum(word in lower_text for word in ['bad', 'bear', 'down', 'low', 'drop', 'sell', 'crash'])
            if pos > neg:
                return SentimentResult(label="POSITIVE", score=0.8)
            elif neg > pos:
                return SentimentResult(label="NEGATIVE", score=0.2)
            else:
                return SentimentResult(label="NEUTRAL", score=0.5)

    def analyze_batch(self, texts: List[str]) -> List[SentimentResult]:
        return [self.analyze(t) for t in texts]

sentiment_service = SentimentService()
