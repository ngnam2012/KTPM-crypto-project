from fastapi import APIRouter, Query
from typing import Optional

from src.services.leaderboard.leaderboard_service import LeaderboardService

router = APIRouter(prefix="/api/v1/leaderboard", tags=["Leaderboard"])
leaderboard_service = LeaderboardService()

@router.get("")
async def get_leaderboard(
    top_k: int = Query(10, description="Number of top entries to return"),
    sort_by: str = Query("overall_score", description="Metric to sort by"),
    order: str = Query("desc", description="Sort order: asc or desc")
):
    """
    Get the top strategies from the leaderboard.
    """
    entries = leaderboard_service.get_top_k(k=top_k, sort_by=sort_by, order=order)
    
    # Format for response
    results = []
    for i, entry in enumerate(entries):
        result = entry.to_dict()
        result["rank"] = i + 1
        results.append(result)
        
    return {"leaderboard": results}
