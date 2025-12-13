from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import json

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
        return (
            bool(self.api_key)
            and not settings.mock_mode
            and (settings.llm_mode or "openai") == "openai"
        )

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _stub_response(self, messages: List[Dict[str, str]], note: str | None = None) -> Dict[str, Any]:
        """
        Deterministic stub used when in mock_mode or when OpenAI is unavailable.
        Echoes the last user message with a short prefix so callers always get
        a syntactically similar response object.
        """
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        prefix = "[Stubbed GPT]"
        if note:
            prefix += f" ({note})"
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
        **extra: Any,
    ) -> Dict[str, Any]:
        """
        Synchronous chat completion helper.

        Callers get a dict shaped like OpenAI's /chat/completions response,
        even when running in stub mode.
        """
        if not self.should_use_real_llm:
            return self._stub_response(messages, note="mock_mode or missing API key")

        payload: Dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        payload.update(extra or {})

        try:
            with httpx.Client(base_url=self.base_url, timeout=self.timeout_seconds) as client:
                resp = client.post("/chat/completions", json=payload, headers=self._build_headers())
                resp.raise_for_status()
                data = resp.json()
                return data
        except httpx.HTTPStatusError as e:
            logger.warning("OpenAI chat completion HTTP error: %s", e, exc_info=True)
            return self._stub_response(messages, note=f"http_error {e.response.status_code}")
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
        return self.run_chat_completion(
            messages,
            temperature=0.1,
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
        return self.run_chat_completion(messages, temperature=0.1)

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
        return self.run_chat_completion(messages, temperature=0.2)

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
        return self.run_chat_completion(messages, temperature=0.3, max_tokens=600)


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


