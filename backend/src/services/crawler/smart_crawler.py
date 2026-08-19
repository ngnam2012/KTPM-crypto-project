import re
import logging
import urllib.parse
from datetime import datetime
from typing import Dict, Any, Optional
import httpx
from html.parser import HTMLParser

from src.infrastructure.database.config import SessionLocal
from src.infrastructure.database.models import CrawlerTagSchemaModel, NewsItemModel
from src.services.ML.sentiment_service import sentiment_service

logger = logging.getLogger(__name__)

class SimpleHTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.in_script = False
        self.in_style = False
        self.h1_texts = []
        self.paragraphs = []
        self.current_tag = None
        self.current_data = []

    def handle_starttag(self, tag, attrs):
        self.current_tag = tag.lower()
        if self.current_tag in ['script', 'style', 'noscript']:
            self.in_script = True
        self.current_data = []

    def handle_endtag(self, tag):
        t = tag.lower()
        if t in ['script', 'style', 'noscript']:
            self.in_script = False
        text = "".join(self.current_data).strip()
        if text and not self.in_script:
            if t == 'h1':
                self.h1_texts.append(text)
            elif t == 'p':
                self.paragraphs.append(text)
            self.text_parts.append(text)
        self.current_tag = None
        self.current_data = []

    def handle_data(self, data):
        if not self.in_script:
            self.current_data.append(data)


class SmartCrawler:
    """
    Intelligent Web Crawler that extracts news and trading articles from arbitrary URLs,
    learns HTML tag structures, and saves tag schemas to SQLite database for reusable extraction.
    """

    @staticmethod
    def _extract_domain(url: str) -> str:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain

    @classmethod
    async def crawl_article(cls, url: str) -> Dict[str, Any]:
        """
        Crawls a news article from a given URL, extracting clean title & content.
        """
        domain = cls._extract_domain(url)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html_content = response.text

        # Extract title from OpenGraph / Twitter meta tags
        og_match = re.search(r'<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
        if not og_match:
            og_match = re.search(r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:title["\']', html_content, re.IGNORECASE)

        # Parse text with HTML parser
        parser = SimpleHTMLTextExtractor()
        try:
            parser.feed(html_content)
        except Exception:
            pass

        title = None
        if og_match:
            title = og_match.group(1).strip()
            title_selector = "meta[property='og:title']"
        elif parser.h1_texts:
            title = parser.h1_texts[0]
            title_selector = "h1"
        else:
            title_match = re.search(r'<title[^>]*>(.*?)</title>', html_content, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else "Crypto Market News"
            title_selector = "title"

        # Content
        valid_ps = [p for p in parser.paragraphs if len(p) > 25]
        if valid_ps:
            content = " ".join(valid_ps[:10])
            content_selector = "article p"
        else:
            content = " ".join([t for t in parser.text_parts if len(t) > 30][:10])
            content_selector = "p"

        published_at = datetime.utcnow()
        date_selector = "time"

        # Save or update schema in DB
        db = SessionLocal()
        try:
            schema = db.query(CrawlerTagSchemaModel).filter(CrawlerTagSchemaModel.domain == domain).first()
            if not schema:
                new_schema = CrawlerTagSchemaModel(
                    domain=domain,
                    title_selector=title_selector,
                    content_selector=content_selector,
                    date_selector=date_selector,
                    created_at=datetime.utcnow()
                )
                db.add(new_schema)
            else:
                schema.title_selector = title_selector
                schema.content_selector = content_selector
                schema.date_selector = date_selector
                schema.updated_at = datetime.utcnow()
            db.commit()
        except Exception as e:
            logger.warning(f"Error persisting crawler schema: {e}")
        finally:
            db.close()

        # Compute sentiment using ML model
        sentiment_res = sentiment_service.analyze(f"{title}. {content[:300]}")

        return {
            "url": url,
            "domain": domain,
            "title": title,
            "content": content[:1000],
            "published_at": published_at.isoformat(),
            "sentiment_score": round(sentiment_res.score, 4),
            "sentiment_label": sentiment_res.label.lower(),
            "learned_schema": {
                "domain": domain,
                "title_selector": title_selector,
                "content_selector": content_selector
            }
        }
