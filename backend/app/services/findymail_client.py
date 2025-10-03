from typing import Dict, Any, Optional
from ..config import settings


def enrich_contact(name: str, domain: str) -> Dict[str, Any]:
    """Stub Findymail enrichment.
    In mock mode, return first.last@domain.
    """
    if settings.mock_mode or not settings.findymail_api_key:
        parts = name.strip().split()
        local = ".".join([p.lower() for p in (parts[:1] + parts[-1:])]) or "contact"
        return {"email": f"{local}@{domain}", "phone": None, "meta": {"source": "mock"}}
    # TODO: real Findymail call
    return {"email": None, "phone": None, "meta": {"source": "stub"}}


