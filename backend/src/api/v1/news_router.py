import logging
from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional, Any

from src.services.news.news_collector import news_collector, NewsCollector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/news", tags=["News"])

class NewsItemResponse(BaseModel):
    id: str
    title: str
    content: str
    source: str
    url: str
    published_at: str
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None

class NewsAggregatedResponse(BaseModel):
    count: int
    data: List[NewsItemResponse]

class NewsSourcesResponse(BaseModel):
    sources: List[str]

def get_news_collector() -> NewsCollector:
    return news_collector

@router.get("", response_model=NewsAggregatedResponse)
async def get_news(
    limit: int = Query(20, description="Max news items per source"),
    source: str = Query("all", description="Specific source or 'all'"),
    collector: NewsCollector = Depends(get_news_collector)
):
    """
    Get aggregated crypto news from RSS feeds.
    Results are cached for 60 seconds to prevent RSS rate limiting.
    """
    try:
        items = await collector.collect_all(limit_per_source=limit, source=source)
        data = [
            NewsItemResponse(
                id=item.id,
                title=item.title,
                content=item.content,
                source=item.source,
                url=item.url,
                published_at=item.published_at.isoformat(),
                sentiment_score=item.sentiment_score,
                sentiment_label=item.sentiment_label
            )
            for item in items
        ]
        return NewsAggregatedResponse(count=len(data), data=data)
    except Exception as e:
        logger.exception(f"Error getting news: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/sources", response_model=NewsSourcesResponse)
async def get_news_sources(
    collector: NewsCollector = Depends(get_news_collector)
):
    """
    Get a list of available news sources.
    """
    try:
        sources = collector.get_sources()
        return NewsSourcesResponse(sources=sources)
    except Exception as e:
        logger.exception(f"Error getting news sources: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

