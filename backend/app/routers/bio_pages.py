from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import re
import uuid
from datetime import datetime, timezone

from ..auth import get_current_user_optional
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store


router = APIRouter()


def _safe_slug(s: str) -> str:
    t = (s or "").strip().lower()
    t = re.sub(r"[^a-z0-9]+", "-", t)
    t = re.sub(r"-{2,}", "-", t).strip("-")
    return t[:64] or "bio"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BioPageTheme(BaseModel):
    accent: str = Field(default="emerald")  # simple token; frontend maps to colors


class BioPageDraft(BaseModel):
    # identity
    display_name: str = ""
    headline: str = ""
    subheadline: str = ""

    # image
    # May be a public URL or a data URL (demo/localStorage). Stored with the draft at publish time.
    profile_image_url: str = ""

    # CTAs
    calendly_url: str = ""
    linkedin_url: str = ""

    # proof + positioning
    proof_points: List[str] = Field(default_factory=list)
    fit_points: List[str] = Field(default_factory=list)

    # deterministic resume section (rendered client-side from resume_extract)
    # we keep the extract here for convenience, but do not invent anything.
    resume_extract: Dict[str, Any] = Field(default_factory=dict)

    # optional links
    portfolio_url: str = ""

    theme: BioPageTheme = Field(default_factory=BioPageTheme)


class GenerateBioPageRequest(BaseModel):
    # Inputs from previous steps (frontend will pass these from localStorage)
    resume_extract: Optional[Dict[str, Any]] = None
    selected_job_description: Optional[Dict[str, Any]] = None
    painpoint_matches: Optional[List[Dict[str, Any]]] = None
    offer_draft: Optional[Dict[str, Any]] = None
    profile_image_url: Optional[str] = None
    theme: Optional[BioPageTheme] = None


class GenerateBioPageResponse(BaseModel):
    draft: BioPageDraft


class PublishBioPageRequest(BaseModel):
    draft: BioPageDraft
    # allow deterministic stable slug override later if needed
    slug_hint: Optional[str] = None


class PublishBioPageResponse(BaseModel):
    slug: str
    public_url: str


class GetBioPageResponse(BaseModel):
    slug: str
    published_at: str
    draft: BioPageDraft


def _build_deterministic_draft(
    resume_extract: Dict[str, Any] | None,
    selected_job_description: Dict[str, Any] | None,
    painpoint_matches: List[Dict[str, Any]] | None,
    offer_draft: Dict[str, Any] | None,
    theme: BioPageTheme | None,
    display_name: str,
    linkedin_url: str,
    profile_image_url: str = "",
) -> BioPageDraft:
    rx = resume_extract or {}
    jd = selected_job_description or {}
    pms = painpoint_matches or []
    od = offer_draft or {}

    title = str(jd.get("title") or jd.get("role") or "").strip()
    company = str(jd.get("company") or "").strip()
    tone_hint = ""
    if od:
        tone_hint = str(od.get("tone") or od.get("custom_tone") or "").strip()

    headline = f"{display_name} — job seeker bio page"
    if title and company:
        headline = f"{display_name} — {title} candidate for {company}"
    elif title:
        headline = f"{display_name} — {title} candidate"

    subheadline = "A concise overview of experience, proof points, and fit."
    if tone_hint:
        subheadline = f"A concise overview of experience, proof points, and fit. (Tone: {tone_hint})"

    proof: List[str] = []
    kms = rx.get("key_metrics") or rx.get("KeyMetrics") or []
    if isinstance(kms, list):
        for m in kms[:6]:
            if isinstance(m, dict):
                metric = str(m.get("metric") or "").strip()
                value = str(m.get("value") or "").strip()
                ctx = str(m.get("context") or "").strip()
                line = " — ".join([p for p in [metric, value] if p])
                if ctx:
                    line = f"{line} ({ctx})" if line else ctx
                if line:
                    proof.append(line[:180])
            else:
                s = str(m).strip()
                if s:
                    proof.append(s[:180])

    # Fit points: borrow from painpoint match overlap snippets if present
    fit: List[str] = []
    if pms and isinstance(pms, list):
        pm0 = pms[0] if isinstance(pms[0], dict) else None
        if pm0:
            for k in ["overlap_1", "overlap_2", "overlap_3"]:
                v = str(pm0.get(k) or "").strip()
                if v:
                    fit.append(v[:160])

    theme_val = theme or BioPageTheme()

    return BioPageDraft(
        display_name=display_name,
        headline=headline,
        subheadline=subheadline,
        profile_image_url=profile_image_url or "",
        calendly_url="",  # filled by profile vars later (or user)
        linkedin_url=linkedin_url or "",
        proof_points=proof[:6],
        fit_points=fit[:6],
        resume_extract=rx,
        portfolio_url=str(od.get("portfolio_url") or od.get("Portfolio_URL") or "").strip(),
        theme=theme_val,
    )


@router.post("/bio-pages/generate", response_model=GenerateBioPageResponse)
async def generate_bio_page(payload: GenerateBioPageRequest, http_request: Request):
    try:
        # Bio pages should work in demo mode without auth. If logged in, we’ll personalize from the user record.
        user = await get_current_user_optional(http_request)
        user_id = user.id if user else "anon"

        display_name = "User"
        linkedin_url = ""
        if user:
            display_name = (
                str(getattr(user, "first_name", "") or "").strip()
                or str(getattr(user, "email", "User") or "User")
            )
            linkedin_url = str(getattr(user, "linkedin_url", "") or "").strip()

        deterministic = _build_deterministic_draft(
            resume_extract=payload.resume_extract,
            selected_job_description=payload.selected_job_description,
            painpoint_matches=payload.painpoint_matches,
            offer_draft=payload.offer_draft,
            theme=payload.theme,
            display_name=display_name,
            linkedin_url=linkedin_url,
            profile_image_url=str(payload.profile_image_url or "").strip(),
        )

        client = get_openai_client()
        if client.should_use_real_llm:
            try:
                # Keep the model scoped: generate only hero + bullets, grounded in provided data.
                prompt = {
                    "display_name": deterministic.display_name,
                    "selected_job": payload.selected_job_description or {},
                    "resume_extract": payload.resume_extract or {},
                    "painpoint_matches": (payload.painpoint_matches or [])[:3],
                    "offer_draft": payload.offer_draft or {},
                    "rules": {
                        "no_invented_numbers": True,
                        "no_external_claims": True,
                        "output_json_only": True,
                    },
                }
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You write job-seeker bio landing page copy.\n"
                            "Use ONLY the provided JSON input. Do not invent facts or numbers.\n"
                            "Return ONLY valid JSON with keys:\n"
                            "- headline: string\n"
                            "- subheadline: string\n"
                            "- proof_points: array of 3-6 strings (short, punchy)\n"
                            "- fit_points: array of 3-6 strings (tie to role responsibilities/pain points)\n"
                        ),
                    },
                    {"role": "user", "content": str(prompt)},
                ]
                raw = client.run_chat_completion(
                    messages,
                    temperature=0.2,
                    max_tokens=700,
                    stub_json={
                        "headline": deterministic.headline,
                        "subheadline": deterministic.subheadline,
                        "proof_points": deterministic.proof_points[:6],
                        "fit_points": deterministic.fit_points[:6],
                    },
                )
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")
                parsed = extract_json_from_text(content_str) or {}

                deterministic.headline = str(parsed.get("headline") or deterministic.headline)[:140]
                deterministic.subheadline = str(parsed.get("subheadline") or deterministic.subheadline)[:220]
                pp = parsed.get("proof_points")
                fp = parsed.get("fit_points")
                if isinstance(pp, list) and pp:
                    deterministic.proof_points = [str(x).strip()[:180] for x in pp if str(x).strip()][:8]
                if isinstance(fp, list) and fp:
                    deterministic.fit_points = [str(x).strip()[:160] for x in fp if str(x).strip()][:8]
            except Exception:
                # fall back to deterministic draft
                pass

        # Persist latest draft for this user (demo store)
        if not hasattr(store, "demo_bio_pages_by_user"):
            store.demo_bio_pages_by_user = {}  # type: ignore[attr-defined]
        store.demo_bio_pages_by_user[user_id] = deterministic.model_dump()

        return GenerateBioPageResponse(draft=deterministic)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate bio page: {str(e)}")


@router.post("/bio-pages/publish", response_model=PublishBioPageResponse)
async def publish_bio_page(payload: PublishBioPageRequest, http_request: Request):
    try:
        user = await get_current_user_optional(http_request)
        user_id = user.id if user else "anon"

        # Ensure storage exists
        if not hasattr(store, "bio_pages_by_slug"):
            store.bio_pages_by_slug = {}  # type: ignore[attr-defined]

        slug_base = _safe_slug(
            payload.slug_hint
            or payload.draft.display_name
            or (str(getattr(user, "email", "")) if user else "")
            or "bio"
        )
        slug = slug_base
        # Uniqueness
        while slug in store.bio_pages_by_slug:  # type: ignore[attr-defined]
            slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"

        record = {
            "slug": slug,
            "user_id": user_id,
            "published_at": _now_iso(),
            "draft": payload.draft.model_dump(),
        }
        store.bio_pages_by_slug[slug] = record  # type: ignore[attr-defined]

        return PublishBioPageResponse(slug=slug, public_url=f"/bio/{slug}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to publish bio page: {str(e)}")


@router.get("/bio-pages/{slug}", response_model=GetBioPageResponse)
async def get_bio_page(slug: str):
    try:
        if not hasattr(store, "bio_pages_by_slug"):
            raise HTTPException(status_code=404, detail="Bio page not found")
        rec = (store.bio_pages_by_slug or {}).get(slug)  # type: ignore[attr-defined]
        if not rec:
            raise HTTPException(status_code=404, detail="Bio page not found")
        return GetBioPageResponse(
            slug=str(rec.get("slug") or slug),
            published_at=str(rec.get("published_at") or ""),
            draft=BioPageDraft(**(rec.get("draft") or {})),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load bio page: {str(e)}")

