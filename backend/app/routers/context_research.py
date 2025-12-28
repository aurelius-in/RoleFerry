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
_PROMPT_VERSION = "2025-12-28-company-research-v2"

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

class RecentNews(BaseModel):
    title: str
    summary: str
    date: str
    source: str
    url: str

class ResearchData(BaseModel):
    company_summary: CompanySummary
    contact_bios: List[ContactBio]
    recent_news: List[RecentNews]
    shared_connections: List[str]

class ResearchRequest(BaseModel):
    contact_ids: List[str]
    company_name: str
    # Optional: pass selected job context so we can research the right org unit for large companies.
    selected_job_description: Optional[Dict[str, Any]] = None
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

        # Web snippets via Serper (best effort)
        serper_hits: List[Dict[str, Any]] = []
        if want_live and settings.serper_api_key:
            try:
                serper_hits = serper_web_search(f"{scope_target} company", num=6)
            except Exception:
                serper_hits = []

        # Per-contact web snippets (best effort) for "public profile insights".
        contact_serper_hits: Dict[str, List[Dict[str, Any]]] = {}
        if want_live and settings.serper_api_key:
            for c in contacts:
                try:
                    q_parts = [str(c.name or "").strip(), str(c.company or company).strip()]
                    if c.linkedin_url:
                        q_parts.append(str(c.linkedin_url).strip())
                    # Bias toward public writing/topics
                    q_parts.append("LinkedIn posts articles")
                    q = " ".join([p for p in q_parts if p]).strip()
                    if not q:
                        continue
                    contact_serper_hits[c.id] = serper_web_search(q, num=4) or []
                except Exception:
                    contact_serper_hits[c.id] = []

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
                base_desc = f"High-level overview for {scope_target} (no external web lookup used)."
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
                        "industry": (corpus.get("signals") or {}).get("company_industries", ["Unknown"])[0] if (corpus.get("signals") or {}).get("company_industries") else "Unknown",
                        "size": (corpus.get("signals") or {}).get("company_sizes", ["Unknown"])[0] if (corpus.get("signals") or {}).get("company_sizes") else "Unknown",
                        "founded": "Unknown",
                        "headquarters": "Unknown",
                        "website": corpus.get("website") or "Unknown",
                        "linkedin_url": corpus.get("linkedin_company") or None,
                },
                "contact_bios": [
                    {
                        "name": c.name,
                        "title": c.title,
                        "company": c.company or company,
                        "bio": (
                            f"{c.name} is a {c.title} at {c.company or company}. "
                            f"Likely cares about measurable outcomes, speed, and low-risk improvements."
                        ),
                        "experience": "10+ years in leadership roles with measurable outcomes.",
                        "education": "BS Computer Science; ongoing executive training",
                        "skills": skills,
                        "linkedin_url": c.linkedin_url,
                    }
                ],
                "recent_news": contact_news,
                "shared_connections": [],
                "hooks": [
                    "Open with a specific outcome you can improve in 2–3 weeks",
                    "Reference a relevant initiative/news item as timing",
                    "Offer a concrete mini-plan instead of a generic pitch",
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
                    "- If the corpus has no web snippets/enrichment (serper_hits empty and pdl_company_enrich empty), you SHOULD still try:\n"
                    "  - Use general model knowledge to write a useful company description (what they sell, who they sell to, and the buying motion).\n"
                    "  - Populate industry/size/headquarters/website/linkedin_url ONLY if you are confident (well-known company) — otherwise 'Unknown'.\n"
                    "  - Never invent specific numbers (revenue, headcount) or specific dates.\n"
                    "  - Never invent 'recent_news' URLs.\n"
                    "  - If no serper_hits, you MAY still include 1–3 outreach-useful timing themes in recent_news,\n"
                    "    BUT you must set url to an empty string and source to 'general_knowledge' (clearly unsourced).\n"
                    "    Use date=''. These should read like \"Themes to mention\" not claimed headlines.\n"
                    "- If information is missing or uncertain, set fields to 'Unknown' or empty lists.\n"
                    "- shared_connections MUST be an empty array unless provided (it is empty in this corpus).\n\n"
                    "Quality bar:\n"
                    "- The company_summary.description should be 2–4 sentences and outreach-useful (what they do + why it matters + likely priorities).\n"
                    "- contact_bios.bio should be 1–2 sentences tailored to the contact's title/department.\n"
                    "- hooks should be 4–8 punchy, concrete outreach angles (no fluff), grounded in the job pain_points / success_metrics if present.\n\n"
                    "Return ONLY a JSON object with keys:\n"
                    "- research_by_contact: object keyed by contact id.\n"
                    "  Each value must be an object with keys:\n"
                    "  - company_summary: { name, description, industry, size, founded, headquarters, website, linkedin_url }\n"
                    "  - contact_bios: array of { name, title, company, bio, experience, education, skills, linkedin_url,\n"
                    "      public_profile_highlights, publications, post_topics, opinions, other_interesting_facts }\n"
                    "  - recent_news: array of { title, summary, date, source, url }\n"
                    "  - shared_connections: array of strings\n"
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
            connections = entry.get("shared_connections") or []

            # If we have no Serper sources and the model returned no "recent_news",
            # generate a few safe, unsourced timing themes so the UI isn't empty.
            try:
                if (not corpus.get("serper_hits")) and (not news):
                    pains = [str(x) for x in (corpus.get("job_pain_points") or []) if str(x).strip()]
                    skills = [str(x) for x in (corpus.get("job_required_skills") or []) if str(x).strip()]
                    succ = [str(x) for x in (corpus.get("job_success_metrics") or []) if str(x).strip()]

                    themes: List[Dict[str, Any]] = []
                    if pains or succ:
                        themes.append(
                            {
                                "title": "Theme: Outcomes + metrics for this role",
                                "summary": (
                                    f"Tie your message to measurable outcomes ({', '.join(succ[:2])}) and the main pain points "
                                    f"({', '.join(pains[:2])})."
                                    if (succ or pains)
                                    else "Tie your message to measurable outcomes and the main pain points for the role."
                                ),
                                "date": "",
                                "source": "general_knowledge",
                                "url": "",
                            }
                        )
                    if skills:
                        themes.append(
                            {
                                "title": "Theme: Implementation credibility",
                                "summary": f"Lead with 1 concrete proof point using {', '.join(skills[:3])} and a real metric (latency, uptime, cost, adoption).",
                                "date": "",
                                "source": "general_knowledge",
                                "url": "",
                            }
                        )
                    # Always include one safe company theme (non-claiming).
                    themes.append(
                        {
                            "title": "Theme: What the company likely cares about",
                            "summary": "Reference a plausible priority (customer experience, reliability, speed, cost) and offer a 2–3 bullet mini-plan—without claiming a specific news event.",
                            "date": "",
                            "source": "general_knowledge",
                            "url": "",
                        }
                    )
                    news = themes[:3]
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
                    )
                    for b in bios
                    if isinstance(b, dict)
                ],
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
