from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime
from abc import ABC, abstractmethod

@dataclass
class NewsItem:
    id: str
    title: str
    content: str
    source: str
    url: str
    published_at: datetime
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None

class INewsProvider(ABC):
    @abstractmethod
    async def fetch_news(self, query: str = None, limit: int = 20) -> List[NewsItem]:
        """
        Fetch news from the provider.
        """
        pass
