from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import httpx


PDL_BASE_URL = "https://api.peopledatalabs.com/v5"


@dataclass
class PdlPersonResult:
    name: str
    title: str
    linkedin_url: Optional[str]
    company: Optional[str]


class PDLClient:
    def __init__(self, api_key: str, timeout_seconds: float = 15.0) -> None:
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def _headers(self) -> Dict[str, str]:
        return {"X-Api-Key": self.api_key, "Accept": "application/json"}

    def company_enrich(self, website: str) -> Dict[str, Any]:
        """
        Company Enrichment API.
        PDL v5 expects `website` (not `domain`) for common lookups.
        """
        url = f"{PDL_BASE_URL}/company/enrich"
        with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
            resp = client.get(url, params={"website": website}, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    def person_search(self, company: str, size: int = 10) -> Dict[str, Any]:
        """
        Person Search API expects `query` as an Elasticsearch JSON query (string),
        which is easiest to send via POST body.
        """
        url = f"{PDL_BASE_URL}/person/search"
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"match": {"job_company_name": company}},
                    ]
                }
            },
            "size": max(1, min(int(size), 25)),
        }
        with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
            resp = client.post(url, json=query, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    def extract_people(self, raw: Dict[str, Any]) -> List[PdlPersonResult]:
        data = raw.get("data") or []
        out: List[PdlPersonResult] = []
        if not isinstance(data, list):
            return out
        for row in data:
            if not isinstance(row, dict):
                continue
            name = str(row.get("full_name") or row.get("name") or "").strip()
            title = str(row.get("job_title") or row.get("title") or "").strip()
            linkedin_url = row.get("linkedin_url") or row.get("linkedin") or None
            company = row.get("job_company_name") or row.get("company") or None
            if not name or not title:
                continue
            if linkedin_url:
                lu = str(linkedin_url).strip()
                if lu.startswith("linkedin.com/") or lu.startswith("www.linkedin.com/"):
                    lu = "https://" + lu.lstrip("/")
                elif lu.startswith("/in/"):
                    lu = "https://www.linkedin.com" + lu
                linkedin_url = lu
            out.append(
                PdlPersonResult(
                    name=name,
                    title=title,
                    linkedin_url=str(linkedin_url).strip() if linkedin_url else None,
                    company=str(company).strip() if company else None,
                )
            )
        return out


