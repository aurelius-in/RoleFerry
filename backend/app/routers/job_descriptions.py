from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import json
import re
import html as html_lib
import hashlib
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import text as sql_text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from ..db import get_engine
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store

router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)
DEMO_USER_ID = "demo-user"

class JobDescription(BaseModel):
    id: str
    title: str
    company: str
    url: Optional[str] = None
    content: str
    pain_points: List[str]
    required_skills: List[str]
    success_metrics: List[str]
    # Optional enrichments (best-effort)
    location: Optional[str] = None
    work_mode: Optional[str] = None
    employment_type: Optional[str] = None
    salary_range: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    requirements: Optional[List[str]] = None
    benefits: Optional[List[str]] = None
    parsed_at: str

class JobDescriptionResponse(BaseModel):
    success: bool
    message: str
    job_description: Optional[JobDescription] = None
    job_descriptions: Optional[List[JobDescription]] = None

class JobDescriptionsListResponse(BaseModel):
    success: bool
    message: str
    job_descriptions: List[JobDescription]

class JobImportRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None


def _should_retry_jd_llm(content: str, data: Dict[str, Any], *, title: str, company: str) -> bool:
    """
    Conservative second-pass trigger to avoid extra cost/latency unless clearly needed.
    """
    if not isinstance(data, dict) or not data:
        return True
    required_skills = data.get("required_skills") or []
    pain_points = data.get("pain_points") or []
    success_metrics = data.get("success_metrics") or []
    # If model failed title/company extraction but we have plausible heuristics, retry.
    if (not str(data.get("title") or "").strip() and title) or (not str(data.get("company") or "").strip() and company):
        return True
    # If JD is long but extraction is tiny/empty, retry.
    if len((content or "").strip()) > 1200:
        if not isinstance(required_skills, list) or len(required_skills) < 5:
            return True
        if not isinstance(pain_points, list) or len(pain_points) < 2:
            return True
        if not isinstance(success_metrics, list) or len(success_metrics) < 2:
            return True
    return False


def _is_bad_title(s: str) -> bool:
    t = str(s or "").strip()
    low = t.lower()
    if not t:
        return True
    if t.endswith(":"):
        return True
    if any(bad in low for bad in ["you can expect", "how to apply", "who ", "about the company", "similar remote jobs"]):
        return True
    # Too long = likely a sentence/header
    if len(t) > 90 or len(t.split()) > 14:
        return True
    # Titles should not contain explicit pay/rate tokens (these belong in salary_range)
    if re.search(r"\$\s*\d", t) and any(k in low for k in ["/hr", "/hour", "per hour", "hourly", "hr"]):
        return True
    return False


def _is_bad_company(s: str) -> bool:
    t = str(s or "").strip()
    low = t.lower().strip()
    if not t:
        return True
    # UI labels / noise frequently mis-parsed as "company"
    if low in {
        "company",
        "overview",
        "position",
        "location",
        "remote",
        "hybrid",
        "onsite",
        "on-site",
        "full-time",
        "part-time",
        "contract",
        "job post",
        "original job post",
        "company-logo",
        "web-link",
    }:
        return True
    if low.startswith(("company-logo", "company logo", "original job post")):
        return True
    if any(bad in low for bad in ["find any email", "insider connection", "beyond your network"]):
        return True
    if t.endswith(":"):
        return True
    # Too long / sentence-y
    if len(t) > 90 or t.endswith("."):
        return True
    return False


_TITLE_ROLE_TOKENS = [
    "engineer",
    "developer",
    "architect",
    "manager",
    "director",
    "analyst",
    "specialist",
    "scientist",
    "designer",
    "recruiter",
    "product",
    "consultant",
    "administrator",
]


def _sanitize_title(raw: str) -> str:
    """
    Best-effort title cleanup for pasted job-board text.
    Removes common UI noise fragments accidentally captured into the title:
    - salary/rate tokens (e.g., "$90/hr", "90 per hour")
    - location suffixes (e.g., "Dallas, TX")
    - stray person names (e.g., recruiter/author) appended to the header
    """
    t = " ".join(str(raw or "").split()).strip()
    if not t:
        return ""

    # If the header is delimited, prefer the segment that looks like a real title.
    parts = [p.strip() for p in re.split(r"\s+[|•]\s+", t) if p.strip()]
    if len(parts) > 1:
        def score(p: str) -> int:
            low = p.lower()
            sc = 0
            sc += 30 if any(tok in low for tok in _TITLE_ROLE_TOKENS) else 0
            sc -= 40 if re.search(r"\$\s*\d", p) else 0
            sc -= 20 if re.search(r"\b\d+\s*(?:/hr|/hour|per\s+hour|hourly)\b", low) else 0
            sc -= 10 if re.search(r"\b[A-Z][a-z]+,\s*[A-Z]{2}\b", p) else 0
            sc -= max(0, len(p) - 60) // 5
            return sc
        t = sorted(parts, key=score, reverse=True)[0]

    # Remove salary/rate snippets anywhere in the string.
    t = re.sub(r"\$\s*\d[\d,]*(?:\.\d+)?\s*(?:/hr|/hour|per\s+hour|hourly)\b", "", t, flags=re.I).strip()
    t = re.sub(r"\b\d[\d,]*(?:\.\d+)?\s*(?:/hr|/hour|per\s+hour|hourly)\b", "", t, flags=re.I).strip()

    # Remove trailing location fragments.
    t = re.sub(r"\s*[-–—,]\s*\b[A-Z][a-z]+,\s*[A-Z]{2}\b\s*$", "", t).strip()
    t = re.sub(r"\s*\(\s*\b[A-Z][a-z]+,\s*[A-Z]{2}\b\s*\)\s*$", "", t).strip()

    # Remove a trailing person-name fragment if the title already contains a role token.
    # (Avoid stripping common title phrases like "Machine Learning".)
    low = t.lower()
    if any(tok in low for tok in _TITLE_ROLE_TOKENS):
        m = re.search(r"\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\s*$", t)
        if m:
            w1 = m.group(1).lower()
            w2 = m.group(2).lower()
            # If either word looks like a title noun/adjective, don't strip.
            safe = {
                "machine",
                "learning",
                "data",
                "software",
                "full",
                "stack",
                "cloud",
                "senior",
                "junior",
                "staff",
                "principal",
                "lead",
                "engineer",
                "developer",
                "architect",
                "manager",
                "director",
                "analyst",
                "scientist",
                "product",
                "security",
                "platform",
                "systems",
                "site",
                "reliability",
                "devops",
                "sre",
                "qa",
                "test",
                "mobile",
                "frontend",
                "front",
                "end",
                "backend",
                "back",
            }
            if w1 not in safe and w2 not in safe and len(t.split()) >= 4:
                t = re.sub(r"\s+\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b\s*$", "", t).strip()

    # Final cleanup.
    t = re.sub(r"\s{2,}", " ", t).strip().strip(",.;:-")
    return t


def _extract_company_from_company_block(content: str) -> str:
    """
    Many scrapes include a labeled block like:
      Company
      HCA Healthcare
    Also capture patterns like "Insider Connection @HCA Healthcare".
    """
    lines = [ln.strip() for ln in (content or "").splitlines() if ln.strip()]
    if not lines:
        return ""

    # Pattern: "... @Company"
    for ln in lines[:160]:
        m = re.search(r"@\s*([A-Z][A-Za-z0-9&.,'’\-\s]{1,80})\b", ln)
        if m:
            cand = (m.group(1) or "").strip().strip(",.;:-")
            if cand and not _is_bad_company(cand):
                return cand[:120]

    # Labeled Company block
    for i, ln in enumerate(lines[:320]):
        if ln.lower().strip() == "company":
            for j in range(i + 1, min(len(lines), i + 10)):
                cand = (lines[j] or "").strip()
                low = cand.lower()
                if not cand:
                    continue
                if _is_bad_company(cand):
                    continue
                if any(x in low for x in ["company-logo", "company logo", "twitter", "glassdoor", "web-link", "people-size", "people size", "location", "date", "funding", "leadership team", "leader-logo", "leader logo"]):
                    continue
                # Avoid picking job title lines as company
                if any(tok in low for tok in ["engineer", "developer", "manager", "director", "architect", "analyst", "designer"]):
                    # Still allow if it's a known company-like multiword brand ending with Healthcare, Inc, etc.
                    if not re.search(r"\b(healthcare|inc|llc|ltd|corp|corporation|group|systems|labs)\b", low):
                        continue
                if 1 <= len(cand.split()) <= 8 and cand[0].isupper() and not cand.endswith("."):
                    return cand[:120]
    return ""


def _html_to_text(raw_html: str) -> str:
    """
    Very lightweight HTML-to-text. Good enough for job descriptions / listings.
    Avoids adding heavy parsing deps.
    """
    s = raw_html or ""
    # Remove script/style blocks
    # NOTE: backref is \1 (not \\1) because this is a raw regex string.
    s = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", s)
    # Add newlines around common block tags
    s = re.sub(r"(?i)</?(p|div|br|li|ul|ol|h1|h2|h3|h4|h5|h6|section|article|header|footer)[^>]*>", "\n", s)
    # Strip remaining tags
    s = re.sub(r"(?is)<[^>]+>", " ", s)
    s = html_lib.unescape(s)
    # Some sites embed literal backslash-n sequences in text blobs (e.g., "\\nAbout...").
    # Convert those to real newlines so we don't render "\n" in the UI and section parsing works.
    s = s.replace("\\n", "\n")
    # Normalize whitespace
    s = s.replace("\r", "\n")
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


def _extract_google_careers_job_urls(page_html: str) -> List[str]:
    """
    Best-effort extractor for Google Careers results pages.
    We look for job detail paths like:
      /about/careers/applications/jobs/results/<id>
    and ignore the listing results/?... URL.
    """
    if not page_html:
        return []
    # Google pages often embed links as escaped sequences inside JS blobs.
    normalized = (
        page_html.replace("\\u002F", "/")
        .replace("\\/", "/")
        .replace("&amp;", "&")
    )

    # Primary pattern (works on the listing page HTML):
    # href="jobs/results/<id>-<slug>?..."
    hrefs = set(
        re.findall(
            r'href="(jobs/results/[^"]+)"',
            normalized,
            flags=re.I,
        )
    )
    cleaned: List[str] = []
    for h in hrefs:
        if h.startswith("jobs/results/?"):
            # pagination / result links, not job details
            continue
        cleaned.append("https://www.google.com/about/careers/applications/" + h.lstrip("/"))

    # Secondary fallback: absolute-ish paths (rare but keep it)
    paths = set(
        re.findall(
            r"/about/careers/applications/jobs/results/\\d+[\\w/%\\-]*",
            normalized,
            flags=re.I,
        )
    )
    for p in paths:
        if "results/?" in p:
            continue
        cleaned.append("https://www.google.com" + p)

    # Stable order for deterministic demos
    return sorted(set(cleaned))


async def _fetch_url_text(url: str) -> str:
    import httpx

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.text


def _now_iso_z() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


_KNOWN_SKILLS: List[str] = [
    # Languages
    "Python",
    "JavaScript",
    "TypeScript",
    "Java",
    "Kotlin",
    "C",
    "C/C++",
    "C++",
    "Golang",
    "C++",
    "C#",
    "Ruby",
    "PHP",
    "SQL",
    # Frameworks / Frontend
    "React",
    "Next.js",
    "Node.js",
    "NodeJS",
    "Express",
    "Django",
    "Flask",
    "FastAPI",
    "Spring",
    # Cloud / DevOps
    "AWS",
    "GCP",
    "Google Cloud",
    "Azure",
    "Docker",
    "Kubernetes",
    "Terraform",
    "Linux",
    # Data
    "PostgreSQL",
    "MySQL",
    "Redis",
    "Kafka",
    # AI/ML
    "LLM",
    "LLMs",
    "AI",
    "AI Agents",
    "Agentic",
    "AI/ML",
    "ML",
    "Machine Learning",
    "Deep Learning",
    "Process Automation",
    "Automation",
    "BPaaS",
    "BPS",
    "KYC",
    "Data modeling",
    "Ontology",
    # Mobile / Android
    "Android",
    "Jetpack Compose",
    "Jetpack Navigation",
    "Kotlin Coroutines",
    "Coroutines",
    "Kotlin Flow",
    "Flow",
    "Dagger",
    "Dagger 2",
    "MVVM",
    "Clean Architecture",
    "Room",
    "JUnit",
    "Canvas",
    "Custom Views",
    "Background Services",
    "Embedded",
    "Embedded programming",
    "Device drivers",
    "Drivers",
    "FPGA",
    "PCIe",
    "Debugging",
    "Troubleshooting",
    "Version control",
    "Testing",
    "Software testing",
    "System architecture",
    "Architecture",
    "Design patterns",
    # Common platform / growth / customer roles
    "SaaS",
    "Customer Success",
    "Account Management",
    "Growth",
    "Growth Marketing",
    "Performance Marketing",
    "Experimentation",
    "A/B Testing",
    # APIs / Web / Infra
    "API",
    "APIs",
    "REST",
    "GraphQL",
    # Web3 / crypto
    "Web3",
    "NFT",
    "Smart Contracts",
    "Solidity",
    # Tools
    "Salesforce",
    "Excel",
    "PowerPoint",
    "Word",
]


def _extract_requirement_skill_phrases(text: str) -> List[str]:
    """
    If the JD contains a "requirements/qualifications" section, extract a few
    high-signal skill phrases. This is intentionally heuristic + conservative.
    """
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return []

    # Find a requirements-ish header.
    header_re = re.compile(
        r"^(we(?:'|’)d\s+love\s+you\s+to\s+bring|requirements|qualifications|experience/skills\s+required|what\s+you(?:'|’)ll\s+bring|you\s+have)\b",
        re.I,
    )
    stop_re = re.compile(r"^(bonus\s+points|nice\s+to\s+have|preferred|benefits|compensation|location|about\s+us)\b", re.I)
    start = -1
    for i, ln in enumerate(lines[:200]):
        if header_re.search(ln):
            start = i + 1
            break
    # Fallback: no explicit header; detect a block of requirement-ish lines (common in pasted JDs).
    if start < 0:
        reqish = []
        req_line_re = re.compile(
            r"^(\d+\+?\s+years?|must\s+have|strong\s+experience|experience\s+with|ability\s+to|proven\s+ability|required\s+to)\b",
            re.I,
        )
        for ln in lines[:260]:
            s = ln.lstrip("•-* ").strip()
            low = s.lower()
            if not s or len(s) < 6:
                continue
            if any(k in low for k in ["benefits", "salary", "equal opportunity", "apply", "about ascendion", "ascendion is"]):
                continue
            if req_line_re.search(s) or re.search(r"\bboolean\b", low) or re.search(r"\bats\b", low):
                reqish.append(s[:160])
            if len(reqish) >= 14:
                break
        if not reqish:
            return []
        chunk = reqish
    else:
        chunk: List[str] = []
        for ln in lines[start : start + 40]:
            if stop_re.search(ln):
                break
            # Capture bullet-ish lines, or short requirement lines.
            cleaned = ln.lstrip("•-* ").strip()
            if len(cleaned) < 6:
                continue
            chunk.append(cleaned[:160])
            if len(chunk) >= 14:
                break

    if not chunk:
        return []

    blob = " \n ".join(chunk)
    # Start with known skill matches, then add a few simple phrases.
    skills = _extract_skills(blob)

    # Add a couple phrase-y skills if present.
    phrase_patterns = [
        ("computer science", "Computer science"),
        ("product experimentation", "Product experimentation"),
        ("performance marketing", "Performance marketing"),
        ("customer-facing", "Customer-facing experience"),
        ("stakeholder", "Stakeholder management"),
        ("crm", "CRM"),
        # Recruiting / sourcing
        ("boolean", "Boolean search"),
        ("search string", "Boolean search"),
        ("ats", "ATS"),
        ("applicant tracking", "ATS"),
        ("sourcing", "Candidate sourcing"),
        ("full lifecycle recruiting", "Full-cycle recruiting"),
        ("full-cycle recruiting", "Full-cycle recruiting"),
        ("recruiting", "Recruiting"),
        ("job boards", "Job boards"),
        ("requisitions", "Requisition management"),
        ("executive", "Executive stakeholder communication"),
    ]
    low = blob.lower()
    for needle, label in phrase_patterns:
        if needle in low:
            skills.append(label)

    # De-dupe while preserving order
    out: List[str] = []
    seen = set()
    for s in skills:
        k = s.strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(s.strip())
    return out[:12]


def _infer_work_mode_from_text(text: str) -> str:
    t = (text or "").lower()
    if not t.strip():
        return "unknown"
    # Some JDs explicitly say they're distributed/no office; treat as remote even if the page has "On-site" UI noise.
    if any(k in t for k in ["100% distributed", "100 percent distributed", "no office", "distributed setting", "remote-first", "remote first", "asynchronous culture"]):
        return "remote"
    if any(k in t for k in ["fully remote", "remote (", "remote)", "work from home", "wfh", "hiring remotely"]):
        return "remote"
    if "hybrid" in t:
        return "hybrid"
    if any(k in t for k in ["in-office", "in office", "in-person", "in person", "on-site", "onsite"]):
        return "onsite"
    return "unknown"


def _infer_employment_type_from_text(text: str) -> str:
    t = (text or "").lower()
    if not t.strip():
        return "unknown"
    # Check explicit job type markers first; "non-internship" appears in some JDs and should not be classified as internship.
    if "full time" in t or "full-time" in t:
        return "full-time"
    if "part time" in t or "part-time" in t:
        return "part-time"
    if "contract" in t or "contractor" in t or "1099" in t:
        return "contract"
    if re.search(r"\bnon[-\s]?internship\b", t):
        # Explicitly not an internship
        return "unknown"
    if re.search(r"\bintern(?:ship)?\b", t):
        return "internship"
    if "contract" in t or "contractor" in t or "1099" in t:
        return "contract"
    if "part time" in t or "part-time" in t:
        return "part-time"
    if "full time" in t or "full-time" in t:
        return "full-time"
    return "unknown"


def _extract_salary_range(text: str) -> Optional[str]:
    s = text or ""
    if not s.strip():
        return None
    # Common patterns: "$180k – $210k", "$180,000/year - $210,000/year", "$110,000 - $150,000"
    patterns = [
        r"(\$\s?\d{2,3}\s?k\s*[–\-]\s*\$\s?\d{2,3}\s?k)",
        r"(\$\s?\d{2,3}\s?[kK]\s*/\s?yr\s*[–\-]\s*\$\s?\d{2,3}\s?[kK]\s*/\s?yr)",
        r"(\$\s?\d{2,3}(?:,\d{3})\s*(?:/year|per year)?\s*[–\-]\s*\$\s?\d{2,3}(?:,\d{3})\s*(?:/year|per year)?)",
        # "$92,000.00-$153,000.00" (decimals, no spaces)
        r"(\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?\s*[–\-]\s*\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?)",
        # Hourly rates: "$80 - $100 an hour", "$80 - $100 per hour", "$80-$100/hr"
        r"(\$\s?\d{1,3}(?:\.\d{1,2})?\s*[–\-]\s*\$\s?\d{1,3}(?:\.\d{1,2})?\s*(?:an?\s+hour|per\s+hour|/hour|/hr|hr)\b)",
        r"(\$\s?\d{1,3}(?:\.\d{1,2})?\s*(?:an?\s+hour|per\s+hour|/hour|/hr|hr)\b)",
        # "Derived Salary: $207562 - $345938/Year" (no commas, 6 digits)
        r"(derived\s+salary:\s*\$\s?\d{3,6}(?:,\d{3})?\s*[–\-]\s*\$\s?\d{3,6}(?:,\d{3})?\s*/\s*(?:year|yr))",
        # "$207,562 - 345,938 / Year" (second value sometimes missing $)
        r"(\$\s?\d{3,6}(?:,\d{3})?\s*[–\-]\s*\d{3,6}(?:,\d{3})?\s*/\s*(?:year|yr))",
        # "$207562 - $345938/Year" (no label)
        r"(\$\s?\d{3,6}(?:,\d{3})?\s*[–\-]\s*\$\s?\d{3,6}(?:,\d{3})?\s*/\s*(?:year|yr))",
        r"(\b\d{2,3}(?:,\d{3})\s*[–\-]\s*\d{2,3}(?:,\d{3})\s*(?:usd)?\s*/\s*year\b)",
        r"(salary\s+range:\s*\$\s?\d[\d,]+.*?\$\s?\d[\d,]+)",
        # USAJobs often formats as:
        # Salary
        # $99,325 to - $190,804 per year
        r"(\$\s?\d[\d,]+\s*to\s*[-–—]?\s*\$\s?\d[\d,]+\s*per\s+year)",
        r"(salary\s*\n\s*\$\s?\d[\d,]+\s*to\s*[-–—]?\s*\$\s?\d[\d,]+\s*per\s+year)",
    ]
    for pat in patterns:
        m = re.search(pat, s, flags=re.I)
        if m:
            out = str(m.group(1)).strip()
            out = re.sub(r"\s+", " ", out)
            return out[:120]
    return None


def _extract_location_hint(text: str) -> Optional[str]:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return None
    # Look for explicit Location / Job Location blocks
    for i, ln in enumerate(lines[:120]):
        low = ln.lower()
        # Common listing-style: "Today • San Antonio, TX" / "San Antonio, TX"
        m_city = re.search(r"\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z]{2})\b", ln)
        if m_city and len(m_city.group(1)) <= 40:
            return m_city.group(1)
        if low.strip() in {"remote", "us remote", "u.s. remote"}:
            return "Remote"
        if low in {"location", "job location"} or low.startswith("location:"):
            # Try same line after colon
            if ":" in ln:
                v = ln.split(":", 1)[1].strip()
                if v:
                    return v[:80]
            # Otherwise take next non-empty line(s)
            if i + 1 < len(lines):
                v = lines[i + 1].strip()
                if v and len(v) <= 80:
                    return v
        if low.startswith("remote") and "united states" in low:
            # "Remote (United States)"
            return "Remote (United States)"

    # USAJobs-style "Location" block often appears later:
    # Location
    # 1 vacancy in the following location:
    # New York, NY
    for i, ln in enumerate(lines[:260]):
        low = ln.lower().strip()
        if low == "location":
            for j in range(i + 1, min(len(lines), i + 10)):
                cand = lines[j].strip()
                if not cand:
                    continue
                if "vacancy" in cand.lower():
                    continue
                m_city = re.search(r"\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z]{2})\b", cand)
                if m_city and len(m_city.group(1)) <= 40:
                    return m_city.group(1)
            break
    return None


def _extract_section_lines(
    text: str,
    header_patterns: List[str],
    *,
    max_lines: int = 10,
    stop_patterns: Optional[List[str]] = None,
) -> List[str]:
    """
    Best-effort extraction of bullet-ish lines after a section header.
    """
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return []
    header_re = re.compile(r"^(?:" + "|".join(header_patterns) + r")\b", re.I)
    if stop_patterns is None:
        stop_patterns = [
            "salary",
            "salary range",
            "perks",
            "benefits",
            "bonus points",
            "nice to have",
            "location",
            "about us",
            "about the job",
            "corporate values",
            "equal opportunity",
        ]
    stop_re = re.compile(r"^(?:" + "|".join(stop_patterns) + r")\b", re.I)
    start = -1
    for i, ln in enumerate(lines[:240]):
        if header_re.search(ln):
            start = i + 1
            break
    if start < 0:
        return []
    out: List[str] = []
    for ln in lines[start : start + 60]:
        if stop_re.search(ln):
            break
        s = ln.lstrip("•-* ").strip()
        if len(s) < 6:
            continue
        # Skip obvious UI noise
        low = s.lower()
        if any(bad in low for bad in [
            "apply now",
            "save",
            "posted:",
            "recruiter recently active",
            "actively hiring",
            "get 50% off",
            "premium",
            "reactivate premium",
            "cancel anytime",
            "meet the hiring team",
            "people you can reach out to",
            "show match details",
            "help me stand out",
            "message",
        ]):
            continue
        out.append(s[:200])
        if len(out) >= max_lines:
            break
    return out


def _extract_remotive_title_company(content: str) -> tuple[str, str]:
    """
    Remotive-style / aggregator paste often includes a strong header like:
      "[Hiring] Senior Independent Software Developer @A.Team"
      "Senior Independent Software Developer"
      "@A.Team"
    Extract it before generic heuristics.
    """
    lines = [ln.strip() for ln in (content or "").splitlines() if ln.strip()]
    if not lines:
        return "", ""

    top = " \n ".join(lines[:25])

    # Pattern 1: [Hiring] Title @Company
    m = re.search(r"^\[hiring\]\s*(.+?)\s*@\s*([A-Za-z0-9&.\-’'· ]{1,80})\s*$", lines[0], flags=re.I)
    if m:
        return (m.group(1) or "").strip()[:120], (m.group(2) or "").strip()[:120]

    m2 = re.search(r"\[hiring\]\s*(.+?)\s*@\s*([A-Za-z0-9&.\-’'· ]{1,80})", top, flags=re.I)
    if m2:
        return (m2.group(1) or "").strip()[:120], (m2.group(2) or "").strip()[:120]

    # Pattern 2: Title on one line, then "@Company" on next line.
    for i in range(min(len(lines) - 1, 25)):
        a = (lines[i] or "").strip()
        b = (lines[i + 1] or "").strip()
        if not a or not b:
            continue
        if b.startswith("@") and len(b) <= 40 and not a.endswith(":"):
            title = a.strip().strip("-—|")
            company = b.lstrip("@").strip()
            if title and company:
                return title[:120], company[:120]

    return "", ""


def _extract_expectations_as_benefits(content: str, max_lines: int = 10) -> List[str]:
    """
    Posts like A.Team don't have a 'Benefits' header, but do have:
      "As part of A·Team, you can expect:" followed by perk-like bullets/paras.
    Treat those as benefits/perks (not pain points).
    """
    header_patterns = [r"as part of .* you can expect"]
    stop_patterns = [
        "how to apply",
        "what you(?:'|’)?ll do",
        "who .* is for",
        "who .* is not for",
        "our long-term vision",
        "about the company",
        "similar remote jobs",
        "salary",
        "job type",
        "posted",
    ]
    return _extract_section_lines(content, header_patterns, max_lines=max_lines, stop_patterns=stop_patterns)


def _extract_who_is_for_as_requirements(content: str, max_lines: int = 12) -> List[str]:
    """
    Convert "Who X is for / not for" blocks into requirement-style lines.
    """
    out: List[str] = []

    # Must be located in ... (location restriction)
    m_loc = re.search(
        r"\bmust\s+be\s+located\s+in\s+([A-Za-z,\s/]+?)(?:\s+to\s+apply|\.|\n)",
        content or "",
        flags=re.I,
    )
    if m_loc:
        loc = " ".join((m_loc.group(1) or "").split()).strip().strip(".")
        if loc:
            out.append(f"Location restriction: must be located in {loc}.")

    for_lines = _extract_section_lines(
        content,
        [r"who .* is for", r"who .* is this for"],
        max_lines=8,
        stop_patterns=["who .* is not for", "how to apply", "about the company", "our long-term vision", "similar remote jobs"],
    )
    not_for_lines = _extract_section_lines(
        content,
        [r"who .* is not for"],
        max_lines=8,
        stop_patterns=["our long-term vision", "about the company", "how to apply", "similar remote jobs"],
    )

    for ln in for_lines:
        s = ln.strip().strip(".")
        if s:
            out.append(s[:200] + ("." if not s.endswith(".") else ""))
    for ln in not_for_lines:
        s = ln.strip().strip(".")
        if s:
            out.append(("Not a fit if: " + s)[:200] + ("." if not s.endswith(".") else ""))

    # De-dupe preserve order
    seen = set()
    dedup: List[str] = []
    for s in out:
        k = re.sub(r"\s+", " ", (s or "").lower()).strip()
        if not k or k in seen:
            continue
        seen.add(k)
        dedup.append(s)
        if len(dedup) >= max_lines:
            break
    return dedup


def _extract_explicit_skills_block(text: str) -> List[str]:
    """
    LinkedIn/Indeed often include an explicit 'Skills' block near the top, e.g.:
      Skills
      Version control
      System architecture design
      Software testing
      + show more
    Extract those tokens (they are frequently higher-signal than global keyword scanning).
    """
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return []
    start = -1
    for i, ln in enumerate(lines[:160]):
        if ln.strip().lower() == "skills":
            start = i + 1
            break
    if start < 0:
        return []
    out: List[str] = []
    for ln in lines[start : start + 30]:
        low = ln.lower().strip()
        if not low:
            continue
        # Stop when we hit UI boundaries or the next section of the JD.
        if any(k in low for k in [
            "+ show more",
            "do you have experience",
            "job details",
            "full job description",
            "profile insights",
            "about the job",
            "about you",
            "what you'll be doing",
            "what you’ll be doing",
            "requirements",
            "benefits",
            "our tech",
            "about the company",
        ]):
            break
        # short-ish skills, not paragraphs
        s = ln.strip("•-* ").strip()
        if len(s) < 3 or len(s) > 60:
            continue
        # Exclude obvious locations (e.g., "San Francisco, CA") from being treated as skills.
        if re.search(r"\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z]{2}\b", s):
            continue
        # Exclude role titles from explicit skills blocks.
        if any(tok in low for tok in ["engineer", "developer", "architect", "manager", "director", "analyst", "designer"]):
            # Allow specific tech tokens like "Engineering" aren't in our skill list anyway; keep conservative.
            continue
        # skip obvious UI-ish tokens
        if any(bad in low for bad in ["premium", "apply", "save", "clicked apply"]):
            continue
        out.append(s)
        if len(out) >= 12:
            break
    # de-dupe preserve order
    seen = set()
    dedup: List[str] = []
    for s in out:
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        dedup.append(s)
    return dedup[:12]


def _extract_skills(text: str) -> List[str]:
    """
    Best-effort skill extraction from raw job description text.
    We only return skills we can actually find in the content, rather than demo defaults.
    """
    hay = f" {text or ''} ".lower()
    found: List[str] = []
    for skill in _KNOWN_SKILLS:
        needle = skill.lower()
        # Very light boundary matching; works well enough for common skill tokens.
        # Special-case: "C" matches lots of non-skill text (e.g., "C-level").
        if needle == "c":
            if re.search(r"(^|[^a-z0-9])c([^a-z0-9]|$)", hay) and not re.search(r"\bc\s*[-–—]\s*level\b", hay):
                found.append(skill)
            continue
        if re.search(rf"(^|[^a-z0-9]){re.escape(needle)}([^a-z0-9]|$)", hay):
            found.append(skill)
    # De-dupe while preserving order
    seen = set()
    out: List[str] = []
    for s in found:
        if s not in seen:
            out.append(s)
            seen.add(s)
    return out


def _extract_requirement_lines_fallback(content: str, max_lines: int = 12) -> List[str]:
    """
    Some pasted JDs have no explicit 'Requirements' header but include a block of requirement lines.
    Capture those lines so the UI doesn't show empty Requirements.
    """
    lines = [ln.strip() for ln in (content or "").splitlines() if ln.strip()]
    if not lines:
        return []
    out: List[str] = []
    seen = set()
    req_line_re = re.compile(
        r"^(\d+\+?\s+years?|must\s+have|strong\s+experience|experience\s+with|ability\s+to|proven\s+ability|required\s+to)\b",
        re.I,
    )
    for ln in lines[:320]:
        s = ln.lstrip("•-* ").strip()
        low = s.lower()
        if not s or len(s) < 6 or len(s) > 220:
            continue
        if any(k in low for k in ["benefits", "salary", "equal opportunity", "ascendion is", "about ascendion", "want to change the world"]):
            continue
        if req_line_re.search(s) or re.search(r"\bboolean\b", low) or re.search(r"\bats\b", low) or "requisitions" in low:
            key = re.sub(r"\s+", " ", low).strip()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
        if len(out) >= max_lines:
            break
    return out


def _infer_pain_points_from_requirements(requirements: List[str], max_items: int = 3) -> List[str]:
    """
    Convert requirement-style lines into business challenges when no explicit 'challenge/problem' language exists.
    Keeps them grounded and non-salary.
    """
    out: List[str] = []
    seen = set()
    blob = " ".join(requirements or []).lower()
    candidates: List[str] = []
    if "boolean" in blob:
        candidates.append("Source hard-to-find candidates using advanced search (Boolean strings).")
    if "ats" in blob or "applicant tracking" in blob:
        candidates.append("Operate efficiently within an ATS while managing recruiting workflow end-to-end.")
    if "requisition" in blob or "volume" in blob:
        candidates.append("Manage a high volume of open requisitions across multiple stakeholders.")
    if "executive" in blob:
        candidates.append("Communicate effectively with executive stakeholders to align on open roles.")
    if "job board" in blob:
        candidates.append("Source candidates across multiple job boards to build qualified pipelines.")

    for c in candidates:
        k = c.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
        if len(out) >= max_items:
            break
    return out


def _merge_label_bullets(lines: List[str]) -> List[str]:
    """
    Merge label-only bullets like:
      - "Education:"
      - "Experience:"
    with the next line if present.
    """
    if not lines:
        return []
    out: List[str] = []
    i = 0
    while i < len(lines):
        cur = str(lines[i] or "").strip()
        low = cur.lower().strip()
        if cur.endswith(":") and low.rstrip(":") in {"education", "experience", "requirements", "qualifications"}:
            nxt = str(lines[i + 1] or "").strip() if i + 1 < len(lines) else ""
            if nxt:
                merged = f"{cur} {nxt}".strip()
                out.append(merged[:220])
                i += 2
                continue
        out.append(cur[:220])
        i += 1
    return [x for x in out if x and x.strip()]


def _clean_required_skills(skills: List[str]) -> List[str]:
    """
    Remove bogus/low-signal skill tokens (e.g. 'C') and normalize recruiter-domain skills.
    """
    if not skills:
        return []
    out: List[str] = []
    seen = set()
    for s in skills:
        t = str(s or "").strip()
        if not t:
            continue
        low = t.lower()
        # Drop single-letter skills (common false positive from "SC" etc.)
        if len(t) == 1:
            continue
        if low in {"c/c++"}:
            continue
        # Normalize common recruiter tokens
        repl = {
            "ats": "ATS",
            "applicant tracking system": "ATS",
            "boolean search": "Boolean search",
            "candidate sourcing": "Candidate sourcing",
            "full-cycle recruiting": "Full-cycle recruiting",
            "full lifecycle recruiting": "Full-cycle recruiting",
            "stakeholder management": "Stakeholder management",
            "requisition management": "Requisition management",
        }
        norm = repl.get(low, t)
        key = norm.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(norm)
    return out[:20]


def _condense_pain_points(pain_points: List[str], max_words: int = 18, max_items: int = 8) -> List[str]:
    """
    Ensure pain points are scannable (no paragraphs).
    """
    if not pain_points:
        return []
    out: List[str] = []
    seen = set()
    for p in pain_points:
        raw = " ".join(str(p or "").split()).strip()
        if not raw:
            continue
        # If it's a paragraph, take the first sentence/clause.
        first = re.split(r"(?<=[.!?])\s+", raw)[0].strip()
        first = re.split(r"[;–—-]\s+", first)[0].strip()
        words = first.split()
        if len(words) > max_words:
            first = " ".join(words[:max_words]).strip()
        if first and first[-1] not in ".!?":
            first += "."
        key = first.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(first)
        if len(out) >= max_items:
            break
    return out


def _best_effort_title_company(content: str, url: Optional[str]) -> tuple[str, str]:
    title = ""
    company = ""

    lines = [ln.strip() for ln in (content or "").splitlines() if ln.strip()]

    # USAJobs summary pattern:
    # "The U.S. Court of International Trade located in New York, New York is recruiting for the position of Programmer/Project Lead."
    if lines:
        blob = " ".join(lines[:40])
        m = re.search(
            r"\bThe\s+(.+?)\s+located\s+in\s+.+?\s+is\s+recruiting\s+for\s+the\s+position\s+of\s+(.+?)(?:\.\s|$)",
            blob,
            flags=re.I,
        )
        if m:
            cand_company = (m.group(1) or "").strip().strip(",.;:-")
            cand_title = (m.group(2) or "").strip().strip(",.;:-")
            if cand_company and len(cand_company) <= 120 and cand_company.lower() not in {"the public"}:
                company = cand_company[:120]
            if cand_title and len(cand_title) <= 120:
                title = cand_title[:120]

    def _looks_like_company_header_line(s: str) -> bool:
        cand = (s or "").strip()
        if not cand:
            return False
        low = cand.lower()
        if any(x in low for x in ["out of 5 stars", "followers", "people clicked apply", "job post", "profile insights", "job details"]):
            return False
        if re.search(r"\$\s?\d", cand):
            return False
        # location-ish
        if re.search(r"\b[A-Z][a-z]+,\s*[A-Z]{2}\b", cand) or re.search(r"\b\d{5}\b", cand):
            return False
        # too long / sentence-y
        if len(cand) > 80 and cand.endswith("."):
            return False
        return True

    # LinkedIn paste: "About the company" -> next line is often the company name.
    # This is more reliable than "top lines" which can contain UI noise like "Responses managed off LinkedIn".
    for i, ln in enumerate(lines[:220]):
        if ln.strip().lower() == "about the company":
            for j in range(i + 1, min(len(lines), i + 10)):
                cand = (lines[j] or "").strip()
                low = cand.lower()
                if not cand:
                    continue
                if any(bad in low for bad in ["followers", "follow", "employees", "on linkedin", "software development"]):
                    continue
                if re.search(r"\d", cand) and "speechify" not in low:
                    # skip pure numeric counts like followers/employee counts
                    continue
                company = cand[:120]
                break
        if company:
            break

    # Many job boards use "About {Company}" rather than "About the company".
    if not company:
        for ln in lines[:260]:
            m = re.search(
                r"^about\s+([A-Z][A-Za-z0-9&.,'’\-]+(?:\s+[A-Z][A-Za-z0-9&.,'’\-]+){0,4})\b",
                (ln or "").strip(),
                flags=re.I,
            )
            if not m:
                continue
            cand = (m.group(1) or "").strip().strip(":")
            low = cand.lower()
            if low in {"the job", "this role", "the role", "our team"}:
                continue
            if 1 <= len(cand.split()) <= 6:
                company = cand[:120]
                break

    def _looks_like_real_title(ln: str) -> bool:
        s = (ln or "").strip()
        if not s or len(s) < 4:
            return False
        low = s.lower()
        # Colons are almost always section headers in pasted JDs.
        if s.endswith(":"):
            return False
        # Never treat a sentence as the title (common failure: responsibility lines).
        if s.endswith("."):
            return False
        # Reject multi-sentence lines (e.g., "... platforms. A") which are never real titles.
        if "." in s and not re.search(r"\b(?:sr|jr|dr)\.\b", low):
            return False
        # "You will ..." / "We are ..." are almost always body copy, not the title.
        if low.startswith(("you will ", "we are ", "we're ", "we’re ")):
            return False
        # Avoid common section headers and obvious non-titles
        if any(low.startswith(h) for h in ["about us", "about the role", "benefits", "location", "requirements", "qualifications"]):
            return False
        if low in {"required documents", "how to apply", "summary", "this job is open to", "duties", "additional information"}:
            return False
        if any(bad in low for bad in ["grade this role", "add to job tracker", "business challenges", "required skills", "success metrics", "jd jargon"]):
            return False
        if re.search(r"\bis\s+hiring\b", low):
            return False
        if "responses managed off linkedin" in low:
            return False
        if "get ai-powered advice" in low or "premium" in low:
            return False
        # Prefer lines with role-like tokens, but allow others
        # NOTE: avoid treating "lead ..." imperative sentences as titles by not using bare "lead" here.
        role_tokens = ["engineer", "architect", "manager", "director", "analyst", "specialist", "designer", "recruiter", "coach", "developer", "product manager", "solutions architect", "sales engineer"]
        if any(t in low for t in role_tokens):
            return True
        # Otherwise accept if it looks like a concise title-case line (no long sentences)
        if len(s.split()) <= 12 and s[0].isupper() and not s.endswith("."):
            return True
        return False

    def _has_role_token(ln: str) -> bool:
        low = (ln or "").lower()
        # Require a real title noun. "lead" alone is too ambiguous (often an imperative verb).
        role_tokens = ["engineer", "architect", "manager", "director", "analyst", "specialist", "designer", "recruiter", "coach", "developer", "product manager", "solutions architect", "sales engineer"]
        if any(t in low for t in role_tokens):
            return True
        # Allow "lead" only when paired with a title noun (e.g., "Tech Lead Engineer")
        if "lead" in low and any(t in low for t in ["engineer", "architect", "manager", "developer", "product"]):
            return True
        return False

    # Title: pass 1 – prefer lines that contain role tokens (avoids title=company).
    # Extra pass 0 – prefer explicit "Role - ..." titles in the first few lines.
    # Extra pass -1 – Remotive-style "[Hiring] Title @Company"
    if lines and not title:
        t0, c0 = _extract_remotive_title_company(content)
        if t0:
            title = t0
        if c0:
            company = c0

    for ln in lines[:8]:
        if " - " in ln and _has_role_token(ln) and _looks_like_real_title(ln):
            title = ln[:120]
            break
    for ln in lines[:20]:
        if _has_role_token(ln) and _looks_like_real_title(ln):
            title = ln[:120]
            break
    # Title: pass 2 – any acceptable title-like line.
    if not title:
        for ln in lines[:20]:
            if _looks_like_real_title(ln):
                title = ln[:120]
                break
    if not title and lines:
        title = lines[0][:120]

    title = _sanitize_title(title)

    # If we ended up with an obviously too-long title, try to recover a better one.
    if title and (len(title) > 90 or len(title.split()) > 14):
        for ln in lines[:40]:
            if _has_role_token(ln) and _looks_like_real_title(ln) and len(ln) <= 90:
                title = ln[:120]
                break

    # Company: explicit markers win.
    for ln in lines[:60]:
        low = ln.lower()
        for key in ("company:", "employer:", "organization:", "organisation:", "about us:", "about:"):
            if low.startswith(key):
                company = (ln.split(":", 1)[1].strip() or "")[:120]
                break
        if company:
            break

    # Company: labeled "Company" block (common in scraped job pages)
    if not company:
        cand = _extract_company_from_company_block(content)
        if cand:
            company = cand[:120]

    # Company: common narrative openings like "Kochava is hiring..." / "Kochava provides..."
    # This is very common for pasted JDs where the first line contains the company name.
    if not company and lines:
        _COMPANY_STOPWORDS = {
            # Common UI / section words
            "applied",
            "grade",
            "role",
            "add",
            "delete",
            "business",
            "challenges",
            "required",
            "skills",
            "success",
            "metrics",
            "jargon",
            "apply",
            "quick",
            "upload",
            "resume",
            "login",
            "log",
            "in",
            "have",
            "account",
            "description",
            # Common non-company descriptors
            "remote",
            "hybrid",
            "onsite",
            "on-site",
            "full-time",
            "part-time",
            "contract",
            # Title-ish words we never want as a company
            "engineer",
            "engineering",
            "director",
            "manager",
            "lead",
            "principal",
            "staff",
            "team",
            "teams",
            "logo",
            "company",
            # Generic words that sometimes get mis-detected (e.g. "This is...")
            "this",
            "we",
            "our",
            "you",
            "us",
            "the",
            "a",
            "an",
            "and",
            "or",
            "as",
            "today",
            "viewed",
            "interview",
            "overview",
        }

        # Indeed-style / job-board header: company often appears as a standalone line near the top
        # right after a title-like line and before rating/location/salary blocks.
        if not company:
            for ln in lines[:12]:
                s = (ln or "").strip()
                low = s.lower()
                if not s or len(s) > 80:
                    continue
                # Job board header noise (date/location lines)
                if "•" in s or low.startswith("today") or low.startswith("viewed on"):
                    continue
                if "company logo" in low:
                    continue
                if low in _COMPANY_STOPWORDS:
                    continue
                if low == "the interview":
                    continue
                if "linkedin" in low:
                    continue
                # Job board UI / CTA noise that often appears near the top
                if any(x in low for x in ["quick apply", "apply on employer site", "upload resume", "have an account", "log in"]):
                    continue
                if low in {"apply", "save"}:
                    continue
                if any(bad in low for bad in ["out of 5 stars", "profile insights", "job details", "full job description"]):
                    continue
                if low in {"required documents", "how to apply", "summary"}:
                    continue
                # Skip obvious location/address/salary lines
                if re.search(r"\$\s?\d", s) or re.search(r"\b\d{5}\b", s):
                    continue
                if "·" in s:
                    continue
                if re.search(r"\b(?:drive|dr|street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|way|court|ct)\b", low):
                    continue
                # Avoid picking the title line itself
                if title and s.lower() == title.lower():
                    continue
                # A reasonable company line is usually 1-6 words and titlecased.
                if 1 <= len(s.split()) <= 6 and s[0].isupper() and not s.endswith(".") and not _has_role_token(s):
                    # Strip ratings like "STAND 8 - 5.0" -> "STAND 8"
                    s2 = re.sub(r"\s*[-–—]\s*\d+(\.\d+)?\s*$", "", s).strip()
                    company = (s2 or s)[:120]
                    break

        # If the first line looks like "Role - job post", treat the next non-noise line as company.
        if not company and lines:
            if "job post" in (lines[0] or "").lower():
                for j in range(1, min(len(lines), 10)):
                    cand = (lines[j] or "").strip()
                    if not _looks_like_company_header_line(cand):
                        continue
                    if _has_role_token(cand):
                        continue
                    low = cand.lower()
                    if any(x in low for x in ["quick apply", "apply", "upload resume", "log in"]):
                        continue
                    company = cand[:120]
                    # Attach "(part of ...)" style follow-up line if present.
                    if j + 1 < len(lines):
                        nxt = (lines[j + 1] or "").strip()
                        if nxt.startswith("(") and "part of" in nxt.lower() and len(nxt) <= 80:
                            company = f"{company} {nxt}".strip()[:120]
                    break

        top_blob = " ".join(lines[:80])

        # Company: patterns like "for Optima Tax Relief, LLC (“Optima”)"
        if not company and lines:
            m = re.search(
                r"\bfor\s+([A-Z][A-Za-z0-9&.,'\- ]{2,80}?)(?:\s*\(|\s*[,–—-]\s*|\s+\b(?:LLC|Inc\.?|Ltd\.?|Corporation|Corp\.?)\b)",
                top_blob,
            )
            if m:
                cand = (m.group(1) or "").strip().strip(",")
                if cand and cand.lower() not in _COMPANY_STOPWORDS:
                    company = cand[:120]

        # Find candidates of the form "X is ..." / "X provides ..." / "X began ..."
        # and pick the best (prefer domain-looking tokens like Lamatic.ai).
        cand_matches = re.findall(
            r"\b([A-Z][A-Za-z0-9&.\-]{1,60})\s+(?:"
            r"is\s+hiring|is\s+recruiting|is\s+seeking|provides|began|"
            r"is\s+(?:an|a|the|one\s+of)"
            r")\b",
            top_blob,
            flags=re.I,
        )

        def _mentions(token: str) -> int:
            t = token.lower()
            return sum(1 for ln in lines[:120] if t in ln.lower())

        def _score(token: str) -> int:
            t = token.strip()
            low = t.lower()
            if not t:
                return -10_000
            if low in _COMPANY_STOPWORDS:
                return -10_000
            # Avoid generic single-word tokens that frequently appear in employer boilerplate.
            # They can be real in rare cases, but most of the time they're a bad parse
            # (e.g., "Learning" from "Imagine Learning provides...").
            if low in {"learning", "education", "technology", "technologies", "software", "services"}:
                return -50
            # Strong preference for domain-like names (Lamatic.ai, example.io)
            looks_like_domain = bool(re.search(r"\.[a-z]{2,10}$", low)) or bool(re.search(r"\.[a-z]{2,10}\b", low))
            score = 0
            score += 80 if looks_like_domain else 0
            score += min(40, _mentions(t) * 10)  # repeat-count signal
            # Penalize tokens that are very likely titles/sections
            if any(k in low for k in ["engineer", "engineering", "director", "manager"]):
                score -= 40
            return score

        best = ""
        best_score = -10_000
        for raw in cand_matches:
            t = (raw or "").strip().strip(",.;:-")
            sc = _score(t)
            if sc > best_score:
                best_score = sc
                best = t

        # Require stronger evidence than "some token appeared once".
        # - Accept domain-like brands immediately (Lamatic.ai)
        # - Otherwise require multiple mentions and a meaningful score
        if best:
            low_best = best.lower()
            looks_like_domain = bool(re.search(r"\.[a-z]{2,10}$", low_best)) or bool(re.search(r"\.[a-z]{2,10}\b", low_best))
            mention_ct = _mentions(best)
            if looks_like_domain or (mention_ct >= 2 and best_score >= 20):
                company = best

        # If we only found a single-word company (common failure: "Learning"),
        # upgrade it to the most frequent multi-word brand phrase that includes it (e.g., "Imagine Learning").
        if company and len(company.split()) == 1:
            token = company.strip()
            low_token = token.lower()
            phrase_re = re.compile(r"\b([A-Z][A-Za-z0-9&.'\-]+(?:\s+[A-Z][A-Za-z0-9&.'\-]+){1,3})\b")
            candidates: List[str] = []
            for ln in lines[:220]:
                for ph in phrase_re.findall(ln):
                    if low_token in ph.lower().split():
                        plow = ph.lower()
                        if any(bad in plow for bad in ["apply", "job details", "profile insights", "full job description"]):
                            continue
                        candidates.append(ph.strip())
            best_phrase = ""
            best_ct = 0
            # Prefer shorter phrases first (2 words beats 4 words) if mention counts are similar.
            for ph in sorted(set(candidates), key=lambda s: (len(s.split()), len(s))):
                ct = sum(1 for ln in lines[:300] if ph.lower() in ln.lower())
                if ct >= 2 and ct > best_ct:
                    best_ct = ct
                    best_phrase = ph
            if best_phrase:
                company = best_phrase[:120]

        # If company is still a CTA-ish phrase, drop it.
        if company and any(x in company.lower() for x in ["quick apply", "apply on employer site", "upload resume", "log in"]):
            company = ""

    # If title includes " at {company}", strip it (we display company separately).
    if title and company and company.lower() != "unknown":
        title = re.sub(rf"\s+at\s+{re.escape(company)}\b.*$", "", title, flags=re.I).strip()
        title = re.sub(r"\s{2,}", " ", title).strip()

    def _company_from_url(u: str) -> str:
        try:
            parsed = urlparse(u)
            host = (parsed.netloc or "").lower().split(":")[0].replace("www.", "")
            path = (parsed.path or "").strip("/")
            segs = [s for s in path.split("/") if s]

            # ATS patterns where company is a path segment
            if "boards.greenhouse.io" in host and segs:
                return segs[0]
            if "jobs.lever.co" in host and segs:
                return segs[0]
            if "careers.smartrecruiters.com" in host and segs:
                return segs[0]
            if "ycombinator.com" in host and len(segs) >= 2:
                # /companies/<company>/jobs/<job-id>
                if segs[0].lower() == "companies":
                    return segs[1]
            if "remoteok.com" in host and segs:
                # /remote-jobs/remote-...-<company>-<id>
                # e.g. remote-staff-embedded-systems-engineer-inspiren-1129620
                last = segs[-1]
                m = re.search(r"-([a-z0-9][a-z0-9\\-]+)-\\d+$", last, flags=re.I)
                if m:
                    return m.group(1)
            if "myworkdayjobs.com" in host and segs:
                # /en-US/COMPANY/job/... or /COMPANY/job/...
                for s in segs:
                    if s.lower() in {"en-us", "en", "jobs"}:
                        continue
                    # first "company-like" segment
                    if len(s) >= 2 and re.match(r"^[A-Za-z0-9\\-_.]+$", s):
                        return s
            if "google.com" in host:
                return "Google"

            # Generic domain fallback: prefer the registrable-ish domain label
            labels = [p for p in host.split(".") if p]
            if len(labels) >= 3:
                # careers.microsoft.com -> microsoft
                return labels[-2]
            if len(labels) == 2:
                return labels[0]
        except Exception:
            return ""
        return ""

    # URL-based fallback (improved). Prefer URL patterns before title splitting,
    # because titles frequently contain "Careers" / "Jobs" which are not companies.
    if url and not company:
        cand = _company_from_url(url)
        if cand and cand.lower() not in {"careers", "jobs", "job", "openings"}:
            company = cand

    # Title patterns like "Role - Company", "Role | Company", "Role @ Company"
    if title and not company:
        parts = re.split(r"\s+(?:\|\s+|-\s+|—\s+|@\s+)", title)
        if len(parts) >= 2:
            tail = parts[-1].strip()
            # Filter out common non-company tails
            bad_tail = {"remote", "hybrid", "onsite", "on-site", "full-time", "part-time", "contract", "careers", "jobs", "job", "openings"}
            if tail and tail.lower() not in bad_tail and len(tail) <= 80:
                # Avoid "United States" / locations
                if not re.search(r"\b(united states|usa|canada|uk|london|new york|seattle|san francisco)\b", tail, flags=re.I):
                    company = tail

    # Content patterns: "At Company, ..." near the top.
    if not company:
        top = " ".join(lines[:12])
        m = re.search(r"\b(?:at|join)\s+([A-Z][A-Za-z0-9&.,\-’']+(?:\s+[A-Z][A-Za-z0-9&.,\-’']+){0,4})\b", top)
        if m:
            cand = m.group(1).strip().strip(",.;:-")
            # Guard against generic words
            if cand and cand.lower() not in {"we", "our team", "the company"} and len(cand) <= 80:
                company = cand

    def _pretty_company(s: str) -> str:
        s = (s or "").strip().strip("-—|@")
        s = re.sub(r"[_\-]+", " ", s).strip()
        s = re.sub(r"\bcompany\s+logo\b", "", s, flags=re.I).strip()
        if not s:
            return s
        # Preserve short all-caps brands (IBM, SAP). Otherwise title-case words.
        if len(s) <= 6 and s.upper() == s and s.isalpha():
            return s
        return " ".join([w[:1].upper() + w[1:] if w else w for w in s.split()])

    if not title:
        title = "Job Description"
    if not company:
        company = "Unknown"
    return title, _pretty_company(company)


def _looks_like_job_board_or_listing_url(url: str) -> bool:
    """
    Many "job board search" pages are not individual job descriptions.
    Importing these will usually produce partial HTML and low-quality parses.
    """
    try:
        u = urlparse(url)
        host = (u.netloc or "").lower().replace("www.", "")
        path = (u.path or "").lower()
        qs = (u.query or "").lower()
        # Common job board search/listing patterns (non-exhaustive).
        if "indeed." in host and path.startswith("/jobs"):
            return True
        if "linkedin.com" in host and "/jobs/search" in path:
            return True
        if "wellfound.com" in host and path.startswith("/jobs"):
            return True
        if "otta.com" in host and "/jobs" in path:
            return True
        if "greenhouse.io" in host and ("/search" in path or "/jobs" in path) and "gh_jid" not in qs:
            return True
        if "lever.co" in host and ("?commit=" in qs or path.rstrip("/").endswith("/jobs")):
            return True
    except Exception:
        return False
    return False


def _validate_extracted_job(
    *,
    url: Optional[str],
    content: str,
    title: str,
    company: str,
    required_skills: List[str],
    pain_points: List[str],
    success_metrics: List[str],
) -> Optional[str]:
    """
    Return a human-friendly error message if the extracted job looks incomplete.
    """
    text = (content or "").strip()
    if url and _looks_like_job_board_or_listing_url(url):
        return "That looks like a job board/search page. Please open a specific job posting and paste that job’s URL (or paste the job description text)."

    # Scrapes that only capture header/nav/auth content look like this.
    low = text.lower()
    if any(kw in low for kw in ["enable javascript", "sign in", "log in", "captcha"]) and len(text) < 1200:
        return "Couldn’t extract a full job description from that page (likely blocked by login/captcha). Please paste the job description text instead."

    # Minimum content threshold: below this is almost always partial.
    if len(text) < 400:
        return "Job description content looks too short/partial. Please use a specific job posting URL or paste the job description text."

    # Title/company sanity
    if not title or title.strip().lower() in ["job description", "jobs", "career", "careers"]:
        return "Couldn’t confidently detect a job title from that page. Please use a specific job posting URL or paste the job description text."
    if not company or company.strip().lower() in ["unknown", "careers", "jobs"]:
        # Not fatal by itself, but combined with missing structure is.
        if len(required_skills) < 1 and len(pain_points) < 1 and len(success_metrics) < 1:
            return "Couldn’t confidently detect the company/job details from that page. Please use a specific job posting URL or paste the job description text."

    # Structural signal: require at least a bit of useful extraction.
    if len(required_skills) < 1 and len(pain_points) < 1 and len(success_metrics) < 1:
        return "Couldn’t extract enough structured info (skills/pain points/metrics). Please paste the job description text or try a different job posting URL."

    return None


def _extract_key_lines(content: str, max_items: int, keywords: List[str]) -> List[str]:
    """
    Pull bullet-like lines or strong sentences that look meaningful.
    Used as a reasonable fallback for pain_points / success_metrics when GPT isn't available.
    """
    text = content or ""
    candidates: List[str] = []
    
    # Common patterns for salary/benefits/employment types that are NOT pain points.
    # e.g. "$120k - $150k", "Full-time", "401k", "Benefits include"
    ignore_patterns = [
        # Compensation / employment / benefits
        r"\$\d+",
        r"\d+k\b",
        r"salary",
        r"compensation",
        r"benefits",
        r"401k",
        r"full-time",
        r"part-time",
        r"contract",
        r"per hour",
        r"per year",
        # LinkedIn UI noise / upsells
        r"\bget\s+ai-powered\b",
        r"\bpremium\b",
        r"\bget\s+\d{1,3}%\s+off\b",
        r"\bshow\s+match\s+details\b",
        r"\bhelp\s+me\s+stand\s+out\b",
        r"\breactivate\s+premium\b",
        r"\bcancel\s+anytime\b",
        r"\bpeople\s+you\s+can\s+reach\s+out\s+to\b",
        r"\bmeet\s+the\s+hiring\s+team\b",
        r"\bmessage\b",
        r"\bapply\b",
        r"\bsave\b",
        r"\bresponses\s+managed\s+off\s+linkedin\b",
        # Location / address / job board UI noise (Indeed etc.)
        r"\bjob\s+address\b",
        r"\bestimated\s+commute\b",
        r"\bprofile\s+insights\b",
        r"\bjob\s+details\b",
        r"\bresponded\s+to\s+\d{1,3}%\b",
        r"\bout\s+of\s+5\s+stars\b",
        r"\bwant\s+more\s+jobs\s+like\s+this\b",
        r"\bget\s+jobs\s+in\b",
        r"\bdelivered\s+to\s+your\s+inbox\b",
        r"\bjob\s+alert\s+subscription\b",
        r"\bviewed\s+on\b",
        r"\bterms\s+of\s+service\b",
        r"\bprivacy\s+policy\b",
        r"\b\d{1,5}\s+[A-Za-z0-9 .'\-]+(?:drive|dr|street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|way|court|ct)\b",
        r"\b[A-Za-z .'\-]+,\s*[A-Z]{2}\s*\d{5}\b",
        # Company boilerplate / marketing copy (not challenges/metrics)
        r"\bour\s+mission\b",
        r"\bmission\s+is\b",
        r"\bwe\s+are\s+(?:a|an)\b",
        r"\bwe(?:'re|’re)\s+(?:a|an)\b",
        r"\bprovides?\s+end[\-\s]?to[\-\s]?end\b",
        r"\bend[\-\s]?to[\-\s]?end\s+it\s+solutions\b",
        r"\bwith\s+offices?\s+in\b",
        r"\bcheck\s+out\s+more\b",
        r"\breach\s+out\s+today\b",
        r"\babout\s+us\b",
        r"\bequal\s+opportunity\b",
        r"\bvisit\s+us\s+at\b",
        r"\bclick\s+to\s+reveal\s+url\b",
        r"\bwww\.[a-z0-9\-]+\.[a-z]{2,}\b",
    ]
    ignore_re = re.compile("|".join(ignore_patterns), re.I)

    for raw in text.splitlines():
        ln = raw.strip()
        if not ln:
            continue
        ln = re.sub(r"^[\-\*\u2022]\s+", "", ln)  # remove leading bullets
        if len(ln) < 24:
            continue
        
        # Filter out compensation/employment details
        if ignore_re.search(ln):
            continue

        score = 0
        low = ln.lower()
        if any(k in low for k in keywords):
            score += 2
        if re.search(r"\d|%|\$", ln):
            score += 1
        if score > 0:
            # Keep the full line here; we'll normalize/shorten later without cutting mid-sentence.
            candidates.append((score, ln))  # type: ignore[list-item]

    # Sort by score desc, then keep stable order-ish by first appearance.
    # We already collected in order; stable sort preserves that for ties.
    candidates_sorted = sorted(candidates, key=lambda t: t[0], reverse=True)  # type: ignore[index]
    def _to_max_words_no_mid_sentence(s: str, max_words: int = 35) -> str:
        """
        Return <= max_words words, never cutting mid-sentence.
        If the first sentence is too long, fall back to a short clause and end with a period.
        """
        raw = " ".join(str(s or "").split()).strip()
        if not raw:
            return raw
        words = raw.split()
        if len(words) <= max_words and raw[-1] in ".!?":
            return raw
        if len(words) <= max_words:
            # Add punctuation if missing.
            return raw + ("." if raw[-1] not in ".!?" else "")

        # Prefer sentence boundaries
        sentences = re.split(r"(?<=[.!?])\s+", raw)
        built: List[str] = []
        wc = 0
        for sent in sentences:
            sent = sent.strip()
            if not sent:
                continue
            sw = sent.split()
            if wc + len(sw) > max_words:
                break
            built.append(sent)
            wc += len(sw)
            if wc >= max_words:
                break
        if built:
            out_s = " ".join(built).strip()
            return out_s if out_s[-1] in ".!?" else out_s + "."

        # No usable sentence boundary: take first clause (comma/semicolon/dash), then ensure <= max_words.
        clause = re.split(r"[;,–—-]\s+", raw)[0].strip()
        cw = clause.split()
        if len(cw) > max_words:
            clause = " ".join(cw[:max_words]).strip()
        return clause + ("." if clause and clause[-1] not in ".!?" else "")

    out: List[str] = []
    seen = set()
    for score, ln in candidates_sorted:  # type: ignore[misc]
        norm = _to_max_words_no_mid_sentence(str(ln), max_words=35)
        if not norm or norm in seen:
            continue
        out.append(norm)
        seen.add(norm)
        if len(out) >= max_items:
            break
    return out


@router.post("/import", response_model=JobDescriptionResponse)
async def import_job_description(payload: JobImportRequest):
    """
    Import and parse job description from URL or text.
    """
    try:
        url = payload.url
        text = payload.text

        if not url and not text:
            raise HTTPException(status_code=400, detail="Either URL or text must be provided")

        # If URL is provided, fetch content.
        # If the URL appears to be a listing page (multiple jobs), extract jobs and return them.
        page_html: str | None = None
        if url and not text:
            try:
                page_html = await _fetch_url_text(url)
            except Exception:
                page_html = None

        # Listing-page detection (Google careers results)
        if url and page_html and ("google.com/about/careers" in url) and ("jobs/results/?" in url):
            job_urls = _extract_google_careers_job_urls(page_html)
            # Keep it bounded for demos.
            job_urls = job_urls[:12]
            if job_urls:
                items: List[JobDescription] = []
                # Reuse the single-import logic for each job url, but without recursion on listings.
                for job_url in job_urls:
                    try:
                        job_html = await _fetch_url_text(job_url)
                        content = _html_to_text(job_html)
                        # Build & persist a single JD using the logic below
                        jd_resp = await import_job_description(JobImportRequest(url=job_url, text=content))
                        if jd_resp.job_description:
                            items.append(jd_resp.job_description)
                    except Exception:
                        continue

                if items:
                    return JobDescriptionResponse(
                        success=True,
                        message=f"Imported {len(items)} job descriptions from listing page",
                        job_descriptions=items,
                    )

        # For normal single-job pages: derive content from URL HTML if text not provided.
        if text:
            content = text
        elif page_html:
            content = _html_to_text(page_html)
        else:
            raise HTTPException(status_code=400, detail="Failed to fetch URL content (no HTML returned)")

        if not content or len(content.strip()) < 50:
            raise HTTPException(status_code=400, detail="Job description content is empty after extraction")

        parsed_at = _now_iso_z()

        # --- Heuristic parsing (non-LLM fallback) ----------------------
        title, company = _best_effort_title_company(content, url)
        required_skills: List[str] = []
        # Prefer explicit "Skills" blocks (LinkedIn/Indeed UI) when present.
        explicit = _extract_explicit_skills_block(content)
        if explicit:
            required_skills.extend(explicit)
        required_skills.extend(_extract_skills(content))
        if not required_skills:
            required_skills = _extract_requirement_skill_phrases(content)
        else:
            # Enrich with any requirement-section signals (deduped)
            extra = _extract_requirement_skill_phrases(content)
            if extra:
                seen = {s.lower() for s in required_skills}
                for s in extra:
                    if s.lower() not in seen:
                        required_skills.append(s)
                        seen.add(s.lower())
                required_skills = required_skills[:18]

        # Additional structured fields (best-effort; UI can display these)
        salary_range = _extract_salary_range(content) or "Salary not provided"
        location = _extract_location_hint(content)
        work_mode = _infer_work_mode_from_text(content)
        employment_type = _infer_employment_type_from_text(content)
        responsibilities = _extract_section_lines(
            content,
            ["key job responsibilities", "responsibilities", "you'll be empowered to", "you will", "what you'll do", "what you’ll do", "what you will do", "a day in the life"],
            max_lines=10,
            stop_patterns=["what you will need", "what you will need:", "basic qualifications", "preferred qualifications", "what would be nice to have", "what we offer", "benefits", "about"],
        )
        # USAJobs uses "Duties" instead of responsibilities. If we don't have responsibilities yet, try that.
        if not responsibilities:
            responsibilities = _extract_section_lines(
                content,
                ["duties"],
                max_lines=10,
                stop_patterns=["requirements", "qualifications", "education", "additional information", "benefits", "how to apply", "required documents", "overview"],
            )
        requirements = _extract_section_lines(
            content,
            [
                "requirements",
                "qualifications",
                "skills & qualifications",
                "skills and qualifications",
                "skills & experience",
                "subject matter knowledge",
                "subject matter knowledge & experience",
                "subject matter knowledge and experience",
                "required skills",
                "what you will need",
                "what you will need:",
                "what would be nice to have",
                "we'd love you to bring",
                "we’d love you to bring",
                "experience/skills required",
                "an ideal candidate should have",
                "the ideal candidate",
                "ideal candidate should have",
                "ideal candidate",
                "bonus",
                "basic qualifications",
                "preferred qualifications",
            ],
            max_lines=10,
            stop_patterns=["want more jobs like this", "job alert subscription", "benefits", "benefits include", "what we offer", "about"],
        )
        if not requirements:
            requirements = _extract_requirement_lines_fallback(content, max_lines=12)
        # Remotive / A.Team style: "Who X is for / not for" and location restrictions.
        if not requirements or len(requirements) < 2:
            req2 = _extract_who_is_for_as_requirements(content, max_lines=12)
            if req2:
                requirements = req2
        benefits = _extract_section_lines(
            content,
            ["benefits", "perks", "what we offer", "work/life balance", "mentorship", "career growth", "inclusive team culture", "diverse experiences"],
            max_lines=10,
            stop_patterns=["the ideal candidate", "ideal candidate", "requirements", "qualifications", "about", "equal opportunity", "job id", "employment type", "posted", "client-provided", "all communication", "guidehouse will", "if you have visited"],
        )
        # Remotive / A.Team style: "As part of X, you can expect:" is effectively benefits/perks.
        if not benefits or len(benefits) < 2:
            b2 = _extract_expectations_as_benefits(content, max_lines=10)
            if b2:
                benefits = b2
        # If there isn't an explicit benefits section, capture top-of-JD perk-like lines.
        # (Common in startup posts: "Remote 1st", "Equity", "Series A", etc.)
        if not benefits:
            perk_lines: List[str] = []
            for ln in [x.strip() for x in (content or "").splitlines()][:120]:
                low = ln.lower().strip()
                if not low:
                    continue
                if any(h in low for h in ["key responsibilities", "responsibilities", "skills & qualifications", "skills and qualifications", "basic qualifications", "preferred qualifications", "job description"]):
                    break
                if re.search(r"\$\s?\d", ln) or "salary" in low:
                    continue
                if "location" in low and ("," in low or "remote" in low):
                    # location is shown elsewhere
                    continue
                if any(k in low for k in ["remote 1st", "remote-first", "remote first", "equity", "series a", "us or canada"]):
                    s = ln.strip("•-* ").strip()
                    if 6 <= len(s) <= 120 and s.lower() not in {x.lower() for x in perk_lines}:
                        perk_lines.append(s[:200])
                if len(perk_lines) >= 6:
                    break
            benefits = perk_lines[:10]

        # If still empty, detect embedded benefits paragraphs (common in big-company posts).
        if not benefits:
            t = (content or "").lower()
            if any(k in t for k in ["medical", "dental", "vision", "401k", "paid time off", "life and ad&d", "short and long term disability", "employee assistance"]):
                benefit_phrases = [
                    ("medical", "Medical insurance"),
                    ("dental", "Dental insurance"),
                    ("vision", "Vision insurance"),
                    ("401k", "401k (with company match when offered)"),
                    ("paid time off", "Paid time off (PTO)"),
                    ("life and ad&d", "Life and AD&D insurance"),
                    ("short and long term disability", "Short/long-term disability coverage"),
                    ("employee assistance", "Employee assistance program"),
                    ("health savings account", "Health Savings Account (HSA)"),
                    ("flexible spending", "Flexible Spending Account (FSA)"),
                ]
                out: List[str] = []
                for key, label in benefit_phrases:
                    if key in t and label.lower() not in {x.lower() for x in out}:
                        out.append(label)
                benefits = out[:10]
        # We cannot truly infer "pain points" without an LLM, but we can extract
        # meaningful lines as a practical non-mock fallback.
        pain_points: List[str] = _extract_key_lines(
            content,
            max_items=3,
            keywords=["challenge", "problem", "need", "support", "scale", "grow", "reliability"],
        )
        if (not pain_points or len(pain_points) < 2) and requirements:
            inferred = _infer_pain_points_from_requirements(requirements, max_items=3)
            if inferred:
                # Prefer explicit pain points first, then inferred.
                seen = {p.lower() for p in pain_points}
                for x in inferred:
                    if x.lower() not in seen:
                        pain_points.append(x)
                        seen.add(x.lower())
                pain_points = pain_points[:3]

        # Prefer responsibilities as a stand-in for "success metrics" when GPT isn't available.
        # This avoids accidentally selecting company boilerplate ("mission", "offices in") as "metrics".
        if responsibilities:
            success_metrics = responsibilities[:3]
        else:
            success_source = content
            success_metrics = _extract_key_lines(
                success_source,
                max_items=3,
                keywords=["metric", "measured", "reliability", "deliver", "improve", "reduce", "increase", "impact", "roi", "efficiency"],
            )

        # De-dupe across sections: avoid repeating the same paragraph/bullet in multiple columns.
        # If there is overlap, keep it in Success Metrics (more appropriate for responsibilities-style lines).
        try:
            def _norm(s: str) -> str:
                # Normalize punctuation/whitespace so minor variations don't bypass dedupe.
                t = (s or "").strip().lower()
                t = re.sub(r"[•\u2022]", " ", t)
                t = re.sub(r"[^\w\s]", " ", t)
                t = re.sub(r"\s+", " ", t).strip()
                return t

            sm_set = {_norm(s) for s in success_metrics if s and s.strip()}
            pain_points = [p for p in pain_points if _norm(p or "") not in sm_set]
            # Also de-dupe within each list while preserving order.
            def _dedup(xs: List[str]) -> List[str]:
                seen = set()
                out: List[str] = []
                for x in xs:
                    k = _norm(x or "")
                    if not k or k in seen:
                        continue
                    seen.add(k)
                    out.append((x or "").strip())
                return out
            pain_points = _dedup(pain_points)[:3]
            success_metrics = _dedup(success_metrics)[:3]
        except Exception:
            pass

        # Salary is returned as its own field (salary_range) and should be displayed separately in the UI
        # (not mixed into Success Metrics).

        parsed_json: Dict[str, Any] = {
            "pain_points": pain_points,
            "required_skills": required_skills,
            "success_metrics": success_metrics,
            "salary_range": salary_range,
            "location": location,
            "work_mode": work_mode,
            "employment_type": employment_type,
            "responsibilities": responsibilities,
            "requirements": requirements,
            "benefits": benefits,
        }

        # --- Optional GPT-backed parsing via OpenAIClient ---------------
        client = get_openai_client()
        if client.should_use_real_llm:
            try:
                raw = client.extract_job_structure(content)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")

                data = extract_json_from_text(content_str) or {}
                # If the model output is missing key fields, do one targeted retry.
                if _should_retry_jd_llm(content, data, title=title, company=company):
                    try:
                        retry_messages = [
                            {
                                "role": "system",
                                "content": (
                                    "You are RoleFerry's job description parser. Your previous output was incomplete.\n"
                                    "Re-extract the job description into the REQUIRED JSON schema.\n\n"
                                    "Hard requirements:\n"
                                    "- Return ONLY a JSON object.\n"
                                    "- Do NOT invent facts.\n"
                                    "- Ignore job-board UI noise.\n"
                                    "- Ensure required_skills lists concrete skills/tools/technologies (no fluff, no duplicates).\n\n"
                                    "Schema:\n"
                                    "{\n"
                                    '  \"title\": \"\",\n'
                                    '  \"company\": \"\",\n'
                                    '  \"location\": \"\",\n'
                                    '  \"work_mode\": \"remote|hybrid|onsite|unknown\",\n'
                                    '  \"employment_type\": \"full-time|part-time|contract|internship|unknown\",\n'
                                    '  \"salary_range\": \"Salary not provided|<as written>\",\n'
                                    '  \"pain_points\": [\"\"],\n'
                                    '  \"responsibilities\": [\"\"],\n'
                                    '  \"requirements\": [\"\"],\n'
                                    '  \"required_skills\": [\"\"],\n'
                                    '  \"benefits\": [\"\"],\n'
                                    '  \"success_metrics\": [\"\"],\n'
                                    "}\n"
                                    "IMPORTANT: success_metrics items must be complete sentences <= 35 words.\n"
                                ),
                            },
                            {"role": "user", "content": content},
                        ]
                        raw2 = client.run_chat_completion(retry_messages, temperature=0.0, max_tokens=1400, stub_json={})
                        choices2 = raw2.get("choices") or []
                        msg2 = (choices2[0].get("message") if choices2 else {}) or {}
                        content_str2 = str(msg2.get("content") or "")
                        data2 = extract_json_from_text(content_str2) or {}
                        if isinstance(data2, dict) and data2:
                            data = data2
                    except Exception:
                        pass
                if isinstance(data, dict) and data:
                    # Let GPT override title/company when provided
                    llm_title = _sanitize_title(str(data.get("title") or "").strip())
                    llm_company = str(data.get("company") or "").strip()

                    # Guard: reject obvious non-title headers (common on Remotive-style pastes)
                    if llm_title and not _is_bad_title(llm_title):
                        title = llm_title
                    if llm_company and not _is_bad_company(llm_company):
                        company = llm_company

                    # Remotive-style header fallback if the resulting title still looks wrong
                    if _is_bad_title(title):
                        t0, c0 = _extract_remotive_title_company(content)
                        if t0:
                            title = t0
                        if c0 and (not company or company.lower() == "unknown"):
                            company = c0

                    title = _sanitize_title(title)

                    # If company still looks wrong, use deterministic labeled-block extraction
                    if _is_bad_company(company) or (not company or company.lower() == "unknown"):
                        c2 = _extract_company_from_company_block(content)
                        if c2:
                            company = c2
                    pain_points = [str(p) for p in (data.get("pain_points") or pain_points)]
                    required_skills = [str(s) for s in (data.get("required_skills") or required_skills)]
                    success_metrics = [str(m) for m in (data.get("success_metrics") or success_metrics)]

                    # Optional richer fields (best-effort)
                    salary_range = str(data.get("salary_range") or salary_range or "") or salary_range
                    location = str(data.get("location") or location or "") or location
                    work_mode = str(data.get("work_mode") or work_mode or "") or work_mode
                    employment_type = str(data.get("employment_type") or employment_type or "") or employment_type
                    responsibilities = [str(x) for x in (data.get("responsibilities") or responsibilities or [])]
                    requirements = [str(x) for x in (data.get("requirements") or requirements or [])]
                    benefits = [str(x) for x in (data.get("benefits") or benefits or [])]

                    parsed_json = {
                        "pain_points": pain_points,
                        "required_skills": required_skills,
                        "success_metrics": success_metrics,
                        "salary_range": salary_range,
                        "location": location,
                        "work_mode": work_mode,
                        "employment_type": employment_type,
                        "responsibilities": responsibilities,
                        "requirements": requirements,
                        "benefits": benefits,
                    }
            except Exception:
                # On any GPT failure, keep heuristic extraction.
                pass

        # --- Post-LLM safety net ---------------------------------------
        # Even with GPT enabled, some postings (esp. recruiting/non-tech) can come back with empty skills/requirements.
        # Ensure we still return something useful and grounded.
        # Clean up common formatting artifacts (label-only bullets).
        requirements = _merge_label_bullets(list(requirements or []))
        responsibilities = _merge_label_bullets(list(responsibilities or []))

        if not requirements:
            requirements = _extract_requirement_lines_fallback(content, max_lines=12) or requirements
        if not required_skills:
            required_skills = _extract_requirement_skill_phrases(content) or _extract_skills(content) or required_skills
        required_skills = _clean_required_skills([str(s) for s in (required_skills or [])])
        if (not pain_points or len(pain_points) < 2) and requirements:
            inferred = _infer_pain_points_from_requirements(requirements, max_items=3)
            if inferred:
                seen = {p.lower() for p in (pain_points or [])}
                pain_points = list(pain_points or [])
                for x in inferred:
                    if x.lower() not in seen:
                        pain_points.append(x)
                        seen.add(x.lower())
                pain_points = pain_points[:3]
        pain_points = _condense_pain_points([str(p) for p in (pain_points or [])], max_words=18, max_items=8)

        parsed_json = {
            "pain_points": pain_points,
            "required_skills": required_skills,
            "success_metrics": success_metrics,
            "salary_range": salary_range,
            "location": location,
            "work_mode": work_mode,
            "employment_type": employment_type,
            "responsibilities": responsibilities,
            "requirements": requirements,
            "benefits": benefits,
        }

        # Validate: do not create incomplete JDs (common when scraping a job board/search page).
        validation_error = _validate_extracted_job(
            url=url,
            content=content,
            title=title,
            company=company,
            required_skills=required_skills,
            pain_points=pain_points,
            success_metrics=success_metrics,
        )
        if validation_error:
            raise HTTPException(status_code=400, detail=validation_error)

        # Persist job + a starter application row for demo user (best-effort).
        # For first-run demos, Postgres may be unavailable; in that case we still
        # return a usable response and let the frontend keep state in localStorage.
        # Stable-ish ID for de-duping and updates (avoid always incrementing "demo" ids).
        if url:
            job_id = "jd_" + hashlib.md5(url.encode("utf-8")).hexdigest()[:10]
        else:
            job_id = "jd_" + hashlib.md5((content[:500]).encode("utf-8")).hexdigest()[:10]
        try:
            stmt_job = (
                sql_text(
                    """
                    INSERT INTO job (user_id, title, company, url, content, parsed_json)
                    VALUES (:user_id, :title, :company, :url, :content, :parsed)
                    RETURNING id
                    """
                ).bindparams(bindparam("parsed", type_=JSONB))
            )

            async with engine.begin() as conn:
                result = await conn.execute(
                    stmt_job,
                    {
                        "user_id": DEMO_USER_ID,
                        "title": title,
                        "company": company,
                        "url": url,
                        "content": content,
                        "parsed": parsed_json,
                    },
                )
                row = result.first()
                job_id = str(row[0]) if row else job_id

                # Auto-create an APPLICATION row in status "saved"
                if row:
                    await conn.execute(
                        sql_text(
                            """
                            INSERT INTO application (user_id, job_id, status, created_at)
                            VALUES (:user_id, :job_id, 'saved', now())
                            """
                        ),
                        {"user_id": DEMO_USER_ID, "job_id": row[0]},
                    )
        except Exception:
            # DB is optional for demo; proceed without persistence.
            pass

        # Always cache in memory for first-run demos (so downstream steps can work without DB).
        store.demo_job_descriptions[job_id] = {
            "id": job_id,
            "title": title,
            "company": company,
            "url": url,
            "content": content,
            "parsed_json": parsed_json,
        }

        jd = JobDescription(
            id=job_id,
            title=title,
            company=company,
            url=url,
            content=content,
            pain_points=pain_points,
            required_skills=required_skills,
            success_metrics=success_metrics,
            location=location,
            work_mode=work_mode,
            employment_type=employment_type,
            salary_range=salary_range,
            responsibilities=responsibilities or None,
            requirements=requirements or None,
            benefits=benefits or None,
            parsed_at=parsed_at,
        )

        return JobDescriptionResponse(
            success=True,
            message="Job description parsed and stored successfully",
            job_description=jd,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error importing job description")
        raise HTTPException(status_code=500, detail="Failed to parse job description")

@router.post("/save", response_model=JobDescriptionResponse)
async def save_job_description(job_description: JobDescription):
    """
    Save job description for a user.
    """
    try:
        parsed_json = {
            "pain_points": job_description.pain_points,
            "required_skills": job_description.required_skills,
            "success_metrics": job_description.success_metrics,
        }
        stmt = (
            sql_text(
                """
                INSERT INTO job (user_id, title, company, url, content, parsed_json)
                VALUES (:user_id, :title, :company, :url, :content, :parsed)
                """
            ).bindparams(bindparam("parsed", type_=JSONB))
        )
        async with engine.begin() as conn:
            # For Week 9, treat this as an append-only insert; let DB assign UUID
            await conn.execute(
                stmt,
                {
                    "user_id": DEMO_USER_ID,
                    "title": job_description.title,
                    "company": job_description.company,
                    "url": job_description.url,
                    "content": job_description.content,
                    "parsed": parsed_json,
                },
            )

        return JobDescriptionResponse(
            success=True,
            message="Job description saved successfully",
            job_description=job_description,
        )
    except Exception as e:
        logger.exception("Error saving job description")
        raise HTTPException(status_code=500, detail="Failed to save job description")

@router.get("/{user_id}", response_model=JobDescriptionsListResponse)
async def get_job_descriptions(user_id: str):
    """
    Get all job descriptions for a user.
    """
    try:
        # For Week 9, fetch any jobs stored for the demo user; fall back to mocks if empty
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    SELECT id, title, company, url, content, parsed_json, created_at
                    FROM job
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    """
                ),
                {"user_id": DEMO_USER_ID},
            )
            rows = result.fetchall()

        job_descriptions: List[JobDescription] = []
        for row in rows:
            parsed = row.parsed_json or {}
            job_descriptions.append(
                JobDescription(
                    id=str(row.id),
                    title=row.title,
                    company=row.company,
                    url=row.url,
                    content=row.content or "",
                    pain_points=parsed.get("pain_points", []),
                    required_skills=parsed.get("required_skills", []),
                    success_metrics=parsed.get("success_metrics", []),
                    parsed_at=row.created_at.isoformat() if getattr(row, "created_at", None) else "",
                )
            )

        if not job_descriptions:
            # Fallback to mock data if DB is empty
            job_descriptions = [
                JobDescription(
                    id="jd_123",
                    title="Senior Software Engineer",
                    company="TechCorp Inc.",
                    url="https://techcorp.com/jobs/senior-engineer",
                    content="Job description content...",
                    pain_points=[
                        "Need to reduce time-to-fill for engineering roles",
                        "Struggling with candidate quality and cultural fit",
                    ],
                    required_skills=["Python", "JavaScript", "React", "Node.js"],
                    success_metrics=[
                        "Reduce time-to-hire by 30%",
                        "Improve candidate quality scores",
                    ],
                    parsed_at="2024-01-15T10:30:00Z",
                )
            ]

        return JobDescriptionsListResponse(
            success=True,
            message="Job descriptions retrieved successfully",
            job_descriptions=job_descriptions,
        )
    except Exception as e:
        logger.exception("Error listing job descriptions")
        raise HTTPException(status_code=500, detail="Failed to get job descriptions")

@router.get("/{user_id}/{jd_id}", response_model=JobDescriptionResponse)
async def get_job_description(user_id: str, jd_id: str):
    """
    Get a specific job description for a user.
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    SELECT id, title, company, url, content, parsed_json, created_at
                    FROM job
                    WHERE user_id = :user_id AND id = :job_id::uuid
                    """
                ),
                {"user_id": DEMO_USER_ID, "job_id": jd_id},
            )
            row = result.first()

        if row:
            parsed = row.parsed_json or {}
            jd = JobDescription(
                id=str(row.id),
                title=row.title,
                company=row.company,
                url=row.url,
                content=row.content or "",
                pain_points=parsed.get("pain_points", []),
                required_skills=parsed.get("required_skills", []),
                success_metrics=parsed.get("success_metrics", []),
                parsed_at=row.created_at.isoformat() if getattr(row, "created_at", None) else "",
            )
        else:
            # Fallback to mock data if not found in DB
            jd = JobDescription(
                id=jd_id,
                title="Senior Software Engineer",
                company="TechCorp Inc.",
                url="https://techcorp.com/jobs/senior-engineer",
                content="Job description content...",
                pain_points=[
                    "Need to reduce time-to-fill for engineering roles",
                    "Struggling with candidate quality and cultural fit",
                ],
                required_skills=["Python", "JavaScript", "React", "Node.js"],
                success_metrics=[
                    "Reduce time-to-hire by 30%",
                    "Improve candidate quality scores",
                ],
                parsed_at="2024-01-15T10:30:00Z",
            )

        return JobDescriptionResponse(
            success=True,
            message="Job description retrieved successfully",
            job_description=jd,
        )
    except Exception as e:
        logger.exception("Error retrieving job description")
        raise HTTPException(status_code=500, detail="Failed to get job description")

@router.put("/{user_id}/{jd_id}", response_model=JobDescriptionResponse)
async def update_job_description(user_id: str, jd_id: str, job_description: JobDescription):
    """
    Update a job description for a user.
    """
    try:
        parsed_json = {
            "pain_points": job_description.pain_points,
            "required_skills": job_description.required_skills,
            "success_metrics": job_description.success_metrics,
        }
        stmt = (
            sql_text(
                """
                UPDATE job
                SET title = :title,
                    company = :company,
                    url = :url,
                    content = :content,
                    parsed_json = :parsed
                WHERE id = :id::uuid AND user_id = :user_id
                """
            ).bindparams(bindparam("parsed", type_=JSONB))
        )
        async with engine.begin() as conn:
            await conn.execute(
                stmt,
                {
                    "id": jd_id,
                    "user_id": DEMO_USER_ID,
                    "title": job_description.title,
                    "company": job_description.company,
                    "url": job_description.url,
                    "content": job_description.content,
                    "parsed": parsed_json,
                },
            )

        return JobDescriptionResponse(
            success=True,
            message="Job description updated successfully",
            job_description=job_description,
        )
    except Exception as e:
        logger.exception("Error updating job description")
        raise HTTPException(status_code=500, detail="Failed to update job description")

@router.delete("/{user_id}/{jd_id}")
async def delete_job_description(user_id: str, jd_id: str):
    """
    Delete a job description for a user.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(
                sql_text("DELETE FROM job WHERE id = :id::uuid AND user_id = :user_id"),
                {"id": jd_id, "user_id": DEMO_USER_ID},
            )
        return {"success": True, "message": "Job description deleted successfully"}
    except Exception as e:
        logger.exception("Error deleting job description")
        raise HTTPException(status_code=500, detail="Failed to delete job description")
