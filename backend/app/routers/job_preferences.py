from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import json
from urllib.parse import quote_plus
from datetime import datetime, timezone

from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from ..db import get_engine
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store
from ..services.serper_client import serper_web_search
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse


router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)

class JobPreferences(BaseModel):
    values: List[str]
    role_categories: List[str]
    location_preferences: List[str]
    work_type: List[str]
    role_type: List[str]
    company_size: List[str]
    industries: List[str]
    skills: List[str]
    minimum_salary: str
    job_search_status: str
    state: Optional[str] = None
    user_mode: str = "job-seeker"  # job-seeker or recruiter

class JobPreferencesResponse(BaseModel):
    success: bool
    message: str
    preferences: Optional[JobPreferences] = None
    helper: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[Dict[str, Any]]] = None


class JobRecommendation(BaseModel):
    id: str
    label: str
    company: str
    source: str
    url: str
    # "job_posting" (specific role posting) vs "job_board_search" / "career_search" (search/listing pages).
    # Most outputs in this demo are search pages, and the UI should label them as such to avoid confusion.
    link_type: str = "career_search"
    rationale: str
    score: int = 0
    created_at: str


class JobRecommendationsResponse(BaseModel):
    success: bool
    message: str
    recommendations: List[JobRecommendation]


class GreenhouseBoardsResponse(BaseModel):
    success: bool
    message: str
    query: str
    results: List[Dict[str, Any]]

DEMO_USER_ID = "demo-user"


def _now_iso_z() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _keywords_from_preferences(p: JobPreferences) -> str:
    parts: List[str] = []
    parts.extend(p.role_categories or [])
    parts.extend(p.industries or [])
    parts.extend(p.skills or [])
    # Keep it short-ish for query params
    s = " ".join([str(x).strip() for x in parts if str(x).strip()])
    s = " ".join(s.split())
    return s[:160] if s else "software engineering"


def _board_query(p: JobPreferences, *, max_len: int = 70) -> str:
    """
    Build a search query that job boards can handle.

    Many boards (LinkedIn, WTTJ, etc.) degrade badly if we stuff in role_categories + industries + skills.
    """
    parts: List[str] = []
    role_kw = _role_keyword_from_categories(p.role_categories or [])
    if role_kw:
        parts.append(role_kw)

    # Add at most 2 skills (first two), since users often select many.
    skills = [str(s).strip() for s in (p.skills or []) if str(s).strip()]
    for s in skills[:2]:
        parts.append(s)

    # Add at most 1 industry hint (first) to keep results relevant but broad.
    industries = [str(x).strip() for x in (p.industries or []) if str(x).strip()]
    if industries:
        parts.append(industries[0])

    q = " ".join([x for x in parts if x]).strip()
    if not q:
        q = _keywords_from_preferences(p)
    return " ".join(q.split())[: max(20, int(max_len))]


def _linkedin_url(p: JobPreferences) -> str:
    """
    LinkedIn Jobs search URL (robust + not overly granular).
    """
    q = quote_plus(_board_query(p, max_len=60))
    # LinkedIn often performs better with a broad location than "United States, California"
    # (and the UI already has state filtering elsewhere).
    loc_hint = "United States"
    if p.state and str(p.state).strip():
        loc_hint = f"United States"
    lc = quote_plus(loc_hint)

    # Optional remote filter if user selected Remote.
    work = [str(x).lower() for x in (p.work_type or p.location_preferences or []) if str(x).strip()]
    is_remote = any("remote" in x for x in work)
    extra = "&f_WT=2" if is_remote else ""

    return f"https://www.linkedin.com/jobs/search/?keywords={q}&location={lc}{extra}"


def _sanitize_url(url: str, p: JobPreferences, source: str = "") -> str:
    """
    Normalize fragile URLs produced by the LLM into stable, demo-friendly links.
    """
    u = (url or "").strip()
    if not u:
        return u

    low = u.lower()

    # 1) Otta / Welcome to the Jungle: normalize to the current stable entrypoint.
    # Otta rebranded/migrated; older deep links (otta.com, uk.welcometothejungle.com, etc.)
    # can be brittle or region-specific. Use the app entrypoint requested for the demo.
    if "otta.com" in low or "welcometothejungle.com" in low:
        return "https://app.welcometothejungle.com/"

    # 2) LinkedIn: strip overly specific params like currentJobId, and rebuild with our short query.
    if "linkedin.com/jobs/search" in low:
        return _linkedin_url(p)

    # 3) Greenhouse meta-search: don't send users to Google; route to our in-app board finder page.
    if "google.com/search" in low and "boards.greenhouse.io" in low:
        q = quote_plus(_board_query(p, max_len=60))
        return f"/job-boards/greenhouse?q={q}"

    return u


def _role_keyword_from_categories(role_categories: List[str]) -> str:
    """
    Convert broad role categories into a search-friendly keyword phrase.
    The UI categories are high-level; job boards work better with concrete role phrases.
    """
    low = " ".join([str(x).lower() for x in (role_categories or []) if str(x).strip()])
    if "marketing" in low:
        return "marketing"
    if "sales" in low:
        return "sales"
    if "recruit" in low or "people ops" in low or "talent" in low:
        return "recruiter"
    if "creative" in low or "design" in low:
        return "product designer"
    if "finance" in low:
        return "finance"
    if "legal" in low:
        return "legal"
    if "life sciences" in low or "biotech" in low:
        return "biotech"
    if "education" in low or "training" in low:
        return "training"
    if "technical" in low or "engineering" in low:
        return "software engineer"
    return ""


def _indeed_query(p: JobPreferences) -> str:
    """
    Indeed search results degrade quickly when q contains too many keywords/filters.
    Use a single primary role phrase + (optional) one skill to keep results broad.
    """
    parts: List[str] = []
    role_kw = _role_keyword_from_categories(p.role_categories or [])
    if role_kw:
        parts.append(role_kw)

    # Add at most one skill keyword (first) if present.
    skill = next((str(s).strip() for s in (p.skills or []) if str(s).strip()), "")
    if skill:
        parts.append(skill)

    # If we still have nothing concrete, fall back to broad keywords.
    q = " ".join([x for x in parts if x]).strip()
    if not q:
        q = _keywords_from_preferences(p)

    # Keep short (indeed behaves better)
    return " ".join(q.split())[:60]


def _location_hint(p: JobPreferences) -> str:
    # Very lightweight location hint (used for some career site search urls).
    if p.state and str(p.state).strip():
        return f"United States, {p.state.strip()}"
    # If remote is selected, bias remote.
    locs = [x.lower() for x in (p.location_preferences or [])]
    if any("remote" in x for x in locs):
        return "Remote"
    return "United States"


def _build_google_careers_url(p: JobPreferences) -> str:
    # This matches the style of URL you provided.
    base = "https://www.google.com/about/careers/applications/jobs/results/"
    employment_types: List[str] = []
    for rt in p.role_type or []:
        low = rt.lower()
        if "full" in low:
            employment_types.append("FULL_TIME")
        elif "part" in low:
            employment_types.append("PART_TIME")
        elif "intern" in low:
            employment_types.append("INTERN")
        elif "contract" in low:
            employment_types.append("TEMPORARY")
    if not employment_types:
        employment_types = ["FULL_TIME"]

    # Google careers query param accepts a comma-separated skills string.
    skills = ", ".join([s.strip() for s in (p.skills or []) if str(s).strip()])
    if not skills:
        skills = "software"

    # Note: we keep this simple & robust; we can add more params later.
    return (
        f"{base}?employment_type={employment_types[0]}"
        f"&skills={quote_plus(skills)}"
    )


def _classify_job_link(url: str, source: str = "") -> str:
    """
    Classify recommendation URLs into:
    - job_posting: specific job post detail page
    - job_board_search: job board / meta board search page
    - career_search: company career site search/listing page
    """
    u = (url or "").strip().lower()
    s = (source or "").strip().lower()
    if not u:
        return "career_search"

    # In-app board finders (we treat these as job board search pages)
    if u.startswith("/job-boards/"):
        return "job_board_search"

    # Strong indicators of a specific posting
    posting_markers = [
        "/jobs/view/",
        "viewjob?",
        "/job/",
        "/jobs/",
        "/positions/",
        "gh_jid=",
    ]
    # If URL has a jobs path but also explicit search query markers, treat as search.
    search_markers = ["?q=", "?query=", "keywords=", "/search", "search?"]

    if any(m in u for m in posting_markers) and not any(sm in u for sm in search_markers):
        return "job_posting"

    # Board sources
    board_sources = {
        "linkedin_jobs",
        "indeed",
        "wellfound",
        "otta",
        "workatastartup",
        "builtin",
        "remoteok",
        "greenhouse",  # meta-search
        "hitmarker",
        "dice",
        "idealist",
    }
    if s in board_sources:
        return "job_board_search"

    # Domain-based heuristics
    if any(
        d in u
        for d in [
            "linkedin.com/jobs/search",
            "indeed.com/jobs",
            "wellfound.com/jobs",
            "otta.com/jobs",
            "welcometothejungle.com",
            "app.welcometothejungle.com",
            "remoteok.com/remote-",
        ]
    ):
        return "job_board_search"

    return "career_search"


def _source_display_name(source: str) -> str:
    s = (source or "").strip().lower()
    return {
        "linkedin_jobs": "LinkedIn Jobs",
        "indeed": "Indeed",
        "wellfound": "Wellfound",
        "otta": "Otta",
        "workatastartup": "Work at a Startup (YC)",
        "builtin": "Built In",
        "remoteok": "Remote OK",
        "greenhouse": "Greenhouse boards",
        "google_careers": "Google Careers",
        "microsoft_careers": "Microsoft Careers",
        "amazon_jobs": "Amazon Jobs",
        "netflix_jobs": "Netflix Jobs",
        "hitmarker": "Hitmarker",
        "dice": "Dice",
        "idealist": "Idealist",
    }.get(s, source or "Jobs")


def _normalize_recommendation(rec: JobRecommendation, p: JobPreferences) -> JobRecommendation:
    """
    Enforce "label matches link" consistency:
    - If it's a board/search page, label it as search and avoid implying a single specific job posting.
    """
    # First: sanitize fragile URLs (LLM can generate overly-specific or broken ones).
    try:
        rec.url = _sanitize_url(rec.url, p, rec.source)
    except Exception:
        pass

    link_type = _classify_job_link(rec.url, rec.source)
    rec.link_type = link_type

    # If the link is a board search, avoid showing a specific company as if it's a posting.
    if link_type == "job_board_search":
        src_name = _source_display_name(rec.source)
        # Preserve any meaningful label text but make it explicit this is search/board.
        lbl = (rec.label or "").strip()
        if "(search)" not in lbl.lower() and "search" not in lbl.lower() and "board" not in lbl.lower():
            lbl = f"{src_name} (search): {lbl}" if lbl else f"{src_name} (search)"
        rec.label = lbl[:120]
        # Boards aren't a single company; set company to "Various" unless already a board-ish value.
        if (rec.company or "").strip().lower() not in {"various", "startups", "unknown"}:
            rec.company = "Various"

    # Company career sites are still search pages; label should not imply a specific posting.
    if link_type == "career_search":
        lbl = (rec.label or "").strip()
        if "(search)" not in lbl.lower() and "search" not in lbl.lower() and "careers" in (rec.source or "").lower():
            lbl = f"{lbl} (search)" if lbl else "Career site (search)"
        rec.label = lbl[:120]

    return rec


def _company_size_bucket(company_sizes: List[str]) -> str:
    """
    Map selected company size strings into a coarse bucket:
    - small: up to ~200 employees
    - mid: ~201-1,000
    - large: 1,001+

    If multiple sizes are selected, we bias to the smallest bucket selected
    (users who check small + medium generally still want smaller companies).
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


def _deterministic_recommendations(p: JobPreferences) -> List[JobRecommendation]:
    created_at = _now_iso_z()
    keywords = _board_query(p, max_len=70)
    loc = _location_hint(p)
    size_bucket = _company_size_bucket(p.company_size or [])

    recs: List[JobRecommendation] = []

    # 1) Company size-aware anchor sources.
    # If the user explicitly selected smaller sizes, do NOT force big-tech career sites.
    if size_bucket in ["large", "any"]:
        recs.append(
            JobRecommendation(
                id="google-careers",
                label="Google Careers (tailored results)",
                company="Google",
                source="google_careers",
                url=_build_google_careers_url(p),
                link_type=_classify_job_link(_build_google_careers_url(p), "google_careers"),
                rationale="High-signal listings; best when you’re open to large companies.",
                score=86,
                created_at=created_at,
            )
        )

    # 2) A few other major career-site search pages (best-effort URL formats).
    q = quote_plus(keywords)
    q_indeed = quote_plus(_indeed_query(p))
    lc = quote_plus(loc)
    industries = [str(x).strip() for x in (p.industries or []) if str(x).strip()]
    industry_hint = industries[0] if industries else ""
    work = [str(x).lower() for x in (p.work_type or p.location_preferences or []) if str(x).strip()]
    is_remote = any("remote" in x for x in work)

    # Simple board selection based on preferences (avoid obscure sources).
    extra_sources: List[JobRecommendation] = []
    extra_sources.append(
        JobRecommendation(
            id="linkedin-jobs",
            label="LinkedIn Jobs (search)",
            company="Various",
            source="linkedin_jobs",
            url=_linkedin_url(p),
            link_type="job_board_search",
            rationale="Great breadth; strong for filtering by location, remote, and seniority.",
            score=78,
            created_at=created_at,
        )
    )
    extra_sources.append(
        JobRecommendation(
            id="indeed-search",
            label="Indeed (search)",
            company="Various",
            source="indeed",
            url=f"https://www.indeed.com/jobs?q={q_indeed}&l={lc}",
            link_type="job_board_search",
            rationale="Broad results (Indeed works best with 1 main role + 0–1 skill keywords).",
            score=70,
            created_at=created_at,
        )
    )

    # Startup-leaning: include startup boards when company size suggests smaller orgs.
    if size_bucket == "small":
        extra_sources.append(
            JobRecommendation(
                id="wellfound",
                label="Wellfound (AngelList Talent) jobs",
                company="Various",
                source="wellfound",
                url=f"https://wellfound.com/jobs?search={q}",
                link_type="job_board_search",
                rationale="Strong for startups and smaller companies; good when you selected early-stage sizes.",
                score=72,
                created_at=created_at,
            )
        )
        extra_sources.append(
            JobRecommendation(
                id="otta",
                label="Otta (search)",
                company="Various",
                source="otta",
                url="https://app.welcometothejungle.com/",
                link_type="job_board_search",
                rationale="Curated roles; useful for startup/mid-size searches.",
                score=66,
                created_at=created_at,
            )
        )
        extra_sources.append(
            JobRecommendation(
                id="workatastartup",
                label="Work at a Startup (YC) (search)",
                company="Startups",
                source="workatastartup",
                url=f"https://www.workatastartup.com/jobs?query={q}",
                link_type="job_board_search",
                rationale="High-quality startup roles (YC network) aligned with small-company preference.",
                score=74,
                created_at=created_at,
            )
        )
        extra_sources.append(
            JobRecommendation(
                id="builtin",
                label="Built In (search)",
                company="Startups/Mid-size",
                source="builtin",
                url=f"https://builtin.com/jobs?search={q}",
                link_type="job_board_search",
                rationale="Good coverage for startup/mid-size tech roles; easy browsing by city/remote.",
                score=68,
                created_at=created_at,
            )
        )

    # Industry-specific (still mainstream)
    if industry_hint.lower() in ["gaming", "entertainment"]:
        extra_sources.append(
            JobRecommendation(
                id="hitmarker",
                label="Hitmarker (gaming jobs)",
                company="Various",
                source="hitmarker",
                url=f"https://hitmarker.net/jobs?search={q}",
                link_type="job_board_search",
                rationale="Focused on gaming/interactive entertainment roles (matches your industry preference).",
                score=74,
                created_at=created_at,
            )
        )

    # Remote: include a remote-first board link (broad)
    if is_remote:
        extra_sources.append(
            JobRecommendation(
                id="remoteok",
                label="Remote OK (search)",
                company="Various",
                source="remoteok",
                url=f"https://remoteok.com/remote-{q}-jobs",
                link_type="job_board_search",
                rationale="Remote-first listings when you selected Remote.",
                score=64,
                created_at=created_at,
            )
        )
    # ATS meta-search: useful for startups/mid-size, still fine for any.
    recs.append(
        JobRecommendation(
            id="greenhouse-search",
            label="Greenhouse boards (in-app search)",
            company="Various",
            source="greenhouse",
            url=f"/job-boards/greenhouse?q={q}",
            link_type="job_board_search",
            rationale="Find relevant company job boards hosted on Greenhouse, without leaving RoleFerry.",
            score=66,
            created_at=created_at,
        )
    )

    # Role-specialized mainstream boards (lightweight and stable)
    role_kw = _role_keyword_from_categories(p.role_categories or [])
    low_role = (role_kw or "").lower()
    if "software" in low_role or "engineer" in low_role:
        extra_sources.append(
            JobRecommendation(
                id="dice",
                label="Dice (tech jobs) (search)",
                company="Various",
                source="dice",
                url=f"https://www.dice.com/jobs?q={quote_plus(_board_query(p, max_len=50))}&location={quote_plus('United States')}",
                link_type="job_board_search",
                rationale="Tech-focused job board; useful when your target is engineering roles.",
                score=62,
                created_at=created_at,
            )
        )
    if any(k in " ".join([x.lower() for x in (p.role_categories or [])]) for k in ["coaching", "mentorship", "education", "training", "social impact"]):
        extra_sources.append(
            JobRecommendation(
                id="idealist",
                label="Idealist (mission-driven roles) (search)",
                company="Various",
                source="idealist",
                url=f"https://www.idealist.org/en/jobs?q={quote_plus(_board_query(p, max_len=50))}",
                link_type="job_board_search",
                rationale="Good for coaching/training and mission-driven org roles when you selected those categories.",
                score=60,
                created_at=created_at,
            )
        )

    # Big-company career sites ONLY if user selected mid/large or left size unspecified.
    if size_bucket in ["large", "mid", "any"]:
        recs.extend(
            [
                JobRecommendation(
                    id="microsoft-careers",
                    label="Microsoft Careers (search)",
                    company="Microsoft",
                    source="microsoft_careers",
                    url=f"https://jobs.careers.microsoft.com/global/en/search?q={q}&lc={lc}",
                    link_type="career_search",
                    rationale="Large volume of roles; useful if you're open to bigger orgs.",
                    score=72,
                    created_at=created_at,
                ),
                JobRecommendation(
                    id="amazon-jobs",
                    label="Amazon Jobs (search)",
                    company="Amazon",
                    source="amazon_jobs",
                    url=f"https://www.amazon.jobs/en/search?offset=0&result_limit=20&sort=relevant&keywords={q}",
                    link_type="career_search",
                    rationale="High hiring volume; useful if you're open to big-company searches.",
                    score=68,
                    created_at=created_at,
                ),
                JobRecommendation(
                    id="netflix-jobs",
                    label="Netflix Jobs (search)",
                    company="Netflix",
                    source="netflix_jobs",
                    url=f"https://jobs.netflix.com/search?q={q}",
                    link_type="career_search",
                    rationale="Good for senior roles when you’re open to larger companies.",
                    score=58,
                    created_at=created_at,
                ),
            ]
        )

    recs.extend(extra_sources)

    # Cap for UI sanity + normalize so labels/companies align with link types
    out = recs[:8]
    return [_normalize_recommendation(r, p) for r in out]


@router.post("/recommendations", response_model=JobRecommendationsResponse)
async def generate_job_recommendations(preferences: JobPreferences):
    """
    Turn Job Preferences into a list of recommended job search page URLs + rationale.

    - Uses LLM when configured.
    - Falls back to deterministic URL patterns when LLM isn't available.
    """
    try:
        # Cache prefs for downstream steps
        store.demo_job_preferences = preferences.model_dump()

        client = get_openai_client()
        created_at = _now_iso_z()

        if client.should_use_real_llm:
            # Ask for job listing page URLs that are easy to click/import in the UI.
            payload = {
                "preferences": preferences.model_dump(),
                "resume_hint": store.demo_latest_resume or {},
                "constraints": {
                    "max_items": 8,
                    "respect_company_size_strictly": True,
                    "return_urls_only_from_official_career_sites_or_well_known_ats": True,
                },
            }
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a job search strategist.\n\n"
                        "Given user job preferences, generate a ranked list of job listing/search page URLs.\n"
                        "Return ONLY JSON with key:\n"
                        "- recommendations: array of { id, label, company, source, url, rationale, score }\n\n"
                        "Rules:\n"
                        "- URLs must be direct search/listing pages (not blog posts).\n"
                        "- IMPORTANT: labels must match the link type:\n"
                        "  - If url is a job board or search page, label must say '(search)' and MUST NOT pretend it is a single specific job posting.\n"
                        "  - If url is a specific job posting detail page, label should be the specific job title.\n"
                        "- You MUST respect company_size. If user selected small companies (<=200), avoid big-tech career sites (Google/Amazon/Microsoft/etc) and prefer startup boards + ATS meta-search.\n"
                        "- If user selected large companies (1000+), include some big-company career sites.\n"
                        "- IMPORTANT: For ATS meta-search (Greenhouse boards), do NOT output a Google link. Use the in-app route '/job-boards/greenhouse?q=YOUR_QUERY' so RoleFerry can show results.\n"
                        "- For Indeed, keep the query broad (one primary role phrase + optionally one skill). Avoid stuffing many keywords into q=.\n"
                        "- Keep rationales 1 sentence.\n"
                        "- score: 0-100.\n"
                    ),
                },
                {"role": "user", "content": json.dumps(payload)},
            ]
            stub = {"recommendations": [r.model_dump(exclude={"created_at"}) for r in _deterministic_recommendations(preferences)]}
            raw = client.run_chat_completion(messages, temperature=0.3, max_tokens=700, stub_json=stub)
            choices = raw.get("choices") or []
            msg = (choices[0].get("message") if choices else {}) or {}
            content_str = str(msg.get("content") or "")
            data = extract_json_from_text(content_str) or stub
            rec_items = (data or {}).get("recommendations") or []

            recs: List[JobRecommendation] = []
            for item in rec_items:
                if not isinstance(item, dict):
                    continue
                try:
                    rec = JobRecommendation(
                            id=str(item.get("id") or "")[:64] or f"rec_{len(recs)+1}",
                            label=str(item.get("label") or "Recommended jobs")[:120],
                            company=str(item.get("company") or "Unknown")[:120],
                            source=str(item.get("source") or "unknown")[:64],
                            url=str(item.get("url") or ""),
                            link_type=str(item.get("link_type") or ""),
                            rationale=str(item.get("rationale") or "")[:240],
                            score=int(item.get("score") or 0),
                            created_at=created_at,
                    )
                    recs.append(_normalize_recommendation(rec, preferences))
                except Exception:
                    continue

            # Enforce company size constraints even if the LLM ignores them.
            size_bucket = _company_size_bucket(preferences.company_size or [])
            if recs and size_bucket == "small":
                disallowed_sources = {
                    "google_careers",
                    "amazon_jobs",
                    "microsoft_careers",
                    "netflix_jobs",
                }
                disallowed_companies = {
                    "google",
                    "alphabet",
                    "amazon",
                    "microsoft",
                    "netflix",
                    "meta",
                    "facebook",
                    "apple",
                }
                filtered = [
                    r
                    for r in recs
                    if (r.source or "").lower() not in disallowed_sources
                    and (r.company or "").strip().lower() not in disallowed_companies
                ]
                recs = filtered

                # Backfill with deterministic startup-leaning recs if we filtered too aggressively.
                if len(recs) < 6:
                    fallback = _deterministic_recommendations(preferences)
                    seen = {str(r.url or "").strip() for r in recs if str(r.url or "").strip()}
                    for f in fallback:
                        u = str(f.url or "").strip()
                        if not u or u in seen:
                            continue
                        recs.append(f)
                        seen.add(u)
                        if len(recs) >= 8:
                            break

            if not recs:
                recs = _deterministic_recommendations(preferences)

            store.demo_job_recommendations = [r.model_dump() for r in recs]
            return JobRecommendationsResponse(success=True, message="Recommendations generated", recommendations=recs)

        # Fallback: deterministic recs
        recs = _deterministic_recommendations(preferences)
        store.demo_job_recommendations = [r.model_dump() for r in recs]
        return JobRecommendationsResponse(success=True, message="Recommendations generated (no LLM)", recommendations=recs)

    except Exception:
        logger.exception("Error generating recommendations")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")


@router.get("/greenhouse-boards", response_model=GreenhouseBoardsResponse)
async def greenhouse_boards(q: str = ""):
    """
    In-app helper: find relevant Greenhouse-hosted job boards using SERPER (if configured).

    We do NOT send the user to Google; we return a curated list of likely boards.
    """
    query = " ".join(str(q or "").split()).strip()
    if not query:
        raise HTTPException(status_code=400, detail="q is required")

    # This uses Serper's Google Search API (requires SERPER_API_KEY). If not present, return a helpful message.
    results = serper_web_search(f"site:boards.greenhouse.io {query}", num=8, gl="us", hl="en")

    # Filter out junk / non-board hits
    cleaned: List[Dict[str, Any]] = []
    for r in results or []:
        url = str(r.get("url") or "").strip()
        if not url:
            continue
        low = url.lower()
        if "boards.greenhouse.io" not in low:
            continue
        # Prefer company board roots and job pages; skip generic embed assets
        if any(bad in low for bad in ["/embed/", "greenhouse.io/embed", "boards.greenhouse.io/embed"]):
            continue
        cleaned.append({"title": r.get("title"), "url": url, "snippet": r.get("snippet")})

    if not cleaned:
        msg = (
            "No Greenhouse boards found. "
            "If this keeps happening, set SERPER_API_KEY on the backend to enable in-app board search."
        )
    else:
        msg = f"Found {len(cleaned)} Greenhouse board results"

    return GreenhouseBoardsResponse(success=True, message=msg, query=query, results=cleaned)


@router.post("/save", response_model=JobPreferencesResponse)
async def save_job_preferences(preferences: JobPreferences):
    """
    Save job preferences for a user.
    In a real implementation, this would save to database.
    """
    try:
        # Always cache for demo continuity (even if Postgres is down)
        store.demo_job_preferences = preferences.model_dump()

        # Persist as structured JSONB against a stubbed demo user (best-effort)
        data_obj = preferences.model_dump()
        try:
            stmt = (
                text(
                    """
                    INSERT INTO job_preferences (user_id, data, updated_at)
                    VALUES (:user_id, :data, now())
                    ON CONFLICT (user_id)
                    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
                    """
                ).bindparams(bindparam("data", type_=JSONB))
            )
            async with engine.begin() as conn:
                await conn.execute(stmt, {"user_id": DEMO_USER_ID, "data": data_obj})
        except BaseException:
            pass

        # GPT helper: normalize skills + suggest adjacent improvements.
        client = get_openai_client()
        helper_context = {
            "values": preferences.values,
            "role_categories": preferences.role_categories,
            "location_preferences": preferences.location_preferences,
            "industries": preferences.industries,
            "skills": preferences.skills,
            "work_type": preferences.work_type,
            "company_size": preferences.company_size,
            "user_mode": preferences.user_mode,
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a job preferences normalization assistant.\n\n"
                    "Return ONLY JSON with keys:\n"
                    "- normalized_skills: array of strings (deduped, consistent casing)\n"
                    "- suggested_skills: array of strings (3-8 items)\n"
                    "- suggested_role_categories: array of strings (0-3 items)\n"
                    "- notes: array of strings (short, actionable)\n"
                ),
            },
            {"role": "user", "content": json.dumps(helper_context)},
        ]
        stub_json = {
            "normalized_skills": sorted({s.strip() for s in (preferences.skills or []) if str(s).strip()}),
            "suggested_skills": ["Product analytics", "Experiment design", "SQL", "Stakeholder management"],
            "suggested_role_categories": preferences.role_categories[:1],
            "notes": [
                "Keep skills to 8–12 high-signal items; remove near-duplicates.",
                "Add 1–2 domain skills that match your target industry (e.g., onboarding/activation).",
            ],
        }
        raw = client.run_chat_completion(messages, temperature=0.1, max_tokens=450, stub_json=stub_json)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        helper = extract_json_from_text(content_str) or stub_json

        return JobPreferencesResponse(
            success=True,
            message="Job preferences saved successfully",
            preferences=preferences,
            helper=helper,
        )
    except Exception as e:
        logger.exception("Error saving job preferences")
        raise HTTPException(status_code=500, detail="Failed to save preferences")

@router.get("/{user_id}", response_model=JobPreferencesResponse)
async def get_job_preferences(user_id: str):
    """
    Get job preferences for a user.
    In a real implementation, this would fetch from database.
    """
    # For Week 9, we treat all traffic as a single demo user
    _user_id = DEMO_USER_ID
    try:
        async with engine.begin() as conn:
            result = await conn.execute(
                text("SELECT data FROM job_preferences WHERE user_id = :user_id"),
                {"user_id": _user_id},
            )
            row = result.first()

        if row and row[0]:
            # row[0] is a JSON/JSONB object
            prefs_obj = JobPreferences(**row[0])
            return JobPreferencesResponse(
                success=True,
                message="Job preferences retrieved successfully",
                preferences=prefs_obj,
            )
    except Exception:
        # If anything goes wrong with the DB, fall back to mock defaults
        pass

    # Prefer demo cache if available
    if store.demo_job_preferences:
        try:
            prefs_obj = JobPreferences(**store.demo_job_preferences)
            return JobPreferencesResponse(
                success=True,
                message="Job preferences retrieved successfully",
                preferences=prefs_obj,
                helper={
                    "normalized_skills": sorted({s.strip() for s in (prefs_obj.skills or []) if str(s).strip()}),
                    "suggested_skills": ["SQL", "Experimentation", "Analytics", "Stakeholder management"],
                    "suggested_role_categories": prefs_obj.role_categories[:1],
                    "notes": ["Loaded from demo cache (DB unavailable)."],
                },
            )
        except Exception:
            pass

    # Fallback to existing mock defaults if nothing stored yet or DB unavailable
    mock_preferences = JobPreferences(
        values=["Impactful work", "Work-life balance"],
        role_categories=["Technical & Engineering"],
        location_preferences=["Remote", "Hybrid"],
        work_type=["Remote", "Hybrid"],
        role_type=["Full-Time"],
        company_size=["51-200 employees", "201-500 employees"],
        industries=["Enterprise Software", "AI & Machine Learning"],
        skills=["Python", "JavaScript", "React"],
        minimum_salary="$80,000",
        job_search_status="Actively looking",
        state="California",
        user_mode="job-seeker",
    )

    return JobPreferencesResponse(
        success=True,
        message="Job preferences retrieved successfully",
        preferences=mock_preferences,
        helper={
            "normalized_skills": sorted({s.strip() for s in (mock_preferences.skills or []) if str(s).strip()}),
            "suggested_skills": ["SQL", "Experimentation", "Analytics", "System design"],
            "suggested_role_categories": mock_preferences.role_categories[:1],
            "notes": ["These are seeded demo preferences; edit them to match your target role."],
        },
    )

@router.put("/{user_id}", response_model=JobPreferencesResponse)
async def update_job_preferences(user_id: str, preferences: JobPreferences):
    """
    Update job preferences for a user.
    """
    try:
        data_obj = preferences.model_dump()
        stmt = (
            text(
                """
                INSERT INTO job_preferences (user_id, data, updated_at)
                VALUES (:user_id, :data, now())
                ON CONFLICT (user_id)
                DO UPDATE SET data = EXCLUDED.data, updated_at = now()
                """
            ).bindparams(bindparam("data", type_=JSONB))
        )
        async with engine.begin() as conn:
            await conn.execute(stmt, {"user_id": DEMO_USER_ID, "data": data_obj})
        return JobPreferencesResponse(
            success=True,
            message="Job preferences updated successfully",
            preferences=preferences,
        )
    except Exception as e:
        logger.exception("Error updating job preferences")
        raise HTTPException(status_code=500, detail="Failed to update preferences")

@router.delete("/{user_id}")
async def delete_job_preferences(user_id: str):
    """
    Delete job preferences for a user.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM job_preferences WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
        return {"success": True, "message": "Job preferences deleted successfully"}
    except Exception as e:
        logger.exception("Error deleting job preferences")
        raise HTTPException(status_code=500, detail="Failed to delete preferences")

@router.get("/options/values")
async def get_values_options():
    """Get available values options."""
    return {
        "values": [
            "Diversity & inclusion",
            "Impactful work", 
            "Independence & autonomy",
            "Innovative product & tech",
            "Mentorship & career development",
            "Progressive leadership",
            "Recognition & reward",
            "Role mobility",
            "Social responsibility & sustainability",
            "Transparency & communication",
            "Work-life balance"
        ]
    }

@router.get("/options/role-categories")
async def get_role_categories():
    """Get available role categories."""
    return {
        "role_categories": [
            "Technical & Engineering",
            "Finance & Operations & Strategy", 
            "Creative & Design",
            "Education & Training",
            "Legal & Support & Administration",
            "Life Sciences",
            "Sales",
            "Marketing",
            "People Ops & Recruiting",
            "Coaching & Mentorship",
        ]
    }

@router.get("/options/industries")
async def get_industries():
    """Get available industries."""
    return {
        "industries": [
            "Aerospace", "AI & Machine Learning", "Automotive & Transportation", 
            "Biotechnology", "Consulting", "Consumer Goods", "Consumer Software",
            "Crypto & Web3", "Cybersecurity", "Data & Analytics", "Defense",
            "Design", "Education", "Energy", "Enterprise Software", "Entertainment",
            "Financial Services", "Fintech", "Food & Agriculture", "Gaming",
            "Government & Public Sector", "Hardware", "Healthcare",
            "Industrial & Manufacturing", "Legal", "Quantitative Finance",
            "Real Estate", "Robotics & Automation", "Social Impact",
            "Venture Capital", "VR & AR",
            "Agriculture",
            "Restaurant Service",
            "Hospitality",
            "Other",
        ]
    }

@router.get("/options/skills")
async def get_skills():
    """Get available skills."""
    return {
        "skills": [
            # A practical, cross-discipline list (kept deterministic for demo mode).
            # Engineering / Data
            "Python",
            "JavaScript",
            "TypeScript",
            "Java",
            "Go",
            "C#",
            "C++",
            "SQL",
            "NoSQL",
            "REST APIs",
            "GraphQL",
            "React",
            "Next.js",
            "Node.js",
            "Django",
            "FastAPI",
            "Flask",
            "Spring",
            "Docker",
            "Kubernetes",
            "AWS",
            "GCP",
            "Azure",
            "Terraform",
            "CI/CD",
            "Git",
            "Linux",
            "Microservices",
            "System Design",
            "Data Structures",
            "Algorithms",
            "Machine Learning",
            "Deep Learning",
            "NLP",
            "LLM Prompting",
            "LLM Evaluation",
            "MLOps",
            "Data Engineering",
            "ETL/ELT",
            "dbt",
            "Airflow",
            "Spark",
            "Kafka",
            "Data Modeling",
            "Statistics",
            "A/B Testing",
            "Experiment Design",
            "Analytics",
            "Tableau",
            "Looker",
            "Power BI",
            "Excel/Sheets",
            "Business Analytics",
            "Information Security",
            "Threat Modeling",
            "AppSec",
            "Penetration Testing",
            "SRE",
            "Observability",
            "Monitoring",
            "Logging",
            "Incident Response",
            "Performance Optimization",
            "Testing",
            "Unit Testing",
            "Integration Testing",
            "QA",
            "Accessibility",
            "Internationalization",
            "Web Scraping",
            # Product / Design
            "Product Management",
            "Product Strategy",
            "Roadmapping",
            "User Research",
            "Customer Interviews",
            "UX Design",
            "UI Design",
            "Figma",
            "Prototyping",
            "Design Systems",
            "Wireframing",
            "Copywriting",
            # Marketing / Growth
            "Marketing Strategy",
            "Brand Strategy",
            "Content Marketing",
            "SEO",
            "SEM",
            "Paid Search",
            "Paid Social",
            "Lifecycle Marketing",
            "Email Marketing",
            "Marketing Automation",
            "HubSpot",
            "Marketo",
            "Mailchimp",
            "Google Analytics",
            "Attribution",
            "CRO",
            "Landing Pages",
            "PR",
            "Social Media",
            "Community Building",
            # Sales / RevOps
            "Sales",
            "Outbound",
            "Inbound",
            "Prospecting",
            "Cold Email",
            "Cold Calling",
            "Discovery",
            "Demo",
            "Negotiation",
            "Account Management",
            "Customer Success",
            "Sales Ops",
            "RevOps",
            "Pipeline Management",
            "Salesforce",
            "CRM",
            "Lead Generation",
            # Recruiting / People
            "Recruiting",
            "Sourcing",
            "Interviewing",
            "Talent Acquisition",
            "People Ops",
            "HR",
            "Onboarding",
            "Performance Management",
            "Compensation",
            "Employee Relations",
            "Coaching",
            "Mentorship",
            "Training",
            # Operations / Finance / Legal
            "Operations",
            "Program Management",
            "Project Management",
            "Agile",
            "Scrum",
            "Stakeholder Management",
            "Process Improvement",
            "OKRs",
            "Finance",
            "FP&A",
            "Accounting",
            "Budgeting",
            "Procurement",
            "Legal",
            "Compliance",
            "Contract Negotiation",
            # Support
            "Customer Support",
            "Zendesk",
            "Technical Support",
        ]
    }
