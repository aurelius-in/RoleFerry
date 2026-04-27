import httpx
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class InstantlyClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://api.instantly.ai/api/v2"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def push_contacts(self, list_name: str, contacts: list[dict]) -> Dict[str, Any]:
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
                r = await client.get(url, headers=self._headers(), params={"limit": 100})
                r.raise_for_status()
                data = r.json()
                return {"ok": True, "raw": data}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def create_campaign(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new campaign in Instantly. Returns the campaign object including its id."""
        url = f"{self.base_url}/campaigns"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=self._headers(), json=payload)
                r.raise_for_status()
                data = r.json()
                return {"ok": True, "raw": data}
        except Exception as e:
            logger.warning("Instantly create_campaign failed: %s", str(e)[:300])
            return {"ok": False, "error": str(e)}

    async def update_campaign(self, campaign_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Patch an existing campaign (e.g. add sequences after creation)."""
        url = f"{self.base_url}/campaigns/{campaign_id}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.patch(url, headers=self._headers(), json=payload)
                r.raise_for_status()
                data = r.json()
                return {"ok": True, "raw": data}
        except Exception as e:
            logger.warning("Instantly update_campaign failed: %s", str(e)[:300])
            return {"ok": False, "error": str(e)}

    async def add_leads(self, campaign_id: str, leads: List[Dict[str, Any]], **kwargs: Any) -> Dict[str, Any]:
        """Bulk-add leads to a campaign."""
        url = f"{self.base_url}/leads/add"
        payload: Dict[str, Any] = {
            "campaign_id": campaign_id,
            "leads": leads,
        }
        if kwargs.get("verify_leads_on_import"):
            payload["verify_leads_on_import"] = True
        if kwargs.get("skip_if_in_workspace"):
            payload["skip_if_in_workspace"] = True
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(url, headers=self._headers(), json=payload)
                r.raise_for_status()
                data = r.json()
                return {"ok": True, "raw": data, "count": len(leads)}
        except Exception as e:
            logger.warning("Instantly add_leads failed: %s", str(e)[:300])
            return {"ok": False, "error": str(e), "count": 0}

    async def activate_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Activate (launch) a campaign."""
        url = f"{self.base_url}/campaigns/{campaign_id}/activate"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=self._headers())
                r.raise_for_status()
                data = r.json()
                return {"ok": True, "raw": data}
        except Exception as e:
            logger.warning("Instantly activate_campaign failed: %s", str(e)[:300])
            return {"ok": False, "error": str(e)}

    async def pause_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Pause an active campaign."""
        url = f"{self.base_url}/campaigns/{campaign_id}/pause"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, headers=self._headers())
                r.raise_for_status()
                data = r.json()
                return {"ok": True, "raw": data}
        except Exception as e:
            logger.warning("Instantly pause_campaign failed: %s", str(e)[:300])
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

    async def get_campaign_leads(self, campaign_id: str, limit: int = 100) -> Dict[str, Any]:
        """Fetch leads for a campaign with their current status (sent, opened, replied, etc.)."""
        url = f"{self.base_url}/leads"
        params = {"campaign_id": campaign_id, "limit": limit}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(url, headers=self._headers(), params=params)
                r.raise_for_status()
                return {"ok": True, "raw": r.json()}
        except Exception as e:
            logger.warning("Instantly get_campaign_leads failed: %s", str(e)[:300])
            return {"ok": False, "error": str(e)}

    async def get_unibox_replies(self, limit: int = 50) -> Dict[str, Any]:
        """Fetch recent replies from Instantly's unified inbox."""
        url = f"{self.base_url}/unibox/emails"
        params: Dict[str, Any] = {"email_type": "received", "limit": limit}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(url, headers=self._headers(), params=params)
                r.raise_for_status()
                return {"ok": True, "raw": r.json()}
        except Exception as e:
            logger.warning("Instantly get_unibox_replies failed: %s", str(e)[:300])
            return {"ok": False, "error": str(e)}

    async def get_campaign_summary(self, campaign_id: str) -> Dict[str, Any]:
        """Get campaign analytics summary (sent, opened, replied counts)."""
        url = f"{self.base_url}/campaigns/{campaign_id}/analytics"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(url, headers=self._headers())
                r.raise_for_status()
                return {"ok": True, "raw": r.json()}
        except Exception as e:
            logger.warning("Instantly get_campaign_summary failed: %s", str(e)[:300])
            return {"ok": False, "error": str(e)}

