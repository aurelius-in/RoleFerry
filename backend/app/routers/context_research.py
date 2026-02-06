from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import re
import time
import hashlib
import os

router = APIRouter()
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..config import settings
from ..services.serper_client import serper_web_search
from ..services.pdl_client import PDLClient
import logging

logger = logging.getLogger(__name__)

# Bump this when changing prompting/logic so cached results don't mask improvements.
_PROMPT_VERSION = "2026-02-06-contact-hooks-v1"

# PDL can be expensive; default OFF unless explicitly enabled.
_ENABLE_PDL = str(os.getenv("ROLEFERRY_ENABLE_PDL", "false")).lower() == "true"

class SelectedContact(BaseModel):
    id: str
    name: str
    title: str
    email: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    linkedin_url: Optional[str] = None
    # Optional PDL-derived fields (outreach-safe)
    email_source: Optional[str] = None
    location_name: Optional[str] = None
    location_country: Optional[str] = None
    job_company_website: Optional[str] = None
    job_company_linkedin_url: Optional[str] = None
    job_company_industry: Optional[str] = None
    job_company_size: Optional[str] = None

class CompanySummary(BaseModel):
    name: str
    description: str
    industry: str
    size: str
    founded: str
    headquarters: str
    website: str
    linkedin_url: Optional[str] = None

class ContactBio(BaseModel):
    name: str
    title: str
    company: str
    bio: str
    experience: str
    education: str
    skills: List[str]
    linkedin_url: Optional[str] = None
    # Optional public-profile enrichment (best-effort, should not hallucinate; empty if no sources).
    public_profile_highlights: List[str] = []
    publications: List[str] = []
    post_topics: List[str] = []
    opinions: List[str] = []
    other_interesting_facts: List[str] = []
    # Preferred: structured "hooks" with sources (only include urls that exist in corpus).
    interesting_facts: List[Dict[str, str]] = []

class RecentNews(BaseModel):
    title: str
    summary: str
    date: str
    source: str
    url: str

class ResearchData(BaseModel):
    company_summary: CompanySummary
    contact_bios: List[ContactBio]
    # Outreach "theme" guidance (not news): plausible priority + mini-plan
    theme: str = ""
    # Explicit company fields (LLM-filled). The UI uses these directly instead of scraping headings.
    company_culture_values: str = ""
    company_market_position: str = ""
    # More company fields useful for job-seekers/outreach (LLM-filled, sourced when possible).
    company_product_launches: str = ""
    company_leadership_changes: str = ""
    company_other_hiring_signals: str = ""
    company_recent_posts: str = ""
    company_publications: str = ""
    recent_news: List[RecentNews]
    shared_connections: List[str]
    # Report-style view (dynamic sections; omit low-signal headings)
    background_report_title: Optional[str] = None
    background_report_sections: Optional[List[Dict[str, Any]]] = None

class ResearchRequest(BaseModel):
    contact_ids: List[str]
    company_name: str
    # Optional: pass selected job context so we can research the right org unit for large companies.
    selected_job_description: Optional[Dict[str, Any]] = None
    # Optional: upstream context so the background report can be grounded in the candidate + role.
    resume_extract: Optional[Dict[str, Any]] = None
    painpoint_matches: Optional[List[Dict[str, Any]]] = None
    # Optional: pass full contact objects so we can generate per-contact research/bios.
    contacts: Optional[List[SelectedContact]] = None
    # Optional: UI data mode ("demo" | "live"). If "live" and keys exist, we will fetch real web/company signals.
    data_mode: Optional[str] = None

class ResearchResponse(BaseModel):
    success: bool
    message: str
    research_data: Optional[ResearchData] = None
    # Per-contact research keyed by contact id. Lets the UI switch between contacts without re-calling.
    research_by_contact: Optional[Dict[str, ResearchData]] = None
    helper: Optional[Dict[str, Any]] = None

# Simple in-process TTL cache (good enough for demo/dev; resets on restart).
_CTX_CACHE: Dict[str, Dict[str, Any]] = {}
_CTX_CACHE_TTL_SECONDS = 60 * 30  # 30 minutes

def _cache_key(payload: Dict[str, Any]) -> str:
    try:
        s = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    except Exception:
        s = str(payload)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    item = _CTX_CACHE.get(key)
    if not item:
        return None
    if (time.time() - float(item.get("ts", 0))) > _CTX_CACHE_TTL_SECONDS:
        _CTX_CACHE.pop(key, None)
        return None
    return item.get("value")

def _cache_set(key: str, value: Dict[str, Any]) -> None:
    _CTX_CACHE[key] = {"ts": time.time(), "value": value}

@router.post("/research", response_model=ResearchResponse)
async def conduct_research(request: ResearchRequest):
    """
    Conduct research on company and contacts.
    """
    try:
        # Decide whether to research company-level only or a specific division/department.
        company = (request.company_name or "").strip()
        jd = request.selected_job_description or {}
        jd_title = str(jd.get("title") or "").strip()

        BIG_COMPANIES = {
            "google",
            "alphabet",
            "microsoft",
            "amazon",
            "meta",
            "apple",
            "netflix",
            "tesla",
            "oracle",
            "ibm",
            "salesforce",
        }

        def infer_org_unit(company_name: str, job_title: str) -> Optional[str]:
            t = (job_title or "").strip()
            if not t:
                return None
            # Try to extract a clear unit from common patterns like "Role, Unit" or "Role - Unit".
            m = re.search(r"[,\\-–—]\\s*([A-Za-z][A-Za-z0-9 &/]+)$", t)
            if m:
                candidate = m.group(1).strip()
                if 3 <= len(candidate) <= 60:
                    return candidate

            low = t.lower()
            # Common large-org divisions
            if "cloud" in low:
                return "Cloud"
            if "youtube" in low:
                return "YouTube"
            if "ads" in low or "advertis" in low:
                return "Ads"
            if "search" in low:
                return "Search"
            if "android" in low:
                return "Android"
            if "maps" in low:
                return "Maps"
            if "workspace" in low or "g suite" in low:
                return "Workspace"
            if "security" in low:
                return "Security"
            if "payments" in low:
                return "Payments"
            if "ai" in low or "genai" in low or "ml" in low:
                return "AI/ML"
            return None

        is_big_company = company.lower() in BIG_COMPANIES
        org_unit = infer_org_unit(company, jd_title) if is_big_company else None
        scope_label = "division" if (is_big_company and org_unit) else "company"
        scope_target = f"{company} — {org_unit}" if (scope_label == "division") else company

        # Build a *non-fabricated* research corpus.
        # - If data_mode == "live" and SERPER_API_KEY is set, we fetch web snippets via Serper.
        # - If PDL_API_KEY is set and we have a company website from contacts, we enrich via PDL company endpoint.
        # - We never fabricate shared connections.

        def _uniq_nonempty(items: List[str]) -> List[str]:
            seen = set()
            out: List[str] = []
            for raw in items or []:
                s = str(raw or "").strip()
                if not s:
                    continue
                k = s.lower()
                if k in seen:
                    continue
                seen.add(k)
                out.append(s)
            return out

        def _signals_from_role_description(corpus_obj: Dict[str, Any]) -> List[str]:
            """
            Produce outreach-safe "hiring signals" derived from the provided role description context.
            This is NOT web research; it is grounded in the imported role/step context we already have.
            """
            try:
                title = str(corpus_obj.get("job_title") or "").strip()
                pains = [str(x).strip() for x in (corpus_obj.get("job_pain_points") or []) if str(x).strip()]
                succ = [str(x).strip() for x in (corpus_obj.get("job_success_metrics") or []) if str(x).strip()]
                skills = [str(x).strip() for x in (corpus_obj.get("job_required_skills") or []) if str(x).strip()]

                bullets: List[str] = []
                if title:
                    bullets.append(f"Hiring for: {title}.")
                if skills:
                    top = ", ".join(skills[:8])
                    bullets.append(f"Prioritizing skills: {top}.")
                if pains:
                    bullets.append(f"Current focus area: {pains[0]}.")
                    if len(pains) > 1:
                        bullets.append(f"Secondary focus area: {pains[1]}.")
                if succ:
                    bullets.append(f"Success will be measured by: {succ[0]}.")

                # Keep it concise + demo-friendly.
                out = []
                seen = set()
                for b in bullets:
                    s = str(b or "").strip()
                    if not s:
                        continue
                    k = s.lower()
                    if k in seen:
                        continue
                    seen.add(k)
                    out.append(s)
                return out[:6]
            except Exception:
                return []

        contact_company_websites = _uniq_nonempty(
            [c.job_company_website for c in (request.contacts or []) if getattr(c, "job_company_website", None)]
        )
        contact_company_linkedin = _uniq_nonempty(
            [c.job_company_linkedin_url for c in (request.contacts or []) if getattr(c, "job_company_linkedin_url", None)]
        )
        contact_company_industries = _uniq_nonempty(
            [c.job_company_industry for c in (request.contacts or []) if getattr(c, "job_company_industry", None)]
        )
        contact_company_sizes = _uniq_nonempty(
            [c.job_company_size for c in (request.contacts or []) if getattr(c, "job_company_size", None)]
        )

        data_mode = str(request.data_mode or "").strip().lower() or "demo"
        want_live = data_mode == "live"

        # Web snippets via Serper (best effort). We keep a small query budget so this stays fast.
        # We gather a richer corpus and let GPT decide which headings have enough signal.
        serper_hits: List[Dict[str, Any]] = []
        contact_serper_hits: Dict[str, List[Dict[str, Any]]] = {}
        company_serper_by_topic: Dict[str, List[Dict[str, Any]]] = {}
        contact_serper_by_topic: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

        def _serper(q: str, *, num: int = 6) -> List[Dict[str, Any]]:
            try:
                return serper_web_search(q, num=num) or []
            except Exception:
                return []

        if want_live and settings.serper_api_key:
            # Company: multiple facets
            company_queries = {
                "overview": f"{scope_target} company overview what they do",
                "news": f"{scope_target} recent news",
                "funding": f"{scope_target} funding investors valuation",
                "product": f"{scope_target} product launch partnership",
                "product_launches": f"{scope_target} product launch release announcement",
                "hiring": f"{scope_target} hiring growth layoffs",
                "leadership": f"{scope_target} leadership changes new CEO CTO CPO CFO VP",
                "culture": f"{scope_target} company culture values how it works",
                "market": f"{scope_target} competitors market position",
                "posts": f"{scope_target} blog posts engineering blog",
                "publications": f"{scope_target} whitepaper case study report publication",
            }
            serper_hits = _serper(company_queries["overview"], num=6)
            for k, q in company_queries.items():
                # Small but richer: multiple facets, keep bounded
                company_serper_by_topic[k] = _serper(q, num=6)

            # Contacts: per-contact facets (keep bounded)
            for c in contacts:
                nm = str(c.name or "").strip()
                co = str(c.company or company).strip()
                if not nm:
                    continue
                # one general query + 2 topic queries (posts/writing + talks/interviews)
                q_general = f"{nm} {co} {c.title or ''}".strip()
                q_posts = f"{nm} {co} posts articles blog LinkedIn"
                q_talks = f"{nm} {co} podcast interview conference talk"
                # If we have an explicit LinkedIn URL, bias a query toward it (public snippets only).
                li = str(getattr(c, "linkedin_url", "") or "").strip()
                q_li = f"{li} {nm} {co}".strip() if li else f'site:linkedin.com/in "{nm}" {co}'
                hits_general = _serper(q_general, num=5)
                hits_posts = _serper(q_posts, num=5)
                hits_talks = _serper(q_talks, num=5)
                hits_li = _serper(q_li, num=5)
                contact_serper_hits[c.id] = hits_general
                contact_serper_by_topic[c.id] = {
                    "general": hits_general,
                    "posts": hits_posts,
                    "talks": hits_talks,
                    "linkedin": hits_li,
                }

        # PDL company enrichment (best effort, but OFF by default due to cost)
        pdl_company: Dict[str, Any] = {}
        if _ENABLE_PDL and settings.pdl_api_key and contact_company_websites:
            try:
                pdl = PDLClient(settings.pdl_api_key)
                pdl_company = pdl.company_enrich(contact_company_websites[0]) or {}
            except Exception:
                pdl_company = {}

        # Minimal fallback website/linkedin (prefer contact-derived)
        website_guess = contact_company_websites[0] if contact_company_websites else ""
        linkedin_guess = contact_company_linkedin[0] if contact_company_linkedin else ""

        corpus = {
            "company_name": company,
            "research_scope": scope_label,
            "scope_target": scope_target,
            "job_title": jd_title,
            "job_required_skills": jd.get("required_skills") or [],
            "job_pain_points": jd.get("pain_points") or [],
            "job_success_metrics": jd.get("success_metrics") or [],
            # Candidate context (best effort). Keep these lightweight/outreach-safe.
            "resume_extract": request.resume_extract or {},
            "painpoint_matches": request.painpoint_matches or [],
            # Internal-only convenience fields (also included in the payload passed to the LLM).
            "contacts_raw": [],
            "recent_news_raw": [],
            "signals": {
                "company_websites": contact_company_websites,
                "company_linkedin_urls": contact_company_linkedin,
                "company_industries": contact_company_industries,
                "company_sizes": contact_company_sizes,
            },
            "pdl_company_enrich": pdl_company,
            "serper_hits": serper_hits,
            "contact_serper_hits": contact_serper_hits,
            "company_serper_by_topic": company_serper_by_topic,
            "contact_serper_by_topic": contact_serper_by_topic,
            "website": website_guess or "",
            "linkedin_company": linkedin_guess or "",
            "shared_connections_raw": [],
            "requested_contact_ids": request.contact_ids,
            "data_mode": data_mode,
        }

        # Convert Serper hits (when present) into a simple recent_news_raw list.
        # If Serper is not enabled/available, keep this empty (no fabricated URLs).
        try:
            for hit in (serper_hits or [])[:4]:
                if not isinstance(hit, dict):
                    continue
                title = str(hit.get("title") or "").strip()
                link = str(hit.get("link") or hit.get("url") or "").strip()
                snippet = str(hit.get("snippet") or "").strip()
                if not (title and link):
                    continue
                corpus["recent_news_raw"].append(
                    {
                        "title": title[:140],
                        "summary": snippet[:240],
                        "date": "Unknown",
                        "source": str(hit.get("source") or "web"),
                        "url": link,
                    }
                )
        except Exception:
            corpus["recent_news_raw"] = []

        # Prefer full contact objects when available; otherwise derive placeholders from ids.
        contacts: List[SelectedContact] = []
        if request.contacts:
            contacts = request.contacts
        else:
            for cid in request.contact_ids:
                contacts.append(
                    SelectedContact(
                        id=cid,
                        name=f"Contact {cid}",
                        title="Decision Maker",
                        company=company,
                    )
                )

        # Cache: key on company + scope + JD title + selected contacts (id/name/title/department).
        cache_payload = {
            "company": company,
            "scope_label": scope_label,
            "scope_target": scope_target,
            "jd_title": jd_title,
            "contact_ids": request.contact_ids,
            "data_mode": data_mode,
            "prompt_version": _PROMPT_VERSION,
            "contacts": [
                {
                    "id": c.id,
                    "name": c.name,
                    "title": c.title,
                    "company": c.company,
                    "department": c.department,
                    "level": c.level,
                    "linkedin_url": c.linkedin_url,
                }
                for c in contacts
            ],
        }
        ck = _cache_key(cache_payload)
        cached = _cache_get(ck)
        if cached:
            return ResearchResponse(**cached)

        def _dept_bucket(c: SelectedContact) -> str:
            t = f"{c.title or ''} {c.department or ''}".lower()
            if any(k in t for k in ["talent", "recruit", "people", "hr"]):
                return "talent"
            if any(k in t for k in ["engineer", "platform", "sre", "devops", "cto", "vp eng", "director eng"]):
                return "engineering"
            if any(k in t for k in ["product", "pm", "growth"]):
                return "product"
            return "general"

        def _contact_highlights(c: SelectedContact) -> List[str]:
            bucket = _dept_bucket(c)
            if bucket == "talent":
                return [
                    "Owns hiring strategy, time-to-fill, and pipeline quality",
                    "Cares about signal, speed, and candidate experience",
                ]
            if bucket == "engineering":
                return [
                    "Optimizes delivery velocity, reliability, and engineering leverage",
                    "Cares about headcount ROI, team structure, and execution risk",
                ]
            if bucket == "product":
                return [
                    "Focuses on roadmap outcomes, adoption, and user value",
                    "Cares about iteration speed and cross-functional execution",
                ]
            return [
                "Focused on measurable outcomes and operational execution",
                "Cares about low-risk, high-leverage improvements",
            ]

        for c in contacts:
            corpus["contacts_raw"].append(
                {
                    "id": c.id,
                    "name": c.name,
                    "title": c.title,
                    "company": c.company or company,
                    "email": c.email,
                    "email_source": c.email_source,
                    "department": c.department,
                    "level": c.level,
                    "linkedin_url": c.linkedin_url,
                    "location_name": c.location_name,
                    "location_country": c.location_country,
                    "job_company_website": c.job_company_website,
                    "job_company_linkedin_url": c.job_company_linkedin_url,
                    "job_company_industry": c.job_company_industry,
                    "job_company_size": c.job_company_size,
                    "highlights": _contact_highlights(c),
                }
            )

        client = get_openai_client()

        def _build_stub_for_contact(c: SelectedContact) -> Dict[str, Any]:
            bucket = _dept_bucket(c)
            dept_phrase = (c.department or "").strip()
            if not dept_phrase:
                dept_phrase = "their org"

            # Minimal, non-fabricated baseline description derived from available signals.
            base_desc = ""
            try:
                if corpus.get("serper_hits"):
                    base_desc = str((corpus["serper_hits"][0] or {}).get("snippet") or "").strip()
            except Exception:
                base_desc = ""
            if not base_desc:
                try:
                    base_desc = str((corpus.get("pdl_company_enrich") or {}).get("summary") or (corpus.get("pdl_company_enrich") or {}).get("description") or "").strip()
                except Exception:
                    base_desc = ""
            if not base_desc:
                # When we have no web/company enrichment, avoid "backend unavailable" style messages.
                # Keep it explicitly limited but still usable for drafting without sounding like the system gave up.
                base_desc = f"High-level overview for {scope_target}."
            if bucket == "engineering":
                tailored = (
                    f"{base_desc} Tailored for engineering leadership: emphasize delivery velocity, reliability, "
                    f"cost, and hiring leverage for {dept_phrase}."
                )
                skills = ["Leadership", "Platform engineering", "Reliability", "Hiring"]
            elif bucket == "talent":
                tailored = (
                    f"{base_desc} Tailored for talent leadership: emphasize signal quality, pipeline speed, "
                    f"candidate experience, and measurable time-to-fill improvements for {dept_phrase}."
                )
                skills = ["Talent strategy", "Sourcing", "Hiring ops", "Stakeholder alignment"]
            elif bucket == "product":
                tailored = (
                    f"{base_desc} Tailored for product leadership: emphasize roadmap outcomes, adoption, "
                    f"and faster iteration for {dept_phrase}."
                )
                skills = ["Product strategy", "Execution", "Analytics", "Cross-functional leadership"]
            else:
                tailored = f"{base_desc} Tailored for outreach to {c.title or 'a decision maker'}."
                skills = ["Leadership", "Execution", "Measurement"]

            # Recent news: only include items when we actually have Serper hits.
            contact_news: List[Dict[str, Any]] = []
            if corpus.get("recent_news_raw"):
                for n in (corpus.get("recent_news_raw") or [])[:2]:
                    if isinstance(n, dict):
                        contact_news.append(
                            {
                                "title": str(n.get("title") or ""),
                                "summary": str(n.get("summary") or ""),
                                "date": str(n.get("date") or ""),
                                "source": str(n.get("source") or ""),
                                "url": str(n.get("url") or ""),
                            }
                        )

            return {
                "company_summary": {
                    "name": scope_target,
                    "description": tailored,
                        # Avoid low-confidence industry/size guesses in stub mode; prefer Unknown unless we have enriched data.
                        "industry": str((corpus.get("pdl_company_enrich") or {}).get("industry") or "Unknown"),
                        "size": str((corpus.get("pdl_company_enrich") or {}).get("size") or "Unknown"),
                        "founded": "Unknown",
                        "headquarters": "Unknown",
                        "website": corpus.get("website") or "Unknown",
                        "linkedin_url": corpus.get("linkedin_company") or None,
                },
                "theme": (
                    "Theme: What the company likely cares about: Reference a plausible priority (customer experience, reliability, speed, cost) "
                    "and offer a 2–3 bullet mini-plan—without claiming a specific news event.\n"
                    "- Start with one concrete outcome tied to the role\n"
                    "- Propose a low-risk first sprint (instrument → ship → measure)\n"
                    "- Share a weekly reporting cadence"
                ),
                "company_culture_values": (
                    "Likely values pragmatic execution, clear ownership, and tight feedback loops. "
                    "For outreach, mirror their tone: concise, specific, and evidence-led. "
                    "Ask about how teams prioritize week-to-week, how decisions are documented, and how cross-functional alignment happens."
                ),
                "company_market_position": (
                    "Position this company based on what they sell and who they sell to (B2B vs B2C), then discuss what matters now: "
                    "differentiation, speed of iteration, reliability, and cost. "
                    "In outreach, reference a plausible competitive pressure and offer a small, measurable improvement you’d drive first."
                ),
                "company_product_launches": (
                    "- Product launches: Not available in stub mode. In Live mode, this will summarize recent releases/announcements found on the web."
                ),
                "company_leadership_changes": (
                    "- Leadership changes: Not available in stub mode. In Live mode, this will summarize recent leadership moves found on the web."
                ),
                "company_other_hiring_signals": (
                    "- Other hiring signals: Not available in stub mode. In Live mode, this will summarize signals like expansions, new offices, funding, or org changes."
                ),
                "company_recent_posts": (
                    "- Recent posts: Not available in stub mode. In Live mode, this will summarize recent blog/press/LinkedIn posts with links."
                ),
                "company_publications": (
                    "- Publications: Not available in stub mode. In Live mode, this will summarize case studies/whitepapers/reports with links."
                ),
                "contact_bios": [
                    {
                        "name": c.name,
                        "title": c.title,
                        "company": c.company or company,
                        "bio": (
                            f"{c.name} is a {c.title} at {c.company or company}. "
                            f"Likely cares about outcomes, execution risk, and pragmatic improvements aligned to their team."
                        ),
                        "experience": "Unknown",
                        "education": "Unknown",
                        "skills": skills,
                        "linkedin_url": c.linkedin_url,
                        "interesting_facts": [],
                    }
                ],
                "recent_news": contact_news,
                "shared_connections": [],
                "background_report_title": "Contact Background Report",
                "background_report_sections": [
                    {
                        "heading": "What to personalize (based on their role)",
                        "body": (
                            f"Personalize your opener to {c.title} by connecting the role you’re pursuing ({corpus.get('job_title') or 'the role'}) "
                            f"to a likely priority for {dept_phrase}. Mention one specific problem-to-solve from the job posting (pain points / responsibilities), "
                            f"then offer one concrete proof point from your resume (a shipped project, a metric, or a scoped mini-plan). "
                            f"Keep it grounded: no big claims, just a crisp 'here’s what I’d improve first' tied to a measurable outcome."
                        ),
                        "sources": [],
                    }
                ],
                "hooks": [
                    "Connect the job’s top pain point to a specific outcome you’ve delivered before",
                    "Reference their org’s likely constraints (speed vs reliability vs cost) and offer a low-risk first step",
                    "Offer a 2–3 bullet mini-plan tied to a KPI the role is accountable for",
                ],
            }

        # Single-call summarization: ask the model to return per-contact research keyed by contact id.
        stub_research_by_contact: Dict[str, Any] = {}
        for c in contacts:
            stub_research_by_contact[c.id] = _build_stub_for_contact(c)

        stub_json = {
            "research_by_contact": stub_research_by_contact,
            "hooks": [
                "Open with a specific outcome you can improve in 2–3 weeks",
                "Reference a relevant initiative/news item as timing",
                "Offer a concrete mini-plan instead of a generic pitch",
            ],
        }

        # Pydantic v1/v2 compatibility
        contacts_dump = [
            (c.model_dump() if hasattr(c, "model_dump") else c.dict()) for c in contacts
        ]

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a company + contact research summarizer for outreach.\n\n"
                    "Given a research corpus JSON (raw provider outputs) and a list of selected contacts, "
                    "produce per-contact structured research.\n\n"
                    "If research_scope is 'division', focus the company_summary on the scope_target org (division/team), "
                    "not the entire company.\n\n"
                    "Rules:\n"
                    "- Prefer facts from the corpus JSON when available.\n"
                    "- Do NOT include meta/system disclaimers like '(no external lookup used)' in any user-facing text.\n"
                    "- If the corpus has no web snippets/enrichment (serper_hits empty and pdl_company_enrich empty), you SHOULD still try:\n"
                    "  - Use general model knowledge to write a useful company description (what they sell, who they sell to, and the buying motion).\n"
                    "  - Populate industry/size/headquarters/website/linkedin_url ONLY if you are confident (well-known company) — otherwise 'Unknown'.\n"
                    "  - Never invent specific numbers (revenue, headcount) or specific dates.\n"
                    "  - Never invent 'recent_news' URLs.\n"
                    "  - recent_news MUST be actual news items from the corpus serper hits (with real URLs). If you don't have serper sources, return recent_news: [].\n"
                    "  - IMPORTANT: company_market_position MUST be sourced. If serper_hits is empty, set company_market_position to an empty string.\n"
                    "  - theme is NOT news. Always populate theme with safe, non-claiming outreach guidance using this exact sentence, then add a 2–3 bullet mini-plan:\n"
                    "    \"Theme: What the company likely cares about: Reference a plausible priority (customer experience, reliability, speed, cost) and offer a 2–3 bullet mini-plan—without claiming a specific news event.\"\n"
                    "- If information is missing or uncertain, set fields to 'Unknown' or empty lists.\n"
                    "- shared_connections MUST be an empty array unless provided (it is empty in this corpus).\n\n"
                    "Quality bar:\n"
                    "- The company_summary.description should be 2–4 sentences and outreach-useful (what they do + why it matters + likely priorities).\n"
                    "- company_culture_values should be 4–8 sentences: how they likely operate + values signals (avoid claiming a specific internal culture doc).\n"
                    "- company_market_position should be 4–8 sentences: who they compete with / positioning / what matters now.\n"
                    "  - Write assertively when sourced (no filler like 'likely', 'may', 'appears').\n"
                    "  - If you don't have sources, leave it empty.\n"
                    "- company_product_launches should be 3–8 bullet points about recent launches/releases/announcements (with URLs if available in corpus).\n"
                    "- company_leadership_changes should be 2–6 bullet points on exec/VP changes or notable leadership moves (with URLs if available in corpus).\n"
                    "- company_other_hiring_signals should be 3–8 bullet points on hiring momentum signals beyond generic 'open roles' (with URLs if available).\n"
                    "- company_recent_posts should be 3–8 bullets summarizing recent company posts (blog/press/LinkedIn topics) with URLs when available.\n"
                    "- company_publications should be 1–6 bullets summarizing notable publications (case studies, whitepapers, reports) with URLs when available.\n"
                    "- contact_bios.bio should be 1–2 sentences tailored to the contact's title/department.\n"
                    "- If the corpus includes contact_serper_by_topic for a contact (posts/talks/linkedin) with real URLs, you MUST populate contact_bios[0].interesting_facts with 3–6 items.\n"
                    "  - Each interesting_facts item must be { fact, source_title, source_url }.\n"
                    "  - fact should be a punchy outreach hook (<= 140 chars), grounded in the snippet and safe to reference.\n"
                    "  - source_url must be a real URL from the corpus for that contact. Do NOT fabricate.\n"
                    "- hooks should be 4–8 punchy, concrete outreach angles (no fluff), grounded in the job pain_points / success_metrics if present.\n\n"
                    "Grounding rules for the Contact Background Report:\n"
                    "- If resume_extract or painpoint_matches are provided, use them to make the report SPECIFIC.\n"
                    "  Example: cite 1 job pain point + 1 resume proof point + a recommended first 2–3 steps.\n"
                    "- Avoid generic coaching language. Make it a brief intelligence brief, not advice.\n\n"
                    "Contact Background Report (dynamic sections):\n"
                    "- Build a report titled 'Contact Background Report' for each contact, containing ~20 possible headings.\n"
                    "- Only INCLUDE a heading if you have at least ~2 sentences of useful, outreach-relevant info for it.\n"
                    "- Use ONLY facts/snippets from the provided corpus when serper is present.\n"
                    "- If serper is missing, you may write general, clearly non-claiming themes, but do not pretend they are sourced.\n"
                    "- Avoid sensitive personal data; keep it outreach-safe.\n\n"
                    "Candidate headings to consider (omit if empty/low-signal):\n"
                    "1) Role summary (what they own)\n"
                    "2) Current priorities / initiatives (from public snippets)\n"
                    "3) Team / org context\n"
                    "4) Recent posts or articles (topics + tone)\n"
                    "5) Interviews / talks / podcasts\n"
                    "6) Publications / writing\n"
                    "7) Public opinions / hot takes (only if explicitly present)\n"
                    "8) Career highlights\n"
                    "9) Past companies / domain experience\n"
                    "10) Hiring / team growth signals\n"
                    "11) Tools/stack they mention\n"
                    "12) Communities / affiliations\n"
                    "13) Awards / recognition\n"
                    "14) Conferences / events\n"
                    "15) Company news relevant to them\n"
                    "16) Product / market moves\n"
                    "17) Company culture / values signals\n"
                    "18) Risks / constraints (compliance, security, etc.)\n"
                    "19) Outreach personalization angles\n"
                    "20) Other notable bits\n\n"
                    "Return ONLY a JSON object with keys:\n"
                    "- research_by_contact: object keyed by contact id.\n"
                    "  Each value must be an object with keys:\n"
                    "  - company_summary: { name, description, industry, size, founded, headquarters, website, linkedin_url }\n"
                    "  - contact_bios: array of { name, title, company, bio, experience, education, skills, linkedin_url,\n"
                    "      public_profile_highlights, publications, post_topics, opinions, other_interesting_facts, interesting_facts }\n"
                    "  - theme: string\n"
                    "  - company_culture_values: string\n"
                    "  - company_market_position: string\n"
                    "  - company_product_launches: string\n"
                    "  - company_leadership_changes: string\n"
                    "  - company_other_hiring_signals: string\n"
                    "  - company_recent_posts: string\n"
                    "  - company_publications: string\n"
                    "  - recent_news: array of { title, summary, date, source, url }\n"
                    "  - shared_connections: array of strings\n"
                    "  - background_report_title: string\n"
                    "  - background_report_sections: array of { heading: string, body: string, sources: array of { title, url } }\n"
                    "- hooks: array of short talking points for outreach\n"
                ),
            },
            {"role": "user", "content": json.dumps({**corpus, "selected_contacts": contacts_dump})},
        ]

        raw = client.run_chat_completion(messages, temperature=0.2, max_tokens=1400, stub_json=stub_json)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or stub_json

        rb = data.get("research_by_contact") or stub_json["research_by_contact"]
        hooks = data.get("hooks") or stub_json["hooks"]

        research_by_contact: Dict[str, ResearchData] = {}
        for cid, entry in (rb.items() if isinstance(rb, dict) else []):
            if not isinstance(entry, dict):
                continue
            cs = entry.get("company_summary") or {}
            bios = entry.get("contact_bios") or []
            news = entry.get("recent_news") or []
            theme = str(entry.get("theme") or "").strip()
            culture_values = str(entry.get("company_culture_values") or "").strip()
            market_position = str(entry.get("company_market_position") or "").strip()
            product_launches = str(entry.get("company_product_launches") or "").strip()
            leadership_changes = str(entry.get("company_leadership_changes") or "").strip()
            other_hiring_signals = str(entry.get("company_other_hiring_signals") or "").strip()
            recent_posts = str(entry.get("company_recent_posts") or "").strip()
            publications = str(entry.get("company_publications") or "").strip()
            connections = entry.get("shared_connections") or []
            report_title = str(entry.get("background_report_title") or "Contact Background Report").strip() or "Contact Background Report"
            report_sections = entry.get("background_report_sections") or []
            if not isinstance(report_sections, list):
                report_sections = []

            # Ensure theme is always populated (theme is NOT news).
            try:
                if not theme:
                    pains = [str(x) for x in (corpus.get("job_pain_points") or []) if str(x).strip()]
                    succ = [str(x) for x in (corpus.get("job_success_metrics") or []) if str(x).strip()]
                    plan: List[str] = []
                    if pains:
                        plan.append(f"- Start with one concrete pain point: {pains[0]}")
                    if succ:
                        plan.append(f"- Tie it to a measurable outcome: {succ[0]}")
                    plan.append("- Mini-plan: instrument → ship 1 improvement → measure → iterate")
                    plan = plan[:3]

                    theme = (
                        "Theme: What the company likely cares about: Reference a plausible priority (customer experience, reliability, speed, cost) "
                        "and offer a 2–3 bullet mini-plan—without claiming a specific news event.\n"
                        + "\n".join(plan)
                    ).strip()
            except Exception:
                pass

            # Enforce: recent_news should only contain actual news with real URLs.
            cleaned_news: List[Dict[str, Any]] = []
            try:
                for n in (news if isinstance(news, list) else []):
                    if not isinstance(n, dict):
                        continue
                    title = str(n.get("title") or "").strip()
                    url = str(n.get("url") or "").strip()
                    source = str(n.get("source") or "").strip()
                    if title.lower().startswith("theme:"):
                        continue
                    if not url:
                        continue
                    if source.lower() == "general_knowledge":
                        continue
                    cleaned_news.append(n)
            except Exception:
                cleaned_news = []
            news = cleaned_news

            # Ensure culture is always populated in LLM mode (use safe, non-claiming defaults).
            # Market position should be sourced; avoid generic "likely/may" filler in demos.
            try:
                if not culture_values:
                    culture_values = (
                        "Culture & values (best-effort): Based on public signals, describe how the company likely operates "
                        "(speed vs rigor, autonomy vs process, customer focus, and decision-making). "
                        "Avoid claiming specific internal policies; keep it as plausible, outreach-useful themes."
                    )
                # Only fill market_position when we had web sources; otherwise keep empty (the UI can prompt to configure SERPER).
                if not market_position and corpus.get("serper_hits"):
                    market_position = ""
                if not product_launches:
                    product_launches = "No product launch details captured in this run. Try Live mode with SERPER configured."
                if not leadership_changes:
                    leadership_changes = "No leadership change details captured in this run. Try Live mode with SERPER configured."
                if not other_hiring_signals:
                    role_bullets = _signals_from_role_description(corpus)
                    if role_bullets:
                        other_hiring_signals = "Signals from the imported role description:\n- " + "\n- ".join(role_bullets)
                    else:
                        other_hiring_signals = ""
                if not recent_posts:
                    recent_posts = "No recent posts captured in this run. Try Live mode with SERPER configured."
                if not publications:
                    publications = "No publications captured in this run. Try Live mode with SERPER configured."
            except Exception:
                pass

            research_by_contact[str(cid)] = ResearchData(
                company_summary=CompanySummary(
                    name=str(cs.get("name") or request.company_name),
                    description=str(cs.get("description") or "Unknown"),
                    industry=str(cs.get("industry") or "Unknown"),
                    size=str(cs.get("size") or "Unknown"),
                    founded=str(cs.get("founded") or "Unknown"),
                    headquarters=str(cs.get("headquarters") or "Unknown"),
                    website=str(cs.get("website") or (corpus.get("website") or "Unknown")),
                    linkedin_url=(str(cs.get("linkedin_url")).strip() if cs.get("linkedin_url") else (corpus.get("linkedin_company") or None)),
                ),
                contact_bios=[
                    ContactBio(
                        name=str(b.get("name") or ""),
                        title=str(b.get("title") or ""),
                        company=str(b.get("company") or request.company_name),
                        bio=str(b.get("bio") or ""),
                        experience=str(b.get("experience") or ""),
                        education=str(b.get("education") or ""),
                        skills=[str(s) for s in (b.get("skills") or [])],
                        linkedin_url=b.get("linkedin_url"),
                        public_profile_highlights=[str(x) for x in (b.get("public_profile_highlights") or [])][:8],
                        publications=[str(x) for x in (b.get("publications") or [])][:6],
                        post_topics=[str(x) for x in (b.get("post_topics") or [])][:10],
                        opinions=[str(x) for x in (b.get("opinions") or [])][:8],
                        other_interesting_facts=[str(x) for x in (b.get("other_interesting_facts") or [])][:8],
                        interesting_facts=[
                            {
                                "fact": str((x or {}).get("fact") or "").strip(),
                                "source_title": str((x or {}).get("source_title") or "").strip(),
                                "source_url": str((x or {}).get("source_url") or "").strip(),
                            }
                            for x in (b.get("interesting_facts") or [])
                            if isinstance(x, dict) and str((x or {}).get("fact") or "").strip()
                        ][:8],
                    )
                    for b in bios
                    if isinstance(b, dict)
                ],
                theme=theme,
                company_culture_values=culture_values,
                company_market_position=market_position,
                company_product_launches=product_launches,
                company_leadership_changes=leadership_changes,
                company_other_hiring_signals=other_hiring_signals,
                company_recent_posts=recent_posts,
                company_publications=publications,
                recent_news=[
                    RecentNews(
                        title=str(n.get("title") or ""),
                        summary=str(n.get("summary") or ""),
                        date=str(n.get("date") or ""),
                        source=str(n.get("source") or ""),
                        url=str(n.get("url") or ""),
                    )
                    for n in news
                    if isinstance(n, dict)
                ],
                # Never surface fake shared connections.
                shared_connections=[],
                background_report_title=report_title,
                background_report_sections=report_sections[:24],
            )

        # Back-compat: also return a single research_data (first contact).
        first_id = contacts[0].id if contacts else (request.contact_ids[0] if request.contact_ids else "")
        research_data = research_by_contact.get(first_id) if first_id else None

        resp_obj = ResearchResponse(
            success=True,
            message="Research completed successfully",
            research_data=research_data,
            research_by_contact=research_by_contact,
            helper={
                "hooks": [str(h) for h in hooks][:6],
                "research_scope": scope_label,
                "scope_target": scope_target,
                "corpus_preview": {
                    "serper_hits": corpus.get("serper_hits", []),
                    "pdl_company_enrich": corpus.get("pdl_company_enrich", {}),
                },
            },
        )
        _cache_set(ck, resp_obj.model_dump() if hasattr(resp_obj, "model_dump") else resp_obj.dict())
        return resp_obj
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to conduct research: {str(e)}")

@router.post("/save", response_model=ResearchResponse)
async def save_research_data(research_data: ResearchData):
    """
    Save research data for a user.
    """
    try:
        # In a real app, save to database with user_id
        return ResearchResponse(
            success=True,
            message="Research data saved successfully",
            research_data=research_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save research data: {str(e)}")

@router.get("/{user_id}", response_model=ResearchResponse)
async def get_research_data(user_id: str):
    """
    Get research data for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data (no fabricated shared connections).
        mock_research_data = ResearchData(
            company_summary=CompanySummary(
                name="TechCorp Inc.",
                description="TechCorp is a leading enterprise software company specializing in cloud infrastructure solutions.",
                industry="Enterprise Software",
                size="501-1,000 employees",
                founded="2015",
                headquarters="San Francisco, CA",
                website="https://techcorp.com",
                linkedin_url="https://linkedin.com/company/techcorp"
            ),
            contact_bios=[
                ContactBio(
                    name="Sarah Johnson",
                    title="VP of Engineering",
                    company="TechCorp Inc.",
                    bio="Sarah Johnson is a VP of Engineering with extensive experience in technology leadership.",
                    experience="10+ years in technology leadership roles",
                    education="MBA from Stanford University",
                    skills=["Leadership", "Strategic Planning", "Team Management"],
                    linkedin_url="https://linkedin.com/in/sarahjohnson"
                )
            ],
            theme=(
                "Theme: What the company likely cares about: Reference a plausible priority (customer experience, reliability, speed, cost) "
                "and offer a 2–3 bullet mini-plan—without claiming a specific news event.\n"
                "- Start with a concrete customer outcome + one KPI\n"
                "- Propose a low-risk first sprint (instrument → ship → measure)\n"
                "- Close with a weekly reporting cadence"
            ),
            company_culture_values="Likely values execution, reliability, and clear ownership. Expect emphasis on measurable outcomes and crisp cross-functional communication.",
            company_market_position="Competes in enterprise cloud infrastructure; differentiation likely centers on reliability, performance, and cost. Near-term priorities likely include scaling, reducing risk, and tightening customer experience.",
            company_product_launches="- Example launch: New platform feature announced (replace with real sources in Live mode).",
            company_leadership_changes="- Example: Leadership move noted (replace with real sources in Live mode).",
            company_other_hiring_signals="- Example: Hiring signal noted (replace with real sources in Live mode).",
            company_recent_posts="- Example post: Blog/press topic (replace with real sources in Live mode).",
            company_publications="- Example publication: Case study/whitepaper (replace with real sources in Live mode).",
            recent_news=[
                RecentNews(
                    title="TechCorp Announces $50M Series C Funding Round",
                    summary="The company plans to use the funding to expand its engineering team.",
                    date="2024-01-15",
                    source="TechCrunch",
                    url="https://techcrunch.com/techcorp-funding"
                )
            ],
            shared_connections=[]
        )
        
        return ResearchResponse(
            success=True,
            message="Research data retrieved successfully",
            research_data=mock_research_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get research data: {str(e)}")

@router.put("/{user_id}", response_model=ResearchResponse)
async def update_research_data(user_id: str, research_data: ResearchData):
    """
    Update research data for a user.
    """
    try:
        # In a real app, update in database
        return ResearchResponse(
            success=True,
            message="Research data updated successfully",
            research_data=research_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update research data: {str(e)}")

@router.delete("/{user_id}")
async def delete_research_data(user_id: str):
    """
    Delete research data for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Research data deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete research data: {str(e)}")

@router.get("/variables/{user_id}")
async def get_available_variables(user_id: str):
    """
    Get available variables for email templates.
    """
    try:
        # In a real app, this would return actual variable data
        variables = {
            "company_summary": "Company description and key information",
            "contact_bio": "Contact's professional background and experience",
            "recent_news": "Latest news and updates about the company",
            "company_theme": "Theme: what the company likely cares about + mini-plan (not news)",
            "company_product_launches": "Recent product launches/releases (best-effort, sourced when possible)",
            "company_leadership_changes": "Leadership changes / exec moves (best-effort, sourced when possible)",
            "company_other_hiring_signals": "Other hiring signals beyond open roles (best-effort, sourced when possible)",
            "company_recent_posts": "Recent company posts/topics (blog/press/LinkedIn) with links when possible",
            "company_publications": "Publications (whitepapers/case studies/reports) with links when possible",
            "shared_connections": "Mutual connections and relationships",
            "company_industry": "Company's industry and sector",
            "company_size": "Number of employees and company size",
            "company_headquarters": "Company's main office location"
        }
        
        return {
            "success": True,
            "variables": variables,
            "message": "Available variables retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get variables: {str(e)}")
