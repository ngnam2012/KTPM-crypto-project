import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.services.ai.strategy_parser import AIStrategyParser
from src.services.crawler.smart_crawler import SmartCrawler
from src.infrastructure.database.config import get_db
from src.infrastructure.database.models import StrategyDefinitionModel, CrawlerTagSchemaModel, UserModel
from src.api.v1.auth_router import get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/custom-strategies", tags=["AI Custom Strategies & Smart Crawler"])

class PromptStrategyRequest(BaseModel):
    prompt: str
    source_url: Optional[str] = None

class CrawlArticleRequest(BaseModel):
    url: str

class StrategySaveRequest(BaseModel):
    name: str
    version: str = "1.0.0"
    tags: List[str] = []
    json_schema: Dict[str, Any]
    source_prompt: Optional[str] = None

class StrategySchemaResponse(BaseModel):
    id: str
    name: str
    version: Optional[str] = "1.0.0"
    type: str
    logic: str
    tags: Optional[List[str]] = []
    strategies: List[Dict[str, Any]]
    description: str
    prompt: Optional[str] = None
    source_url: Optional[str] = None
    long_conditions: Optional[List[str]] = []
    short_conditions: Optional[List[str]] = []
    risk_management: Optional[Dict[str, Any]] = {}
    timeframe: Optional[str] = "1h (Default)"
    applicability: Optional[str] = "All USDT Trading Pairs (Configurable)"
    json_schema: Optional[Dict[str, Any]] = {}
    validation: Optional[Dict[str, str]] = {}

@router.post("/generate-from-prompt", response_model=StrategySchemaResponse)
async def generate_strategy_from_prompt(request: PromptStrategyRequest):
    """
    Takes natural language trading description or article notes and transforms
    into Single/Composite strategy JSON schema with conditions, risk management (StopLoss, TakeProfit),
    and validation, saving it in the DB for reusable backtests.
    """
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")
    try:
        res = AIStrategyParser.parse_from_text(request.prompt, request.source_url)
        return StrategySchemaResponse(**res)
    except Exception as e:
        logger.exception(f"Error generating strategy from prompt: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse strategy from prompt.")

@router.post("/save")
async def save_custom_strategy(
    request: StrategySaveRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user)
):
    """
    Saves a customized or validated strategy into Strategy Library in database, optionally tagged with current user.
    """
    try:
        db_id = str(uuid4())
        record = StrategyDefinitionModel(
            id=db_id,
            user_id=current_user.id if current_user else None,
            name=request.name,
            type="custom",
            version=request.version,
            description=request.json_schema.get("description", f"Custom strategy {request.name}"),
            source_prompt=request.source_prompt,
            params_json=request.json_schema,
            created_at=datetime.utcnow()
        )
        db.add(record)
        db.commit()
        return {
            "id": db_id,
            "message": f"Strategy '{request.name}' saved to library successfully!",
            "author": current_user.username if current_user else "Public / Anonymous"
        }
    except Exception as e:
        logger.exception(f"Error saving strategy: {e}")
        raise HTTPException(status_code=500, detail="Failed to save strategy to library.")

@router.get("/saved")
async def get_saved_strategies(db: Session = Depends(get_db)):
    """
    Retrieves all AI-generated or custom saved strategies from the database.
    """
    try:
        records = db.query(StrategyDefinitionModel).order_by(StrategyDefinitionModel.created_at.desc()).all()
        results = []
        for r in records:
            params = r.params_json or {}
            results.append({
                "id": r.id,
                "user_id": r.user_id,
                "author": r.user.username if r.user else "System / Built-in",
                "name": r.name,
                "type": r.type,
                "version": r.version,
                "description": r.description,
                "source_prompt": r.source_prompt,
                "params": params,
                "created_at": r.created_at.isoformat() if r.created_at else None
            })
        return {"saved_strategies": results}
    except Exception as e:
        logger.exception(f"Error loading saved strategies: {e}")
        raise HTTPException(status_code=500, detail="Failed to load saved strategies.")

@router.post("/crawl-news")
async def crawl_news_article(request: CrawlArticleRequest):
    """
    Crawls arbitrary news/trading article URL, extracts clean text via learned/inferred
    HTML tags, caches tag schema to SQLite, and performs sentiment analysis.
    """
    if not request.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
    try:
        data = await SmartCrawler.crawl_article(request.url)
        return data
    except Exception as e:
        logger.exception(f"Error crawling URL {request.url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to crawl article: {str(e)}")

@router.get("/crawler-schemas")
async def get_crawler_tag_schemas(db: Session = Depends(get_db)):
    """
    Returns all learned HTML tag schemas saved in database.
    """
    try:
        schemas = db.query(CrawlerTagSchemaModel).all()
        results = [
            {
                "id": s.id,
                "domain": s.domain,
                "title_selector": s.title_selector,
                "content_selector": s.content_selector,
                "date_selector": s.date_selector,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None
            }
            for s in schemas
        ]
        return {"schemas": results}
    except Exception as e:
        logger.exception(f"Error fetching crawler schemas: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch crawler schemas.")
