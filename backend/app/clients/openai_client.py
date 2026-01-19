from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import json
import hashlib
import time
import re

import httpx

from ..config import settings


logger = logging.getLogger(__name__)


_BANNED_OPENER_PATTERNS = [
    r"\bi hope (this message|you(’|')?re|you are|you're)\b",
    r"\bhope (this message|you(’|')?re|you are|you're)\b",
    r"\btrust you(’|')?re\b",
    r"\btrust this (message|email)\b",
    r"\bjust (wanted|reaching out) to\b.*\bintroduce myself\b",
]


def _strip_fluff_openers(text: str) -> str:
    """
    Remove common low-signal openers from the start of outreach copy.
    We only strip when the phrase appears in the first ~2 non-empty lines / first ~280 chars.
    """
    if not text:
        return text

    s = str(text).replace("\r\n", "\n").replace("\r", "\n")
    original = s

    # Quick window check (avoid touching bodies where the phrase appears later in a quoted thread)
    head = s[:280].lower()
    if not any(re.search(p, head, flags=re.I) for p in _BANNED_OPENER_PATTERNS):
        return original

    lines = [ln for ln in s.split("\n")]

    def is_blank(ln: str) -> bool:
        return not (ln or "").strip()

    # Trim leading blank lines
    while lines and is_blank(lines[0]):
        lines.pop(0)

    # If first line is a greeting, check the next non-empty line for fluff.
    greeting_re = re.compile(r"^\s*(hi|hello|hey)\b", re.I)
    i0 = 0
    if lines and greeting_re.match(lines[0] or ""):
        # find next non-empty line
        j = 1
        while j < len(lines) and is_blank(lines[j]):
            j += 1
        if j < len(lines) and any(re.search(p, (lines[j] or ""), flags=re.I) for p in _BANNED_OPENER_PATTERNS):
            lines.pop(j)
            # also remove any extra blank line right after removing
            while j < len(lines) and is_blank(lines[j]):
                lines.pop(j)

    # If the first non-empty line itself is fluff, drop it.
    while lines:
        first = (lines[0] or "").strip()
        if not first:
            lines.pop(0)
            continue
        if any(re.search(p, first, flags=re.I) for p in _BANNED_OPENER_PATTERNS):
            lines.pop(0)
            # remove following blank line(s)
            while lines and is_blank(lines[0]):
                lines.pop(0)
            continue
        break

    out = "\n".join(lines).strip()
    return out or original


def extract_json_from_text(text: str) -> Dict[str, Any] | None:
    """
    Best-effort JSON object extraction from model output.

    Supports:
    - raw JSON object: {"a": 1}
    - fenced JSON: ```json\n{...}\n```
    - extra prose around JSON (extracts outermost {...})

    Returns a dict or None.
    """
    if not text:
        return None

    s = text.strip()

    # Strip common fenced code block wrappers
    if s.startswith("```"):
        # Remove first fence line
        first_nl = s.find("\n")
        if first_nl != -1:
            s = s[first_nl + 1 :]
        # Remove trailing fence
        if s.endswith("```"):
            s = s[: -3]
        s = s.strip()

    # Fast path: direct JSON object
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass

    # Best effort: extract the largest {...} span
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        obj = json.loads(s[start : end + 1])
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


class OpenAIClient:
    """
    Thin wrapper around the OpenAI Chat Completions/Responses API.

    Responsibilities:
    - Centralize configuration (API key, model, base URL, timeouts)
    - Respect Settings.mock_mode / llm_mode and fall back to deterministic stubs
    - Provide a small surface: run_chat_completion(...) plus focused helpers
    """

    def __init__(
        self,
        api_key: Optional[str],
        model: str,
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url or "https://api.openai.com/v1"
        self.timeout_seconds = timeout_seconds

    # ---- Core helpers -------------------------------------------------

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def should_use_real_llm(self) -> bool:
        # Week 10: "GPT default" when API key is present.
        # - If OPENAI_API_KEY is set, we use GPT even when ROLEFERRY_MOCK_MODE=true.
        # - LLM_MODE is the explicit kill switch (set to "stub" to force stubs).
        return bool(self.api_key) and (settings.llm_mode or "openai") == "openai"

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _stable_seed(self, messages: List[Dict[str, str]]) -> int:
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        digest = hashlib.sha256(last_user.encode("utf-8", errors="ignore")).hexdigest()
        return int(digest[:8], 16)

    def _stub_response(
        self,
        messages: List[Dict[str, str]],
        note: str | None = None,
        *,
        json_obj: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Deterministic stub used when in mock_mode or when OpenAI is unavailable.
        Echoes the last user message with a short prefix so callers always get
        a syntactically similar response object.
        """
        prefix = "[Stubbed GPT]"
        if note:
            prefix += f" ({note})"

        if json_obj is not None:
            content = json.dumps(json_obj, ensure_ascii=False)
        else:
            last_user = next(
                (m["content"] for m in reversed(messages) if m.get("role") == "user"),
                "",
            )
            content = f"{prefix} {last_user[:512]}"
        return {
            "id": "stub-chat-completion",
            "model": self.model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        }

    def run_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 512,
        stub_json: Dict[str, Any] | None = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        """
        Synchronous chat completion helper.

        Callers get a dict shaped like OpenAI's /chat/completions response,
        even when running in stub mode.
        """
        if not self.should_use_real_llm:
            return self._stub_response(messages, note="stub_mode", json_obj=stub_json)

        payload: Dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        payload.update(extra or {})

        # Retry a few times for transient provider issues.
        # IMPORTANT: we do NOT generally retry 429 because for many demo failures it's
        # "insufficient_quota" (billing), which will never succeed and just adds latency.
        retry_statuses = {500, 502, 503, 504}
        backoffs = [0.8, 1.6, 3.2]
        try:
            with httpx.Client(base_url=self.base_url, timeout=self.timeout_seconds) as client:
                last_status: int | None = None
                for attempt, backoff in enumerate([0.0] + backoffs):
                    if backoff:
                        time.sleep(backoff)
                    try:
                        resp = client.post("/chat/completions", json=payload, headers=self._build_headers())
                        resp.raise_for_status()
                        return resp.json()
                    except httpx.HTTPStatusError as e:
                        last_status = int(getattr(e.response, "status_code", 0) or 0)
                        # Try to surface a helpful reason for the demo operator (quota, billing, rate limit).
                        reason = ""
                        err_code = ""
                        try:
                            err_json = e.response.json()
                            err_obj = (err_json or {}).get("error") or {}
                            msg = str(err_obj.get("message") or "").strip()
                            code = str(err_obj.get("code") or "").strip()
                            typ = str(err_obj.get("type") or "").strip()
                            err_code = code
                            reason_parts = [p for p in [code, typ, msg] if p]
                            if reason_parts:
                                reason = " | ".join(reason_parts)
                        except Exception:
                            try:
                                reason = (e.response.text or "").strip()
                            except Exception:
                                reason = ""
                        reason = reason[:240] if reason else ""

                        # Retry transient errors.
                        # - 5xx: retry
                        # - 429: retry only if it doesn't look like a quota/billing issue.
                        if attempt < len(backoffs):
                            if last_status in retry_statuses:
                                logger.warning(
                                    "OpenAI HTTP %s; retrying (attempt %s/%s)",
                                    last_status,
                                    attempt + 1,
                                    len(backoffs) + 1,
                                )
                                continue
                            if last_status == 429 and err_code and err_code != "insufficient_quota":
                                logger.warning(
                                    "OpenAI HTTP 429 (%s); retrying (attempt %s/%s)",
                                    err_code,
                                    attempt + 1,
                                    len(backoffs) + 1,
                                )
                                continue
                        logger.warning("OpenAI chat completion HTTP error: %s", e, exc_info=True)
                        note = f"http_error {last_status}"
                        if reason:
                            note += f" ({reason})"
                        return self._stub_response(messages, note=note, json_obj=stub_json)
        except Exception as e:  # pragma: no cover - defensive catch-all
            logger.exception("OpenAI chat completion failed", exc_info=e)
            return self._stub_response(messages, note="exception", json_obj=stub_json)

    # ---- Focused use-case helpers -------------------------------------

    def analyze_deliverability(self, email_body: str, subject: str) -> Dict[str, Any]:
        """
        Analyze email copy for deliverability risks (spam triggers, tone, clarity).
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a deliverability expert. Analyze the provided email for inbox placement risk.\n\n"
                    "Focus on:\n"
                    "- Spam trigger words (urgent, free, cash, etc.)\n"
                    "- Over-aggressive punctuation (!!!) or ALL CAPS\n"
                    "- Tone (too salesy vs human/authentic)\n"
                    "- Clarity and brevity\n\n"
                    "Return ONLY JSON:\n"
                    "- risk_score: 0-10 (0 is safe, 10 is guaranteed spam)\n"
                    "- issues: array of strings (e.g. 'Subject line is too long')\n"
                    "- fixes: array of strings (e.g. 'Shorten subject to < 50 chars')\n"
                    "- safety_variant: a rewritten version that is safer for inbox placement\n"
                ),
            },
            {"role": "user", "content": f"Subject: {subject}\n\nBody:\n{email_body}"},
        ]
        return self.run_chat_completion(messages, temperature=0.1, max_tokens=800)

    def summarize_resume(self, text: str) -> Dict[str, Any]:
        """
        Summarize a raw resume into key bullets and metrics.

        Returns a dict that callers can post-process into strongly-typed models
        (e.g. ResumeParsed) without this helper needing to know DB schemas.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are RoleFerry's resume parser. Extract accurate structured fields from messy resume text.\n\n"
                    "Hard requirements:\n"
                    "- Do NOT fabricate facts.\n"
                    "- Prefer precision over completeness.\n"
                    "- Return ONLY a JSON object (no markdown, no prose).\n\n"
                    "Positions/work experience:\n"
                    "- Extract every role in work history (including multiple roles at the same company).\n"
                    "- company and title must be short strings (not paragraphs).\n"
                    "- start_date/end_date must be normalized to YYYY-MM when month is known, otherwise YYYY.\n"
                    "- current must be true only when the resume clearly indicates Present/Current.\n"
                    "- description should be 1–2 sentences (<= 240 chars) summarizing scope + impact, based only on the resume.\n\n"
                    "Key metrics:\n"
                    "- Extract measurable impacts (%, $, scale like 60M+, 6K+, cost savings, latency reductions, etc.).\n"
                    "- If the resume contains any explicit numeric impact, return at least 3 key_metrics.\n"
                    "- If the resume does NOT contain explicit numeric impact, still return 3–6 key_metrics as QUALITATIVE outcomes:\n"
                    "  - Use value=\"\" (empty string) for qualitative items.\n"
                    "  - metric should name the outcome/KPI (e.g., 'Deployment speed', 'Reliability', 'Search discoverability').\n"
                    "  - context should cite the resume evidence in a short phrase.\n"
                    "- Each key_metrics item: metric (what), value (number/amount), context (short).\n\n"
                    "Skills:\n"
                    "- Return ONLY real skills: tools, languages, frameworks, cloud/platforms, methodologies.\n"
                    "- Exclude locations, personal tags, titles, education degrees, section headings, awards, certifications, and proficiency text like '(Full Professional)'.\n"
                    "- Normalize synonyms/casing (e.g., 'REACT.js' -> 'React', 'node.js' -> 'Node.js', 'Pytorch' -> 'PyTorch').\n"
                    "- Keep skills as short tokens (2–30 chars when possible).\n\n"
                    "Education:\n"
                    "- Extract education entries (degrees/courses) from the resume.\n"
                    "- Return normalized start_year/end_year when present.\n\n"
                    "Return ONLY a JSON object with these keys:\n"
                    "- positions: array of { company, title, start_date, end_date, current, description }\n"
                    "- key_metrics: array of { metric, value, context }\n"
                    "- business_challenges: array of strings (infer from responsibilities/accomplishments when not explicitly labeled; stay grounded in the resume)\n"
                    "- skills: array of strings\n"
                    "- accomplishments: array of strings\n"
                    "- tenure: array of { company, duration, role }\n"
                    "- education: array of { school, degree, field, start_year, end_year, notes }\n"
                ),
            },
            {"role": "user", "content": text},
        ]
        seed = self._stable_seed(messages)
        stub = {
            "positions": [
                {
                    "company": ["TechCorp", "BlueYonder", "NimbusAI"][seed % 3],
                    "title": ["Senior Software Engineer", "Data Engineer", "Product Analyst"][seed % 3],
                    "start_date": "2022-01",
                    "end_date": "2024-12",
                    "current": True,
                    "description": "Owned a core platform initiative and delivered measurable performance and reliability gains.",
                }
            ],
            "key_metrics": [
                {"metric": "Latency", "value": "40% reduction", "context": "via caching + query optimization"},
                {"metric": "Costs", "value": "18% reduction", "context": "through infra right-sizing"},
            ],
            "business_challenges": [
                "Improved reliability and reduced incident volume for a core service",
                "Reduced latency and infrastructure costs while maintaining SLAs",
            ],
            "skills": ["Python", "SQL", "AWS", "Docker", "React"],
            "accomplishments": [
                "Shipped a high-availability service used by internal teams weekly",
                "Improved observability with dashboards + alerts",
            ],
            "tenure": [{"company": "TechCorp", "duration": "2 years", "role": "Senior Software Engineer"}],
            "education": [{"school": "Example University", "degree": "BS", "field": "Computer Science", "start_year": "2018", "end_year": "2022", "notes": ""}],
        }
        return self.run_chat_completion(
            messages,
            temperature=0.1,
            max_tokens=1400,
            stub_json=stub,
        )

    def extract_job_structure(self, text: str) -> Dict[str, Any]:
        """
        Parse a job description into structured fields.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are RoleFerry's job description parser. Extract accurate structured fields from messy job posting text.\n\n"
                    "The input may include job-board UI noise like: 'Actively Hiring', 'Apply Now', 'Save', 'Posted 1 week ago', salaries, locations, etc.\n"
                    "Ignore UI noise and focus on the actual job content.\n\n"
                    "Hard requirements:\n"
                    "- Do NOT fabricate facts. Only extract what is clearly present.\n"
                    "- title MUST be the role title (e.g., 'Strategic Customer Success Manager'), NOT the company name.\n"
                    "- company MUST be the company name (e.g., 'SentiLink'), NOT a generic word like 'This'/'We'/'Remote'.\n"
                    "- If uncertain, return empty string for that field.\n\n"
                    "Rules for pain_points (business challenges):\n"
                    "- Focus on business/technical goals, problems, or challenges.\n"
                    "- DO NOT include compensation/salary/benefits/employment type/location as pain points.\n"
                    "- DO NOT include addresses, commute text, ratings, or job-board UI lines (e.g., 'Responded to 75%').\n\n"
                    "Rules for success_metrics:\n"
                    "- Prefer measurable outcomes or KPI-style expectations.\n"
                    "- If none are explicitly stated, return 1-3 short outcome statements derived from responsibilities (not marketing fluff).\n\n"
                    "Formatting constraints:\n"
                    "- Each item in success_metrics MUST be a complete sentence (end with . ! or ?).\n"
                    "- Each item MUST be <= 35 words.\n"
                    "- Rewrite/condense as needed to meet the word limit without cutting mid-sentence.\n\n"
                    "Also:\n"
                    "- DO NOT include salary or addresses in success_metrics.\n\n"
                    "Rules for required_skills:\n"
                    "- Include concrete skills/tools/technologies (e.g., 'Salesforce', 'APIs', 'SQL', 'Customer success').\n"
                    "- Avoid accidental matches like the word 'go' from 'go live' (only include 'Go' if clearly referring to the programming language).\n\n"
                    "Skills normalization:\n"
                    "- Normalize casing/synonyms (e.g., 'node js' -> 'Node.js', 'reactjs' -> 'React').\n"
                    "- Do not include proficiency levels or duplicates.\n\n"
                    "Return ONLY JSON with these keys:\n"
                    "- title: string\n"
                    "- company: string\n"
                    "- location: string (e.g., 'United States', 'San Francisco, CA')\n"
                    "- work_mode: string (remote|hybrid|onsite|unknown)\n"
                    "- employment_type: string (full-time|part-time|contract|internship|unknown)\n"
                    "- salary_range: string (as written). If no salary is present, return 'Salary not provided'.\n"
                    "- pain_points: array of strings\n"
                    "- responsibilities: array of strings\n"
                    "- requirements: array of strings\n"
                    "- required_skills: array of strings\n"
                    "- benefits: array of strings\n"
                    "- success_metrics: array of strings\n"
                ),
            },
            {"role": "user", "content": text},
        ]
        seed = self._stable_seed(messages)
        titles = ["Senior Product Manager", "Senior Software Engineer", "Head of Growth", "Data Scientist"]
        companies = ["GrowthLoop", "TechCorp Inc.", "Acme Analytics", "NimbusAI"]
        stub = {
            "title": titles[seed % len(titles)],
            "company": companies[(seed // 7) % len(companies)],
            "location": "United States",
            "work_mode": "remote",
            "employment_type": "full-time",
            "salary_range": "$150,000 - $190,000",
            "pain_points": [
                "Improve onboarding activation and reduce drop-off",
                "Reduce churn by improving time-to-value",
                "Increase visibility into funnel metrics and attribution",
            ],
            "responsibilities": [
                "Own onboarding and activation initiatives end-to-end",
                "Partner cross-functionally with Product and Engineering",
            ],
            "requirements": [
                "3+ years in a relevant role",
                "Strong stakeholder management",
            ],
            "required_skills": ["SQL", "Experimentation", "Stakeholder management", "Analytics", "Roadmapping"],
            "benefits": ["Remote-friendly", "Health insurance", "401(k)"],
            "success_metrics": ["+15% activation", "-10% churn", "Shorter cycle time for releases"],
        }
        return self.run_chat_completion(messages, temperature=0.1, max_tokens=1200, stub_json=stub)

    def generate_pain_point_map(self, jd_blob: str, resume_blob: str) -> Dict[str, Any]:
        """
        Given a job description and resume text, propose up to three
        (challenge, solution, metric) triplets with an overall alignment_score.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You compare a job description and a resume. Propose up to three alignments where the user's experience solves a business challenge.\n\n"
                    "Rules:\n"
                    "- jd_snippet: must be a business or technical challenge (NOT salary/benefits).\n"
                    "- resume_snippet: how the user solved it.\n"
                    "- metric: measurable impact.\n\n"
                    "Return ONLY JSON: pairs[ { jd_snippet, resume_snippet, metric } ], alignment_score (0-1)."
                ),
            },
            {"role": "user", "content": f"Job description:\n{jd_blob}\n\nResume:\n{resume_blob}"},
        ]
        seed = self._stable_seed(messages)
        stub = {
            "pairs": [
                {
                    "jd_snippet": "Improve onboarding activation and reduce drop-off",
                    "resume_snippet": "Led onboarding funnel revamp and improved activation via experiments",
                    "metric": "+12% activation",
                },
                {
                    "jd_snippet": "Reduce churn by improving time-to-value",
                    "resume_snippet": "Built usage-based lifecycle messaging that reduced early churn",
                    "metric": "-8% churn",
                },
                {
                    "jd_snippet": "Increase visibility into funnel metrics and attribution",
                    "resume_snippet": "Implemented event taxonomy + dashboards for end-to-end attribution",
                    "metric": "4x faster insights",
                },
            ],
            "alignment_score": round(0.72 + ((seed % 20) / 100), 2),
        }
        return self.run_chat_completion(messages, temperature=0.2, stub_json=stub)

    def draft_offer_email(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Draft a short outreach/offer email given a structured context dict.
        The context is intentionally free-form; routers/services own the schema.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You write concise, plain-language outreach snippets. "
                    "Use the provided JSON context to personalize the message. "
                    "Respond ONLY as compact JSON with keys: "
                    "title (short string) and content (offer snippet string).\n\n"
                    "Hard constraints:\n"
                    "- Do NOT include any names or greetings (e.g., 'Hi Briana', 'Briana, your role...').\n"
                    "- Do NOT start with fluff like \"I hope you're doing well\" / \"I hope this message finds you well\".\n"
                    "- The snippet must be a standalone paragraph or few sentences that can be inserted into a larger email template later.\n"
                    "- Focus immediately on the value (offer, pain point, proof, or question).\n"
                ),
            },
            {
                "role": "user",
                "content": f"Context JSON:\n{context}",
            },
        ]
        seed = self._stable_seed(messages)
        company = (context or {}).get("company") or "TechCorp"
        role = (context or {}).get("job_title") or "the role"
        stub = {
            "title": f"{role}: quick idea for {company}",
            "content": (
                f"Hi {{first_name}},\n\n"
                f"I noticed {company} is tackling {{painpoint_1}}. I’ve helped teams address this by {{solution_1}} "
                f"({{metric_1}}). If it’s useful, I can share a 2–3 bullet plan tailored to {role}.\n\n"
                f"Open to a quick 10–15 minute chat?\n\n"
                f"Best,\n[Your Name]\n"
            ),
        }
        return self.run_chat_completion(messages, temperature=0.3, max_tokens=600, stub_json=stub)

    def draft_compose_email(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Draft an email for the Compose step (subject/body + optional variants).

        Returns ONLY JSON:
        - subject: string
        - body: string
        - variants: array of { label, intended_for, audience_tone, subject, body }
        - rationale: short string
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are RoleFerry's outreach copilot. Draft a concise, human email with a strong opener, "
                    "one credibility proof, and a clear CTA. Keep it plain-language and specific.\n\n"
                    "Style constraints:\n"
                    "- Hard ban: do NOT use canned/opening clichés like: \"I hope this message finds you well\", "
                    "\"I hope you're doing well\", \"I hope you are well\", \"I hope you had a great weekend\", "
                    "\"trust you're well\", or any wellbeing/pleasantry opener.\n"
                    "- After any greeting, sentence 1 must be value-first (offer/painpoint/proof/ask) — no throat-clearing.\n"
                    "- Start with a modern, succinct opener that references something concrete from the context "
                    "(role/company/pain point/news) or go straight to the point.\n"
                    "- Keep greetings minimal (e.g., \"Hi {first_name},\" then 1–2 tight sentences).\n\n"
                    "You MUST follow the requested tone/audience:\n"
                    "- recruiter: ultra concise, logistics-forward, easy yes/no\n"
                    "- manager: competent + collaborative, emphasizes team impact\n"
                    "- exec: outcome/ROI + risk reduction, strategic framing\n"
                    "- developer: technical specificity, concrete implementation details, no fluff\n"
                    "- sales: crisp proof points, clear next step, confident but not pushy\n"
                    "- startup: high-ownership, fast-moving, momentum and iteration\n"
                    "- enterprise: process-aware, risk-aware, stakeholders + delivery predictability\n"
                    "- custom: follow `custom_tone` exactly.\n\n"
                    "Incorporate the Offer step if present:\n"
                    "- If `offer_snippet` exists, rewrite it into ONE strong sentence and include it as a single bullet or short line.\n"
                    "- Do NOT paste the whole offer content.\n"
                    "- If `offer_url` exists, include a single line with a tone-appropriate intro (rewrite it, don't always use the same phrase).\n"
                    "\nTemplate rules:\n"
                    "- Preserve placeholders exactly (e.g., {{first_name}}, {{job_title}}, {{company_name}}, {{painpoint_1}}, {{solution_1}}, {{metric_1}}, {{offer_snippet}}, {{work_link}}).\n"
                    "- Do NOT replace placeholders with actual names/companies.\n"
                    "Return ONLY a JSON object with keys:\n"
                    "- subject: string\n"
                    "- body: string\n"
                    "- variants: array of { label, intended_for, audience_tone, subject, body }\n"
                    "- rationale: string\n"
                ),
            },
            {"role": "user", "content": f"Context JSON:\n{context}"},
        ]
        seed = self._stable_seed(messages)
        company = str((context or {}).get("company_name") or "TechCorp")
        role = str((context or {}).get("job_title") or "the role")
        first_name = str((context or {}).get("first_name") or "there")
        pp = str((context or {}).get("painpoint_1") or "a key priority")
        sol = str((context or {}).get("solution_1") or "a proven approach")
        metric = str((context or {}).get("metric_1") or "a measurable result")
        stub = {
            "subject": f"{role} at {company} — quick idea",
            "body": (
                "Hi {{first_name}},\n\n"
                "Saw the {{job_title}} role at {{company_name}} and wanted to share one quick idea.\n\n"
                "- One idea I’d bring: {{offer_snippet}}\n"
                "- Relevant proof: {{solution_1}} ({{metric_1}})\n\n"
                "Open to a quick 10–15 minute chat?\n\n"
                "Please see my work here: {{work_link}}\n\n"
                f"Best,\n[Your Name]\n"
            ),
            "variants": [
                {
                    "label": "short_direct",
                    "intended_for": "Cold email; concise opener + fast CTA",
                    "audience_tone": "recruiter",
                    "subject": "{{company_name}}: idea for {{job_title}}",
                    "body": (
                        "Hi {{first_name}} — quick note.\n\n"
                        "{{painpoint_1}} stood out. I’ve tackled this by {{solution_1}} ({{metric_1}}).\n\n"
                        "Open to a quick chat?\n\nBest,\n[Your Name]\n"
                    ),
                },
                {
                    "label": "warm_context",
                    "intended_for": "Warmish cold email; a bit more context and credibility",
                    "audience_tone": "manager",
                    "subject": "Re: {{job_title}} @ {{company_name}}",
                    "body": (
                        "Hi {{first_name}},\n\n"
                        "I saw the {{job_title}} opening and did a quick scan of {{company_name}}’s priorities. "
                        "{{painpoint_1}} seems central. I’ve delivered {{metric_1}} in similar situations by {{solution_1}}.\n\n"
                        "Happy to share specifics—want a 10–15 min chat?\n\nBest,\n[Your Name]\n"
                    ),
                },
            ][: 2 + (seed % 1)],
            "rationale": "Two variants: one short/direct and one warm/context-driven for A/B testing.",
        }
        return self.run_chat_completion(messages, temperature=0.35, max_tokens=700, stub_json=stub)


# Singleton-style accessor used across the backend
_default_client: Optional[OpenAIClient] = None


def get_openai_client() -> OpenAIClient:
    global _default_client
    if _default_client is None:
        _default_client = OpenAIClient(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            base_url=settings.openai_base_url,
        )
    return _default_client


