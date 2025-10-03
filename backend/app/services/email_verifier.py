from typing import Dict, Any
from ..config import settings
from .neverbounce_client import verify_email as nb_verify


def verify(email: str) -> Dict[str, Any]:
    """Verifier interface with optional waterfall: prefer configured provider; if status not sendable and waterfall enabled, try the other.
    """
    def mv_verify_stub(e: str) -> Dict[str, Any]:
        status = "valid" if e.endswith(".com") else "unknown"
        score = 85 if status == "valid" else None
        return {"status": status, "score": score, "raw": {"provider": "millionverifier", "source": "mock"}}

    preferred = settings.preferred_email_verifier
    result = None
    if preferred == "neverbounce" and (settings.neverbounce_api_key or settings.mock_mode):
        result = nb_verify(email)
    elif (settings.mv_api_key or settings.mock_mode):
        result = mv_verify_stub(email)
    else:
        result = {"status": "unknown", "score": None}

    # Waterfall (simple): if accept_all with low score or unknown, try alternate if available
    if result.get("status") in {"unknown"} and (settings.mv_api_key or settings.mock_mode) and preferred == "neverbounce":
        alt = mv_verify_stub(email)
        if alt.get("status") != "unknown":
            result = alt
    return result


