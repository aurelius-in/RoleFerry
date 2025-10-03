from typing import Dict, Any
from time import perf_counter, sleep
from ..config import settings


def qualify_prospect(preview: Dict[str, Any], temperature: float = 0.2) -> Dict[str, Any]:
    """Stub AI qualifier using mock or OpenAI when configured.
    Returns decision, reason, model, latency_ms.
    """
    t0 = perf_counter()
    # Simulate realistic latency in mock
    if settings.mock_mode or not settings.openai_api_key:
        sleep(0.15)
        dt = int((perf_counter() - t0) * 1000)
        title = preview.get("title", "").lower()
        decision = "maybe"
        if "ceo" in title or "chief" in title:
            decision = "yes"
        elif "vp" in title or "head" in title or "director" in title:
            # temperature skews maybe vs yes
            decision = "yes" if temperature < 0.25 else "maybe"
        else:
            decision = "maybe" if temperature < 0.5 else "no"
        return {
            "decision": decision,
            "reason": "Title indicates decision maker",
            "model": f"mock-qualifier-t{temperature}",
            "latency_ms": dt,
        }
    # TODO: real OpenAI call
    dt = int((perf_counter() - t0) * 1000)
    return {"decision": "maybe", "reason": "Stub", "model": "openai-gpt", "latency_ms": dt}


