from typing import Dict

from .config import settings
from .clients.openai_client import get_openai_client


class LLMAdapter:
    """
    Lightweight adapter used by existing services to talk to an LLM.

    Today this is a thin façade over the centralized OpenAIClient. In mock_mode
    or when no API key is configured it deterministically stubs outputs so
    callers never need to handle provider failures directly.
    """

    def __init__(self, provider: str | None = None, api_key: str | None = None) -> None:
        # provider is reserved for future multi-vendor routing; for now "openai" or "stub"
        self.provider = provider or "openai"
        self.api_key = api_key or settings.openai_api_key

    def generate(self, prompt: str, max_tokens: int = 400) -> str:
        """
        Simple text generation helper.

        For now we use a single-turn chat with the prompt as the user message.
        The adapter always returns plain text, regardless of whether the call
        hit the real API or the stubbed path.
        """
        client = get_openai_client()

        # If we're in a stubbed path (mock_mode, missing key, or llm_mode != openai),
        # the client returns a deterministic echo-shaped message.
        messages = [
            {
                "role": "user",
                "content": prompt,
            }
        ]
        data = client.run_chat_completion(messages, max_tokens=max_tokens)
        try:
            choice = (data.get("choices") or [])[0]
            msg = choice.get("message") or {}
            content = msg.get("content") or ""
            return str(content)
        except Exception:
            # Extremely defensive: fall back to the old stub format
            return "[Stubbed LLM Output] " + prompt[: max_tokens // 2] + "..."


def format_calendly_line(url: str | None) -> str:
    return f"If helpful, grab time here: {url}" if url else "If helpful, happy to send times."

