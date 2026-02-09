from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import re
import uuid
import os
import shutil
from datetime import datetime, timezone

from ..auth import get_current_user_optional
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store


router = APIRouter()


_BIO_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "bio")
_BIO_UPLOAD_DIR = os.path.abspath(_BIO_UPLOAD_DIR)
os.makedirs(_BIO_UPLOAD_DIR, exist_ok=True)

# Allow “2 minutes or shorter” clips with realistic file sizes.
# (We enforce duration on the frontend; backend enforces a hard size cap.)
_MAX_VIDEO_BYTES = 80 * 1024 * 1024  # 80MB


def _safe_media_key(k: str) -> str:
    t = str(k or "").strip()
    if not t:
        return ""
    # only allow URL-safe keys we generate (uuid hex)
    if not re.fullmatch(r"[a-f0-9]{16,64}", t):
        return ""
    return t


def _safe_slug(s: str) -> str:
    t = (s or "").strip().lower()
    t = re.sub(r"[^a-z0-9]+", "-", t)
    t = re.sub(r"-{2,}", "-", t).strip("-")
    return t[:64] or "bio"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BioPageTheme(BaseModel):
    accent: str = Field(default="emerald")  # simple token; frontend maps to colors
    # The user only chooses background colors; the frontend computes readable text colors.
    bg_top: str = Field(default="#050505")
    bg_bottom: str = Field(default="#050505")
    bullet_style: str = Field(default="dot")
    slogan_line: str = Field(default="")


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

    # Intro/portfolio video: can be a URL or data URL (demo/localStorage).
    video_url: str = ""
    # A short script to help the user record a 1-minute intro video.
    # This is never required for the public page; it’s purely a creation aid.
    video_script: str = ""

    # proof + positioning
    proof_points: List[str] = Field(default_factory=list)
    fit_points: List[str] = Field(default_factory=list)
    # Work style section (user preferences distilled). Frontend may compute this deterministically
    # from `job_preferences` and attach it before publishing.
    work_style_points: List[str] = Field(default_factory=list)

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


class GenerateVideoScriptRequest(BaseModel):
    resume_extract: Optional[Dict[str, Any]] = None
    selected_job_description: Optional[Dict[str, Any]] = None
    painpoint_matches: Optional[List[Dict[str, Any]]] = None
    offer_draft: Optional[Dict[str, Any]] = None
    display_name: Optional[str] = None


class GenerateVideoScriptResponse(BaseModel):
    script: str


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
    tone_hint = ""
    if od:
        tone_hint = str(od.get("tone") or od.get("custom_tone") or "").strip()

    headline = f"{display_name} — job seeker bio page"
    if title:
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
        video_url="",
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
                # NOTE: Bio page is multi-use (sent to multiple people/companies). Do not mention a specific employer.
                selected_job = payload.selected_job_description or {}
                if isinstance(selected_job, dict) and selected_job:
                    selected_job = dict(selected_job)
                    for k in ["company", "company_name", "employer", "org", "organization"]:
                        if k in selected_job:
                            selected_job[k] = ""
                prompt = {
                    "display_name": deterministic.display_name,
                    "selected_job": selected_job,
                    "resume_extract": payload.resume_extract or {},
                    "painpoint_matches": (payload.painpoint_matches or [])[:3],
                    "offer_draft": payload.offer_draft or {},
                    "rules": {
                        "no_invented_numbers": True,
                        "no_external_claims": True,
                        "no_company_specificity": True,
                        "output_json_only": True,
                    },
                }
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You write job-seeker bio landing page copy.\n"
                            "Use ONLY the provided JSON input. Do not invent facts or numbers.\n"
                            "IMPORTANT: This bio page must be reusable across multiple companies.\n"
                            "- Do NOT mention any specific company name (including the selected job's company).\n"
                            "- Do NOT say 'applying to X' or 'candidate for X'.\n"
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


@router.post("/bio-pages/generate-video-script", response_model=GenerateVideoScriptResponse)
async def generate_video_script(payload: GenerateVideoScriptRequest, http_request: Request):
    """
    Generate a ~1 minute intro video script for the user.
    This is a creation aid for the private Bio Page editor (not the public page).
    """
    try:
        user = await get_current_user_optional(http_request)

        # Keep it role-agnostic (bio is reusable) but use role *type* for framing.
        jd = payload.selected_job_description or {}
        if isinstance(jd, dict) and jd:
            jd = dict(jd)
            for k in ["company", "company_name", "employer", "org", "organization"]:
                if k in jd:
                    jd[k] = ""

        display_name = (str(payload.display_name or "").strip() or (str(getattr(user, "first_name", "") or "").strip() if user else "") or "I")
        # Avoid "I" being used as the display name in the greeting.
        first = display_name.split()[0] if display_name and display_name != "I" else ""

        rx = payload.resume_extract or {}
        pms = payload.painpoint_matches or []
        od = payload.offer_draft or {}

        # Deterministic fallback script (if LLM is unavailable).
        headline = str(jd.get("title") or jd.get("role") or "").strip() or "roles"
        kms = rx.get("key_metrics") or rx.get("KeyMetrics") or []
        metric_line = ""
        if isinstance(kms, list) and kms:
            m0 = kms[0]
            if isinstance(m0, dict):
                metric = str(m0.get("metric") or "").strip()
                value = str(m0.get("value") or "").strip()
                metric_line = " — ".join([x for x in [metric, value] if x]).strip()
            else:
                metric_line = str(m0).strip()
        pm0 = pms[0] if (isinstance(pms, list) and pms and isinstance(pms[0], dict)) else {}
        pain = str(pm0.get("painpoint_1") or "").strip()
        sol = str(pm0.get("solution_1") or "").strip()
        cta = str(od.get("cta") or "If it sounds useful, I’d love to chat.").strip()

        fallback = "\n".join(
            [
                f"Hi{', ' + first if first else ''} — I’m {display_name}.",
                f"I build and lead work that drives outcomes, and I’m exploring {headline}.",
                (f"A recent win: {metric_line}." if metric_line else "A recent win: I’ve delivered measurable improvements across teams and systems."),
                (f"I’m especially strong at tackling problems like: {pain}." if pain else "I’m especially strong at tackling messy, high-impact problems and turning them into clear execution plans."),
                (f"My approach: {sol}." if sol else "My approach: clarify the goal, map constraints, ship an MVP fast, then iterate with feedback."),
                cta,
            ]
        ).strip()

        client = get_openai_client()
        if not client.should_use_real_llm:
            return GenerateVideoScriptResponse(script=fallback[:1200])

        prompt = {
            "display_name": display_name,
            "selected_job": jd,
            "resume_extract": rx,
            "painpoint_matches": (pms or [])[:2],
            "offer_draft": od,
            "constraints": {
                "seconds": 60,
                "no_company_specificity": True,
                "no_external_claims": True,
                "friendly_confident": True,
                "structure": ["hook", "who_i_am", "proof", "what_i_like_solving", "cta"],
            },
        }

        messages = [
            {
                "role": "system",
                "content": (
                    "You write a short first-person script for a job-seeker’s 1-minute intro video.\n"
                    "IMPORTANT:\n"
                    "- This bio page is reusable across multiple companies: DO NOT mention any specific employer.\n"
                    "- Use ONLY the provided JSON; do not invent facts or numbers.\n"
                    "- Keep it ~60 seconds when read aloud (roughly 110–160 words).\n"
                    "- Keep sentences short and natural.\n"
                    "Return ONLY JSON: { script: string }"
                ),
            },
            {"role": "user", "content": str(prompt)},
        ]
        raw = client.run_chat_completion(
            messages,
            temperature=0.25,
            max_tokens=420,
            stub_json={"script": fallback},
        )
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        parsed = extract_json_from_text(content_str) or {}
        script = str(parsed.get("script") or fallback).strip()
        script = re.sub(r"\n{3,}", "\n\n", script).strip()
        return GenerateVideoScriptResponse(script=script[:1600])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate video script: {str(e)}")


class UploadBioVideoResponse(BaseModel):
    success: bool = True
    url: str


@router.post("/bio-pages/upload-video", response_model=UploadBioVideoResponse)
async def upload_bio_video(http_request: Request, file: UploadFile = File(...)):
    """
    Upload an intro video and return a URL that can be used in `draft.video_url`.
    The frontend enforces a <=2 minute duration; we enforce size + mime type here.
    """
    try:
        # Bio pages are demo-friendly and can run without auth; still attribute if present.
        user = await get_current_user_optional(http_request)
        user_id = user.id if user else "anon"

        ct = str(file.content_type or "").lower().strip()
        if not ct.startswith("video/"):
            raise HTTPException(status_code=422, detail="Please upload a video file.")

        # Pick an extension for serving; prefer known formats.
        ext = ""
        name = str(file.filename or "")
        if "." in name:
            ext = "." + name.split(".")[-1].lower().strip()
        if ext not in [".mp4", ".mov", ".webm", ".m4v", ".ogg"]:
            ext = ".mp4" if ct in ["video/mp4", "video/m4v"] else (".webm" if ct == "video/webm" else ".mp4")

        key = uuid.uuid4().hex  # 32 chars
        out_path = os.path.join(_BIO_UPLOAD_DIR, f"{key}{ext}")

        # Stream copy with a hard cap.
        written = 0
        try:
            with open(out_path, "wb") as f:
                while True:
                    chunk = await file.read(1024 * 1024)  # 1MB
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > _MAX_VIDEO_BYTES:
                        raise HTTPException(status_code=413, detail="Video too large. Please upload a shorter/smaller clip (<= 2 minutes).")
                    f.write(chunk)
        finally:
            try:
                await file.close()
            except Exception:
                pass

        # Store a tiny index for later lookup (optional, but helps future cleanup).
        if not hasattr(store, "bio_video_index"):
            store.bio_video_index = {}  # type: ignore[attr-defined]
        try:
            store.bio_video_index[key] = {  # type: ignore[attr-defined]
                "path": out_path,
                "content_type": ct,
                "user_id": user_id,
                "uploaded_at": _now_iso(),
            }
        except Exception:
            pass

        # IMPORTANT: use /api-prefixed URL so it works on the public bio page.
        return UploadBioVideoResponse(success=True, url=f"/api/bio-pages/media/{key}")
    except HTTPException:
        # cleanup partial file if present
        try:
            if "out_path" in locals() and isinstance(out_path, str) and os.path.exists(out_path):
                os.remove(out_path)
        except Exception:
            pass
        raise
    except Exception as e:
        try:
            if "out_path" in locals() and isinstance(out_path, str) and os.path.exists(out_path):
                os.remove(out_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")


@router.get("/bio-pages/media/{key}")
async def get_bio_video(key: str):
    safe = _safe_media_key(key)
    if not safe:
        raise HTTPException(status_code=404, detail="Not found")

    # Prefer index lookup; fallback to scanning known extensions.
    path = ""
    ct = "video/mp4"
    try:
        rec = (getattr(store, "bio_video_index", {}) or {}).get(safe)  # type: ignore[attr-defined]
        if isinstance(rec, dict):
            path = str(rec.get("path") or "")
            ct = str(rec.get("content_type") or ct)
    except Exception:
        path = ""

    if not path:
        for ext in [".mp4", ".mov", ".webm", ".m4v", ".ogg"]:
            candidate = os.path.join(_BIO_UPLOAD_DIR, f"{safe}{ext}")
            if os.path.exists(candidate):
                path = candidate
                break

    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(path, media_type=ct, filename=os.path.basename(path))

