from typing import Dict


class LLMAdapter:
    def __init__(self, provider: str | None = None, api_key: str | None = None) -> None:
        self.provider = provider or "stub"
        self.api_key = api_key

    def generate(self, prompt: str, max_tokens: int = 400) -> str:
        # Stubbed response for MVP
        return (
            "[Stubbed LLM Output] "
            + prompt[: max_tokens // 2]
            + "..."
        )


def format_calendly_line(url: str | None) -> str:
    return f"If helpful, grab time here: {url}" if url else "If helpful, happy to send times."

