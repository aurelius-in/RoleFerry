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
    "Go",
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
    # Data
    "PostgreSQL",
    "MySQL",
    "Redis",
    "Kafka",
    # AI/ML
    "LLM",
    "Machine Learning",
    "Deep Learning",
]


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

    # Title: first non-empty line is often usable after HTML-to-text.
    if lines:
        title = lines[0][:120]

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
        top_blob = " ".join(lines[:20])
        # Capture a single-token brand/company (handles Kochava, Stripe, Workday, etc.)
        m = re.search(
            r"\b([A-Z][A-Za-z0-9&.\-]{1,60})\s+(?:is\s+hiring|is\s+recruiting|is\s+seeking|provides|is\s+an|is\s+a|began)\b",
            top_blob,
            flags=re.I,
        )
        cand = (m.group(1).strip() if m else "")
        if not cand:
            # Fallback: first token on first line, but only if it repeats (avoids "Remote ...")
            m2 = re.match(r"^([A-Z][A-Za-z0-9&.\-]{1,60})\b", lines[0])
            cand = (m2.group(1).strip() if m2 else "")

        if cand:
            # Require at least 2 mentions in the first chunk to reduce false positives.
            mentions = sum(1 for ln in lines[:60] if cand.lower() in ln.lower())
            if mentions >= 2 and cand.lower() not in {"remote", "hybrid", "onsite", "on-site"}:
                company = cand

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
        m = re.search(r"\b(?:at|join)\s+([A-Z][A-Za-z0-9&.,\-]+(?:\s+[A-Z][A-Za-z0-9&.,\-]+){0,4})\b", top)
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
        r"\$\d+", r"\d+k\b", r"salary", r"compensation", r"benefits", r"401k", 
        r"full-time", r"part-time", r"contract", r"per hour", r"per year"
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
            candidates.append((score, ln[:200]))  # type: ignore[list-item]

    # Sort by score desc, then keep stable order-ish by first appearance.
    # We already collected in order; stable sort preserves that for ties.
    candidates_sorted = sorted(candidates, key=lambda t: t[0], reverse=True)  # type: ignore[index]
    out: List[str] = []
    seen = set()
    for score, ln in candidates_sorted:  # type: ignore[misc]
        if ln in seen:
            continue
        out.append(ln)
        seen.add(ln)
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
        required_skills: List[str] = _extract_skills(content)
        # We cannot truly infer "pain points" without an LLM, but we can extract
        # meaningful lines as a practical non-mock fallback.
        pain_points: List[str] = _extract_key_lines(
            content,
            max_items=3,
            keywords=["challenge", "problem", "improve", "reduce", "increase", "help", "responsible", "you will"],
        )
        success_metrics: List[str] = _extract_key_lines(
            content,
            max_items=3,
            keywords=["kpi", "metric", "measured", "increase", "reduce", "improve", "impact", "deliver"],
        )

        parsed_json: Dict[str, Any] = {
            "pain_points": pain_points,
            "required_skills": required_skills,
            "success_metrics": success_metrics,
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
                    parsed_json = {
                        "pain_points": pain_points,
                        "required_skills": required_skills,
                        "success_metrics": success_metrics,
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
