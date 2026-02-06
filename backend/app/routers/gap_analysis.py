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
    # Optional enrichments (if provided by frontend/job parser)
    location: Optional[str] = None
    workMode: Optional[str] = None
    employmentType: Optional[str] = None
    salaryRange: Optional[str] = None
    industries: Optional[List[str]] = None


class GapAnalysisRequest(BaseModel):
    preferences: Dict[str, Any]
    resume_extract: Dict[str, Any]
    personality_profile: Optional[Dict[str, Any]] = None
    temperament_profile: Optional[Dict[str, Any]] = None
    job_descriptions: List[Dict[str, Any]]

class GapSeverity(str):
    pass


class GapDetail(BaseModel):
    gap: str
    severity: Literal["low", "medium", "high"] = "medium"
    evidence: List[str] = Field(default_factory=list)
    how_to_close: str = ""


class GapAnalysisItem(BaseModel):
    job_id: str
    title: str
    company: str
    score: int
    recommendation: Literal["pursue", "maybe", "skip"]
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    resume_gaps: List[GapDetail] = Field(default_factory=list)
    personality_gaps: List[GapDetail] = Field(default_factory=list)
    preference_gaps: List[GapDetail] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class GapAnalysisResponse(BaseModel):
    success: bool
    message: str
    ranked: List[GapAnalysisItem] = Field(default_factory=list)
    overall: Optional[Dict[str, Any]] = None
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


def _norm_skill(s: str) -> str:
    t = str(s or "").strip().lower()
    if not t:
        return ""
    # normalize common punctuation
    t = t.replace("–", "-").replace("—", "-").replace("/", " ")
    t = " ".join(t.split())
    # normalize common AI terms
    repl = {
        "ai/ml": "ai ml",
        "ai ml": "ai ml",
        "machine-learning": "machine learning",
        "gen ai": "generative ai",
        "genai": "generative ai",
        "llms": "llm",
        "ai agents": "agentic ai",
        "rag": "retrieval augmented generation",
    }
    return repl.get(t, t)


def _resume_evidence_text(resume: ResumeExtract) -> str:
    """
    Build a rich text corpus from the resume extract so we can match skills even when
    they appear in role descriptions instead of the top-level skills list.
    """
    parts: List[str] = []
    parts.extend(_norm_list(resume.skills))
    parts.extend(_norm_list(resume.accomplishments))

    pos = resume.positions or []
    if isinstance(pos, list):
        for p in pos[:30]:
            if isinstance(p, dict):
                parts.append(str(p.get("title") or ""))
                parts.append(str(p.get("company") or ""))
                parts.append(str(p.get("description") or ""))
            else:
                parts.append(str(p))

    kms = resume.keyMetrics or []
    if isinstance(kms, list):
        for m in kms[:30]:
            if isinstance(m, dict):
                parts.append(str(m.get("metric") or ""))
                parts.append(str(m.get("value") or ""))
                parts.append(str(m.get("context") or ""))
            else:
                parts.append(str(m))

    return " \n ".join([p.strip() for p in parts if str(p or "").strip()])


def _skill_supported_by_resume(skill: str, resume_text: str) -> bool:
    """
    Smarter-than-exact matching for required skills:
    - AI/ML/GenAI/Agentic are treated as a family
    - cloud platforms match on common tokens
    - otherwise substring/token check
    """
    s = _norm_skill(skill)
    hay = (resume_text or "").lower()
    if not s or not hay:
        return False

    # AI family matching
    if any(k in s for k in ["ai", "ml", "machine learning", "generative", "llm", "agentic"]):
        needles = [
            "ai",
            "ml",
            "machine learning",
            "deep learning",
            "artificial intelligence",
            "neural",
            "nlp",
            "computer vision",
            "llm",
            "gpt",
            "openai",
            "generative ai",
            "genai",
            "agentic",
            "ai agent",
            "ai agents",
            "rag",
            "retrieval augmented generation",
            "retrieval-augmented generation",
            "vector database",
            "embeddings",
            "embedding",
        ]
        return any(n in hay for n in needles)

    # Cloud family matching
    if any(k in s for k in ["gcp", "google cloud", "azure", "aws"]):
        if "gcp" in s or "google cloud" in s:
            return ("gcp" in hay) or ("google cloud" in hay)
        if "azure" in s:
            return "azure" in hay
        if "aws" in s:
            return "aws" in hay

    # Agile / SDLC family
    if "agile" in s:
        return any(n in hay for n in ["agile", "scrum", "kanban"])
    if "testing" in s:
        return any(n in hay for n in ["testing", "test", "unit test", "integration"])

    # Default: substring match on normalized text
    return s in hay


def _job_work_mode(job: GapJobDescription) -> str:
    # prefer explicit field if present
    for v in [job.workMode, _infer_work_mode(job.content)]:
        t = str(v or "").lower().strip()
        if t in {"remote", "hybrid", "onsite", "unknown"}:
            return t
    return "unknown"


def _job_employment_type(job: GapJobDescription) -> str:
    t = str(job.employmentType or "").lower().strip()
    if t in {"full-time", "part-time", "contract", "internship"}:
        return t
    return _infer_employment_type(job.content)


def _parse_salary_floor(s: str) -> Optional[int]:
    """
    Parse a rough minimum annual salary if possible.
    Returns USD/year integer or None if unknown/ambiguous (e.g. hourly).
    """
    txt = str(s or "")
    low = txt.lower()
    if not txt.strip():
        return None
    # hourly -> skip (preference comparisons can get tricky)
    if any(k in low for k in ["/hour", "/hr", "per hour", "an hour", "hourly"]):
        return None
    import re
    m = re.search(r"\$\s*([\d,]{2,7})", txt)
    if not m:
        m = re.search(r"\b([\d]{2,3})\s*k\b", low)
        if m:
            try:
                return int(m.group(1)) * 1000
            except Exception:
                return None
        return None
    try:
        return int(m.group(1).replace(",", ""))
    except Exception:
        return None


def _deterministic_personality_gaps(
    personality_profile: Dict[str, Any] | None,
    temperament_profile: Dict[str, Any] | None,
    job: GapJobDescription,
) -> List[GapDetail]:
    """
    Best-effort personality/work-style gaps without an LLM.
    Uses temperament_profile when available; otherwise light hints from personality_profile.
    """
    out: List[GapDetail] = []
    txt = " \n ".join(
        [
            str(job.title or ""),
            str(job.company or ""),
            str(job.content or ""),
            " ".join(_norm_list(job.painPoints)),
            " ".join(_norm_list(job.requiredSkills)),
            " ".join(_norm_list(job.successMetrics)),
        ]
    ).lower()

    # Signals from job
    needs_alignment = any(k in txt for k in ["stakeholder", "cross-functional", "cross functional", "matrix", "collaborate", "partner with"])
    needs_autonomy = any(k in txt for k in ["autonomy", "independent", "self-directed", "self directed", "ambiguous", "0 to 1", "0→1", "build from scratch"])
    high_process = any(k in txt for k in ["compliance", "hipaa", "regulatory", "audit", "policy", "process", "governance"])
    fast_paced = any(k in txt for k in ["fast-paced", "fast paced", "move fast", "tight deadlines", "rapidly"])
    needs_strategy = any(k in txt for k in ["strategy", "strategic", "roadmap", "vision", "principles", "concepts", "north star"])
    needs_detail = any(k in txt for k in ["requirements", "details", "detail-oriented", "documentation", "docs", "spec", "specification"])
    needs_people = any(k in txt for k in ["coach", "ment", "culture", "values", "relationships", "people-first", "people first", "feedback", "collaboration"])

    def _signal_list() -> List[str]:
        """
        Human-readable job work-style signals we detected from text.
        This is used for evidence and to tailor screening questions when we don't find a direct mismatch.
        """
        sig: List[str] = []
        if needs_alignment:
            sig.append("stakeholder/cross-functional alignment")
        if needs_autonomy:
            sig.append("high autonomy / ambiguity (0→1 / self-directed)")
        if high_process:
            sig.append("process/regulatory/compliance emphasis")
        if fast_paced:
            sig.append("fast-paced execution / tight deadlines")
        if needs_strategy:
            sig.append("strategy/vision framing")
        if needs_detail:
            sig.append("detail/specs/documentation heavy")
        if needs_people:
            sig.append("people/culture/relationships emphasis")
        return sig

    t = temperament_profile or {}
    t_scores = (t.get("scores") if isinstance(t, dict) else {}) or {}
    action = None
    communication = None
    try:
        action = int(t_scores.get("action")) if "action" in t_scores else None
    except Exception:
        action = None
    try:
        communication = int(t_scores.get("communication")) if "communication" in t_scores else None
    except Exception:
        communication = None

    # action < 0 ≈ autonomy/utilitarian; action >= 0 ≈ cooperative/alignment
    if action is not None:
        if action < 0 and needs_alignment:
            out.append(
                GapDetail(
                    gap="Role emphasizes cross-team alignment; your work-style leans toward autonomy.",
                    severity="medium",
                    evidence=["Temperament: autonomy-leaning (action axis)", "Job text mentions collaboration/stakeholders"],
                    how_to_close="In outreach/interviews, emphasize times you aligned stakeholders and mentored others without losing execution speed.",
                )
            )
        if action >= 0 and needs_autonomy:
            out.append(
                GapDetail(
                    gap="Role may require high autonomy/ambiguity tolerance; you lean toward alignment-driven environments.",
                    severity="low",
                    evidence=["Temperament: alignment-leaning (action axis)", "Job text suggests autonomy/ambiguity"],
                    how_to_close="Highlight independent decision-making examples and how you set direction when requirements are unclear.",
                )
            )

    # Temperament communication axis: concrete (-) vs abstract (+)
    if communication is not None:
        if communication < 0 and needs_strategy:
            out.append(
                GapDetail(
                    gap="Role leans strategic/abstract; you may prefer concrete examples and specifics first.",
                    severity="low",
                    evidence=["Temperament: concrete-leaning (communication axis)", "Job text suggests strategy/vision"],
                    how_to_close="In interviews, start with one concrete example, then zoom out to the principle/strategy you used.",
                )
            )
        if communication >= 0 and needs_detail:
            out.append(
                GapDetail(
                    gap="Role looks detail/spec heavy; you may prefer principles over granular execution details.",
                    severity="low",
                    evidence=["Temperament: abstract-leaning (communication axis)", "Job text suggests specs/documentation"],
                    how_to_close="Prepare a 1-page example of how you translate a high-level goal into requirements, tickets, and acceptance criteria.",
                )
            )

    # Work-style sensitivity: use personality_profile 'scores' if present
    p = personality_profile or {}
    p_scores = (p.get("scores") if isinstance(p, dict) else {}) or {}
    energy = None
    info = None
    decisions = None
    structure = None
    try:
        energy = int(p_scores.get("energy")) if "energy" in p_scores else None
    except Exception:
        energy = None
    try:
        info = int(p_scores.get("info")) if "info" in p_scores else None
    except Exception:
        info = None
    try:
        decisions = int(p_scores.get("decisions")) if "decisions" in p_scores else None
    except Exception:
        decisions = None
    try:
        structure = int(p_scores.get("structure")) if "structure" in p_scores else None
    except Exception:
        structure = None

    # energy: negative => independent/deep focus, positive => collaboration-charged
    if energy is not None:
        if energy < 0 and needs_alignment:
            out.append(
                GapDetail(
                    gap="Role is stakeholder-heavy; your style may be more deep-focus/independent.",
                    severity="medium",
                    evidence=["Personality: focus-charged (energy axis)", "Job text mentions stakeholders/cross-functional work"],
                    how_to_close="Show 1–2 examples of driving alignment with stakeholders (cadence, docs, decision records) without losing execution speed.",
                )
            )

    # info: negative => concrete/details, positive => big-picture/patterns
    if info is not None:
        if info < 0 and needs_strategy:
            out.append(
                GapDetail(
                    gap="Role may expect strategic framing; your style may lean more concrete/requirements-first.",
                    severity="low",
                    evidence=["Personality: concrete-leaning (info axis)", "Job text suggests strategy/vision"],
                    how_to_close="Bring a short 'strategy-to-execution' story: how you turned a vague goal into a plan and measurable outcomes.",
                )
            )
        if info >= 0 and needs_detail:
            out.append(
                GapDetail(
                    gap="Role may be detail/requirements heavy; your style may lean more big-picture.",
                    severity="low",
                    evidence=["Personality: big-picture-leaning (info axis)", "Job text suggests specs/documentation"],
                    how_to_close="Prepare a concrete artifact example (PRD, spec, runbook) to show you can go from concept to precise execution.",
                )
            )

    # decisions: negative => logic/evidence, positive => values/people
    if decisions is not None:
        if decisions < 0 and needs_people:
            out.append(
                GapDetail(
                    gap="Role emphasizes people/culture/relationship work; you may default to logic-first framing.",
                    severity="low",
                    evidence=["Personality: logic/evidence-leaning (decisions axis)", "Job text suggests coaching/culture/collaboration"],
                    how_to_close="Add one 'people impact' line to your stories: how you influenced, coached, or improved team dynamics.",
                )
            )

    # structure: negative => planned/predictable, positive => adaptive (matches frontend scoring)
    if structure is not None:
        if structure >= 0 and high_process:
            out.append(
                GapDetail(
                    gap="Role appears process-heavy/regulatory; you may prefer faster iteration and flexibility.",
                    severity="medium",
                    evidence=["Personality: adaptive-leaning (structure axis)", "Job text mentions compliance/process"],
                    how_to_close="Prepare examples of delivering in regulated environments (docs, audits, guardrails) while keeping momentum.",
                )
            )
        if structure < 0 and fast_paced:
            out.append(
                GapDetail(
                    gap="Role looks fast-paced; you may prefer more structured planning cycles.",
                    severity="low",
                    evidence=["Personality: planned-leaning (structure axis)", "Job text mentions fast-paced execution"],
                    how_to_close="Show how you plan in short cycles (weekly milestones) and keep quality high under speed constraints.",
                )
            )

    # If we still have nothing, be explicit about why (prevents empty columns).
    if not out:
        if not str(job.content or "").strip():
            out.append(
                GapDetail(
                    gap="Work-style fit not scored (job description text is missing).",
                    severity="low",
                    evidence=["Job content is empty/missing; can’t infer environment signals"],
                    how_to_close="Re-import the job description (paste the full text) to get personality/work-style fit gaps.",
                )
            )
        else:
            # Make the fallback visibly dependent on BOTH the profile and the job text,
            # so users can tell we're actually cross-referencing their selections.
            sigs = _signal_list()

            profile_bits: List[str] = []
            if action is not None or communication is not None:
                profile_bits.append(f"Temperament scores: action={action}, communication={communication}")
            if energy is not None or info is not None or decisions is not None or structure is not None:
                profile_bits.append(f"Personality scores: energy={energy}, info={info}, decisions={decisions}, structure={structure}")

            # Tailor screening prompts by detected job signals (if any).
            prompts: List[str] = []
            if needs_alignment:
                prompts.append("meeting cadence + stakeholder load (weekly hours in meetings, who owns decisions)")
            if needs_autonomy:
                prompts.append("ambiguity tolerance (how requirements are set when inputs are unclear)")
            if fast_paced:
                prompts.append("pace/deadlines (how often priorities shift; what 'urgent' means)")
            if high_process:
                prompts.append("process/compliance (docs required, approvals, audits, change control)")
            if needs_detail:
                prompts.append("expectations for specs/docs (who writes them; depth; review cycles)")
            if needs_strategy:
                prompts.append("strategy vs execution split (time spent on roadmap/vision vs delivery)")
            if needs_people:
                prompts.append("people leadership expectations (coaching, feedback, conflict handling)")
            if not prompts:
                prompts = ["meeting load, autonomy, and how work is prioritized week-to-week"]

            out.append(
                GapDetail(
                    gap=(
                        "Work-style fit: no strong conflicts detected by heuristics; validate environment details in screening."
                        + (f" (Job signals: {', '.join(sigs)})" if sigs else " (Job signals: none obvious in text)")
                    ),
                    severity="low",
                    evidence=(
                        ["Checked job text for pace, autonomy, process, stakeholder load, and strategy/detail signals"]
                        + (profile_bits if profile_bits else ["Personality/temperament profile missing or unscorable"])
                        + ([f"Detected job signals: {', '.join(sigs)}"] if sigs else ["Detected job signals: none obvious"])
                    ),
                    how_to_close="Validate in screening: ask about " + "; ".join(prompts) + ".",
                )
            )

    # De-dupe by gap text and cap
    uniq: List[GapDetail] = []
    seen = set()
    for g in out:
        key = str(g.gap or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        uniq.append(g)
    return uniq[:4]


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


def _infer_location_hint(text: str | None) -> str:
    """
    Lightweight location extraction for preference checks (NOT authoritative).
    Returns a short location string or empty.
    """
    t = (text or "").strip()
    if not t:
        return ""
    low = t.lower()
    if "united states" in low:
        return "United States"
    if "canada" in low:
        return "Canada"
    if "europe" in low or "eu" in low:
        return "Europe"
    import re
    m = re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}),\s*([A-Z]{2})\b", t)
    if m:
        return f"{m.group(1)}, {m.group(2)}"
    return ""


def _job_location(job: GapJobDescription) -> str:
    # Prefer explicit field if present, otherwise sniff from content.
    explicit = str(job.location or "").strip()
    if explicit:
        return explicit
    return _infer_location_hint(job.content)


def _deterministic_rank(
    preferences: GapAnalysisPreferences,
    resume: ResumeExtract,
    jobs: List[GapJobDescription],
    *,
    personality_profile: Dict[str, Any] | None = None,
    temperament_profile: Dict[str, Any] | None = None,
) -> List[GapAnalysisItem]:
    pref_skills = {s.lower() for s in _norm_list(preferences.skills)}
    resume_text = _resume_evidence_text(resume)
    resume_skills = {s.lower() for s in _norm_list(resume.skills)}
    role_cats = {s.lower() for s in _norm_list(preferences.role_categories)}

    ranked: List[GapAnalysisItem] = []
    for j in jobs:
        req = _norm_list(j.requiredSkills)
        req_set = {s.lower() for s in req}
        matched = sorted(
            {
                s
                for s in req
                if (s.lower() in resume_skills)
                or (s.lower() in pref_skills)
                or _skill_supported_by_resume(s, resume_text)
            }
        )
        missing = sorted({s for s in req if not _skill_supported_by_resume(s, resume_text) and s.lower() not in resume_skills})

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
        job_work = _job_work_mode(j)
        if "remote" in pref_work and "in-person" not in pref_work and "hybrid" not in pref_work:
            # remote-only
            if job_work in {"onsite", "hybrid"}:
                pref_gaps.append(f"Work preference mismatch: you selected Remote, but this job looks {job_work} (based on the job text).")
        if ("in-person" in pref_work or "in person" in pref_work) and "remote" not in pref_work:
            if job_work == "remote":
                pref_gaps.append("Work preference mismatch: you selected In-Person, but this job looks remote (based on the job text).")

        # Employment type mismatch (full-time/part-time/contract/internship)
        pref_types = {x.lower() for x in _norm_list(preferences.role_type)}
        job_type = _job_employment_type(j)
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
            # Best-effort salary check (only for annual salary ranges; hourly is skipped)
            try:
                pref_floor = _parse_salary_floor(preferences.minimum_salary)
            except Exception:
                pref_floor = None
            job_salary = str(j.salaryRange or "").strip()
            job_floor = _parse_salary_floor(job_salary)
            if pref_floor is not None and job_floor is not None and job_floor < pref_floor:
                pref_gaps.append(
                    f"Salary preference mismatch: you want at least ${pref_floor:,}/yr, but this job appears to start around ${job_floor:,}/yr."
                )
            elif pref_floor is not None and job_floor is None:
                pref_gaps.append("Salary preference not checked yet (salary is missing or not parseable from this job).")

        # Role category mismatch (soft): user selected categories but title doesn't match.
        if role_cats:
            title_tokens = set(_tokenize(j.title))
            cat_hit = any(tok in title_tokens for cat in role_cats for tok in _tokenize(cat))
            if not cat_hit:
                pref_gaps.append(
                    f"Role-category fit not obvious: you selected {', '.join(sorted(list(role_cats))[:4])}, but the title may not match those categories."
                )

        # Location preferences (soft): if user selected specific places, check job location when available.
        loc_prefs = [x.strip() for x in _norm_list(preferences.location_preferences) if str(x).strip()]
        loc_floor = str(preferences.state or "").strip()
        job_loc = _job_location(j)
        if loc_prefs or loc_floor:
            jl = (job_loc or "").lower()
            # If user picked a state, require it when job is onsite/hybrid and location is known.
            if loc_floor and job_work in {"onsite", "hybrid"} and jl and loc_floor.lower() not in jl:
                pref_gaps.append(f"Location preference mismatch: you selected {loc_floor}, but this job appears to be in {job_loc or 'an unspecified location'}.")
            # If user picked explicit cities/states and job location is known and doesn't mention any, flag as a soft mismatch.
            if jl and loc_prefs and not any(p.lower() in jl for p in loc_prefs):
                pref_gaps.append(
                    "Location preference not confirmed: your preferred locations don’t appear to match this job’s listed location."
                )

        # Industry preferences (soft): we can't reliably infer industries without an LLM, but we can surface a check.
        inds = [x.strip() for x in _norm_list(preferences.industries) if str(x).strip()]
        if inds:
            # If the job explicitly lists industries and none intersect, flag.
            job_inds = [x.strip() for x in _norm_list(j.industries) if str(x).strip()]
            if job_inds:
                inter = {x.lower() for x in inds}.intersection({x.lower() for x in job_inds})
                if not inter:
                    pref_gaps.append(f"Industry preference mismatch: you selected {', '.join(inds[:3])}, but this job appears outside those industries.")
            else:
                pref_gaps.append("Industry preference not confirmed: the posting doesn’t clearly state the industry; confirm in screening.")

        # Values (soft): translate values into screening checks using job text signals.
        vals = [x.strip() for x in _norm_list(preferences.values) if str(x).strip()]
        if vals:
            txt = (j.content or "").lower()
            # A few high-signal contradictions to surface (best-effort).
            if any(v.lower() in {"work-life balance", "work life balance", "flexibility"} for v in vals) and any(
                k in txt for k in ["on-call", "on call", "weekend", "nights", "overtime", "tight deadlines"]
            ):
                pref_gaps.append("Values fit risk: you value work-life balance, but the job text suggests on-call or intense deadlines.")
            if any(v.lower() in {"structure", "clarity", "stability"} for v in vals) and any(
                k in txt for k in ["0 to 1", "0→1", "ambiguous", "wear many hats", "fast-paced"]
            ):
                pref_gaps.append("Values fit risk: you want structure/clarity, but the role signals high ambiguity and fast iteration.")

        # Force non-empty preference gaps (user request): add an actionable screening check when none were found.
        if not pref_gaps:
            pref_gaps.append("Preference fit looks OK from available signals; confirm work mode, role type, and salary range in the first screen.")

        pref_gap_objs: List[GapDetail] = [
            GapDetail(gap=g, severity="medium", evidence=["Derived from job text + preferences"], how_to_close="Adjust preferences or focus on better-aligned roles.")
            for g in pref_gaps[:6]
        ]
        resume_gap_objs: List[GapDetail] = []
        for s in missing[:10]:
            resume_gap_objs.append(
                GapDetail(
                    gap=f"Missing required skill: {s}",
                    severity="high" if len(missing) >= 6 else "medium",
                    evidence=["Job required_skills vs resume evidence (skills + role descriptions + accomplishments)"],
                    how_to_close=f"Add explicit evidence of {s} to your resume (skill line + 1 bullet), or build/refresh {s} and include a project bullet.",
                )
            )

        personality_gap_objs = _deterministic_personality_gaps(personality_profile, temperament_profile, j)
        # Force non-empty personality gaps when profile context exists (user request).
        if (personality_profile or temperament_profile) and not personality_gap_objs:
            personality_gap_objs = [
                GapDetail(
                    gap="Work-style fit looks broadly compatible; confirm meeting load, autonomy, and pace in the first screen.",
                    severity="low",
                    evidence=["Personality/temperament profile provided", "No strong conflicts detected from job text"],
                    how_to_close="Ask about meeting cadence, on-call expectations, and how priorities change week-to-week.",
                )
            ]

        ranked.append(
            GapAnalysisItem(
                job_id=j.id,
                title=j.title,
                company=j.company,
                score=score,
                recommendation=recommendation,
                matched_skills=matched[:20],
                missing_skills=missing[:20],
                resume_gaps=resume_gap_objs[:8],
                personality_gaps=personality_gap_objs[:6],
                preference_gaps=pref_gap_objs[:6],
                notes=["Deterministic scoring (no LLM)."],
            )
        )

    ranked.sort(key=lambda x: x.score, reverse=True)
    return ranked


def _safe_deterministic_rank(
    prefs: GapAnalysisPreferences,
    resume: ResumeExtract,
    jobs: List[GapJobDescription],
    *,
    personality_profile: Dict[str, Any] | None = None,
    temperament_profile: Dict[str, Any] | None = None,
) -> List[GapAnalysisItem]:
    """
    Production safety: never let the endpoint 500 due to a heuristic edge case.
    If deterministic ranking fails, return a minimal-but-valid response so the UI can proceed.
    """
    try:
        return _deterministic_rank(
            prefs,
            resume,
            jobs,
            personality_profile=personality_profile,
            temperament_profile=temperament_profile,
        )
    except Exception as e:
        logger.exception("Deterministic gap ranking failed")
        ranked: List[GapAnalysisItem] = []
        for j in jobs:
            ranked.append(
                GapAnalysisItem(
                    job_id=j.id,
                    title=j.title,
                    company=j.company,
                    score=50,
                    recommendation="maybe",
                    matched_skills=[],
                    missing_skills=[],
                    resume_gaps=[],
                    personality_gaps=[
                        GapDetail(
                            gap="Could not compute personality gaps due to an internal scoring error (rerun after refresh).",
                            severity="low",
                            evidence=["Fallback: deterministic gap analyzer hit an error"],
                            how_to_close="Refresh and re-run. If it persists, re-import the job description text and resume.",
                        )
                    ]
                    if (personality_profile or temperament_profile)
                    else [],
                    preference_gaps=[
                        GapDetail(
                            gap="Could not compute preference gaps due to an internal scoring error (rerun after refresh).",
                            severity="low",
                            evidence=["Fallback: deterministic gap analyzer hit an error"],
                            how_to_close="Refresh and re-run. If it persists, re-import the job description text and resume.",
                        )
                    ],
                    notes=[f"Deterministic rank failed: {str(e)[:120]}"],
                )
            )
        return ranked


@router.post("/analyze", response_model=GapAnalysisResponse)
async def analyze_gap(req: GapAnalysisRequest) -> GapAnalysisResponse:
    """
    Rank imported job descriptions and highlight gaps:
    - preferences ↔ jobs
    - resume ↔ jobs
    Uses OpenAI when configured; falls back to deterministic heuristics.
    """
    # Defensive defaults: never reference locals that may not exist.
    prefs: GapAnalysisPreferences | None = None
    resume: ResumeExtract | None = None
    jobs: List[GapJobDescription] = []
    client = None

    try:
        prefs = GapAnalysisPreferences(**(req.preferences or {}))
        resume = ResumeExtract(**(req.resume_extract or {}))
        jobs = [GapJobDescription(**j) for j in (req.job_descriptions or [])]
    except Exception as e:
        # This should be a 400, not a 500.
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    if not jobs:
        return GapAnalysisResponse(success=True, message="No jobs to analyze", ranked=[], helper={"used_llm": False})

    try:
        # get_openai_client() should be safe, but never allow config issues to 500 this endpoint.
        try:
            client = get_openai_client()
        except Exception as e:
            logger.exception("Failed to initialize OpenAI client; falling back to deterministic")
            ranked = _safe_deterministic_rank(
                prefs,
                resume,
                jobs,
                personality_profile=req.personality_profile,
                temperament_profile=req.temperament_profile,
            )
            return GapAnalysisResponse(
                success=True,
                message="Gap analysis complete (LLM init error; used deterministic scoring)",
                ranked=ranked,
                overall=None,
                helper={"used_llm": False, "model": "unavailable", "notes": [f"LLM init error: {str(e)[:160]}"]},
            )

        if not getattr(client, "should_use_real_llm", False):
            ranked = _safe_deterministic_rank(
                prefs,
                resume,
                jobs,
                personality_profile=req.personality_profile,
                temperament_profile=req.temperament_profile,
            )
            return GapAnalysisResponse(
                success=True,
                message="Gap analysis complete (no LLM)",
                ranked=ranked,
                overall=None,
                helper={
                    "used_llm": False,
                    "model": getattr(client, "model", "unavailable"),
                    "notes": ["OpenAI not configured or LLM_MODE!=openai; used deterministic heuristics."],
                },
            )

        # LLM path
        stub_ranked = [
            r.model_dump()
            for r in _safe_deterministic_rank(
                prefs,
                resume,
                jobs,
                personality_profile=req.personality_profile,
                temperament_profile=req.temperament_profile,
            )[: min(8, len(jobs))]
        ]
        stub_json = {
            "ranked": stub_ranked,
            "notes": ["Stub fallback (should not be used when GPT is ON)."],
        }

        personality = req.personality_profile or {}
        temperament = req.temperament_profile or {}

        messages = [
            {
                "role": "system",
                "content": (
                    "You are RoleFerry's Gap Analyst. You will compare:\n"
                    "- resume_extract\n"
                    "- personality_profile + temperament_profile\n"
                    "- job preferences\n"
                    "- selected job descriptions\n\n"
                    "Your job is to produce a SMART, practical analysis with three explicit gap buckets:\n"
                    "- Resume gaps (skills/experience mismatches vs job)\n"
                    "- Personality gaps (work-style/environment mismatches vs job)\n"
                    "- Preference gaps (stated preferences that conflict with job)\n\n"
                    "Rules:\n"
                    "- Do NOT fabricate candidate experience.\n"
                    "- Do NOT invent facts or requirements not present in the inputs.\n"
                    "- If job text does not specify a preference-related signal (salary/work mode/etc), you MAY include a low-severity 'confirm in screening' gap.\n"
                    "  Evidence for those must cite: the user's stated preference AND that the job text is missing/unclear.\n"
                    "- Prefer concise, scannable items.\n"
                    "- Output ONLY JSON.\n\n"
                    "Hard requirements (non-empty buckets):\n"
                    "- If personality_profile or temperament_profile is provided, EACH ranked item MUST include at least 1 personality_gaps entry.\n"
                    "- EACH ranked item MUST include at least 2 preference_gaps entries (can be 'confirm in screening' when unclear).\n"
                    "- Use ALL preference inputs when relevant: values, role_categories, location_preferences, work_type, role_type, company_size, industries, skills, minimum_salary.\n\n"
                    "Return a JSON object with:\n"
                    "- ranked: array of items {\n"
                    "  job_id, title, company,\n"
                    "  score (0-100), recommendation (pursue|maybe|skip),\n"
                    "  matched_skills[], missing_skills[],\n"
                    "  resume_gaps: [{gap, severity(low|medium|high), evidence[], how_to_close}],\n"
                    "  personality_gaps: [{gap, severity(low|medium|high), evidence[], how_to_close}],\n"
                    "  preference_gaps: [{gap, severity(low|medium|high), evidence[], how_to_close}],\n"
                    "  notes[]\n"
                    "}\n"
                    "- overall: { resume_gaps[], personality_gaps[], preference_gaps[] } (optional summary buckets)\n"
                    "- notes: short array of strings\n"
                ),
            },
            {
                "role": "user",
                "content": (
                    "Analyze and rank these jobs.\n\n"
                    f"preferences:\n{prefs.model_dump()}\n\n"
                    f"resume_extract:\n{resume.model_dump()}\n\n"
                    f"personality_profile:\n{personality}\n\n"
                    f"temperament_profile:\n{temperament}\n\n"
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
            ranked = _safe_deterministic_rank(
                prefs,
                resume,
                jobs,
                personality_profile=req.personality_profile,
                temperament_profile=req.temperament_profile,
            )
            notes = ["GPT output could not be parsed; used deterministic scoring."]
            overall = None
        else:
            notes = _norm_list(data.get("notes"))[:6] or ["GPT-ranked analysis."]
            overall = data.get("overall") if isinstance(data.get("overall"), dict) else None

        # Ensure every imported job appears at least once (append missing with heuristic scores)
        seen = {r.job_id for r in ranked}
        if len(seen) < len(jobs):
            fill = _safe_deterministic_rank(
                prefs,
                resume,
                [j for j in jobs if j.id not in seen],
                personality_profile=req.personality_profile,
                temperament_profile=req.temperament_profile,
            )
            ranked.extend(fill)
            ranked.sort(key=lambda x: x.score, reverse=True)

        return GapAnalysisResponse(
            success=True,
            message="Gap analysis complete",
            ranked=ranked,
            overall=overall,
            helper={"used_llm": True, "model": getattr(client, "model", "unavailable"), "notes": notes},
        )
    except HTTPException:
        raise
    except Exception as e:
        # Ultimate safety net: never let the UI see a 500 for this endpoint.
        logger.exception("Gap analysis failed")
        ranked = _safe_deterministic_rank(
            prefs,
            resume,
            jobs,
            personality_profile=req.personality_profile,
            temperament_profile=req.temperament_profile,
        )
        return GapAnalysisResponse(
            success=True,
            message="Gap analysis complete (internal error; used deterministic scoring)",
            ranked=ranked,
            overall=None,
            helper={"used_llm": False, "model": getattr(client, "model", "unavailable"), "notes": [f"Internal error: {str(e)[:160]}"]},
        )


