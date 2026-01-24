import httpx
from typing import Any, Dict, List, Optional


class InstantlyClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://api.instantly.ai/api/v2"

    def _headers(self) -> Dict[str, str]:
        # Instantly docs show Bearer auth; some integrations use x-api-key.
        # Sending both keeps us resilient across API key formats.
        return {
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def push_contacts(self, list_name: str, contacts: list[dict]) -> Dict[str, Any]:
        # Attempt real API call; fall back to stubbed response on error
        url = f"{self.base_url}/contacts/bulk"
        headers = self._headers()
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

    async def list_accounts(self) -> Dict[str, Any]:
        url = f"{self.base_url}/accounts"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(url, headers=self._headers())
                r.raise_for_status()
                data = r.json()
                return {"ok": True, "raw": data}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def enable_warmup(
        self,
        emails: Optional[List[str]] = None,
        include_all_emails: bool = False,
        excluded_emails: Optional[List[str]] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/accounts/warmup/enable"
        payload: Dict[str, Any] = {}
        if include_all_emails:
            payload["include_all_emails"] = True
            if excluded_emails:
                payload["excluded_emails"] = excluded_emails
            if search:
                payload["search"] = search
        else:
            payload["emails"] = [e for e in (emails or []) if str(e or "").strip()]
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=self._headers(), json=payload)
                r.raise_for_status()
                return {"ok": True, "raw": r.json()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def get_warmup_analytics(self, emails: Optional[List[str]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}/accounts/warmup-analytics"
        payload: Dict[str, Any] = {}
        if emails:
            payload["emails"] = [e for e in emails if str(e or "").strip()]
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=self._headers(), json=payload)
                r.raise_for_status()
                return {"ok": True, "raw": r.json()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

