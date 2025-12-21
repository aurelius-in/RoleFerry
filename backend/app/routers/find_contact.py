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


def _extract_contacts_from_text(text: str, company: str, domain: str, source_url: str) -> List["Contact"]:
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
        s = 0
        if any(k in low for k in ["vp", "vice president", "chief", "director", "head"]):
            s += 3
        if any(k in low for k in ["engineering", "talent", "recruit", "people", "hr"]):
            s += 2
        if "manager" in low:
            s += 1
        return s

    uniq = sorted(uniq, key=lambda t: score(t[1]), reverse=True)
    uniq = uniq[:8]

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

class ContactSearchRequest(BaseModel):
    query: str
    company: Optional[str] = None
    role: Optional[str] = None
    level: Optional[str] = None

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

        # 0) Prefer People Data Labs if configured (real people data)
        if settings.pdl_api_key:
            try:
                pdl = PDLClient(settings.pdl_api_key)
                # best-effort: treat query as company name
                raw = pdl.person_search(company=q, size=12)
                people = pdl.extract_people(raw)

                def _score_person(title: str) -> int:
                    """
                    Rank toward actual hiring decision makers:
                    - Engineering leadership (Head/Director/VP/Manager Eng)
                    - Talent/People leadership (Head/Director/VP Talent/Recruiting/People)
                    De-prioritize sales/account/deal roles and IC-only titles.
                    """
                    low = (title or "").lower()
                    score = 0

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
                    elif any(k in low for k in ["lead", "principal", "staff"]):
                        score += 18
                    else:
                        score += 5

                    # Department relevance
                    eng = any(k in low for k in ["engineering", "engineer", "software", "platform", "infrastructure", "sre", "devops"])
                    talent = any(k in low for k in ["talent", "recruit", "recruiting", "talent acquisition", "people", "hr", "human resources"])

                    if eng:
                        score += 30
                    if talent:
                        score += 30

                    # Extra signals
                    if "hiring" in low or "headcount" in low:
                        score += 10
                    if "operations" in low and talent:
                        score += 6

                    # Slightly penalize pure IC titles unless they are senior/principal (keeps 1-2 around for variety)
                    if any(k in low for k in ["engineer", "developer"]) and not any(k in low for k in ["manager", "director", "head", "vp", "chief"]):
                        score -= 10

                    return score

                scored = [(int(_score_person(p.title)), p) for p in people]
                scored.sort(key=lambda t: t[0], reverse=True)

                def _is_eng_dm(title: str) -> bool:
                    low = (title or "").lower()
                    return (
                        any(k in low for k in ["engineering", "engineer", "software", "platform", "infrastructure", "sre", "devops"])
                        and any(k in low for k in ["manager", "director", "head", "vp", "vice president", "chief"])
                    )

                def _is_talent_dm(title: str) -> bool:
                    low = (title or "").lower()
                    return (
                        any(k in low for k in ["talent", "recruit", "recruiting", "talent acquisition", "people", "hr", "human resources"])
                        and any(k in low for k in ["manager", "director", "head", "vp", "vice president", "chief"])
                    )

                eng_dm = [p for _, p in scored if _is_eng_dm(p.title)]
                talent_dm = [p for _, p in scored if _is_talent_dm(p.title)]
                others = [p for _, p in scored if p not in eng_dm and p not in talent_dm]

                picked: List[Any] = []
                for p in eng_dm[:4]:
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
                    email_guess = ""
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
                    "talking_points_by_contact": {},
                    "opener_suggestions": [
                        "Quick question on your priorities for the role",
                        "Noticed a theme in the job posting — here’s a concrete idea",
                    ],
                    "questions_to_ask": [
                        "What’s the most urgent outcome you need in the next 90 days?",
                        "Where is the team currently feeling the most pain (quality, speed, cost)?",
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
                contacts = _extract_contacts_from_text(page_text, company=company, domain=domain, source_url=fetched["url"])

        # 3) If we still have nothing, surface a clear failure (don't silently fake it)
        if not contacts:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No public decision makers found for that query. "
                    "Try a more specific company name (e.g., 'Google LLC') or provide a company website domain."
                ),
            )

        # GPT helper: decision-maker talking points + outreach angles per contact.
        client = get_openai_client()
        helper_context = {
            "query": request.query,
            "company": request.company,
            "role": request.role,
            "level": request.level,
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
