from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..services.email_verifier import verify_email_async, get_verification_badge
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..config import settings
from ..services.pdl_client import PDLClient, extract_person_signals, extract_company_signals
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
        return "general"
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
    Gate to surface useful "decision makers" while filtering obvious noise.
    Permissive for any senior/management-level person; the scoring layer
    and LLM audit will rank and trim from there.
    """
    low = (title or "").strip().lower()
    if not low:
        return False
    if _looks_irrelevant_for_any_target(title, job_fn):
        return False

    is_recruiting = any(k in low for k in _JOB_FN_KEYWORDS["recruiting"])
    if is_recruiting:
        if any(k in low for k in ["analyst", "coordinator", "assistant"]) and not any(k in low for k in ["recruiter", "sourcer"]):
            return False
        return True

    if _is_individual_contributor_title(title):
        return False

    senior = any(k in low for k in [
        "manager", "director", "head", "vp", "vice president",
        "chief", "cxo", "cto", "ceo", "cfo", "coo", "founder",
        "president", "partner", "owner", "lead", "senior director",
    ])
    if senior:
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
    "draw",
    "design",
    "board",
    "canvas",
    "studio",
    "cloud",
    "platform",
    "tools",
    "features",
    "solutions",
    "services",
    "enterprise",
    "connect",
    "share",
    "create",
    "build",
    "explore",
    "discover",
    "learn",
    "start",
    "pricing",
    "support",
    "blog",
    "docs",
    "community",
    "resources",
    "login",
    "signup",
}


def _looks_like_name(s: str) -> bool:
    t = (s or "").strip()
    if not t or len(t) > 60:
        return False
    if not re.match(r"^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}$", t):
        return False
    parts = [p.strip().lower() for p in t.split() if p.strip()]
    if any(p in _NAME_STOPWORDS for p in parts):
        return False
    return True


def _is_real_person(name: str, title: str) -> bool:
    """Filter out entries that are clearly not real people (product names, generic titles used as names, etc.)."""
    n = (name or "").strip()
    t = (title or "").strip().lower()
    if not n or len(n) < 3:
        return False
    nl = n.lower()
    # Name contains title keywords — likely a title mis-parsed as a name
    if any(k in nl for k in ["chief", "officer", "director", "board", "administrative", "manager", "coordinator"]):
        return False
    # Name contains "or" joining two things — e.g. "Chief Administrative Officer or Board of Directors"
    if " or " in nl:
        return False
    # Only one word (real names have at least first + last)
    if len(n.split()) < 2:
        return False
    # Name is mostly digits or symbols
    alpha = sum(1 for c in n if c.isalpha())
    if alpha < len(n) * 0.6:
        return False
    # Name word appears in product/navigation stopwords
    parts = [w.lower() for w in n.split() if w.strip()]
    if any(p in _NAME_STOPWORDS for p in parts):
        return False
    # Name is suspiciously long (> 5 words)
    if len(parts) > 5:
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
    if any(k in low for k in ["chief", "ceo", "cto", "cfo", "coo", "founder", "president"]):
        return "C-Suite"
    if "vp" in low or "vice president" in low or "svp" in low:
        return "VP"
    if "director" in low or "head" in low:
        return "Director"
    if "manager" in low:
        return "Manager"
    if any(k in low for k in ["senior", "staff", "principal", "lead", "sr."]):
        return "Senior"
    return "Senior"


def _matches_seniority_filter(level: str, seniority_csv: str) -> bool:
    if not seniority_csv:
        return True
    allowed = {s.strip().lower() for s in seniority_csv.split(",") if s.strip()}
    if not allowed:
        return True
    lvl = (level or "").strip().lower()
    if lvl in allowed:
        return True
    aliases = {
        "c-suite": {"c-level", "c-suite", "executive"},
        "c-level": {"c-suite", "c-level", "executive"},
        "vp": {"vp", "vice president"},
        "director": {"director", "head"},
        "head": {"director", "head"},
        "manager": {"manager"},
        "senior": {"senior", "lead", "principal", "staff"},
        "lead": {"senior", "lead"},
    }
    return bool(allowed & aliases.get(lvl, set()))


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
    uniq = [p for p in uniq if score(p[1]) > -1000][:15]

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

class ContactSignal(BaseModel):
    label: str
    value: str
    category: str

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
    person_signals: Optional[List[ContactSignal]] = None
    company_signals: Optional[List[ContactSignal]] = None

class ContactSearchRequest(BaseModel):
    query: str
    company: Optional[str] = None
    role: Optional[str] = None
    title_filters: Optional[List[str]] = None
    level: Optional[str] = None
    seniority: Optional[str] = None
    location: Optional[str] = None
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

class ImproveLinkedInNoteRequest(BaseModel):
    note: str
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_company: Optional[str] = None
    job_title: Optional[str] = None
    painpoint: Optional[str] = None
    solution: Optional[str] = None
    metric: Optional[str] = None
    limit: Optional[int] = 200
    interesting_facts: Optional[List[str]] = None
    post_topics: Optional[List[str]] = None
    profile_highlights: Optional[List[str]] = None
    company_theme: Optional[str] = None


class ImproveLinkedInNoteResponse(BaseModel):
    note: str
    used_ai: bool = False


def _trim_to_chars(s: str, limit: int) -> str:
    t = str(s or "").strip()
    if limit <= 0:
        return t
    if len(t) <= limit:
        return t
    ell = "…"
    if limit <= len(ell):
        return t[:limit]
    return (t[: (limit - len(ell))].rstrip() + ell).strip()


def _sanitize_linkedin_note(note: str, limit: int) -> str:
    # Avoid em/en dashes per app style.
    s = (note or "").replace("—", "-").replace("–", "-")
    # De-noise whitespace.
    s = re.sub(r"\s+", " ", s).strip()
    # Basic punctuation cleanup (avoid double periods, space-before-punct).
    s = re.sub(r"\s+([,.;?!])", r"\1", s)
    s = re.sub(r"\.{2,}", ".", s)
    s = s.replace("..", ".")
    # Keep within character budget.
    return _trim_to_chars(s, limit)


def _painpoint_phrase(pain: str) -> str:
    """
    Turn a long imperative job line into a short phrase that fits after "focus on".
    Example:
      "Define and implement a scalable, secure data architecture on Azure."
      -> "a scalable, secure data architecture on Azure"
    """
    t = re.sub(r"\s+", " ", str(pain or "")).strip()
    t = re.sub(r"^[\-\*\u2022\d\.\)\s]+", "", t).strip()
    t = re.sub(r"\s*\.+\s*$", "", t).strip()
    low = t.lower()
    if low in {"a key priority", "key priority"}:
        return ""
    drop = [
        "define and implement ",
        "design and implement ",
        "build and implement ",
        "develop and implement ",
        "define and build ",
        "design and build ",
        "build ",
        "develop ",
        "define ",
        "design ",
        "implement ",
        "lead ",
        "own ",
        "manage ",
        "create ",
        "drive ",
    ]
    for p in drop:
        if low.startswith(p):
            t = t[len(p) :].strip()
            break
    return _trim_to_chars(t, 70).strip().rstrip(".")


def _deterministic_improve_linkedin_note(req: ImproveLinkedInNoteRequest) -> str:
    import hashlib as _hashlib

    name = (req.contact_name or "").strip()
    first = (name.split()[0] if name else "").strip() or "there"
    company = (req.contact_company or "").strip()
    sol = (req.solution or "").strip()
    painpoint = (req.painpoint or "").strip()
    pain_short = _painpoint_phrase(painpoint) if painpoint else ""

    facts = [str(f).strip() for f in (req.interesting_facts or []) if str(f).strip()][:3]
    topics = [str(t).strip() for t in (req.post_topics or []) if str(t).strip()][:3]
    highlights = [str(h).strip() for h in (req.profile_highlights or []) if str(h).strip()][:3]
    theme = (req.company_theme or "").strip()

    # Pick the best fact/topic (short enough for a connection note).
    best_fact = ""
    for f in facts:
        if 10 < len(f) <= 90:
            best_fact = f.rstrip(".")
            break
    best_topic = ""
    for t in topics:
        if 5 < len(t) <= 60:
            best_topic = t.rstrip(".")
            break
    best_highlight = ""
    for h in highlights:
        if 10 < len(h) <= 80:
            best_highlight = h.rstrip(".")
            break

    # Use a hash of the contact name to pick a template variant for variety.
    seed = int(_hashlib.md5((name + company).encode()).hexdigest()[:8], 16)

    # Build candidate note strategies ordered by personalization quality.
    candidates: List[str] = []

    # Strategy 1: Reference a specific fact about the contact.
    if best_fact and company:
        candidates.append(
            f"Hi {first}, I came across your work at {company} and was impressed by {best_fact}. "
            f"I work in a similar space and would love to connect."
        )
    elif best_fact:
        candidates.append(
            f"Hi {first}, I noticed {best_fact} and found it really compelling. "
            f"Would love to connect and follow your work."
        )

    # Strategy 2: Reference their post topics.
    if best_topic and company:
        candidates.append(
            f"Hi {first}, your perspective on {best_topic} caught my attention. "
            f"I work on related problems and always appreciate connecting with thoughtful people at {company}."
        )
    elif best_topic:
        candidates.append(
            f"Hi {first}, I have been following discussions around {best_topic} and liked your take. "
            f"Would be great to connect."
        )

    # Strategy 3: Reference a profile highlight.
    if best_highlight and company:
        candidates.append(
            f"Hi {first}, {best_highlight} really stood out on your profile. "
            f"I am building in a similar area and would love to have you in my network."
        )

    # Strategy 4: Company theme + shared space.
    if theme and len(theme) <= 80 and company:
        theme_clean = theme.split("\n")[0].strip().rstrip(".")
        if 10 < len(theme_clean) <= 70:
            candidates.append(
                f"Hi {first}, {company}'s focus on {theme_clean.lower()} resonates with the work I do. "
                f"Would love to connect and exchange ideas."
            )

    # Strategy 5: Pain point bridge (shared domain interest).
    if pain_short and company:
        candidates.append(
            f"Hi {first}, I have been focused on {pain_short} and noticed {company} is tackling similar challenges. "
            f"Would love to connect."
        )
    elif pain_short:
        candidates.append(
            f"Hi {first}, I spend a lot of time thinking about {pain_short}. "
            f"Your background suggests we are in a similar space. Let's connect."
        )

    # Strategy 6: Company flattery + value add.
    if company and sol and len(sol) <= 72:
        candidates.append(
            f"Hi {first}, I have been following what {company} is building and it is impressive work. "
            f"I focus on {sol.rstrip('.')} and think we would have a lot to talk about."
        )

    # Strategy 7: Generic but warm (last resort).
    if company:
        generic_variants = [
            f"Hi {first}, the work coming out of {company} has caught my eye. I would love to connect and learn more about what you are building.",
            f"Hi {first}, I have a lot of respect for what {company} is doing. Always looking to connect with sharp people in the space.",
            f"Hi {first}, your background at {company} is impressive. I work in a related area and would value having you in my network.",
        ]
        candidates.append(generic_variants[seed % len(generic_variants)])
    else:
        candidates.append(
            f"Hi {first}, your profile stood out and I think we are in a similar space. Would love to connect."
        )

    # Pick the best candidate (most personalized = first in list), but use seed for variety
    # when multiple good options exist.
    if len(candidates) >= 3:
        # Top 3 are all good; rotate among them for variety.
        note = candidates[seed % min(3, len(candidates))]
    elif candidates:
        note = candidates[0]
    else:
        note = f"Hi {first}, would love to connect and exchange ideas."

    return note


@router.post("/search", response_model=ContactSearchResponse)
async def search_contacts(request: ContactSearchRequest):
    """
    Search for contacts at target companies.
    """
    try:
        import time as _time
        _budget_start = _time.monotonic()
        _BUDGET_SECONDS = 50

        def _budget_remaining() -> float:
            return max(0.0, _BUDGET_SECONDS - (_time.monotonic() - _budget_start))

        def _budget_ok(min_seconds: float = 2.0) -> bool:
            return _budget_remaining() > min_seconds

        q = (request.company or request.query or "").strip()
        if not q:
            raise HTTPException(status_code=400, detail="Query is required")

        target_job_title = (request.target_job_title or request.role or "").strip()
        job_fn = _infer_job_function(target_job_title)
        title_filters = [str(x).strip() for x in (request.title_filters or []) if str(x).strip()]
        logger.info("Contact search: company='%s' target_title='%s' job_fn='%s' filters=%s", q, target_job_title, job_fn, title_filters[:5])

        def _norm_title(s: str) -> str:
            low = (s or "").strip().lower()
            low = low.replace("vice president", "vp")
            low = re.sub(r"\s+", " ", low).strip()
            return low

        def _matches_title_filters(title: str) -> bool:
            if not title_filters:
                return True
            t = _norm_title(title)
            for f in title_filters:
                ff = _norm_title(f)
                if not ff:
                    continue
                # All tokens in filter must appear somewhere in title (order-agnostic).
                toks = [x for x in ff.split(" ") if x]
                if toks and all(tok in t for tok in toks):
                    return True
            return False

        # 0a) Resolve company -> domain early so we can use it for PDL too
        resolved = await _clearbit_company_suggest(q)
        company = (resolved or {}).get("name") or q
        domain = (resolved or {}).get("domain") or ""
        logger.info("Clearbit resolved '%s' -> company='%s' domain='%s'", q, company, domain)

        # 0b) Prefer People Data Labs if configured (real people data)
        pdl_contacts: List[Contact] = []
        if settings.pdl_api_key:
            try:
                pdl = PDLClient(settings.pdl_api_key, timeout_seconds=min(15.0, _budget_remaining() - 10.0))
                raw = pdl.person_search(company=q, size=100, domain=domain)
                people = pdl.extract_people(raw)
                logger.info("PDL person_search for '%s' returned %d people", q, len(people))

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

                    if any(k in low for k in ["intern", "student", "contractor"]):
                        return -1000
                    if job_fn not in ("general", "sales") and any(k in low for k in ["sales", "account", "deal", "pursuit", "bd", "business development"]):
                        score -= 60
                    if job_fn not in ("general", "marketing") and any(k in low for k in ["marketing", "growth", "partnerships"]):
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
                logger.info("PDL scored %d people for '%s' (job_fn=%s)", len(scored), q, job_fn)

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

                desired = 50

                relevant_pool = [p for _, p in scored if _is_relevant_decision_maker_for_job(p.title, job_fn)]

                if title_filters:
                    filtered_pool = [p for p in relevant_pool if _matches_title_filters(p.title)]
                    if filtered_pool:
                        people = filtered_pool[:desired]
                    elif relevant_pool:
                        people = relevant_pool[:desired]
                    else:
                        senior_pool = [p for _, p in scored if any(
                            k in (p.title or "").lower() for k in ["manager", "director", "head", "vp", "vice president", "chief", "cto", "ceo", "founder"]
                        )]
                        people = (senior_pool or [p for _, p in scored])[:desired]
                else:
                    if relevant_pool:
                        picked: List[Any] = []
                        for p in fn_dm[:12]:
                            picked.append(p)
                        for p in talent_dm[:8]:
                            if p not in picked:
                                picked.append(p)
                        for p in others:
                            if p not in picked:
                                picked.append(p)
                            if len(picked) >= desired:
                                break
                        for p in relevant_pool:
                            if p not in picked:
                                picked.append(p)
                            if len(picked) >= desired:
                                break
                        people = picked[:desired]
                    else:
                        senior_pool = [p for _, p in scored if any(
                            k in (p.title or "").lower() for k in ["manager", "director", "head", "vp", "vice president", "chief", "cto", "ceo", "founder"]
                        )]
                        people = (senior_pool or [p for _, p in scored])[:desired]
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
                            person_signals=[ContactSignal(**s) for s in extract_person_signals(p)],
                            company_signals=[ContactSignal(**s) for s in extract_company_signals(p)],
                        )
                    )

                pdl_contacts = list(contacts)
                logger.info("PDL returned %d relevant contacts for '%s'", len(pdl_contacts), q)
            except Exception as pdl_err:
                logger.exception("PDL contact search failed for '%s' (%s); will try other sources", q, str(pdl_err)[:120])

        # 1) Fetch leadership/team page(s) and extract names/titles
        contacts: List[Contact] = []
        if domain and _budget_ok(10.0):
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
                logger.info("Web scrape for '%s' found %d contacts from %s", q, len(contacts), fetched["url"])
                if title_filters:
                    contacts = [c for c in contacts if _matches_title_filters(c.title)]
            else:
                logger.info("Web scrape: no working leadership/team page found for domain='%s'", domain)

        # 3) Try OpenAI to identify public personas (supplements PDL + web scraping)
        if len(contacts) + len(pdl_contacts) < 25 and settings.openai_api_key and _budget_ok(10.0):
            try:
                client = get_openai_client()
                # Ask GPT to identify likely decision makers based on its training data (broad knowledge).
                # We strictly ask for name, title, and LinkedIn search URL.
                target = (request.target_job_title or request.role or "").strip()
                filters = [str(x).strip() for x in (request.title_filters or []) if str(x).strip()]
                prompt = "".join(
                    [
                        f"Identify 12-20 REAL people who work at '{company}' in leadership, management, recruiting, or executive roles.\n\n",
                        f"Context: the user is looking for people who might influence hiring for a '{target or 'this role'}' position.\n\n",
                        "Include:\n",
                        "- VP/Director/Head/Manager of Engineering, Product, Design, HR, Talent, etc.\n",
                        "- Recruiters and Talent Acquisition professionals\n",
                        "- C-suite executives (CEO, CTO, COO, etc.)\n",
                        "- Founders\n\n",
                        "Exclude individual contributors (Staff Engineer, Senior Designer, etc.) unless they also have a management title.\n",
                        (f"- Preferred titles: {', '.join(filters[:18])}.\n" if filters else ""),
                        "- Provide name and exact current title.\n\n",
                        "Return ONLY a JSON object with key 'people': array of {name, title}.",
                    ]
                )
                messages = [{"role": "user", "content": prompt}]
                raw_gpt = client.run_chat_completion(messages, temperature=0.1, max_tokens=800)
                choices = raw_gpt.get("choices") or []
                content_str = str((choices[0].get("message") if choices else {}).get("content") or "")
                data = extract_json_from_text(content_str)
                gpt_people = data.get("people") if isinstance(data, dict) else []
                
                if gpt_people and isinstance(gpt_people, list):
                    for p in gpt_people:
                        nm = str(p.get("name") or "").strip()
                        ttl = str(p.get("title") or "").strip()
                        if nm and ttl and not _is_individual_contributor_title(ttl):
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

        # 4) Combine PDL contacts with web-scraped / GPT contacts, de-duping by name.
        # When both sources have the same person, merge their data (keep the richer one
        # but backfill any missing fields from the other).
        seen_names: dict[str, int] = {}
        combined: List[Contact] = []
        for c in pdl_contacts:
            key = (c.name or "").strip().lower()
            if key and key not in seen_names:
                seen_names[key] = len(combined)
                combined.append(c)
        for c in contacts:
            key = (c.name or "").strip().lower()
            if not key:
                continue
            if key in seen_names:
                existing = combined[seen_names[key]]
                if not existing.email and c.email:
                    existing.email = c.email
                    existing.email_source = c.email_source
                if not existing.linkedin_url and c.linkedin_url:
                    existing.linkedin_url = c.linkedin_url
                if not existing.location_name and c.location_name:
                    existing.location_name = c.location_name
                if not existing.job_company_website and c.job_company_website:
                    existing.job_company_website = c.job_company_website
            else:
                seen_names[key] = len(combined)
                combined.append(c)
        contacts = combined
        logger.info("Combined contacts for '%s': %d PDL + %d other = %d total", q, len(pdl_contacts), len(contacts) - len(pdl_contacts), len(contacts))

        # 4c) Enrich contacts that have no signals via PDL Person Enrichment API.
        if settings.pdl_api_key and _budget_ok(12.0):
            pdl_enricher = PDLClient(settings.pdl_api_key, timeout_seconds=min(8.0, _budget_remaining() - 8.0))
            enrich_count = 0
            for c in contacts:
                if enrich_count >= 6 or not _budget_ok(8.0):
                    break
                if c.person_signals and len(c.person_signals) > 0:
                    continue
                try:
                    raw = pdl_enricher.person_enrich(
                        name=c.name or "",
                        company=c.company or q,
                        linkedin_url=c.linkedin_url or "",
                        title=c.title or "",
                    )
                    p = pdl_enricher.extract_enriched_person(raw)
                    if p:
                        c.person_signals = [ContactSignal(**s) for s in extract_person_signals(p)]
                        if not c.company_signals or len(c.company_signals) == 0:
                            c.company_signals = [ContactSignal(**s) for s in extract_company_signals(p)]
                        if p.email and not c.email:
                            c.email = p.email
                            c.email_source = p.email_source
                        enrich_count += 1
                except Exception:
                    logger.debug("PDL person_enrich failed for %s; skipping", c.name)

        if not contacts:
            logger.warning("No contacts found for '%s' after all sources (PDL=%d, web=%d, GPT=%d)",
                           q, len(pdl_contacts), 0, 0)
            return ContactSearchResponse(
                success=False,
                message=(
                    "No decision makers found for that company. "
                    "Try a more specific company name, or use the suggested targets below."
                ),
                contacts=[],
                helper=None,
            )

        # 4b) AI sanity-check: ensure contacts are truly relevant decision makers for the target job.
        client = get_openai_client()
        target = (request.target_job_title or request.role or "").strip()
        if client.should_use_real_llm and target and contacts and _budget_ok(10.0):
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
                            "You are reviewing a list of people at a company for networking and outreach.\n"
                            "Be PERMISSIVE — keep anyone who could plausibly be involved in or influence hiring.\n\n"
                            "Keep:\n"
                            "- Recruiting / Talent Acquisition / People / HR roles at any level\n"
                            "- Managers, Directors, Heads, VPs, C-suite in the relevant function\n"
                            "- Managers, Directors, Heads, VPs, C-suite in adjacent functions\n"
                            "- Executives (CEO, CTO, COO, Founder, President) — always keep\n"
                            "- Anyone at Manager level or above, even in a different department\n\n"
                            "Only drop:\n"
                            "- Individual contributors (Engineer, Developer, Analyst, Specialist) with no management title\n"
                            "- Clearly irrelevant roles (Buyer, Procurement, Store Manager) unless target role is in that domain\n\n"
                            "When in doubt, KEEP the person. More contacts is better than fewer.\n"
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

        # Filter out non-person entries (product names, garbled titles used as names, etc.)
        contacts = [c for c in contacts if _is_real_person(c.name, c.title)]

        # Apply seniority filter from UI (if provided).
        seniority_csv = (request.seniority or "").strip()
        if seniority_csv and contacts:
            filtered = [c for c in contacts if _matches_seniority_filter(c.level, seniority_csv)]
            if filtered:
                contacts = filtered

        # Hard cap for UI sanity: avoid overwhelming lists.
        try:
            contacts = (contacts or [])[:30]
        except Exception:
            pass

        # GPT helper: decision-maker talking points + outreach angles per contact.
        stub_helper = {
            "talking_points_by_contact": {},
            "opener_suggestions": [
                "Quick question on your priorities for the role",
                "Noticed a theme in the job posting - here's a concrete idea",
            ],
            "questions_to_ask": [
                "What's the most urgent outcome you need in the next 90 days?",
                "Where is the team currently feeling the most pain (quality, speed, cost)?",
            ],
        }
        if _budget_ok(8.0):
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
            _llm_timeout = max(8.0, min(30.0, _budget_remaining() - 3.0))
            raw = client.run_chat_completion(messages, temperature=0.25, max_tokens=650, stub_json=stub_helper, timeout_seconds=_llm_timeout, max_retries=1)
            choices = raw.get("choices") or []
            msg = (choices[0].get("message") if choices else {}) or {}
            content_str = str(msg.get("content") or "")
            helper = extract_json_from_text(content_str) or stub_helper
        else:
            logger.info("Skipping helper LLM (budget %.1fs left)", _budget_remaining())
            helper = stub_helper

        _elapsed = _time.monotonic() - _budget_start
        logger.info("search_contacts completed in %.1fs for '%s' (%d contacts)", _elapsed, q, len(contacts))


        return ContactSearchResponse(
            success=True,
            message=f"Found {len(contacts)} contacts (public sources; emails unverified)",
            contacts=contacts,
            helper=helper,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to search contacts for '%s'", (request.company or request.query or ""))
        return ContactSearchResponse(
            success=False,
            message=f"Contact search encountered an error: {str(e)[:200]}",
            contacts=[],
            helper=None,
        )

@router.post("/verify", response_model=ContactVerificationResponse)
async def verify_contacts(request: ContactVerificationRequest):
    """
    Verify email addresses for selected contacts.
    """
    try:
        verified_contacts: List[Contact] = []

        def _is_placeholder_email(email: str) -> bool:
            e = (email or "").strip().lower()
            if not e:
                return True
            if e == "unknown@example.com":
                return True
            if e.endswith("@example.com"):
                return True
            return False

        def _domain_from_url(u: str) -> str:
            try:
                from urllib.parse import urlparse
                host = (urlparse(u).hostname or "").strip().lower()
                if host.startswith("www."):
                    host = host[4:]
                return host
            except Exception:
                return ""

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

            # If we don't have a real email yet, try to infer a company domain and guess one.
            try:
                if _is_placeholder_email(str(base.email or "")):
                    domain = _domain_from_url(str(getattr(base, "job_company_website", "") or ""))
                    if not domain:
                        resolved = await _clearbit_company_suggest(str(base.company or "").strip())
                        domain = (resolved or {}).get("domain") or ""
                    if domain:
                        guessed = _guess_email(str(base.name or "").strip(), domain)
                        if guessed:
                            base.email = guessed
            except Exception:
                # best-effort only
                pass

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
        logger.exception("Failed to verify contacts")
        return ContactVerificationResponse(
            success=False,
            message=f"Verification encountered an error: {str(e)[:200]}",
            verified_contacts=[],
        )


@router.post("/improve-linkedin-note", response_model=ImproveLinkedInNoteResponse)
async def improve_linkedin_note(request: ImproveLinkedInNoteRequest) -> ImproveLinkedInNoteResponse:
    """
    Rewrite a LinkedIn connection request note to sound more human:
    casual/warm/personal but professional enough for first contact.
    This note should be profile-based (no role/job application framing).
    Enforces the app constraints: <=200 chars (or request.limit) and no em dashes.
    """
    try:
        limit = int(request.limit or 200)
        limit = max(120, min(limit, 300))  # guardrails

        # Always provide a reasonable deterministic improvement, even without AI.
        fallback = _sanitize_linkedin_note(_deterministic_improve_linkedin_note(request), limit)

        client = get_openai_client()
        if not client.should_use_real_llm:
            return ImproveLinkedInNoteResponse(note=fallback, used_ai=False)

        ctx = {
            "note": str(request.note or "").strip(),
            "contact_name": (request.contact_name or "").strip(),
            "contact_title": (request.contact_title or "").strip(),
            "contact_company": (request.contact_company or "").strip(),
            "job_title": (request.job_title or "").strip(),
            "painpoint": (request.painpoint or "").strip(),
            "solution": (request.solution or "").strip(),
            "metric": (request.metric or "").strip(),
            "interesting_facts": [str(f).strip() for f in (request.interesting_facts or []) if str(f).strip()][:3],
            "post_topics": [str(t).strip() for t in (request.post_topics or []) if str(t).strip()][:3],
            "profile_highlights": [str(h).strip() for h in (request.profile_highlights or []) if str(h).strip()][:3],
            "company_theme": (request.company_theme or "").strip(),
            "limit": limit,
        }

        messages = [
            {
                "role": "system",
                "content": (
                    "You write LinkedIn connection request notes.\n\n"
                    "Goal: Write a short, personalized note that makes the contact want to accept. "
                    "Each note must feel unique to THIS person, not a template.\n\n"
                    "PERSONALIZATION PRIORITY (use the FIRST one that has data):\n"
                    "1. interesting_facts: Reference something specific they did or said. E.g., 'Your work on [fact] really resonated with me.'\n"
                    "2. post_topics: Reference what they post about. E.g., 'Your perspective on [topic] is sharp, I have been thinking about similar problems.'\n"
                    "3. profile_highlights: Reference a career highlight. E.g., 'What you built at [company] is impressive.'\n"
                    "4. company_theme: Reference something about their company. E.g., '[Company]'s approach to [theme] is really interesting.'\n"
                    "5. painpoint: Frame a shared domain interest. E.g., 'I spend a lot of time on [pain area] too.'\n"
                    "6. Only if NOTHING above is available: use company name for a warm but brief note.\n\n"
                    "EXAMPLES of great notes:\n"
                    "- 'Hi Sarah, your post on scaling observability at Datadog was spot-on. I have been working on similar challenges and would love to swap notes.'\n"
                    "- 'Hi Marcus, what you built with the real-time fraud engine at Stripe is impressive. I work in a similar space and would value connecting.'\n"
                    "- 'Hi Priya, I noticed your talk on ML pipeline reliability. That is exactly the problem I have been focused on. Would love to connect.'\n"
                    "- 'Hi James, Acme's approach to developer experience is really thoughtful. I focus on related problems and think we would have a lot in common.'\n\n"
                    "Hard constraints:\n"
                    "- Output MUST be valid JSON ONLY: {\"note\": \"...\"}\n"
                    "- note MUST be a single paragraph, 2-3 sentences max\n"
                    "- note MUST be <= limit characters\n"
                    "- Do NOT use em dashes or en dashes\n"
                    "- Do NOT mention applying for a role, job openings, or hiring\n"
                    "- Do NOT mention the contact's specific job title (it sounds like 'you can help me get a job')\n"
                    "- Do NOT open with 'I noticed you work at [Company]' (it sounds like surveillance)\n"
                    "- Do NOT lead with the sender's metrics or accomplishments\n"
                    "- Do NOT fabricate facts; only reference what is provided in the context\n"
                    "- Do NOT be generic. 'I reviewed your profile' is lazy. Every note must reference something SPECIFIC.\n"
                    "- End with a natural close: 'Would love to connect.' or similar\n\n"
                    "Style: Warm, genuine, peer-to-peer. Like a thoughtful professional who actually looked at their profile.\n"
                ),
            },
            {"role": "user", "content": json.dumps(ctx)},
        ]

        stub_json = {"note": fallback}
        raw = client.run_chat_completion(messages, temperature=0.35, max_tokens=180, stub_json=stub_json)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or {}
        note = str((data.get("note") if isinstance(data, dict) else "") or "").strip()
        note = _sanitize_linkedin_note(note or fallback, limit)
        if len(note) < 30:
            note = fallback
        return ImproveLinkedInNoteResponse(note=note, used_ai=True)
    except Exception as e:
        logger.exception("Failed to improve LinkedIn note")
        raise HTTPException(status_code=500, detail=f"Failed to improve LinkedIn note: {str(e)}")


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
