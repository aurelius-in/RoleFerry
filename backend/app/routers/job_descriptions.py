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
    if start < 0:
        return []

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
        # "Derived Salary: $207562 - $345938/Year" (no commas, 6 digits)
        r"(derived\s+salary:\s*\$\s?\d{3,6}(?:,\d{3})?\s*[–\-]\s*\$\s?\d{3,6}(?:,\d{3})?\s*/\s*(?:year|yr))",
        # "$207,562 - 345,938 / Year" (second value sometimes missing $)
        r"(\$\s?\d{3,6}(?:,\d{3})?\s*[–\-]\s*\d{3,6}(?:,\d{3})?\s*/\s*(?:year|yr))",
        # "$207562 - $345938/Year" (no label)
        r"(\$\s?\d{3,6}(?:,\d{3})?\s*[–\-]\s*\$\s?\d{3,6}(?:,\d{3})?\s*/\s*(?:year|yr))",
        r"(\b\d{2,3}(?:,\d{3})\s*[–\-]\s*\d{2,3}(?:,\d{3})\s*(?:usd)?\s*/\s*year\b)",
        r"(salary\s+range:\s*\$\s?\d[\d,]+.*?\$\s?\d[\d,]+)",
    ]
    for pat in patterns:
        m = re.search(pat, s, flags=re.I)
        if m:
            out = str(m.group(1)).strip()
            out = re.sub(r"\s+", " ", out)
            return out[:80]
    return None


def _extract_location_hint(text: str) -> Optional[str]:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return None
    # Look for explicit Location / Job Location blocks
    for i, ln in enumerate(lines[:120]):
        low = ln.lower()
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
    return None


def _extract_section_lines(text: str, header_patterns: List[str], *, max_lines: int = 10) -> List[str]:
    """
    Best-effort extraction of bullet-ish lines after a section header.
    """
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return []
    header_re = re.compile(r"^(?:" + "|".join(header_patterns) + r")\b", re.I)
    stop_re = re.compile(
        r"^(?:salary|salary range|perks|benefits|bonus points|nice to have|location|about us|about the job|corporate values|equal opportunity)\b",
        re.I,
    )
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
        if any(k in low for k in ["+ show more", "do you have experience", "job details", "full job description", "profile insights"]):
            break
        # short-ish skills, not paragraphs
        s = ln.strip("•-* ").strip()
        if len(s) < 3 or len(s) > 60:
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


def _best_effort_title_company(content: str, url: Optional[str]) -> tuple[str, str]:
    title = ""
    company = ""

    lines = [ln.strip() for ln in (content or "").splitlines() if ln.strip()]

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

    def _looks_like_real_title(ln: str) -> bool:
        s = (ln or "").strip()
        if not s or len(s) < 4:
            return False
        low = s.lower()
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
        }

        # Indeed-style / job-board header: company often appears as a standalone line near the top
        # right after a title-like line and before rating/location/salary blocks.
        if not company:
            for ln in lines[:12]:
                s = (ln or "").strip()
                low = s.lower()
                if not s or len(s) > 80:
                    continue
                if low in _COMPANY_STOPWORDS:
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
                    company = s[:120]
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
        r"\b\d{1,5}\s+[A-Za-z0-9 .'\-]+(?:drive|dr|street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|way|court|ct)\b",
        r"\b[A-Za-z .'\-]+,\s*[A-Z]{2}\s*\d{5}\b",
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
            ["key job responsibilities", "responsibilities", "you'll be empowered to", "you will", "what you'll do", "what you’ll do", "a day in the life"],
            max_lines=10,
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
                "we'd love you to bring",
                "we’d love you to bring",
                "experience/skills required",
                "an ideal candidate should have",
                "ideal candidate should have",
                "ideal candidate",
                "bonus",
                "basic qualifications",
                "preferred qualifications",
            ],
            max_lines=10,
        )
        benefits = _extract_section_lines(
            content,
            ["benefits", "perks", "what we offer", "work/life balance", "mentorship", "career growth", "inclusive team culture", "diverse experiences"],
            max_lines=10,
        )
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

        # Prefer "success metrics" from responsibilities if available (avoids culture/mission paragraphs).
        success_source = "\n".join(responsibilities) if responsibilities else content
        success_metrics: List[str] = _extract_key_lines(
            success_source,
            max_items=3,
            keywords=["metric", "measured", "reliability", "deliver", "improve", "reduce", "increase", "impact"],
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
                if isinstance(data, dict) and data:
                    # Let GPT override title/company when provided
                    title = str(data.get("title") or title)
                    company = str(data.get("company") or company)
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
