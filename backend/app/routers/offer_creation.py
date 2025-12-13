from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json

from sqlalchemy import text as sql_text

from ..db import get_engine
from ..config import settings
from ..clients.openai_client import get_openai_client, extract_json_from_text

router = APIRouter()
engine = get_engine()
DEMO_USER_ID = "demo-user"

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
    context_research: Optional[Dict[str, Any]] = None

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

    This endpoint now prefers the centralized GPT client when available, while
    preserving the previous deterministic template as a fallback.
    """
    try:
        if not request.pinpoint_matches:
            raise HTTPException(status_code=400, detail="Pinpoint matches are required")

        base_match: Dict[str, Any] = request.pinpoint_matches[0]

        # --- Deterministic fallback (previous behavior) -----------------
        def build_rule_based_offer() -> Offer:
            if request.user_mode == "job-seeker":
                raw_label = base_match.get("pinpoint_1", "Your Challenge")
                label_words = str(raw_label).split(" ")[:3]
                title = f"How I Can Solve {' '.join(label_words)}"
                content = (
                    f"I understand you're facing {str(base_match.get('pinpoint_1', 'challenges')).lower()}. "
                    f"In my previous role, I {str(base_match.get('solution_1', 'delivered results')).lower()}, "
                    f"resulting in {str(base_match.get('metric_1', 'significant impact'))}. "
                    "I'm confident I can bring similar results to your team."
                )
            else:
                raw_label = base_match.get("pinpoint_1", "Your Role")
                label_words = str(raw_label).split(" ")[:3]
                title = f"Perfect Candidate for {' '.join(label_words)}"
                content = (
                    f"I have an exceptional candidate who has successfully {str(base_match.get('solution_1', 'achieved results')).lower()}, "
                    f"achieving {str(base_match.get('metric_1', 'outstanding metrics'))}. "
                    f"They would be an ideal fit for your {str(base_match.get('pinpoint_1', 'challenges')).lower()} challenge."
                )

            # Adjust tone based on audience
            if request.tone == "recruiter":
                content_prefixed = f"Efficiency-focused: {content}"
            elif request.tone == "manager":
                content_prefixed = f"Proof of competence: {content}"
            elif request.tone == "exec":
                content_prefixed = f"ROI/Strategy focused: {content}"
            else:
                content_prefixed = content

            return Offer(
                id=f"offer_{len(request.pinpoint_matches)}",
                title=title,
                content=content_prefixed,
                tone=request.tone,
                format=request.format,
                created_at="2024-01-15T10:30:00Z",
                user_mode=request.user_mode,
            )

        # --- GPT-backed path via OpenAIClient ---------------------------
        client = get_openai_client()
        if client.should_use_real_llm:
            try:
                context: Dict[str, Any] = {
                    "user_mode": request.user_mode,
                    "tone": request.tone,
                    "format": request.format,
                    "pinpoint_match": base_match,
                    "context_research": request.context_research or {},
                }
                raw = client.draft_offer_email(context)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")

                # Expect JSON: {"title": "...", "content": "..."}
                parsed = extract_json_from_text(content_str) or {}
                title_val = parsed.get("title")
                body_val = parsed.get("content")

                rule_fallback = build_rule_based_offer()
                title = str(title_val or rule_fallback.title)
                body = str(body_val or rule_fallback.content)

                offer = Offer(
                    id=f"offer_{len(request.pinpoint_matches)}",
                    title=title,
                    content=body,
                    tone=request.tone,
                    format=request.format,
                    created_at="2024-01-15T10:30:00Z",
                    user_mode=request.user_mode,
                )

                return OfferCreationResponse(
                    success=True,
                    message="Offer created successfully (GPT-backed)",
                    offer=offer,
                )
            except Exception:
                # Fall through to deterministic path on any GPT error.
                pass

        # Default: deterministic offer (existing behavior)
        offer = build_rule_based_offer()
        return OfferCreationResponse(
            success=True,
            message="Offer created successfully",
            offer=offer,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create offer: {str(e)}")

@router.post("/save", response_model=OfferCreationResponse)
async def save_offer(offer: Offer):
    """
    Save an offer for a user.
    """
    try:
        # Persist offer body & tone to the offer table for the demo user
        async with engine.begin() as conn:
            await conn.execute(
                sql_text(
                    """
                    INSERT INTO offer (user_id, application_id, body, tone, length_preset, created_at)
                    VALUES (:user_id, NULL, :body, :tone, NULL, now())
                    """
                ),
                {
                    "user_id": DEMO_USER_ID,
                    "body": offer.content,
                    "tone": offer.tone,
                },
            )

        return OfferCreationResponse(
            success=True,
            message="Offer saved successfully",
            offer=offer,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save offer: {str(e)}")

@router.get("/{user_id}", response_model=OffersListResponse)
async def get_offers(user_id: str):
    """
    Get all offers for a user.
    """
    try:
        # For Week 9, fetch any stored offers for the demo user; fall back to mocks
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    SELECT id, body, tone, created_at
                    FROM offer
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    """
                ),
                {"user_id": DEMO_USER_ID},
            )
            rows = result.fetchall()

        offers: List[Offer] = []
        for row in rows:
            offers.append(
                Offer(
                    id=str(row.id),
                    title="Saved offer",
                    content=row.body,
                    tone=row.tone or "manager",
                    format="text",
                    created_at=row.created_at.isoformat() if getattr(row, "created_at", None) else "",
                    user_mode="job-seeker",
                )
            )

        if not offers:
            offers = [
                Offer(
                    id="offer_1",
                    title="How I Can Solve Your Engineering Challenges",
                    content="I understand you're facing challenges with time-to-fill for engineering roles. In my previous role, I reduced TTF by 40% using ATS optimization, resulting in 40% reduction, 18 vs 30 days. I'm confident I can bring similar results to your team.",
                    tone="manager",
                    format="text",
                    created_at="2024-01-15T10:30:00Z",
                    user_mode="job-seeker",
                )
            ]

        return OffersListResponse(
            success=True,
            message="Offers retrieved successfully",
            offers=offers,
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
