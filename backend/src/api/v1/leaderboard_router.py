import logging
from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from src.services.leaderboard.leaderboard_service import LeaderboardService, leaderboard_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/leaderboard", tags=["Leaderboard"])

class LeaderboardEntryResponse(BaseModel):
    id: str
    rank: int
    strategy_name: str
    strategy_config: Dict[str, Any]
    metrics: Dict[str, Any]
    overall_score: float
    timestamp: str

class LeaderboardResponse(BaseModel):
    leaderboard: List[LeaderboardEntryResponse]

def get_leaderboard_service() -> LeaderboardService:
    return leaderboard_service

@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    top_k: int = Query(10, description="Number of top entries to return"),
    sort_by: str = Query("overall_score", description="Metric to sort by"),
    order: str = Query("desc", description="Sort order: asc or desc"),
    svc: LeaderboardService = Depends(get_leaderboard_service)
):
    """
    Get the top strategies from the leaderboard.
    """
    try:
        entries = svc.get_top_k(k=top_k, sort_by=sort_by, order=order)
        
        results = []
        for i, entry in enumerate(entries):
            r = entry.to_dict()
            r["rank"] = i + 1
            results.append(LeaderboardEntryResponse(**r))
            
        return LeaderboardResponse(leaderboard=results)
    except Exception as e:
        logger.exception(f"Error fetching leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

