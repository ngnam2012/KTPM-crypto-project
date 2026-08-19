import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any

from src.services.ML.sentiment_service import sentiment_service, SentimentService
from src.services.news.news_collector import news_collector, NewsCollector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sentiment", tags=["Sentiment"])

class AnalyzeRequest(BaseModel):
    text: str

class SentimentAnalysisResponse(BaseModel):
    label: str
    score: float

class NewsSentimentItem(BaseModel):
    id: str
    title: str
    source: str
    sentiment_label: str
    sentiment_score: float
    published_at: str

class SentimentDistribution(BaseModel):
    positive: float
    neutral: float
    negative: float

class SentimentSummaryResponse(BaseModel):
    average_score: float
    distribution: SentimentDistribution
    recent_news: List[NewsSentimentItem]

def get_sentiment_service() -> SentimentService:
    return sentiment_service

def get_news_collector() -> NewsCollector:
    return news_collector

@router.get("/summary", response_model=SentimentSummaryResponse)
async def get_sentiment_summary(
    collector: NewsCollector = Depends(get_news_collector),
    svc: SentimentService = Depends(get_sentiment_service)
):
    """
    Fetches the latest news and runs sentiment analysis in background thread pool.
    """
    try:
        items = await collector.collect_all(limit_per_source=5, source="all")
        if not items:
            return SentimentSummaryResponse(
                average_score=0.5,
                distribution=SentimentDistribution(positive=0, neutral=0, negative=0),
                recent_news=[]
            )
            
        texts = [item.title + " " + item.content for item in items]
        # Offload heavy transformers inference to thread pool
        results = await asyncio.to_thread(svc.analyze_batch, texts)
        
        pos = neu = neg = 0
        total_score = 0.0
        recent_news = []
        
        for item, res in zip(items, results):
            if res.label == "POSITIVE":
                pos += 1
            elif res.label == "NEGATIVE":
                neg += 1
            else:
                neu += 1
                
            total_score += res.score
            
            recent_news.append(NewsSentimentItem(
                id=item.id,
                title=item.title,
                source=item.source,
                sentiment_label=res.label,
                sentiment_score=res.score,
                published_at=item.published_at.isoformat()
            ))
            
        total = len(items)
        
        return SentimentSummaryResponse(
            average_score=total_score / total,
            distribution=SentimentDistribution(
                positive=round((pos / total) * 100, 2),
                neutral=round((neu / total) * 100, 2),
                negative=round((neg / total) * 100, 2)
            ),
            recent_news=recent_news
        )
    except Exception as e:
        logger.exception(f"Error fetching sentiment summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/analyze", response_model=SentimentAnalysisResponse)
async def analyze_text(
    request: AnalyzeRequest,
    svc: SentimentService = Depends(get_sentiment_service)
):
    """
    Analyze arbitrary text for sentiment in a background thread pool.
    """
    try:
        res = await asyncio.to_thread(svc.analyze, request.text)
        return SentimentAnalysisResponse(label=res.label, score=res.score)
    except Exception as e:
        logger.exception(f"Error analyzing sentiment text: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

