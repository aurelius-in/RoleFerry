from typing import Dict, Any
from time import perf_counter, sleep
import json

from ..config import settings
from ..clients.openai_client import get_openai_client


def _rule_based_fallback(preview: Dict[str, Any], temperature: float, latency_ms: int) -> Dict[str, Any]:
    """
    Deterministic, title-based qualifier used in mock_mode and as a safety
    net if the LLM path fails.
    """
    title = (preview.get("title") or "").lower()
    decision = "maybe"
    if "ceo" in title or "chief" in title:
        decision = "yes"
    elif any(k in title for k in ("vp", "head", "director")):
        decision = "yes" if temperature < 0.25 else "maybe"
    else:
        decision = "maybe" if temperature < 0.5 else "no"

    return {
        "decision": decision,
        "reason": "Title indicates decision maker",
        "model": f"mock-qualifier-t{temperature}",
        "latency_ms": latency_ms,
    }


def qualify_prospect(preview: Dict[str, Any], temperature: float = 0.2) -> Dict[str, Any]:
    """Qualifier that prefers GPT when enabled, otherwise falls back to rules.

    Returns a dict with keys: decision ('yes'|'no'|'maybe'), reason, model, latency_ms.
    """
    t0 = perf_counter()

    client = get_openai_client()
    # Primary path: rule-based when in mock mode or when OpenAI is disabled
    if not client.should_use_real_llm:
        sleep(0.15)  # preserve prior perceived latency
        dt = int((perf_counter() - t0) * 1000)
        return _rule_based_fallback(preview, temperature, dt)

    # GPT-backed path: ask for a small JSON object and validate the response.
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a lead qualification assistant. Given a prospect preview "
                    "JSON (name, title, company, linkedin_url), decide if they are a "
                    "good decision-maker to contact about outbound campaigns.\n\n"
                    "Respond ONLY as a JSON object with: decision ('yes'|'no'|'maybe'), "
                    "reason (short string)."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(preview, ensure_ascii=False),
            },
        ]
        data = client.run_chat_completion(
            messages,
            temperature=temperature,
            max_tokens=128,
        )
        dt = int((perf_counter() - t0) * 1000)

        choice = (data.get("choices") or [])[0]
        msg = choice.get("message") or {}
        raw_content = msg.get("content") or ""

        parsed: Dict[str, Any]
        try:
            parsed = json.loads(raw_content)
        except Exception:
            # Some models may wrap JSON in extra text; attempt a crude extraction
            start = raw_content.find("{")
            end = raw_content.rfind("}")
            if start != -1 and end != -1 and end > start:
                parsed = json.loads(raw_content[start : end + 1])
            else:
                raise

        decision = str(parsed.get("decision", "maybe")).lower()
        if decision not in {"yes", "no", "maybe"}:
            decision = "maybe"
        reason = str(parsed.get("reason") or "LLM qualifier result")

        return {
            "decision": decision,
            "reason": reason,
            "model": data.get("model", settings.openai_model),
            "latency_ms": dt,
        }
    except Exception:
        # If anything goes wrong, fall back to deterministic behavior so callers
        # are never blocked on GPT flakiness.
        dt = int((perf_counter() - t0) * 1000)
        return _rule_based_fallback(preview, temperature, dt)


