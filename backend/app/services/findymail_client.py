from typing import Dict, Any, Optional
from time import sleep
from ..config import settings

import logging

_log = logging.getLogger(__name__)


def enrich_contact(name: str, domain: str) -> Dict[str, Any]:
    """Find a professional email for *name* at *domain*.

    Waterfall:
      1. Apollo person_enrich (if APOLLO_API_KEY is set) — costs 1 credit per email found.
      2. Findymail real API (if FINDYMAIL_API_KEY is set) — TODO: not yet implemented.
      3. Mock fallback (first.last@domain) when in mock mode or no keys configured.
    """
    # 1. Apollo email discovery
    if settings.apollo_api_key:
        try:
            from ..clients.apollo import ApolloClient
            apollo = ApolloClient(settings.apollo_api_key, timeout_seconds=10.0)
            parts = name.strip().split()
            first = parts[0] if parts else ""
            last = parts[-1] if len(parts) > 1 else ""
            raw = apollo.person_enrich(
                first_name=first,
                last_name=last,
                domain=domain,
                organization_name="",
            )
            if raw:
                person = raw.get("person") or raw
                email = str(person.get("email") or "").strip()
                email_status = str(person.get("email_status") or "").strip()
                if email and email_status != "invalid":
                    _log.info("Apollo email found for %s@%s: %s (%s)", name, domain, email, email_status)
                    return {
                        "email": email,
                        "phone": str(person.get("phone") or person.get("organization_phone") or "").strip() or None,
                        "meta": {"source": "apollo", "email_status": email_status},
                    }
        except Exception as e:
            _log.debug("Apollo email lookup failed for %s@%s: %s", name, domain, e)

    # 2. Findymail real API (placeholder)
    if settings.findymail_api_key and not settings.mock_mode:
        # TODO: real Findymail call
        return {"email": None, "phone": None, "meta": {"source": "stub"}}

    # 3. Mock fallback
    if settings.mock_mode:
        sleep(0.1)
        parts = name.strip().split()
        local = ".".join([p.lower() for p in (parts[:1] + parts[-1:])]) or "contact"
        return {"email": f"{local}@{domain}", "phone": None, "meta": {"source": "mock"}}

    return {"email": None, "phone": None, "meta": {"source": "none"}}
