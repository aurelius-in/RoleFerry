from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from ..config import settings
from ..services.offer_decks.gamma_provider import GammaProvider
from ..services.offer_decks.pptx_provider import PPTXProvider


router = APIRouter(prefix="/offer-decks", tags=["offer-decks"]) 


class OfferRequest(BaseModel):
    company: str
    role: str
    candidate_profile: Dict[str, Any] = {}
    problems: List[str] = []
    uvp: str = ""
    evidence_links: List[str] = []


@router.post("/build")
async def build(payload: OfferRequest) -> Dict[str, Any]:
    if not settings.clay_clone_enabled:
        raise HTTPException(status_code=403, detail="Offer decks disabled")
    provider = settings.offer_deck_provider
    if provider == "gamma":
        if not (settings.gamma_api_key or settings.gamma_webhook_url):
            # Fallback to PPTX when Gamma not configured
            p = PPTXProvider()
            return await p.create_deck(payload.company, payload.role, payload.candidate_profile, payload.problems, payload.uvp, payload.evidence_links)
        p = GammaProvider()
        return await p.create_deck(payload.company, payload.role, payload.candidate_profile, payload.problems, payload.uvp, payload.evidence_links)
    # pptx fallback
    p = PPTXProvider()
    return await p.create_deck(payload.company, payload.role, payload.candidate_profile, payload.problems, payload.uvp, payload.evidence_links)


