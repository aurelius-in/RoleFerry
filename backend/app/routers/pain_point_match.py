from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import json

router = APIRouter()

class PinpointMatch(BaseModel):
    pinpoint_1: str
    solution_1: str
    metric_1: str
    pinpoint_2: str
    solution_2: str
    metric_2: str
    pinpoint_3: str
    solution_3: str
    metric_3: str
    alignment_score: float

class PinpointMatchResponse(BaseModel):
    success: bool
    message: str
    matches: List[PinpointMatch]

class MatchRequest(BaseModel):
    job_description_id: str
    resume_extract_id: str

@router.post("/generate", response_model=PinpointMatchResponse)
async def generate_pinpoint_matches(request: MatchRequest):
    """
    Generate pinpoint matches between job description pain points and resume solutions.
    """
    try:
        # In a real implementation, this would use AI/ML to analyze the job description
        # and resume extract to find the best alignments
        # For now, return mock data
        mock_matches = [
            PinpointMatch(
                pinpoint_1="Need to reduce time-to-fill for engineering roles",
                solution_1="Reduced TTF by 40% using ATS optimization and streamlined hiring process",
                metric_1="40% reduction, 18 vs 30 days average",
                pinpoint_2="Struggling with candidate quality and cultural fit",
                solution_2="Implemented structured interview process with cultural fit assessment",
                metric_2="Improved candidate quality scores by 35%",
                pinpoint_3="High turnover in engineering team affecting project delivery",
                solution_3="Built team retention program with career development focus",
                metric_3="Reduced turnover by 25% in 6 months",
                alignment_score=0.85
            )
        ]
        
        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches generated successfully",
            matches=mock_matches
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate matches: {str(e)}")

@router.post("/save", response_model=PinpointMatchResponse)
async def save_pinpoint_matches(matches: List[PinpointMatch]):
    """
    Save pinpoint matches for a user.
    """
    try:
        # In a real app, save to database with user_id
        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches saved successfully",
            matches=matches
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save matches: {str(e)}")

@router.get("/{user_id}", response_model=PinpointMatchResponse)
async def get_pinpoint_matches(user_id: str):
    """
    Get pinpoint matches for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_matches = [
            PinpointMatch(
                pinpoint_1="Need to reduce time-to-fill for engineering roles",
                solution_1="Reduced TTF by 40% using ATS optimization and streamlined hiring process",
                metric_1="40% reduction, 18 vs 30 days average",
                pinpoint_2="Struggling with candidate quality and cultural fit",
                solution_2="Implemented structured interview process with cultural fit assessment",
                metric_2="Improved candidate quality scores by 35%",
                pinpoint_3="High turnover in engineering team affecting project delivery",
                solution_3="Built team retention program with career development focus",
                metric_3="Reduced turnover by 25% in 6 months",
                alignment_score=0.85
            )
        ]
        
        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches retrieved successfully",
            matches=mock_matches
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get matches: {str(e)}")

@router.put("/{user_id}", response_model=PinpointMatchResponse)
async def update_pinpoint_matches(user_id: str, matches: List[PinpointMatch]):
    """
    Update pinpoint matches for a user.
    """
    try:
        # In a real app, update in database
        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches updated successfully",
            matches=matches
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update matches: {str(e)}")

@router.delete("/{user_id}")
async def delete_pinpoint_matches(user_id: str):
    """
    Delete pinpoint matches for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Pinpoint matches deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete matches: {str(e)}")

@router.get("/{user_id}/score")
async def get_alignment_score(user_id: str):
    """
    Get the overall alignment score for a user's matches.
    """
    try:
        # In a real app, calculate from stored matches
        # For now, return mock data
        return {
            "success": True,
            "alignment_score": 0.85,
            "score_label": "Excellent Match",
            "message": "Alignment score retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alignment score: {str(e)}")
