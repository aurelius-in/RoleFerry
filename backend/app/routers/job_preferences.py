from fastapi import APIRouter, HTTPException, Request
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
    location_text: Optional[str] = None
    work_type: List[str]
    role_type: List[str]
    company_size: List[str]
    industries: List[str]
    skills: List[str]
    minimum_salary: str
    job_search_status: str
    state: Optional[str] = None
    metro_areas: List[str] = []
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


class SuggestDeliverablesRequest(BaseModel):
    career_result: str
    positioning_level: Optional[str] = None
    role_categories: Optional[List[str]] = None
    industries: Optional[List[str]] = None

class SuggestDeliverablesResponse(BaseModel):
    success: bool
    suggestions: List[str]

@router.post("/suggest-deliverables", response_model=SuggestDeliverablesResponse)
async def suggest_deliverables(payload: SuggestDeliverablesRequest):
    """Generate 3 free deliverable ideas based on the candidate's strongest career result and positioning."""
    client = get_openai_client()
    career_result = (payload.career_result or "").strip()
    if not career_result:
        return SuggestDeliverablesResponse(success=False, suggestions=[
            "A personalized 30-day onboarding plan for their team",
            "A short audit of their current process with 3 quick-win recommendations",
            "A mini case study or example project showing your methodology",
        ])

    system = (
        "You are a Dream 100 job search coach. The candidate wants to identify a FREE DELIVERABLE "
        "they can offer hiring managers upfront — before being asked. The deliverable must be:\n"
        "- Specific to THEIR skills and track record (not generic)\n"
        "- Useful to the hiring manager immediately (not just a promise)\n"
        "- Small enough to actually make in 1-3 hours\n"
        "- Something they can offer with 'mind if I send it over?' — no hard ask\n\n"
        "Examples of good deliverables:\n"
        "- A 30-60-90 day onboarding plan for the role\n"
        "- A short process audit with 3 specific improvement recommendations\n"
        "- A sample dashboard or tracking template\n"
        "- A competitive analysis of 3 companies in their space\n"
        "- A content calendar or campaign outline for their next quarter\n\n"
        "Return ONLY valid JSON: { \"suggestions\": [\"...\", \"...\", \"...\"] } — exactly 3 ideas, each 10-20 words."
    )
    user_content = f"Career result: {career_result}"
    if payload.positioning_level:
        user_content += f"\nPositioning level: {payload.positioning_level}"
    if payload.role_categories:
        user_content += f"\nTarget roles: {', '.join(payload.role_categories[:3])}"
    if payload.industries:
        user_content += f"\nTarget industries: {', '.join(payload.industries[:3])}"

    try:
        raw = client.run_chat_completion(
            [{"role": "system", "content": system}, {"role": "user", "content": user_content}],
            temperature=0.7,
            max_tokens=300,
            stub_json={"suggestions": [
                "A 30-60-90 day onboarding plan tailored to their open role",
                "A short audit of their current process with 3 quick wins",
                "A sample project or case study demonstrating your methodology",
            ]},
        )
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        data = extract_json_from_text(str(msg.get("content") or "")) or {}
        suggestions = data.get("suggestions") or []
        if not isinstance(suggestions, list) or not suggestions:
            raise ValueError("empty suggestions")
        return SuggestDeliverablesResponse(success=True, suggestions=[str(s) for s in suggestions[:3]])
    except Exception:
        return SuggestDeliverablesResponse(success=True, suggestions=[
            "A 30-60-90 day onboarding plan tailored to their open role",
            "A short audit of their current process with 3 quick wins",
            "A sample project or case study demonstrating your methodology",
        ])


class Dream100PositioningInput(BaseModel):
    positioning_level: Optional[str] = None
    career_result: Optional[str] = None
    free_deliverable: Optional[str] = None


class Dream100TargetingRequest(BaseModel):
    preferences: JobPreferences
    dream100: Optional[Dream100PositioningInput] = None
    resume_extract: Optional[Dict[str, Any]] = None


class IdealCompanyCriteria(BaseModel):
    headcount: str = ""
    growth_signals: List[str] = []
    funding_stage: str = ""
    tech_stack_clues: List[str] = []
    content_activity: str = ""
    summary: str = ""


class ActiveNeedSignal(BaseModel):
    signal: str
    why_it_matters: str = ""


class RedFlag(BaseModel):
    flag: str
    disqualify_reason: str = ""


class ChannelPlaybookItem(BaseModel):
    channel: str
    how_to: List[str] = []
    example_search: str = ""
    url: str = ""


class ScoringFactor(BaseModel):
    factor: str
    weight: str = "medium"
    score_guide: str = ""


class ScoringRubric(BaseModel):
    overview: str = ""
    factors: List[ScoringFactor] = []
    how_to_use: str = ""


class SampleTarget(BaseModel):
    company_type: str
    team_structure: str = ""
    why_fit: str = ""
    where_to_find_contact: str = ""
    hook_angle: str = ""
    example_score: int = 7


class Dream100TargetingData(BaseModel):
    ideal_company: IdealCompanyCriteria
    active_need_signals: List[ActiveNeedSignal] = []
    red_flags: List[RedFlag] = []
    channel_playbook: List[ChannelPlaybookItem] = []
    scoring_rubric: ScoringRubric
    sample_targets: List[SampleTarget] = []


class Dream100TargetingResponse(BaseModel):
    success: bool
    message: str
    targeting: Dream100TargetingData
    used_llm: bool = False


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


def _build_boolean_search_strings(p: JobPreferences) -> Dict[str, str]:
    """Pre-built Boolean strings for job board channels."""
    role = _role_keyword_from_categories(p.role_categories or []) or "manager"
    skill = next((str(s).strip() for s in (p.skills or []) if str(s).strip()), "")
    industry = next((str(x).strip() for x in (p.industries or []) if str(x).strip()), "")
    skill_part = f' OR "{skill}"' if skill else ""
    ind_part = f' AND "{industry}"' if industry else ""
    return {
        "linkedin_jobs": f'("{role}" OR "lead {role}" OR "senior {role}"){skill_part}{ind_part}',
        "indeed": f"{role} {skill}".strip()[:60],
        "greenhouse_lever": f'site:boards.greenhouse.io OR site:jobs.lever.co "{role}" {skill}'.strip(),
        "adjacent_roles": f'("{role}" OR "director" OR "head of") AND (hiring OR "we are looking"){ind_part}',
    }


def _channel_playbook_seed(p: JobPreferences) -> List[Dict[str, Any]]:
    """Deterministic channel playbook with real URLs where possible."""
    booleans = _build_boolean_search_strings(p)
    q = quote_plus(_board_query(p, max_len=60))
    role = _role_keyword_from_categories(p.role_categories or []) or "your function"
    industries = ", ".join((p.industries or [])[:2]) or "your target industry"
    return [
        {
            "channel": "LinkedIn",
            "how_to": [
                "Search company pages in your target size/industry and follow hiring managers who post about team growth",
                "Use LinkedIn Jobs with your Boolean string, then click through to company pages of adjacent-role postings",
                "Check 'People also viewed' on profiles of hiring managers in similar companies",
                "Engage with recent posts (comment thoughtfully) before sending a connection request or DM",
            ],
            "example_search": booleans["linkedin_jobs"],
            "url": _linkedin_url(p),
        },
        {
            "channel": "Job boards (Boolean search)",
            "how_to": [
                f'LinkedIn Jobs Boolean: {booleans["linkedin_jobs"]}',
                f'Indeed search: {booleans["indeed"]}',
                f'Greenhouse/Lever discovery: {booleans["greenhouse_lever"]}',
                "Look for adjacent titles (not your exact title) — companies hiring related roles often need your function next",
            ],
            "example_search": booleans["adjacent_roles"],
            "url": f"https://www.indeed.com/jobs?q={quote_plus(booleans['indeed'])}",
        },
        {
            "channel": "Twitter / X",
            "how_to": [
                f'Search: "{role}" hiring OR "we\'re hiring" OR "join our team" + industry keywords',
                "Follow founders and operators who announce headcount milestones or product launches",
                "Reply to tweets about team building — warm engagement before cold outreach",
            ],
            "example_search": f'"{role}" (hiring OR "we are hiring") {industries}',
            "url": f"https://x.com/search?q={quote_plus(role + ' hiring')}&f=live",
        },
        {
            "channel": "Podcasts",
            "how_to": [
                f'Search Listen Notes or Apple Podcasts for "{role}" + "{industries}"',
                "Target founders/operators who've discussed building teams in your function",
                "Reference a specific episode moment in your outreach hook",
            ],
            "example_search": f"{role} {industries} podcast",
            "url": f"https://www.listennotes.com/search/?q={quote_plus(role + ' ' + industries)}",
        },
        {
            "channel": "Newsletters / Substacks",
            "how_to": [
                f'Search Substack Discover for writers in {industries} covering {role} topics',
                "Authors often run or advise at target companies — check their bio and linked companies",
                "Subscribe and engage before reaching out; reference a specific newsletter issue",
            ],
            "example_search": f"{industries} {role} substack",
            "url": f"https://substack.com/search/{quote_plus(industries + ' ' + role)}",
        },
        {
            "channel": "Communities (Slack / Discord)",
            "how_to": [
                f'Search for Slack communities in {industries} (e.g. via Slofile, Google "{industries} slack community")',
                "Join operator/founder communities where hiring managers ask for referrals",
                "Contribute value in channels before pitching — lurk first, then offer your deliverable",
            ],
            "example_search": f"{industries} slack community {role}",
            "url": "",
        },
        {
            "channel": "Crunchbase / funding announcements",
            "how_to": [
                "Filter Crunchbase for companies that raised in the last 6-12 months in your target industries",
                "Series A/B companies typically hire your function within 3-6 months of a raise",
                "Cross-reference funding news on TechCrunch with LinkedIn headcount growth signals",
            ],
            "example_search": f"{industries} funding 2025 2026",
            "url": f"https://www.crunchbase.com/discover/organization.companies/{quote_plus(industries)}",
        },
    ]


def _deterministic_dream100_targeting(p: JobPreferences, d100: Optional[Dream100PositioningInput]) -> Dream100TargetingData:
    """Fallback targeting plan when LLM is unavailable."""
    career = str((d100.career_result if d100 else "") or "").strip()
    deliverable = str((d100.free_deliverable if d100 else "") or "").strip()
    role = _role_keyword_from_categories(p.role_categories or []) or "your target role"
    sizes = ", ".join(p.company_size[:2]) if p.company_size else "50-500 employees"
    industries = ", ".join(p.industries[:3]) if p.industries else "your target industries"
    skills = ", ".join(p.skills[:4]) if p.skills else "your core skills"

    ideal = IdealCompanyCriteria(
        headcount=sizes,
        growth_signals=[
            "Headcount growing 10%+ in the last 12 months (check LinkedIn company page)",
            "Recent funding round or revenue milestone announced in the last 18 months",
            "Active job postings for adjacent roles (signals budget and hiring intent)",
        ],
        funding_stage="Series A through growth-stage (post-PMF, pre-IPO) unless you prefer enterprise",
        tech_stack_clues=[f"Uses tools/skills aligned with: {skills}"] if skills else ["Match stack to your resume skills"],
        content_activity="Founders or hiring managers posting weekly about product, team, or growth challenges",
        summary=f"Mid-market companies in {industries} that are scaling {role} capacity and show public hiring or growth signals.",
    )

    signals = [
        ActiveNeedSignal(
            signal="Multiple open roles in your function or adjacent functions",
            why_it_matters="Budget is allocated and hiring is active — not a cold guess",
        ),
        ActiveNeedSignal(
            signal="Recent funding, product launch, or geographic expansion",
            why_it_matters="Growth creates new pain points your background can address immediately",
        ),
        ActiveNeedSignal(
            signal="Hiring manager posting about team challenges, process gaps, or scaling pains",
            why_it_matters="Public pain = a ready-made hook for your deliverable offer",
        ),
        ActiveNeedSignal(
            signal="Company content mentions metrics or outcomes you have directly improved",
            why_it_matters="Your career result maps cleanly to their stated priorities",
        ),
    ]

    red_flags = [
        RedFlag(flag="Hiring freeze or recent layoffs with no growth counter-signals", disqualify_reason="No budget or appetite to hire your function right now"),
        RedFlag(flag="No identifiable decision maker reachable on LinkedIn or email", disqualify_reason="Dream 100 requires a person, not a black hole careers page"),
        RedFlag(flag="Your strongest result does not connect to any visible company pain", disqualify_reason="Outreach will feel generic and get ignored"),
    ]

    playbook_raw = _channel_playbook_seed(p)
    playbook = [ChannelPlaybookItem(**item) for item in playbook_raw]

    rubric = ScoringRubric(
        overview="Score each company 1-10 before adding to your Dream 100 list. Pursue 8+, maybe 5-7, skip below 5.",
        factors=[
            ScoringFactor(factor="Growth stage & hiring intent", weight="high", score_guide="1=frozen/shrinking, 10=actively hiring your function with budget signals"),
            ScoringFactor(factor="Likelihood of needing your function", weight="high", score_guide="1=no visible pain, 10=multiple adjacent roles open + public scaling challenges"),
            ScoringFactor(factor="Publicly visible pain points", weight="high", score_guide="1=generic company page only, 10=specific posts/news about problems you solve"),
            ScoringFactor(factor="Reachable hiring manager quality", weight="medium", score_guide="1=no LinkedIn presence, 10=active poster with clear title and email findable"),
            ScoringFactor(factor="Career result fit", weight="high", score_guide=f"1=no connection to their challenges, 10=your result ({career[:60] or 'your track record'}) directly maps to their stated priority"),
        ],
        how_to_use="Research each company for 10 minutes, score on all 5 factors, average or weight toward high factors. Only add 8+ to your active Dream 100 list.",
    )

    hook_base = deliverable or "a tailored deliverable for their team"
    career_hook = career or "relevant track record in this space"
    samples = [
        SampleTarget(
            company_type=f"Series B {industries.split(',')[0].strip() if industries else 'SaaS'} company scaling {role}",
            team_structure=f"50-200 employees, first dedicated {role} hire or small team of 2-3",
            why_fit=f"They need someone who can {career_hook} without a long ramp",
            where_to_find_contact="VP/Director on LinkedIn who posted about team growth or hiring",
            hook_angle=f"Saw you're scaling the team — put together {hook_base}. Mind if I send it?",
            example_score=9,
        ),
        SampleTarget(
            company_type=f"Growth-stage company post-funding in {industries}",
            team_structure="200-500 employees, building out a new function or replacing a departed leader",
            why_fit="Funding creates urgency; they need proven operators not learners",
            where_to_find_contact="Head of function + founder on LinkedIn; check Crunchbase for recent raise",
            hook_angle=f"Congrats on the raise — noticed you're hiring adjacent roles. I {career_hook}. Worth a quick look at {hook_base}?",
            example_score=8,
        ),
        SampleTarget(
            company_type=f"Mid-market {industries} company with visible process/ops pain",
            team_structure="100-300 employees, lean team overwhelmed by growth",
            why_fit="Public content mentions challenges your deliverable directly addresses",
            where_to_find_contact="Hiring manager who commented on industry posts in the last 30 days",
            hook_angle=f"Your post about [specific challenge] resonated — I built {hook_base} for teams in exactly this situation.",
            example_score=8,
        ),
    ]
    # Pad to 10 with varied archetypes
    extras = [
        ("Enterprise division launching new product line", "500-2000 employees, internal startup team", 7),
        ("Agency/consultancy adding a practice area", "20-100 employees, partner-led hiring", 6),
        ("PE-backed rollup consolidating operations", "Multi-site, new COO/VP mandate", 8),
        ("Remote-first startup hiring US leadership", "30-80 employees, founder still hands-on", 7),
        ("Company replacing a departed leader (backfill)", "Stable headcount, urgent backfill posting", 9),
        ("Stealth startup coming out of beta", "10-30 employees, first GTM or ops hire", 6),
        ("Nonprofit or mission org scaling impact", "50-150 employees, grant-funded growth", 5),
    ]
    for i, (ctype, team, score) in enumerate(extras):
        if len(samples) >= 10:
            break
        samples.append(SampleTarget(
            company_type=ctype,
            team_structure=team,
            why_fit=f"Your background in {role} maps to their scaling moment",
            where_to_find_contact="LinkedIn search + job board adjacent-role discovery",
            hook_angle=f"I put together {hook_base} — relevant given where you are in the growth curve.",
            example_score=score,
        ))

    return Dream100TargetingData(
        ideal_company=ideal,
        active_need_signals=signals,
        red_flags=red_flags,
        channel_playbook=playbook,
        scoring_rubric=rubric,
        sample_targets=samples[:10],
    )


@router.post("/dream100-targeting", response_model=Dream100TargetingResponse)
async def generate_dream100_targeting(payload: Dream100TargetingRequest):
    """
    Generate a full Dream 100 targeting plan: ideal company criteria, active-need signals,
    red flags, channel playbook, 1-10 scoring rubric, and 10 sample target archetypes.
    """
    p = payload.preferences
    d100 = payload.dream100
    fallback = _deterministic_dream100_targeting(p, d100)
    client = get_openai_client()

    resume = payload.resume_extract or {}
    resume_summary = ""
    if isinstance(resume, dict):
        positions = resume.get("positions") or []
        if positions and isinstance(positions[0], dict):
            resume_summary = f"{positions[0].get('title', '')} at {positions[0].get('company', '')}"
        metrics = resume.get("key_metrics") or []
        if metrics:
            resume_summary += "; metrics: " + ", ".join(
                str(m.get("metric", "")) for m in metrics[:3] if isinstance(m, dict)
            )

    ctx = {
        "preferences": p.model_dump(),
        "dream100": (d100.model_dump() if d100 else {}),
        "resume_summary": resume_summary,
        "search_urls": {
            "linkedin_jobs": _linkedin_url(p),
            "indeed": f"https://www.indeed.com/jobs?q={quote_plus(_indeed_query(p))}",
        },
        "boolean_searches": _build_boolean_search_strings(p),
        "channel_playbook_seed": _channel_playbook_seed(p),
    }

    system = (
        "You are a Dream 100 job search strategist. Build a personalized targeting plan for this candidate.\n"
        "Use ONLY the provided context. Be specific to their role categories, industries, skills, company size prefs, and career result.\n"
        "Return ONLY valid JSON with this exact structure:\n"
        "{\n"
        '  "ideal_company": {\n'
        '    "headcount": "string", "growth_signals": ["..."], "funding_stage": "string",\n'
        '    "tech_stack_clues": ["..."], "content_activity": "string", "summary": "string"\n'
        "  },\n"
        '  "active_need_signals": [{"signal": "string", "why_it_matters": "string"}],\n'
        '  "red_flags": [{"flag": "string", "disqualify_reason": "string"}],\n'
        '  "channel_playbook": [{"channel": "string", "how_to": ["step1","step2"], "example_search": "string", "url": "string"}],\n'
        '  "scoring_rubric": {\n'
        '    "overview": "string",\n'
        '    "factors": [{"factor": "string", "weight": "high|medium|low", "score_guide": "what 1 vs 10 looks like"}],\n'
        '    "how_to_use": "string"\n'
        "  },\n"
        '  "sample_targets": [{\n'
        '    "company_type": "string", "team_structure": "string", "why_fit": "string",\n'
        '    "where_to_find_contact": "string", "hook_angle": "string", "example_score": 7\n'
        "  }]\n"
        "}\n\n"
        "Requirements:\n"
        "- ideal_company: tailored to their preferences (size, industries, skills)\n"
        "- active_need_signals: exactly 4 signals that mean ACTIVELY IN NEED vs waste of time\n"
        "- red_flags: exactly 3 immediate disqualifiers\n"
        "- channel_playbook: exactly 7 channels — LinkedIn, Job boards (Boolean search), Twitter/X, Podcasts, Newsletters/Substacks, Communities (Slack/Discord), Crunchbase/funding announcements. Include concrete example_search strings and url where applicable. Merge/improve the channel_playbook_seed from context.\n"
        "- scoring_rubric: 5 factors including growth stage, likelihood of needing their function, visible pain points, hiring manager reachability, career result fit. Score guide must explain 1 vs 10 for each.\n"
        "- sample_targets: exactly 10 varied company archetypes (realistic types, not fake company names). Each needs hook_angle using their deliverable if provided.\n"
    )

    try:
        if client.should_use_real_llm:
            raw = client.run_chat_completion(
                [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(ctx, ensure_ascii=False)}],
                temperature=0.35,
                max_tokens=3500,
                stub_json=fallback.model_dump(),
            )
            choices = raw.get("choices") or []
            msg = (choices[0].get("message") if choices else {}) or {}
            data = extract_json_from_text(str(msg.get("content") or "")) or {}
            if data.get("ideal_company") and data.get("sample_targets"):
                targeting = Dream100TargetingData(**data)
                # Ensure playbook URLs from seed if LLM omitted them
                seed_by_channel = {x["channel"]: x for x in _channel_playbook_seed(p)}
                merged_playbook = []
                for item in targeting.channel_playbook:
                    seed = seed_by_channel.get(item.channel) or {}
                    merged_playbook.append(ChannelPlaybookItem(
                        channel=item.channel,
                        how_to=item.how_to or seed.get("how_to", []),
                        example_search=item.example_search or seed.get("example_search", ""),
                        url=item.url or seed.get("url", ""),
                    ))
                if merged_playbook:
                    targeting.channel_playbook = merged_playbook
                return Dream100TargetingResponse(
                    success=True,
                    message="Dream 100 targeting plan generated",
                    targeting=targeting,
                    used_llm=True,
                )
    except Exception as exc:
        logger.warning("Dream 100 targeting LLM failed: %s", exc)

    return Dream100TargetingResponse(
        success=True,
        message="Dream 100 targeting plan generated (fallback)",
        targeting=fallback,
        used_llm=False,
    )


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
            rationale="Broad results (Indeed works best with 1 main role + 0-1 skill keywords).",
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
async def save_job_preferences(preferences: JobPreferences, request: Request):
    """
    Save job preferences for the authenticated user.
    """
    try:
        from ..auth import get_current_user_optional
        auth_user = await get_current_user_optional(request)
        _user_id = auth_user.email if auth_user else DEMO_USER_ID

        store.demo_job_preferences = preferences.model_dump()

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
                await conn.execute(stmt, {"user_id": _user_id, "data": data_obj})
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
                "Keep skills to 8-12 high-signal items; remove near-duplicates.",
                "Add 1-2 domain skills that match your target industry (e.g., onboarding/activation).",
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
    """
    _user_id = user_id.strip() if user_id and user_id != "me" else DEMO_USER_ID
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
            # Only keep state when the UI could have collected it (In-Person selected).
            try:
                locs = [str(x).strip().lower() for x in (prefs_obj.location_preferences or []) if str(x).strip()]
                has_in_person = any(("in-person" in x) or ("in person" in x) for x in locs)
                if not has_in_person:
                    prefs_obj = prefs_obj.model_copy(update={"state": None})
            except Exception:
                pass
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
            # Only keep state when the UI could have collected it (In-Person selected).
            try:
                locs = [str(x).strip().lower() for x in (prefs_obj.location_preferences or []) if str(x).strip()]
                has_in_person = any(("in-person" in x) or ("in person" in x) for x in locs)
                if not has_in_person:
                    prefs_obj = prefs_obj.model_copy(update={"state": None})
            except Exception:
                pass
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

    return JobPreferencesResponse(
        success=True,
        message="No preferences saved yet",
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
            _uid = user_id.strip() if user_id and user_id != "me" else DEMO_USER_ID
            await conn.execute(stmt, {"user_id": _uid, "data": data_obj})
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
    _uid = user_id.strip() if user_id and user_id != "me" else DEMO_USER_ID
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM job_preferences WHERE user_id = :user_id"),
                {"user_id": _uid},
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
