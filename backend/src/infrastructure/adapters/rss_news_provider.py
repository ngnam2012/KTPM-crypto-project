import feedparser
import asyncio
from typing import List
from datetime import datetime
from dateutil import parser as date_parser
import hashlib

from src.domain.news_interfaces import INewsProvider, NewsItem

class RSSNewsProvider(INewsProvider):
    def __init__(self, source_name: str, rss_url: str):
        self.source_name = source_name
        self.rss_url = rss_url

    async def fetch_news(self, query: str = None, limit: int = 20) -> List[NewsItem]:
        # feedparser is blocking, so we run it in a thread executor to avoid blocking the asyncio event loop
        loop = asyncio.get_running_loop()
        feed = await loop.run_in_executor(None, feedparser.parse, self.rss_url)
        
        items = []
        for entry in feed.entries[:limit]:
            # Generate a consistent ID from the URL
            url = entry.get('link', '')
            item_id = hashlib.md5(url.encode()).hexdigest()
            
            title = entry.get('title', '')
            content = entry.get('summary', '') or entry.get('description', '')
            
            # Parse publish date
            published_str = entry.get('published', '') or entry.get('updated', '')
            try:
                published_at = date_parser.parse(published_str) if published_str else datetime.utcnow()
            except Exception:
                published_at = datetime.utcnow()
                
            # Very basic client-side naive matching if query is provided
            if query and query.lower() not in title.lower() and query.lower() not in content.lower():
                continue
                
            # Optional: Add naive sentiment here, or leave for a specialized sentiment service
            # For now, left as None
            
            items.append(NewsItem(
                id=item_id,
                title=title,
                content=content,
                source=self.source_name,
                url=url,
                published_at=published_at
            ))
            
        return items
