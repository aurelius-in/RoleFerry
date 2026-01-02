from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Literal
import logging

from ..clients.openai_client import get_openai_client, extract_json_from_text


logger = logging.getLogger(__name__)
router = APIRouter()


class GapAnalysisPreferences(BaseModel):
    values: List[str] = Field(default_factory=list)
    role_categories: List[str] = Field(default_factory=list)
    location_preferences: List[str] = Field(default_factory=list)
    work_type: List[str] = Field(default_factory=list)
    role_type: List[str] = Field(default_factory=list)
    company_size: List[str] = Field(default_factory=list)
    industries: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    minimum_salary: str = ""
    job_search_status: str = ""
    state: Optional[str] = None
    user_mode: str = "job-seeker"


class ResumeExtract(BaseModel):
    positions: Optional[List[Dict[str, Any]]] = None
    keyMetrics: Optional[List[Dict[str, Any]]] = None
    skills: Optional[List[str]] = None
    accomplishments: Optional[List[str]] = None


class GapJobDescription(BaseModel):
    id: str
    title: str
    company: str
    url: Optional[str] = None
    content: Optional[str] = None
    painPoints: Optional[List[str]] = None
    requiredSkills: Optional[List[str]] = None
    successMetrics: Optional[List[str]] = None


class GapAnalysisRequest(BaseModel):
    preferences: Dict[str, Any]
    resume_extract: Dict[str, Any]
    job_descriptions: List[Dict[str, Any]]


class GapAnalysisItem(BaseModel):
    job_id: str
    title: str
    company: str
    score: int
    recommendation: Literal["pursue", "maybe", "skip"]
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    preference_gaps: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class GapAnalysisResponse(BaseModel):
    success: bool
    message: str
    ranked: List[GapAnalysisItem] = Field(default_factory=list)
    helper: Optional[Dict[str, Any]] = None


def _norm_list(xs: Any) -> List[str]:
    out: List[str] = []
    if not xs:
        return out
    if isinstance(xs, list):
        for x in xs:
            s = str(x or "").strip()
            if s:
                out.append(s)
    return out


def _tokenize(s: str) -> List[str]:
    return [t for t in (s or "").lower().replace("/", " ").replace("-", " ").split() if t]


def _company_size_bucket(company_sizes: List[str]) -> str:
    """
    Map selected company size strings into a coarse bucket: small/mid/large/any.
    """
    if not company_sizes:
        return "any"
    s = " ".join([str(x).lower() for x in company_sizes if str(x).strip()])
    if any(tok in s for tok in ["1-10", "11-50", "51-200"]):
        return "small"
    if any(tok in s for tok in ["201-500", "501-1,000", "501-1000"]):
        return "mid"
    if any(tok in s for tok in ["1,001-5,000", "1001-5000", "5,001-10,000", "5001-10000", "10,001+", "10001+"]):
        return "large"
    return "any"


def _infer_company_size_bucket(company: str, content: str | None) -> str:
    """
    Best-effort company size inference:
    - Known big-tech list
    - Very light text sniffing for "employees"
    """
    c = (company or "").strip().lower()
    big = {
        "google",
        "alphabet",
        "microsoft",
        "amazon",
        "meta",
        "facebook",
        "apple",
        "netflix",
        "salesforce",
        "oracle",
        "ibm",
        "intel",
    }
    if c in big:
        return "large"

    txt = (content or "")
    # Simple patterns like "10,001+ employees" / "1,001-5,000 employees"
    import re
    m = re.search(r"(\d{1,3}(?:,\d{3})\+?)\s+employees", txt, flags=re.I)
    if m:
        raw = str(m.group(1)).replace(",", "")
        try:
            if raw.endswith("+"):
                n = int(raw[:-1])
            else:
                n = int(raw)
            if n >= 1001:
                return "large"
            if n >= 201:
                return "mid"
            return "small"
        except Exception:
            pass
    return "any"


def _infer_work_mode(content: str | None) -> str:
    """
    remote | hybrid | onsite | unknown
    """
    t = (content or "").lower()
    if not t.strip():
        return "unknown"
    if any(k in t for k in ["remote", "work from home", "wfh"]):
        return "remote"
    if "hybrid" in t:
        return "hybrid"
    if any(k in t for k in ["on-site", "onsite", "in-person", "in person"]):
        return "onsite"
    return "unknown"


def _infer_employment_type(content: str | None) -> str:
    """
    full-time | part-time | contract | internship | unknown
    """
    t = (content or "").lower()
    if not t.strip():
        return "unknown"
    if "intern" in t:
        return "internship"
    if any(k in t for k in ["contract", "contractor", "1099"]):
        return "contract"
    if "part-time" in t or "part time" in t:
        return "part-time"
    if "full-time" in t or "full time" in t:
        return "full-time"
    return "unknown"


def _deterministic_rank(preferences: GapAnalysisPreferences, resume: ResumeExtract, jobs: List[GapJobDescription]) -> List[GapAnalysisItem]:
    pref_skills = {s.lower() for s in _norm_list(preferences.skills)}
    resume_skills = {s.lower() for s in _norm_list(resume.skills)}
    role_cats = {s.lower() for s in _norm_list(preferences.role_categories)}

    ranked: List[GapAnalysisItem] = []
    for j in jobs:
        req = _norm_list(j.requiredSkills)
        req_set = {s.lower() for s in req}
        matched = sorted({s for s in req if s.lower() in resume_skills or s.lower() in pref_skills})
        missing = sorted({s for s in req if s.lower() not in resume_skills})

        # Heuristic score:
        # - reward overlap with required skills
        # - small boost if title loosely matches role categories
        overlap = len(matched)
        miss = len(missing)
        score = 50
        if req:
            score += int(40 * (overlap / max(len(req), 1)))
            score -= int(15 * (miss / max(len(req), 1)))

        title_tokens = set(_tokenize(j.title))
        if role_cats:
            # very rough: if any category token appears in title, add a bit
            cat_hit = any(tok in title_tokens for cat in role_cats for tok in _tokenize(cat))
            if cat_hit:
                score += 6

        score = max(0, min(100, score))

        recommendation: Literal["pursue", "maybe", "skip"] = "maybe"
        if score >= 75:
            recommendation = "pursue"
        elif score <= 45:
            recommendation = "skip"

        pref_gaps: List[str] = []

        # --- Preference alignment gaps (non-skill) -----------------------------
        # Company size mismatch (only when user explicitly chose a bucket)
        desired_bucket = _company_size_bucket(preferences.company_size or [])
        if desired_bucket != "any":
            inferred_bucket = _infer_company_size_bucket(j.company, j.content)
            if inferred_bucket != "any" and inferred_bucket != desired_bucket:
                pref_gaps.append(
                    f"Company size preference mismatch: you selected {desired_bucket} companies, but {j.company} appears {inferred_bucket}."
                )

        # Work mode mismatch (remote/hybrid/onsite)
        pref_work = " ".join([x.lower() for x in (preferences.work_type or preferences.location_preferences or [])])
        job_work = _infer_work_mode(j.content)
        if "remote" in pref_work and "in-person" not in pref_work and "hybrid" not in pref_work:
            # remote-only
            if job_work in {"onsite", "hybrid"}:
                pref_gaps.append(f"Work preference mismatch: you selected Remote, but this job looks {job_work} (based on the job text).")
        if ("in-person" in pref_work or "in person" in pref_work) and "remote" not in pref_work:
            if job_work == "remote":
                pref_gaps.append("Work preference mismatch: you selected In-Person, but this job looks remote (based on the job text).")

        # Employment type mismatch (full-time/part-time/contract/internship)
        pref_types = {x.lower() for x in _norm_list(preferences.role_type)}
        job_type = _infer_employment_type(j.content)
        if pref_types:
            # Normalize to our labels
            wanted = set()
            for t in pref_types:
                if "full" in t:
                    wanted.add("full-time")
                elif "part" in t:
                    wanted.add("part-time")
                elif "contract" in t:
                    wanted.add("contract")
                elif "intern" in t:
                    wanted.add("internship")
            if wanted and job_type != "unknown" and job_type not in wanted:
                pref_gaps.append(f"Role type preference mismatch: you selected {', '.join(sorted(wanted))}, but this job looks {job_type}.")

        if preferences.minimum_salary:
            pref_gaps.append("Salary preference not checked yet (no salary data parsed from this JD).")

        ranked.append(
            GapAnalysisItem(
                job_id=j.id,
                title=j.title,
                company=j.company,
                score=score,
                recommendation=recommendation,
                matched_skills=matched[:20],
                missing_skills=missing[:20],
                preference_gaps=pref_gaps[:6],
                notes=["Deterministic scoring (no LLM)."],
            )
        )

    ranked.sort(key=lambda x: x.score, reverse=True)
    return ranked


@router.post("/analyze", response_model=GapAnalysisResponse)
async def analyze_gap(req: GapAnalysisRequest) -> GapAnalysisResponse:
    """
    Rank imported job descriptions and highlight gaps:
    - preferences ↔ jobs
    - resume ↔ jobs
    Uses OpenAI when configured; falls back to deterministic heuristics.
    """
    try:
        prefs = GapAnalysisPreferences(**(req.preferences or {}))
        resume = ResumeExtract(**(req.resume_extract or {}))
        jobs = [GapJobDescription(**j) for j in (req.job_descriptions or [])]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    if not jobs:
        return GapAnalysisResponse(success=True, message="No jobs to analyze", ranked=[], helper={"used_llm": False})

    client = get_openai_client()
    if not client.should_use_real_llm:
        ranked = _deterministic_rank(prefs, resume, jobs)
        return GapAnalysisResponse(
            success=True,
            message="Gap analysis complete (no LLM)",
            ranked=ranked,
            helper={
                "used_llm": False,
                "model": client.model,
                "notes": ["OpenAI not configured or LLM_MODE!=openai; used deterministic heuristics."],
            },
        )

    # LLM path
    try:
        stub_ranked = [r.model_dump() for r in _deterministic_rank(prefs, resume, jobs)[: min(8, len(jobs))]]
        stub_json = {
            "ranked": stub_ranked,
            "notes": ["Stub fallback (should not be used when GPT is ON)."],
        }

        messages = [
            {
                "role": "system",
                "content": (
                    "You are RoleFerry's job-fit analyst. You will rank imported job descriptions for a candidate.\n\n"
                    "Rules:\n"
                    "- Do NOT fabricate candidate experience.\n"
                    "- Use the provided resume_extract + preferences.\n"
                    "- Output ONLY JSON.\n\n"
                    "Return a JSON object with:\n"
                    "- ranked: array of items { job_id, title, company, score (0-100), recommendation (pursue|maybe|skip), "
                    "matched_skills[], missing_skills[], preference_gaps[], notes[] }\n"
                    "- notes: short array of strings\n"
                ),
            },
            {
                "role": "user",
                "content": (
                    "Analyze and rank these jobs.\n\n"
                    f"preferences:\n{prefs.model_dump()}\n\n"
                    f"resume_extract:\n{resume.model_dump()}\n\n"
                    f"job_descriptions:\n{[j.model_dump() for j in jobs]}\n"
                ),
            },
        ]

        resp = client.run_chat_completion(messages, temperature=0.2, max_tokens=900, stub_json=stub_json)
        content = (((resp or {}).get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        data = extract_json_from_text(str(content)) or {}
        items = data.get("ranked") or []
        ranked: List[GapAnalysisItem] = []
        for it in items:
            try:
                ranked.append(GapAnalysisItem(**it))
            except Exception:
                continue

        # If model output is empty/invalid, fall back.
        if not ranked:
            ranked = _deterministic_rank(prefs, resume, jobs)
            notes = ["GPT output could not be parsed; used deterministic scoring."]
        else:
            notes = _norm_list(data.get("notes"))[:6] or ["GPT-ranked analysis."]

        # Ensure every imported job appears at least once (append missing with heuristic scores)
        seen = {r.job_id for r in ranked}
        if len(seen) < len(jobs):
            fill = _deterministic_rank(prefs, resume, [j for j in jobs if j.id not in seen])
            ranked.extend(fill)
            ranked.sort(key=lambda x: x.score, reverse=True)

        return GapAnalysisResponse(
            success=True,
            message="Gap analysis complete",
            ranked=ranked,
            helper={"used_llm": True, "model": client.model, "notes": notes},
        )
    except Exception as e:
        logger.exception("Gap analysis failed")
        ranked = _deterministic_rank(prefs, resume, jobs)
        return GapAnalysisResponse(
            success=True,
            message="Gap analysis complete (LLM error; used deterministic scoring)",
            ranked=ranked,
            helper={"used_llm": False, "model": client.model, "notes": [f"LLM error: {str(e)[:160]}"]},
        )


