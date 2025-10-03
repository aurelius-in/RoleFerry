from typing import List, Dict, Any
from time import sleep
from ..config import settings

_CACHE: dict[tuple[str, str], list[dict[str, any]]] = {}


def search_linkedin(domain: str, role_query: str) -> List[Dict[str, Any]]:
    """Stub Serper search client.
    In mock mode or when keys are missing, returns deterministic sample results.
    """
    key = (domain, role_query)
    if key in _CACHE:
        return _CACHE[key]
    if settings.mock_mode or not settings.serper_api_key:
        sleep(0.12)
        base = domain.replace(".", "-")
        _CACHE[key] = [
            {
                "title": f"CEO at {domain}",
                "url": f"https://www.linkedin.com/in/{base}-ceo",
                "snippet": f"Executive leader relevant to {role_query}",
            }
        ]
        return _CACHE[key]
    # TODO: real Serper Web Search API call
    return []


