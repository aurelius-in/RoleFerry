from typing import Dict, Any
from ..config import settings
from .neverbounce_client import verify_email as nb_verify


def verify(email: str) -> Dict[str, Any]:
    """Verifier interface: prefer NeverBounce if configured, else MillionVerifier via env, else mock.
    """
    # Prefer NeverBounce
    if settings.preferred_email_verifier == "neverbounce" and (settings.neverbounce_api_key or settings.mock_mode):
        return nb_verify(email)

    # Fallback: MillionVerifier stub
    if settings.mv_api_key or settings.mock_mode:
        # simple mock for MV
        status = "valid" if email.endswith(".com") else "unknown"
        score = 85 if status == "valid" else None
        return {"status": status, "score": score, "raw": {"provider": "millionverifier", "source": "mock"}}

    # No providers and not mock
    return {"status": "unknown", "score": None, "raw": {"error": "no_verifier_available"}}


