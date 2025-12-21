from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import json
import hashlib
import time

import httpx

from ..config import settings


logger = logging.getLogger(__name__)


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
                        return self._stub_response(messages, note=note)
        except Exception as e:  # pragma: no cover - defensive catch-all
            logger.exception("OpenAI chat completion failed", exc_info=e)
            return self._stub_response(messages, note="exception")

    # ---- Focused use-case helpers -------------------------------------

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
                    "You are a resume parsing assistant. Extract structured information from raw resume text. "
                    "Do not invent facts.\n\n"
                    "Return ONLY a JSON object with these keys:\n"
                    "- positions: array of { company, title, start_date, end_date, current, description }\n"
                    "- key_metrics: array of { metric, value, context }\n"
                    "- skills: array of strings\n"
                    "- accomplishments: array of strings\n"
                    "- tenure: array of { company, duration, role }\n"
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
            "skills": ["Python", "SQL", "AWS", "Docker", "React"],
            "accomplishments": [
                "Shipped a high-availability service used by internal teams weekly",
                "Improved observability with dashboards + alerts",
            ],
            "tenure": [{"company": "TechCorp", "duration": "2 years", "role": "Senior Software Engineer"}],
        }
        return self.run_chat_completion(
            messages,
            temperature=0.1,
            stub_json=stub,
        )

    def extract_job_structure(self, text: str) -> Dict[str, Any]:
        """
        Parse a job description into pain_points, required_skills, success_metrics.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a job description parser. Extract structured fields from raw job posting text.\n\n"
                    "Return ONLY a JSON object with keys:\n"
                    "- title: string\n"
                    "- company: string\n"
                    "- pain_points: array of strings\n"
                    "- required_skills: array of strings\n"
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
            "pain_points": [
                "Improve onboarding activation and reduce drop-off",
                "Reduce churn by improving time-to-value",
                "Increase visibility into funnel metrics and attribution",
            ],
            "required_skills": ["SQL", "Experimentation", "Stakeholder management", "Analytics", "Roadmapping"],
            "success_metrics": ["+15% activation", "-10% churn", "Shorter cycle time for releases"],
        }
        return self.run_chat_completion(messages, temperature=0.1, stub_json=stub)

    def generate_pain_point_map(self, jd_blob: str, resume_blob: str) -> Dict[str, Any]:
        """
        Given a job description and resume text, propose up to three
        (challenge, solution, metric) triplets with an overall alignment_score.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You compare a job description and a resume. "
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
                    "You write concise, plain-language outreach emails. "
                    "Use the provided JSON context to personalize the message. "
                    "Respond ONLY as compact JSON with keys: "
                    "title (short string) and content (email body string)."
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
        - variants: array of { label, subject, body }
        - rationale: short string
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are RoleFerry's outreach copilot. Draft a concise, human email with a strong opener, "
                    "one credibility proof, and a clear CTA. Keep it plain-language and specific.\n\n"
                    "Return ONLY a JSON object with keys:\n"
                    "- subject: string\n"
                    "- body: string\n"
                    "- variants: array of { label, subject, body }\n"
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
                f"Hi {first_name},\n\n"
                f"I noticed {company} is working through {pp}. I’ve helped teams solve similar problems by {sol} "
                f"({metric}).\n\n"
                f"If you’re open to it, I can share a 2–3 bullet plan tailored to {role}. "
                f"Would a quick 10–15 minute chat this week be useful?\n\n"
                f"Best,\n[Your Name]\n"
            ),
            "variants": [
                {
                    "label": "short_direct",
                    "subject": f"{company}: idea for {role}",
                    "body": (
                        f"Hi {first_name} — quick note.\n\n"
                        f"{pp} stood out. I’ve tackled this by {sol} ({metric}). "
                        f"Open to a quick chat?\n\nBest,\n[Your Name]\n"
                    ),
                },
                {
                    "label": "warm_context",
                    "subject": f"Re: {role} @ {company}",
                    "body": (
                        f"Hi {first_name},\n\n"
                        f"I saw the {role} opening and did a quick scan of {company}'s priorities. "
                        f"{pp} seems central. I’ve delivered {metric} in similar situations by {sol}.\n\n"
                        f"Happy to share specifics—want a 10–15 min chat?\n\nBest,\n[Your Name]\n"
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


