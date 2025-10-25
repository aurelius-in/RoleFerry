from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()

class Offer(BaseModel):
    id: str
    title: str
    content: str
    tone: str  # 'recruiter', 'manager', 'exec'
    format: str  # 'text', 'link', 'video'
    url: Optional[str] = None
    video_url: Optional[str] = None
    created_at: str
    user_mode: str = "job-seeker"  # 'job-seeker' or 'recruiter'

class OfferCreationRequest(BaseModel):
    pinpoint_matches: List[dict]
    tone: str
    format: str
    user_mode: str = "job-seeker"

class OfferCreationResponse(BaseModel):
    success: bool
    message: str
    offer: Optional[Offer] = None

class OffersListResponse(BaseModel):
    success: bool
    message: str
    offers: List[Offer]

@router.post("/create", response_model=OfferCreationResponse)
async def create_offer(request: OfferCreationRequest):
    """
    Create a personalized offer based on pinpoint matches and audience tone.
    """
    try:
        # In a real implementation, this would use AI to generate personalized offers
        # For now, return mock data based on the request
        if not request.pinpoint_matches:
            raise HTTPException(status_code=400, detail="Pinpoint matches are required")
        
        match = request.pinpoint_matches[0]
        
        # Generate offer based on user mode and tone
        if request.user_mode == "job-seeker":
            title = f"How I Can Solve {match.get('pinpoint_1', 'Your Challenge').split(' ')[:3]}"
            content = f"I understand you're facing {match.get('pinpoint_1', 'challenges').lower()}. In my previous role, I {match.get('solution_1', 'delivered results').lower()}, resulting in {match.get('metric_1', 'significant impact')}. I'm confident I can bring similar results to your team."
        else:
            title = f"Perfect Candidate for {match.get('pinpoint_1', 'Your Role').split(' ')[:3]}"
            content = f"I have an exceptional candidate who has successfully {match.get('solution_1', 'achieved results').lower()}, achieving {match.get('metric_1', 'outstanding metrics')}. They would be an ideal fit for your {match.get('pinpoint_1', 'challenges').lower()} challenge."
        
        # Adjust tone based on audience
        if request.tone == "recruiter":
            content = f"Efficiency-focused: {content}"
        elif request.tone == "manager":
            content = f"Proof of competence: {content}"
        elif request.tone == "exec":
            content = f"ROI/Strategy focused: {content}"
        
        offer = Offer(
            id=f"offer_{len(request.pinpoint_matches)}",
            title=title,
            content=content,
            tone=request.tone,
            format=request.format,
            created_at="2024-01-15T10:30:00Z",
            user_mode=request.user_mode
        )
        
        return OfferCreationResponse(
            success=True,
            message="Offer created successfully",
            offer=offer
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create offer: {str(e)}")

@router.post("/save", response_model=OfferCreationResponse)
async def save_offer(offer: Offer):
    """
    Save an offer for a user.
    """
    try:
        # In a real app, save to database with user_id
        return OfferCreationResponse(
            success=True,
            message="Offer saved successfully",
            offer=offer
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save offer: {str(e)}")

@router.get("/{user_id}", response_model=OffersListResponse)
async def get_offers(user_id: str):
    """
    Get all offers for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_offers = [
            Offer(
                id="offer_1",
                title="How I Can Solve Your Engineering Challenges",
                content="I understand you're facing challenges with time-to-fill for engineering roles. In my previous role, I reduced TTF by 40% using ATS optimization, resulting in 40% reduction, 18 vs 30 days. I'm confident I can bring similar results to your team.",
                tone="manager",
                format="text",
                created_at="2024-01-15T10:30:00Z",
                user_mode="job-seeker"
            ),
            Offer(
                id="offer_2",
                title="Perfect Candidate for Your Engineering Team",
                content="I have an exceptional candidate who has successfully reduced TTF by 40% using ATS optimization, achieving 40% reduction, 18 vs 30 days. They would be an ideal fit for your time-to-fill challenges.",
                tone="recruiter",
                format="text",
                created_at="2024-01-14T15:45:00Z",
                user_mode="recruiter"
            )
        ]
        
        return OffersListResponse(
            success=True,
            message="Offers retrieved successfully",
            offers=mock_offers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get offers: {str(e)}")

@router.get("/{user_id}/{offer_id}", response_model=OfferCreationResponse)
async def get_offer(user_id: str, offer_id: str):
    """
    Get a specific offer by ID.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_offer = Offer(
            id=offer_id,
            title="How I Can Solve Your Engineering Challenges",
            content="I understand you're facing challenges with time-to-fill for engineering roles. In my previous role, I reduced TTF by 40% using ATS optimization, resulting in 40% reduction, 18 vs 30 days. I'm confident I can bring similar results to your team.",
            tone="manager",
            format="text",
            created_at="2024-01-15T10:30:00Z",
            user_mode="job-seeker"
        )
        
        return OfferCreationResponse(
            success=True,
            message="Offer retrieved successfully",
            offer=mock_offer
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get offer: {str(e)}")

@router.put("/{user_id}/{offer_id}", response_model=OfferCreationResponse)
async def update_offer(user_id: str, offer_id: str, offer: Offer):
    """
    Update an offer.
    """
    try:
        # In a real app, update in database
        return OfferCreationResponse(
            success=True,
            message="Offer updated successfully",
            offer=offer
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update offer: {str(e)}")

@router.delete("/{user_id}/{offer_id}")
async def delete_offer(user_id: str, offer_id: str):
    """
    Delete an offer.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Offer deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete offer: {str(e)}")

@router.get("/tones/descriptions")
async def get_tone_descriptions():
    """
    Get descriptions for different audience tones.
    """
    try:
        tones = {
            "recruiter": "Efficiency-focused, quick decision making",
            "manager": "Proof of competence, team impact",
            "exec": "ROI/Strategy focused, business outcomes"
        }
        
        return {
            "success": True,
            "tones": tones,
            "message": "Tone descriptions retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tone descriptions: {str(e)}")

@router.get("/formats/descriptions")
async def get_format_descriptions():
    """
    Get descriptions for different offer formats.
    """
    try:
        formats = {
            "text": "Text-based pitch for email or message",
            "link": "Link to detailed pitch page or portfolio",
            "video": "Video pitch for personal touch"
        }
        
        return {
            "success": True,
            "formats": formats,
            "message": "Format descriptions retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get format descriptions: {str(e)}")
