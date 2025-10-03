from typing import Dict, Any
import os


DEFAULT_PRICING = {
    "serper_per_request": float(os.getenv("COST_SERPER_PER_REQUEST", "0.0000")),
    "openai_per_1k_tokens": float(os.getenv("COST_OPENAI_PER_1K_TOKENS", "0.0030")),
    "findymail_per_lookup": float(os.getenv("COST_FINDYMAIL_PER_LOOKUP", "0.0300")),
    "neverbounce_per_verify": float(os.getenv("COST_NEVERBOUNCE_PER_VERIFY", "0.0080")),
}


def record(step: str, prospect_id: str | None, units: float, unit_type: str, est_cost_usd: float | None = None, meta: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Stub cost meter: returns a record dict; persistence will be added with DB.
    """
    if est_cost_usd is None:
        if step == "serper":
            est_cost_usd = DEFAULT_PRICING["serper_per_request"] * units
        elif step == "gpt":
            est_cost_usd = DEFAULT_PRICING["openai_per_1k_tokens"] * units
        elif step == "findymail":
            est_cost_usd = DEFAULT_PRICING["findymail_per_lookup"] * units
        elif step == "neverbounce":
            est_cost_usd = DEFAULT_PRICING["neverbounce_per_verify"] * units
        else:
            est_cost_usd = 0.0
    return {
        "step": step,
        "prospect_id": prospect_id,
        "units": units,
        "unit_type": unit_type,
        "est_cost_usd": round(float(est_cost_usd), 4),
        "meta": meta or {},
    }


