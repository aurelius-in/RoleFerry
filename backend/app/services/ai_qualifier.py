from typing import Dict, Any
from time import perf_counter, sleep
from ..config import settings


def qualify_prospect(preview: Dict[str, Any]) -> Dict[str, Any]:
    """Stub AI qualifier using mock or OpenAI when configured.
    Returns decision, reason, model, latency_ms.
    """
    t0 = perf_counter()
    # Simulate realistic latency in mock
    if settings.mock_mode or not settings.openai_api_key:
        sleep(0.15)
        dt = int((perf_counter() - t0) * 1000)
        return {
            "decision": "yes" if "ceo" in preview.get("title", "").lower() else "maybe",
            "reason": "Title indicates decision maker",
            "model": "mock-qualifier",
            "latency_ms": dt,
        }
    # TODO: real OpenAI call
    dt = int((perf_counter() - t0) * 1000)
    return {"decision": "maybe", "reason": "Stub", "model": "openai-gpt", "latency_ms": dt}


