import asyncio
from typing import List, Dict
from datetime import datetime, timedelta

from src.domain.news_interfaces import INewsProvider, NewsItem
from src.infrastructure.adapters.rss_news_provider import RSSNewsProvider

class NewsCollector:
    def __init__(self):
        self.providers: Dict[str, INewsProvider] = {
            "CoinTelegraph": RSSNewsProvider("CoinTelegraph", "https://cointelegraph.com/rss"),
            "CoinDesk": RSSNewsProvider("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
            "CryptoPotato": RSSNewsProvider("CryptoPotato", "https://cryptopotato.com/feed/")
        }
        
        # In-memory cache: (timestamp, List[NewsItem])
        self._cache: Dict[str, tuple[datetime, List[NewsItem]]] = {}
        self._cache_ttl = timedelta(seconds=60) # 60 seconds TTL
        
    def get_sources(self) -> List[str]:
        return list(self.providers.keys())

    async def collect_all(self, limit_per_source: int = 10, source: str = "all") -> List[NewsItem]:
        cache_key = f"{source}_{limit_per_source}"
        now = datetime.utcnow()
        
        # Check cache
        if cache_key in self._cache:
            cached_time, cached_data = self._cache[cache_key]
            if now - cached_time < self._cache_ttl:
                return cached_data

        tasks = []
        if source == "all":
            for p in self.providers.values():
                tasks.append(p.fetch_news(limit=limit_per_source))
        elif source in self.providers:
            tasks.append(self.providers[source].fetch_news(limit=limit_per_source))
        else:
            return []

        # Fetch in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        aggregated = []
        seen_urls = set()
        
        for result in results:
            if isinstance(result, Exception):
                print(f"Error fetching news: {result}")
                continue
                
            for item in result:
                if item.url not in seen_urls:
                    seen_urls.add(item.url)
                    aggregated.append(item)
                    
        # Sort descending by date
        aggregated.sort(key=lambda x: x.published_at, reverse=True)
        
        # Save to cache
        self._cache[cache_key] = (now, aggregated)
        
        return aggregated

# Global instance
news_collector = NewsCollector()
