from fastapi import APIRouter, Query
from typing import List, Dict

from src.services.news.news_collector import news_collector

router = APIRouter(prefix="/api/v1/news", tags=["News"])

@router.get("")
async def get_news(
    limit: int = Query(20, description="Max news items per source"),
    source: str = Query("all", description="Specific source or 'all'")
):
    """
    Get aggregated crypto news from RSS feeds.
    Results are cached for 60 seconds to prevent RSS rate limiting.
    """
    items = await news_collector.collect_all(limit_per_source=limit, source=source)
    # Convert dataclasses to dicts and serialize datetime objects for FastAPI response
    return {
        "count": len(items),
        "data": [
            {
                "id": item.id,
                "title": item.title,
                "content": item.content,
                "source": item.source,
                "url": item.url,
                "published_at": item.published_at.isoformat(),
                "sentiment_score": item.sentiment_score,
                "sentiment_label": item.sentiment_label
            }
            for item in items
        ]
    }

@router.get("/sources")
async def get_news_sources() -> Dict[str, List[str]]:
    """
    Get a list of available news sources.
    """
    sources = news_collector.get_sources()
    return {"sources": sources}
