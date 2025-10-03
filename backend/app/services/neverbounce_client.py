from typing import Dict, Any
from time import sleep
from ..config import settings


def verify_email(email: str) -> Dict[str, Any]:
    """Stub NeverBounce verification.
    Returns status and score.
    """
    if settings.mock_mode or not settings.neverbounce_api_key:
        sleep(0.08)
        # simple deterministic mock based on hash
        status = "valid" if email and email[0].lower() < "n" else "accept_all"
        score = 90 if status == "valid" else 70
        return {"status": status, "score": score, "raw": {"source": "mock"}}
    # TODO: real NeverBounce call
    return {"status": "unknown", "score": None, "raw": {"source": "stub"}}


