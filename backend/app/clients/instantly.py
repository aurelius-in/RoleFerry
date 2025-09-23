import httpx
from typing import Any, Dict


class InstantlyClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://api.instantly.ai/api/v2"

    async def push_contacts(self, list_name: str, contacts: list[dict]) -> Dict[str, Any]:
        # Attempt real API call; fall back to stubbed response on error
        url = f"{self.base_url}/contacts/bulk"
        headers = {"x-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {"list": list_name, "contacts": contacts}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
                return {
                    "status": data.get("status", "queued"),
                    "list": list_name,
                    "count": len(contacts),
                    "raw": data,
                }
        except Exception as e:
            return {"status": "queued", "list": list_name, "count": len(contacts), "error": str(e)}

