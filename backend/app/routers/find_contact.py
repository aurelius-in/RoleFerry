from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..services.email_verifier import verify_email_async, get_verification_badge
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..config import settings
from ..services.pdl_client import PDLClient
import json
import logging
import re
import html as html_lib
import hashlib
from urllib.parse import quote_plus
import httpx

router = APIRouter()
logger = logging.getLogger(__name__)


def _html_to_text(raw_html: str) -> str:
    """
    Lightweight HTML-to-text conversion suitable for leadership/team pages.
    """
    s = raw_html or ""
    s = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?i)</?(p|div|br|li|ul|ol|h1|h2|h3|h4|h5|h6|section|article|header|footer|main)[^>]*>", "\n", s)
    s = re.sub(r"(?is)<[^>]+>", " ", s)
    s = html_lib.unescape(s)
    s = s.replace("\r", "\n")
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


async def _clearbit_company_suggest(query: str) -> Optional[Dict[str, str]]:
    """
    Public Clearbit autocomplete endpoint (no key) to resolve a company name -> domain.
    """
    q = (query or "").strip()
    if not q:
        return None
    url = f"https://autocomplete.clearbit.com/v1/companies/suggest?query={quote_plus(q)}"
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "RoleFerry/1.0"})
            resp.raise_for_status()
            data = resp.json() or []
            if not data:
                return None
            top = data[0] or {}
            name = str(top.get("name") or "").strip()
            domain = str(top.get("domain") or "").strip()
            if not domain:
                return None
            return {"name": name or q, "domain": domain}
    except Exception:
        return None


async def _fetch_first_working_url(urls: List[str]) -> Optional[Dict[str, str]]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
        for url in urls:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code >= 400:
                    continue
                txt = resp.text or ""
                if len(txt) < 5000:
                    continue
                return {"url": url, "html": txt}
            except Exception:
                continue
    return None


_TITLE_KEYWORDS = [
    "engineering",
    "talent",
    "recruit",
    "people",
    "hr",
    "human resources",
]

_SENIORITY_KEYWORDS = [
    "chief",
    "officer",
    "ceo",
    "cto",
    "cfo",
    "coo",
    "president",
    "vice president",
    "vp",
    "director",
    "head",
    "manager",
    "lead",
    "founder",
]

# High-level job functions inferred from the target job title (role being applied for).
_JOB_FN_KEYWORDS: Dict[str, List[str]] = {
    "engineering": ["engineer", "engineering", "software", "platform", "infrastructure", "devops", "sre", "security", "data", "ml", "ai", "backend", "frontend", "full stack", "fullstack", "mobile", "ios", "android", "cloud", "it"],
    "product": ["product manager", "product", "pm", "product management", "growth product"],
    "design": ["design", "designer", "ux", "ui", "product design", "research"],
    "marketing": ["marketing", "growth", "demand gen", "demand generation", "content", "seo", "brand", "performance marketing"],
    "sales": ["sales", "account executive", "account manager", "ae", "bdr", "sdr", "revenue", "revops", "customer success", "csm", "partnerships"],
    "recruiting": ["recruiter", "recruiting", "talent", "talent acquisition", "people", "hr", "human resources", "sourcer"],
    "finance": ["finance", "accounting", "controller", "fp&a", "treasury"],
    "operations": ["operations", "ops", "bizops", "program manager", "project manager", "chief of staff"],
}

# Titles we should NOT surface as "decision makers" in this step (unless the target job function is explicitly that domain).
_GLOBAL_TITLE_EXCLUDES = [
    "buyer",
    "procurement",
    "purchasing",
    "e-commerce",
    "ecommerce",
    "merchandising",
    "category manager",
    "store manager",
]

def _infer_job_function(target_job_title: str) -> str:
    low = (target_job_title or "").strip().lower()
    if not low:
        return "engineering"  # default bias for the product demo; overridden when context is provided
    # Exact-ish signals first
    if "recruit" in low or "talent" in low or "sourcer" in low:
        return "recruiting"
    if "product manager" in low or (low.startswith("pm ") or low.endswith(" pm")):
        return "product"
    if "designer" in low or " ux" in low or " ui" in low or "design" in low:
        return "design"
    if "marketing" in low or "demand gen" in low or "seo" in low:
        return "marketing"
    if "sales" in low or "account executive" in low or "customer success" in low:
        return "sales"
    # Keyword scan
    for fn, keys in _JOB_FN_KEYWORDS.items():
        if any(k in low for k in keys):
            return fn
    return "engineering"

def _is_individual_contributor_title(title: str) -> bool:
    low = (title or "").lower()
    if any(k in low for k in ["manager", "director", "head", "vp", "vice president", "chief", "cxo", "founder", "owner", "partner"]):
        return False
    # Common IC senior titles that are often not decision-makers for hiring
    if any(k in low for k in ["principal", "staff", "lead"]) and any(k in low for k in ["engineer", "engineering", "developer"]):
        return True
    # Generic IC roles
    if any(k in low for k in ["engineer", "developer", "specialist", "associate"]) and not any(k in low for k in ["recruiter", "sourcer"]):
        return True
    return False

def _looks_irrelevant_for_any_target(title: str, job_fn: str) -> bool:
    low = (title or "").lower()
    if any(x in low for x in _GLOBAL_TITLE_EXCLUDES):
        # Only allow if the target job is explicitly in that domain (rare in this app)
        return job_fn not in {"operations", "finance"}
    return False

def _is_relevant_decision_maker_for_job(title: str, job_fn: str) -> bool:
    """
    Strict gate to prevent irrelevant roles from showing up as "decision makers".
    Always allow recruiting/TA roles (since they are directly involved in hiring),
    and require management-level seniority for function leads.
    """
    low = (title or "").strip().lower()
    if not low:
        return False
    if _looks_irrelevant_for_any_target(title, job_fn):
        return False

    # Always include recruiting/TA people (they are the funnel owners), but avoid unrelated ops like "HRIS analyst"
    is_recruiting = any(k in low for k in _JOB_FN_KEYWORDS["recruiting"])
    if is_recruiting:
        if any(k in low for k in ["analyst", "coordinator", "assistant"]) and not any(k in low for k in ["recruiter", "sourcer"]):
            return False
        return True

    # Exclude IC titles like Principal Engineer etc (user explicitly requested)
    if _is_individual_contributor_title(title):
        return False

    # Function match + seniority gate
    fn_keys = _JOB_FN_KEYWORDS.get(job_fn, [])
    fn_match = any(k in low for k in fn_keys) if fn_keys else False

    senior = any(k in low for k in ["manager", "director", "head", "vp", "vice president", "chief", "cxo", "cto", "ceo", "founder", "president"])
    if fn_match and senior:
        return True

    # Execs can be relevant even if function keywords don't match (small companies)
    if any(k in low for k in ["ceo", "cto", "chief", "founder", "president"]):
        return True

    return False

_NAME_STOPWORDS = {
    "about",
    "careers",
    "leadership",
    "team",
    "company",
    "products",
    "product",
    "technology",
    "information",
    "press",
    "news",
    "contact",
    "privacy",
    "terms",
    "google",
}


def _looks_like_name(s: str) -> bool:
    t = (s or "").strip()
    if not t or len(t) > 60:
        return False
    if not re.match(r"^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}$", t):
        return False
    parts = [p.strip().lower() for p in t.split() if p.strip()]
    # Avoid page/navigation titles being mis-detected as "people"
    if any(p in _NAME_STOPWORDS for p in parts):
        return False
    return True


def _looks_like_title(s: str) -> bool:
    t = (s or "").strip()
    if not t or len(t) > 120:
        return False
    low = t.lower()
    if any(bad in low for bad in ["about ", "cookie", "privacy", "terms", "our products", "company information"]):
        return False
    # Must look like an actual senior title, optionally with dept keywords.
    if not any(k in low for k in _SENIORITY_KEYWORDS):
        return False
    return True


def _infer_level(title: str) -> str:
    low = (title or "").lower()
    if any(k in low for k in ["chief", "ceo", "cto", "cfo", "coo"]):
        return "C-Level"
    if "vp" in low or "vice president" in low:
        return "VP"
    if "director" in low:
        return "Director"
    if "head" in low:
        return "Head"
    if "manager" in low:
        return "Manager"
    return "Lead"


def _infer_department(title: str) -> str:
    low = (title or "").lower()
    if "engineer" in low:
        return "Engineering"
    if any(k in low for k in ["talent", "recruit", "people", "hr", "human resources"]):
        return "HR"
    if "product" in low:
        return "Product"
    if "sales" in low:
        return "Sales"
    if "marketing" in low:
        return "Marketing"
    return "General"


def _guess_email(name: str, domain: str) -> str:
    parts = [p.strip().lower() for p in (name or "").split() if p.strip()]
    if len(parts) >= 2:
        first, last = parts[0], parts[-1]
        return f"{first}.{last}@{domain}".lower()
    if parts:
        return f"{parts[0]}@{domain}".lower()
    return f"contact@{domain}".lower()


def _linkedin_search_url(name: str, company: str) -> str:
    q = quote_plus(f"{name} {company}".strip())
    return f"https://www.linkedin.com/search/results/people/?keywords={q}"


def _extract_contacts_from_text(text: str, company: str, domain: str, source_url: str, job_fn: str) -> List["Contact"]:
    """
    Extract (name,title) pairs from leadership/team page text.
    """
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    pairs: List[tuple[str, str]] = []

    # Pattern A: "Name — Title" on one line
    for ln in lines:
        m = re.match(r"^([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\s*[\-|–|—|•|·|:]\s*(.{3,120})$", ln)
        if not m:
            continue
        nm = m.group(1).strip()
        title = m.group(2).strip()
        if _looks_like_name(nm) and _looks_like_title(title):
            pairs.append((nm, title))

    # Pattern B: adjacent lines (Name on one line, Title on next)
    for i in range(len(lines) - 1):
        nm = lines[i]
        title = lines[i + 1]
        if _looks_like_name(nm) and _looks_like_title(title):
            pairs.append((nm, title))

    # De-dupe while preserving order, then prioritize decision-maker-ish titles
    seen = set()
    uniq: List[tuple[str, str]] = []
    for nm, title in pairs:
        key = (nm.lower(), title.lower())
        if key in seen:
            continue
        seen.add(key)
        uniq.append((nm, title))

    def score(title: str) -> int:
        low = title.lower()
        if not _is_relevant_decision_maker_for_job(title, job_fn):
            return -1000
        s = 0
        if any(k in low for k in ["vp", "vice president", "chief", "director", "head"]):
            s += 3
        # prefer same function + recruiting
        if any(k in low for k in _JOB_FN_KEYWORDS.get(job_fn, [])):
            s += 2
        if any(k in low for k in _JOB_FN_KEYWORDS["recruiting"]):
            s += 2
        if "manager" in low:
            s += 1
        return s

    uniq = sorted(uniq, key=lambda t: score(t[1]), reverse=True)
    uniq = [p for p in uniq if score(p[1]) > -1000][:8]

    contacts: List[Contact] = []
    for nm, title in uniq:
        email = _guess_email(nm, domain)
        cid = hashlib.sha256(f"{domain}:{nm}:{title}".encode("utf-8", errors="ignore")).hexdigest()[:12]
        contacts.append(
            Contact(
                id=f"contact_{cid}",
                name=nm,
                title=title,
                email=email,
                linkedin_url=_linkedin_search_url(nm, company),
                confidence=0.75,
                verification_status="unknown",
                verification_score=None,
                company=company,
                department=_infer_department(title),
                level=_infer_level(title),
            )
        )

    return contacts

class Contact(BaseModel):
    id: str
    name: str
    title: str
    email: str
    linkedin_url: Optional[str] = None
    confidence: float
    verification_status: str
    verification_score: Optional[float] = None
    company: str
    department: str
    level: str
    email_source: Optional[str] = None
    location_name: Optional[str] = None
    location_country: Optional[str] = None
    job_company_website: Optional[str] = None
    job_company_linkedin_url: Optional[str] = None
    job_company_industry: Optional[str] = None
    job_company_size: Optional[str] = None

class ContactSearchRequest(BaseModel):
    query: str
    company: Optional[str] = None
    role: Optional[str] = None
    level: Optional[str] = None
    # Context from upstream steps so we can pick ONLY relevant decision makers for the role being applied for.
    target_job_title: Optional[str] = None
    candidate_title: Optional[str] = None
    user_mode: Optional[str] = None

class ContactSearchResponse(BaseModel):
    success: bool
    message: str
    contacts: List[Contact]
    helper: Optional[Dict[str, Any]] = None

class ContactVerificationRequest(BaseModel):
    contact_ids: List[str]
    # Optional: allow the frontend to send the current contact objects so we can
    # verify the real emails deterministically without a DB lookup.
    contacts: Optional[List[Contact]] = None

class ContactVerificationResponse(BaseModel):
    success: bool
    message: str
    verified_contacts: List[Contact]

@router.post("/search", response_model=ContactSearchResponse)
async def search_contacts(request: ContactSearchRequest):
    """
    Search for contacts at target companies.
    """
    try:
        q = (request.company or request.query or "").strip()
        if not q:
            raise HTTPException(status_code=400, detail="Query is required")

        target_job_title = (request.target_job_title or request.role or "").strip()
        job_fn = _infer_job_function(target_job_title)

        # 0) Prefer People Data Labs if configured (real people data)
        if settings.pdl_api_key:
            try:
                pdl = PDLClient(settings.pdl_api_key)
                # best-effort: treat query as company name
                raw = pdl.person_search(company=q, size=12)
                people = pdl.extract_people(raw)

                def _score_person(title: str) -> int:
                    """
                    Rank toward actual hiring decision makers for the target role.
                    Strictly exclude irrelevant titles (buyers, e-comm, etc) and IC-only roles.
                    """
                    low = (title or "").lower()
                    score = 0

                    # Strict relevance gate first
                    if not _is_relevant_decision_maker_for_job(title, job_fn):
                        return -1000

                    # Hard penalties for irrelevant/non-decision roles
                    if any(k in low for k in ["intern", "student", "contractor"]):
                        return -1000
                    if any(k in low for k in ["sales", "account", "deal", "pursuit", "bd", "business development"]):
                        score -= 60
                    if any(k in low for k in ["marketing", "growth", "partnerships"]):
                        score -= 20

                    # Seniority
                    if any(k in low for k in ["chief", "ceo", "cto", "cfo", "coo", "founder"]):
                        score += 60
                    elif "vp" in low or "vice president" in low:
                        score += 50
                    elif "head" in low:
                        score += 45
                    elif "director" in low:
                        score += 42
                    elif "manager" in low:
                        score += 30
                    else:
                        score += 5

                    # Department relevance
                    eng = any(k in low for k in _JOB_FN_KEYWORDS["engineering"])
                    product = any(k in low for k in _JOB_FN_KEYWORDS["product"])
                    design = any(k in low for k in _JOB_FN_KEYWORDS["design"])
                    marketing = any(k in low for k in _JOB_FN_KEYWORDS["marketing"])
                    sales = any(k in low for k in _JOB_FN_KEYWORDS["sales"])
                    talent = any(k in low for k in _JOB_FN_KEYWORDS["recruiting"])

                    # Boost contacts in the same function as the target job, plus recruiting.
                    if job_fn == "engineering" and eng:
                        score += 35
                    if job_fn == "product" and product:
                        score += 35
                    if job_fn == "design" and design:
                        score += 35
                    if job_fn == "marketing" and marketing:
                        score += 35
                    if job_fn == "sales" and sales:
                        score += 35
                    if talent:
                        score += 30

                    # Extra signals
                    if "hiring" in low or "headcount" in low:
                        score += 10
                    if "operations" in low and talent:
                        score += 6

                    return score

                scored = [(int(_score_person(p.title)), p) for p in people]
                scored.sort(key=lambda t: t[0], reverse=True)

                def _is_fn_dm(title: str) -> bool:
                    return _is_relevant_decision_maker_for_job(title, job_fn) and any(
                        k in (title or "").lower() for k in ["manager", "director", "head", "vp", "vice president", "chief", "cto", "ceo", "founder"]
                    )

                def _is_recruiting(title: str) -> bool:
                    low = (title or "").lower()
                    return any(k in low for k in _JOB_FN_KEYWORDS["recruiting"])

                fn_dm = [p for _, p in scored if _is_fn_dm(p.title) and not _is_recruiting(p.title)]
                talent_dm = [p for _, p in scored if _is_recruiting(p.title)]
                others = [p for _, p in scored if p not in fn_dm and p not in talent_dm and _is_relevant_decision_maker_for_job(p.title, job_fn)]

                picked: List[Any] = []
                for p in fn_dm[:4]:
                    picked.append(p)
                for p in talent_dm[:3]:
                    if p not in picked:
                        picked.append(p)
                for p in others:
                    if p not in picked:
                        picked.append(p)
                    if len(picked) >= 8:
                        break

                people = picked[:8]
                contacts: List[Contact] = []
                for p in people:
                    # If we don't have a real email, leave it blank and let the UI hide it.
                    email_guess = str(p.email or "").strip()
                    name = (p.name or "").strip()
                    if name and name == name.lower():
                        name = " ".join([w[:1].upper() + w[1:] for w in name.split()])
                    cid = hashlib.sha256(f"pdl:{p.linkedin_url or ''}:{p.name}:{p.title}".encode("utf-8", errors="ignore")).hexdigest()[:12]
                    contacts.append(
                        Contact(
                            id=f"pdl_{cid}",
                            name=name or p.name,
                            title=p.title,
                            email=email_guess,
                            linkedin_url=p.linkedin_url,
                            confidence=0.9,
                            verification_status="unknown",
                            verification_score=None,
                            company=p.company or q,
                            department=_infer_department(p.title),
                            level=_infer_level(p.title),
                            email_source=p.email_source,
                            location_name=p.location_name,
                            location_country=p.location_country,
                            job_company_website=p.job_company_website,
                            job_company_linkedin_url=p.job_company_linkedin_url,
                            job_company_industry=p.job_company_industry,
                            job_company_size=p.job_company_size,
                        )
                    )

                if not contacts:
                    raise HTTPException(status_code=404, detail="No decision makers found via PDL for that company query.")

                # GPT helper (same as before)
                client = get_openai_client()
                helper_context = {
                    "query": request.query,
                    "company": request.company,
                    "role": request.role,
                    "level": request.level,
                    "target_job_title": request.target_job_title,
                    "candidate_title": request.candidate_title,
                    "job_function": job_fn,
                    "contacts": [c.model_dump() for c in contacts],
                }
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You generate outreach talking points for decision makers. "
                            "Focus on business value and relevant industry questions.\n\n"
                            "Style constraints:\n"
                            "- Hard ban: do NOT use clichés like \"I hope you're doing well\", \"How are you?\", or \"Thank you for your time\".\n"
                            "- suggestions should be direct and value-oriented.\n\n"
                            "Return ONLY JSON with keys:\n"
                            "- talking_points_by_contact: object mapping contact_id -> array of strings\n"
                            "- opener_suggestions: array of strings\n"
                            "- questions_to_ask: array of strings\n"
                        ),
                    },
                    {"role": "user", "content": json.dumps(helper_context)},
                ]
                stub_json = {
                    "talking_points_by_contact": {},
                    "opener_suggestions": [
                        "Quick question on your priorities for the team",
                        "Noticed a theme in the roadmap — here’s a concrete idea",
                    ],
                    "questions_to_ask": [
                        "What’s the most urgent outcome you need in the next 90 days?",
                        "Where is the team currently feeling the most friction (quality or speed)?",
                    ],
                }
                raw_llm = client.run_chat_completion(messages, temperature=0.25, max_tokens=650, stub_json=stub_json)
                choices = raw_llm.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")
                helper = extract_json_from_text(content_str) or stub_json

                return ContactSearchResponse(
                    success=True,
                    message=f"Found {len(contacts)} contacts (PDL ranked)",
                    contacts=contacts,
                    helper=helper,
                )
            except HTTPException:
                raise
            except Exception:
                logger.exception("PDL contact search failed; falling back to public-source scrape")

        # 1) Resolve company -> domain using public Clearbit autocomplete
        resolved = await _clearbit_company_suggest(q)
        company = (resolved or {}).get("name") or q
        domain = (resolved or {}).get("domain") or ""

        # 2) Fetch leadership/team page(s) and extract names/titles
        contacts: List[Contact] = []
        if domain:
            # Special-case: Google leadership page is on about.google
            urls: List[str] = []
            if domain.lower() == "google.com":
                urls.append("https://about.google/our-story/leadership/")
            urls.extend(
                [
                    f"https://{domain}/leadership",
                    f"https://{domain}/team",
                    f"https://{domain}/about",
                    f"https://{domain}/about-us",
                    f"https://{domain}/company",
                    f"https://{domain}/management",
                    f"https://{domain}/our-team",
                    f"https://{domain}/who-we-are",
                ]
            )
            fetched = await _fetch_first_working_url(urls)
            if fetched:
                page_text = _html_to_text(fetched["html"])
                contacts = _extract_contacts_from_text(page_text, company=company, domain=domain, source_url=fetched["url"], job_fn=job_fn)

        # 3) If we still have nothing, try OpenAI as a final backup to identify public personas
        if not contacts and settings.openai_api_key:
            try:
                client = get_openai_client()
                # Ask GPT to identify likely decision makers based on its training data (broad knowledge).
                # We strictly ask for name, title, and LinkedIn search URL.
                target = (request.target_job_title or request.role or "").strip()
                prompt = (
                    f"Identify 3-6 REAL hiring decision makers for the role '{target or 'this role'}' at the company '{company}'.\n\n"
                    f"Rules:\n"
                    f"- Only include people who would plausibly be involved in hiring for that role (hiring manager, functional leader, talent acquisition/recruiting).\n"
                    f"- EXCLUDE irrelevant functions (e.g., buyers, e-commerce, marketing leaders for an engineering role, etc.).\n"
                    f"- EXCLUDE individual contributors like 'Principal Engineer' / 'Staff Engineer' unless they are also a Manager/Director/Head/VP.\n"
                    f"- Provide name and exact title.\n\n"
                    f"Return ONLY a JSON object with key 'people': array of {{name, title}}."
                )
                messages = [{"role": "user", "content": prompt}]
                raw_gpt = client.run_chat_completion(messages, temperature=0.1, max_tokens=500)
                choices = raw_gpt.get("choices") or []
                content_str = str((choices[0].get("message") if choices else {}).get("content") or "")
                data = extract_json_from_text(content_str)
                gpt_people = data.get("people") if isinstance(data, dict) else []
                
                if gpt_people and isinstance(gpt_people, list):
                    for p in gpt_people:
                        nm = str(p.get("name") or "").strip()
                        ttl = str(p.get("title") or "").strip()
                        if nm and ttl and _is_relevant_decision_maker_for_job(ttl, job_fn):
                            cid = hashlib.sha256(f"gpt_backup:{nm}:{ttl}".encode("utf-8")).hexdigest()[:12]
                            contacts.append(
                                Contact(
                                    id=f"gpt_{cid}",
                                    name=nm,
                                    title=ttl,
                                    email=_guess_email(nm, domain or "example.com"),
                                    linkedin_url=_linkedin_search_url(nm, company),
                                    confidence=0.6,  # Lower confidence because it's from training data, not a live scrape
                                    verification_status="unknown",
                                    verification_score=None,
                                    company=company,
                                    department=_infer_department(ttl),
                                    level=_infer_level(ttl),
                                )
                            )
            except Exception:
                logger.exception("OpenAI contact backup failed")

        # 4) If we still have nothing, surface a clear failure
        if not contacts:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No public decision makers found for that query. "
                    "Try a more specific company name (e.g., 'Google LLC') or provide a company website domain."
                ),
            )

        # 4b) AI sanity-check: ensure contacts are truly relevant decision makers for the target job.
        # We keep deterministic guardrails above, but this catches edge-cases when titles are ambiguous.
        client = get_openai_client()
        target = (request.target_job_title or request.role or "").strip()
        if client.should_use_real_llm and target and contacts:
            try:
                audit_payload = {
                    "target_job_title": target,
                    "candidate_title": (request.candidate_title or "").strip(),
                    "company": company,
                    "contacts": [
                        {
                            "id": c.id,
                            "name": c.name,
                            "title": c.title,
                            "department": c.department,
                            "level": c.level,
                        }
                        for c in contacts
                    ],
                }
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are filtering a list of people to ONLY those who are hiring decision makers for the target role.\n"
                            "Return a strict subset.\n\n"
                            "Keep ONLY:\n"
                            "- Recruiting / Talent Acquisition roles (Recruiter, Sourcer, TA Partner, TA Manager/Director/Head)\n"
                            "- The likely hiring manager / function leader for the target role (Manager/Director/Head/VP in the relevant function)\n"
                            "- Executives only when plausible (CEO/CTO/Founder) for smaller orgs\n\n"
                            "Drop:\n"
                            "- Individual contributors like Principal/Staff/Lead Engineer (unless also a Manager/Director/Head/VP)\n"
                            "- Unrelated functions (e.g. buyers, e-commerce, marketing leaders for engineering roles)\n\n"
                            "Return ONLY JSON: { keep_ids: [string], notes: [string] }"
                        ),
                    },
                    {"role": "user", "content": json.dumps(audit_payload, ensure_ascii=False)},
                ]
                stub_json = {"keep_ids": [c.id for c in contacts], "notes": []}
                raw = client.run_chat_completion(messages, temperature=0.1, max_tokens=450, stub_json=stub_json)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")
                data = extract_json_from_text(content_str) or {}
                keep_ids = data.get("keep_ids") if isinstance(data, dict) else None
                if isinstance(keep_ids, list) and keep_ids:
                    keep = {str(x) for x in keep_ids if str(x).strip()}
                    filtered = [c for c in contacts if c.id in keep]
                    # If the model filtered everything, fall back to deterministic list.
                    if filtered:
                        contacts = filtered
            except Exception:
                logger.exception("LLM contact relevance audit failed (non-blocking)")

        # GPT helper: decision-maker talking points + outreach angles per contact.
        helper_context = {
            "query": request.query,
            "company": request.company,
            "role": request.role,
            "level": request.level,
            "target_job_title": request.target_job_title,
            "candidate_title": request.candidate_title,
            "job_function": job_fn,
            "contacts": [c.model_dump() for c in contacts],
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You generate outreach talking points for decision makers.\n\n"
                    "Return ONLY JSON with keys:\n"
                    "- talking_points_by_contact: object mapping contact_id -> array of strings\n"
                    "- opener_suggestions: array of strings\n"
                    "- questions_to_ask: array of strings\n"
                ),
            },
            {"role": "user", "content": json.dumps(helper_context)},
        ]
        stub_json = {
            "talking_points_by_contact": {
                # Will be used only if LLM is disabled/unavailable.
            },
            "opener_suggestions": [
                "Quick question on your priorities for the role",
                "Noticed a theme in the job posting — here’s a concrete idea",
            ],
            "questions_to_ask": [
                "What’s the most urgent outcome you need in the next 90 days?",
                "Where is the team currently feeling the most pain (quality, speed, cost)?",
            ],
        }
        raw = client.run_chat_completion(messages, temperature=0.25, max_tokens=650, stub_json=stub_json)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        helper = extract_json_from_text(content_str) or stub_json

        return ContactSearchResponse(
            success=True,
            message=f"Found {len(contacts)} contacts (public sources; emails unverified)",
            contacts=contacts,
            helper=helper,
        )
    except Exception as e:
        # Preserve HTTPException status codes (404, 400, etc)
        if isinstance(e, HTTPException):
            raise
        logger.exception("Failed to search contacts")
        raise HTTPException(status_code=500, detail=f"Failed to search contacts: {str(e)}")

@router.post("/verify", response_model=ContactVerificationResponse)
async def verify_contacts(request: ContactVerificationRequest):
    """
    Verify email addresses for selected contacts.
    """
    try:
        verified_contacts: List[Contact] = []

        contacts_by_id: Dict[str, Contact] = {}
        for c in (request.contacts or []):
            contacts_by_id[c.id] = c

        for contact_id in request.contact_ids:
            base = contacts_by_id.get(contact_id)
            if base is None:
                base = Contact(
                    id=contact_id,
                    name="Contact",
                    title="Decision Maker",
                    email=f"{contact_id}@example.com",
                    confidence=0.8,
                    verification_status="unknown",
                    verification_score=None,
                    company="Company",
                    department="Engineering",
                    level="Director",
                )

            verification_result = await verify_email_async(base.email)
            base.verification_status = verification_result.get("status", "unknown")
            base.verification_score = verification_result.get("score")
            verified_contacts.append(base)
        
        return ContactVerificationResponse(
            success=True,
            message=f"Verified {len(verified_contacts)} contacts",
            verified_contacts=verified_contacts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify contacts: {str(e)}")

@router.get("/{contact_id}", response_model=Contact)
async def get_contact(contact_id: str):
    """
    Get a specific contact by ID.
    """
    try:
        # In a real implementation, this would fetch from database
        # For now, return mock data
        mock_contact = Contact(
            id=contact_id,
            name="Sarah Johnson",
            title="VP of Engineering",
            email="sarah.johnson@techcorp.com",
            linkedin_url="https://linkedin.com/in/sarahjohnson",
            confidence=0.95,
            verification_status="valid",
            verification_score=92,
            company="TechCorp Inc.",
            department="Engineering",
            level="VP"
        )
        
        return mock_contact
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get contact: {str(e)}")

@router.put("/{contact_id}", response_model=Contact)
async def update_contact(contact_id: str, contact: Contact):
    """
    Update a contact.
    """
    try:
        # In a real implementation, this would update in database
        return contact
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update contact: {str(e)}")

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    """
    Delete a contact.
    """
    try:
        # In a real implementation, this would delete from database
        return {"success": True, "message": "Contact deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete contact: {str(e)}")

@router.get("/badge/{status}/{score}")
async def get_contact_badge(status: str, score: float):
    """
    Get badge information for a contact's verification status.
    """
    try:
        badge = get_verification_badge(status, score)
        return {
            "success": True,
            "status": status,
            "score": score,
            "badge": badge
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get badge: {str(e)}")
