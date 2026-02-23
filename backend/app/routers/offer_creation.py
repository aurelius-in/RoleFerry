from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import uuid
import re
from datetime import datetime, timezone

from sqlalchemy import text as sql_text

from ..db import get_engine
from ..config import settings
from ..clients.openai_client import get_openai_client, extract_json_from_text, _strip_fluff_openers
from ..auth import require_current_user
from ..storage import store

router = APIRouter()
engine = get_engine()

class Offer(BaseModel):
    id: str
    title: str
    content: str
    tone: str  # 'recruiter', 'manager', 'exec'
    format: str  # 'text', 'link', 'video'
    url: Optional[str] = None
    video_url: Optional[str] = None
    custom_tone: Optional[str] = None
    created_at: str
    user_mode: str = "job-seeker"  # 'job-seeker' or 'recruiter'

class OfferCreationRequest(BaseModel):
    painpoint_matches: List[dict]
    tone: str
    custom_tone: Optional[str] = None
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


class ComposeOfferSnippetRequest(BaseModel):
    one_liner: str = ""
    proof_points: List[str] = []
    case_studies: List[Dict[str, Any]] = []
    default_cta: str = ""
    soft_cta: str = ""
    hard_cta: str = ""
    role_title: Optional[str] = None
    role_company: Optional[str] = None
    required_skills: List[str] = []
    pain_points: List[str] = []
    success_metrics: List[str] = []


class ComposeOfferSnippetResponse(BaseModel):
    success: bool
    message: str
    snippet: str
    used_llm: bool = False


def _build_rule_based_snippet(payload: ComposeOfferSnippetRequest) -> str:
    one = re.sub(r"\s+", " ", str(payload.one_liner or "")).strip()[:220]
    proofs = [re.sub(r"\s+", " ", str(x or "")).strip()[:160] for x in (payload.proof_points or []) if str(x or "").strip()]
    proofs = proofs[:3]
    hard_cta = re.sub(r"\s+", " ", str(payload.hard_cta or payload.default_cta or "")).strip()[:140]
    soft_cta = re.sub(r"\s+", " ", str(payload.soft_cta or "")).strip()[:140]
    case_bits: List[str] = []
    for c in (payload.case_studies or [])[:2]:
        if not isinstance(c, dict):
            continue
        p = re.sub(r"\s+", " ", str(c.get("problem") or "")).strip()
        a = re.sub(r"\s+", " ", str(c.get("actions") or "")).strip()
        i = re.sub(r"\s+", " ", str(c.get("impact") or "")).strip()
        bit = " -> ".join([x for x in [p[:100], a[:100], i[:80]] if x])
        if bit:
            case_bits.append(bit)

    lines: List[str] = []
    if one:
        lines.append(one)
    if proofs:
        lines.append(f"Proof: {' | '.join(proofs)}")
    if case_bits:
        lines.append(f"Example: {case_bits[0]}")
    if soft_cta:
        lines.append(f"Soft CTA: {soft_cta}")
    if hard_cta:
        lines.append(f"Hard CTA: {hard_cta}")
    s = "\n".join(lines).strip()
    return s[:900]


@router.post("/compose-snippet", response_model=ComposeOfferSnippetResponse)
async def compose_offer_snippet(payload: ComposeOfferSnippetRequest):
    """
    Compose a concise, human-sounding offer snippet from Offer page inputs.
    Uses LLM when configured; deterministic fallback otherwise.
    """
    try:
        fallback = _build_rule_based_snippet(payload)
        client = get_openai_client()
        if client.should_use_real_llm:
            try:
                ctx = {
                    "role": {"title": payload.role_title, "company": payload.role_company},
                    "one_liner": payload.one_liner,
                    "proof_points": (payload.proof_points or [])[:6],
                    "case_studies": (payload.case_studies or [])[:2],
                    "default_cta": payload.default_cta,
                    "soft_cta": payload.soft_cta,
                    "hard_cta": payload.hard_cta,
                    "required_skills": (payload.required_skills or [])[:8],
                    "pain_points": (payload.pain_points or [])[:6],
                    "success_metrics": (payload.success_metrics or [])[:6],
                }
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You write an offer snippet for a job seeker.\n"
                            "Return ONLY JSON: {\"snippet\": string}\n\n"
                            "Rules:\n"
                            "- First-person singular only (I/me/my), never we/us/our.\n"
                            "- Keep it concise: 3-6 short lines total.\n"
                            "- Human tone; avoid corporate filler and awkward templates.\n"
                            "- Do NOT start with 'For <role> at <company>:'\n"
                            "- Avoid these exact phrases: 'I help teams ship outcomes', 'Need for', 'Context:'.\n"
                            "- Include one low-friction soft CTA line if provided.\n"
                            "- Include one stronger hard CTA line if provided.\n"
                            "- Use only provided inputs; do not invent facts or numbers.\n"
                            "- If proof points are weak, still produce clean copy without hallucinations.\n"
                        ),
                    },
                    {"role": "user", "content": json.dumps(ctx, ensure_ascii=False)},
                ]
                raw = client.run_chat_completion(
                    messages,
                    temperature=0.25,
                    max_tokens=380,
                    stub_json={"snippet": fallback},
                )
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")
                parsed = extract_json_from_text(content_str) or {}
                snippet = str(parsed.get("snippet") or "").strip()
                snippet = _strip_fluff_openers(snippet)
                snippet = re.sub(r"\bFor\s+[^:\n]{1,120}:\s*", "", snippet, flags=re.I)
                snippet = re.sub(r"\bI help teams ship outcomes\b", "I help teams get results", snippet, flags=re.I)
                snippet = re.sub(r"\bNeed for\b", "Need to", snippet, flags=re.I)
                snippet = re.sub(r"\n{3,}", "\n\n", snippet).strip()
                if len(snippet.split()) < 18:
                    snippet = fallback
                return ComposeOfferSnippetResponse(
                    success=True,
                    message="Offer snippet composed",
                    snippet=snippet[:900],
                    used_llm=True,
                )
            except Exception:
                pass

        return ComposeOfferSnippetResponse(
            success=True,
            message="Offer snippet composed (fallback)",
            snippet=fallback,
            used_llm=False,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compose offer snippet: {str(e)}")

@router.post("/create", response_model=OfferCreationResponse)
async def create_offer(request: OfferCreationRequest):
    """
    Create a personalized offer based on pain point matches and audience tone.

    This endpoint now prefers the centralized GPT client when available, while
    preserving the previous deterministic template as a fallback.
    """
    try:
        if not request.painpoint_matches:
            raise HTTPException(status_code=400, detail="Pain point matches are required")

        base_match: Dict[str, Any] = request.painpoint_matches[0]

        # --- Deterministic fallback (previous behavior) -----------------
        def build_rule_based_offer() -> Offer:
            offer_id = str(uuid.uuid4())
            created_at = datetime.now(timezone.utc).isoformat()
            if request.user_mode == "job-seeker":
                raw_label = base_match.get("painpoint_1", "Your Challenge")
                label_words = str(raw_label).split(" ")[:3]
                title = f"How I Can Solve {' '.join(label_words)}"
                pain = str(base_match.get("painpoint_1", "the role")).strip()
                sol = str(base_match.get("solution_1", "delivered results")).strip()
                met = str(base_match.get("metric_1", "")).strip()
                metric_phrase = met if met else "Qualitative: meaningful improvements (confirm specifics in resume bullets)."
                content = (
                    f"I noticed the challenges around {pain}. "
                    f"I’ve done similar work, for example: {sol}. "
                    f"Impact: {metric_phrase}. "
                    "If it’s useful, I can share a 2–3 bullet plan tailored to this role."
                )
            else:
                raw_label = base_match.get("painpoint_1", "Your Role")
                label_words = str(raw_label).split(" ")[:3]
                title = f"Perfect Candidate for {' '.join(label_words)}"
                pain = str(base_match.get("painpoint_1", "this")).strip()
                sol = str(base_match.get("solution_1", "achieved results")).strip()
                met = str(base_match.get("metric_1", "")).strip()
                metric_phrase = met if met else "Qualitative: strong impact (confirm specifics in resume bullets)."
                content = (
                    f"I'm working with a candidate who has done similar work, for example: {sol}. "
                    f"Impact: {metric_phrase}. "
                    f"They are a strong fit for addressing {pain}."
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
                id=offer_id,
                title=title,
                content=content_prefixed,
                tone=request.tone,
                format=request.format,
                created_at=created_at,
                user_mode=request.user_mode,
            )

        # --- GPT-backed path via OpenAIClient ---------------------------
        client = get_openai_client()
        if client.should_use_real_llm:
            try:
                context: Dict[str, Any] = {
                    "user_mode": request.user_mode,
                    "tone": request.tone,
                    "custom_tone": request.custom_tone,
                    "format": request.format,
                    "painpoint_match": base_match,
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
                body = _strip_fluff_openers(str(body_val or rule_fallback.content))
                # Guardrail: avoid a repeated phrase that users found too generic.
                body = re.sub(
                    r"\bI help teams ship outcomes\b",
                    "I help teams get important work done",
                    body,
                    flags=re.I,
                )
                # Guardrail: if GPT returns something too short/sparse, fall back to deterministic.
                if len(body.split()) < 35:
                    body = rule_fallback.content

                offer = Offer(
                    id=str(uuid.uuid4()),
                    title=title,
                    content=body,
                    tone=request.tone,
                    format=request.format,
                    custom_tone=request.custom_tone,
                    created_at=datetime.now(timezone.utc).isoformat(),
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
async def save_offer(offer: Offer, http_request: Request):
    """
    Save an offer for a user.
    """
    try:
        user = await require_current_user(http_request)
        user_id = user.id

        # DB-first (future webapp), fallback to in-memory if Postgres is unavailable.
        try:
            async with engine.begin() as conn:
                res = await conn.execute(
                    sql_text(
                        """
                        INSERT INTO offer (user_id, application_id, body, tone, length_preset, created_at, title, format, url, video_url, custom_tone, user_mode)
                        VALUES (:user_id, NULL, :body, :tone, NULL, now(), :title, :format, :url, :video_url, :custom_tone, :user_mode)
                        RETURNING id::text
                        """
                    ),
                    {
                        "user_id": user_id,
                        "body": offer.content,
                        "tone": offer.tone,
                        "title": offer.title,
                        "format": offer.format,
                        "url": offer.url,
                        "video_url": offer.video_url,
                        "custom_tone": offer.custom_tone,
                        "user_mode": offer.user_mode,
                    },
                )
                row = res.first()
                if row and getattr(row, "id", None):
                    offer.id = str(row.id)
        except Exception:
            # In-memory demo persistence (per user)
            store.demo_offer_library_by_user.setdefault(user_id, [])
            existing_ids = {str(o.get("id")) for o in (store.demo_offer_library_by_user.get(user_id) or []) if isinstance(o, dict)}
            if (not offer.id) or (str(offer.id) in existing_ids):
                offer.id = str(uuid.uuid4())
            store.demo_offer_library_by_user[user_id].insert(0, offer.model_dump() if hasattr(offer, "model_dump") else offer.dict())

        return OfferCreationResponse(
            success=True,
            message="Offer saved successfully",
            offer=offer,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save offer: {str(e)}")

@router.get("/me", response_model=OffersListResponse)
async def get_offers_me(http_request: Request):
    """
    Get all offers for the authenticated user.
    """
    try:
        user = await require_current_user(http_request)
        user_id = user.id

        offers: List[Offer] = []

        # DB-first
        try:
            async with engine.begin() as conn:
                result = await conn.execute(
                    sql_text(
                        """
                        SELECT id::text as id, title, body, tone, created_at, format, url, video_url, custom_tone, user_mode
                        FROM offer
                        WHERE user_id = :user_id
                        ORDER BY created_at DESC
                        """
                    ),
                    {"user_id": user_id},
                )
                rows = result.fetchall()
            for row in rows:
                offers.append(
                    Offer(
                        id=str(row.id),
                        title=str(row.title or "Saved offer"),
                        content=str(row.body or ""),
                        tone=str(row.tone or "manager"),
                        format=str(row.format or "text"),
                        url=(str(row.url) if row.url else None),
                        video_url=(str(row.video_url) if row.video_url else None),
                        custom_tone=(str(row.custom_tone) if row.custom_tone else None),
                        created_at=row.created_at.isoformat() if getattr(row, "created_at", None) else "",
                        user_mode=str(row.user_mode or "job-seeker"),
                    )
                )
        except Exception:
            # In-memory fallback
            for raw in (store.demo_offer_library_by_user.get(user_id) or []):
                if isinstance(raw, dict):
                    offers.append(Offer(**raw))

        return OffersListResponse(
            success=True,
            message="Offers retrieved successfully",
            offers=offers,
        )
    except HTTPException:
        raise
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
