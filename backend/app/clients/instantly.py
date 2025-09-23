import httpx
from typing import Any, Dict


class InstantlyClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://api.instantly.ai/api/v2"

    async def push_contacts(self, list_name: str, contacts: list[dict]) -> Dict[str, Any]:
        # Stub: mimic API call
        async with httpx.AsyncClient(timeout=30) as client:
            # In a real call, we'd POST with auth headers
            return {"status": "queued", "list": list_name, "count": len(contacts)}

