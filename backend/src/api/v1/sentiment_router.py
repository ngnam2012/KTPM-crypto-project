from fastapi import APIRouter
from pydantic import BaseModel

from src.services.ML.sentiment_service import sentiment_service
from src.services.news.news_collector import news_collector

router = APIRouter(prefix="/api/v1/sentiment", tags=["Sentiment"])

class AnalyzeRequest(BaseModel):
    text: str

@router.get("/summary")
async def get_sentiment_summary():
    """
    Fetches the latest news and runs sentiment analysis to generate a market summary.
    """
    items = await news_collector.collect_all(limit_per_source=5, source="all")
    if not items:
        return {"average_score": 0.5, "distribution": {"positive": 0, "neutral": 0, "negative": 0}, "recent_news": []}
        
    texts = [item.title + " " + item.content for item in items]
    results = sentiment_service.analyze_batch(texts)
    
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
        
        # Attach sentiment to item
        item.sentiment_label = res.label
        item.sentiment_score = res.score
        
        recent_news.append({
            "id": item.id,
            "title": item.title,
            "source": item.source,
            "sentiment_label": item.sentiment_label,
            "sentiment_score": item.sentiment_score,
            "published_at": item.published_at.isoformat()
        })
        
    total = len(items)
    
    return {
        "average_score": total_score / total,
        "distribution": {
            "positive": round((pos / total) * 100, 2),
            "neutral": round((neu / total) * 100, 2),
            "negative": round((neg / total) * 100, 2)
        },
        "recent_news": recent_news
    }

@router.post("/analyze")
async def analyze_text(request: AnalyzeRequest):
    """
    Analyze arbitrary text for sentiment.
    """
    res = sentiment_service.analyze(request.text)
    return {"label": res.label, "score": res.score}
