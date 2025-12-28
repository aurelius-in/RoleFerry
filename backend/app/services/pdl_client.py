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
    email: Optional[str] = None
    email_source: Optional[str] = None
    location_name: Optional[str] = None
    location_country: Optional[str] = None
    job_company_website: Optional[str] = None
    job_company_linkedin_url: Optional[str] = None
    job_company_industry: Optional[str] = None
    job_company_size: Optional[str] = None


# Keep this intentionally small + outreach-safe.
# We do NOT request birth date/year, sex, street address, phone numbers, etc.
DEFAULT_PERSON_FIELDS: List[str] = [
    "id",
    "full_name",
    "first_name",
    "last_name",
    "job_title",
    "job_company_name",
    "linkedin_url",
    "work_email",
    "recommended_personal_email",
    "emails",
    "location_name",
    "location_country",
    "job_company_website",
    "job_company_linkedin_url",
    "job_company_industry",
    "job_company_size",
]


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
            "fields": DEFAULT_PERSON_FIELDS,
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

        def _best_email(row: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
            # Priority: work_email > recommended_personal_email > emails[].address
            work = row.get("work_email")
            if isinstance(work, str) and work.strip():
                return work.strip(), "work_email"
            rec = row.get("recommended_personal_email")
            if isinstance(rec, str) and rec.strip():
                return rec.strip(), "recommended_personal_email"
            emails = row.get("emails")
            if isinstance(emails, list):
                for e in emails:
                    if not isinstance(e, dict):
                        continue
                    addr = e.get("address")
                    if isinstance(addr, str) and addr.strip():
                        et = str(e.get("type") or "").strip()
                        src = f"emails{':' + et if et else ''}"
                        return addr.strip(), src
            return None, None

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

            email, email_source = _best_email(row)
            location_name = row.get("location_name")
            location_country = row.get("location_country")
            job_company_website = row.get("job_company_website")
            job_company_linkedin_url = row.get("job_company_linkedin_url")
            job_company_industry = row.get("job_company_industry")
            job_company_size = row.get("job_company_size")
            out.append(
                PdlPersonResult(
                    name=name,
                    title=title,
                    linkedin_url=str(linkedin_url).strip() if linkedin_url else None,
                    company=str(company).strip() if company else None,
                    email=str(email).strip() if email else None,
                    email_source=str(email_source).strip() if email_source else None,
                    location_name=str(location_name).strip() if isinstance(location_name, str) and location_name.strip() else None,
                    location_country=str(location_country).strip() if isinstance(location_country, str) and location_country.strip() else None,
                    job_company_website=str(job_company_website).strip() if isinstance(job_company_website, str) and job_company_website.strip() else None,
                    job_company_linkedin_url=str(job_company_linkedin_url).strip() if isinstance(job_company_linkedin_url, str) and job_company_linkedin_url.strip() else None,
                    job_company_industry=str(job_company_industry).strip() if isinstance(job_company_industry, str) and job_company_industry.strip() else None,
                    job_company_size=str(job_company_size).strip() if isinstance(job_company_size, str) and job_company_size.strip() else None,
                )
            )
        return out


