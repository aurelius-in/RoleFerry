"""
Apollo.io API client for people search, company enrichment, and email discovery.

Docs: https://docs.apollo.io/reference/
Auth: x-api-key header (master key required for people search).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

_log = logging.getLogger(__name__)

APOLLO_BASE = "https://api.apollo.io/api/v1"

_SENIORITY_MAP = {
    "owner": "C-Suite",
    "founder": "C-Suite",
    "c_suite": "C-Suite",
    "partner": "VP",
    "vp": "VP",
    "head": "Director",
    "director": "Director",
    "manager": "Manager",
    "senior": "Senior",
    "entry": "Mid",
    "intern": "Mid",
}


@dataclass
class ApolloPersonResult:
    name: str
    title: str
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    email_status: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    seniority: Optional[str] = None
    departments: Optional[List[str]] = None
    headline: Optional[str] = None
    photo_url: Optional[str] = None
    twitter_url: Optional[str] = None
    github_url: Optional[str] = None
    facebook_url: Optional[str] = None
    employment_history: Optional[List[Dict[str, Any]]] = None
    organization_id: Optional[str] = None
    org_name: Optional[str] = None
    org_website: Optional[str] = None
    org_industry: Optional[str] = None
    org_employee_count: Optional[int] = None
    org_revenue: Optional[str] = None
    org_founded_year: Optional[int] = None
    org_linkedin_url: Optional[str] = None
    org_keywords: Optional[List[str]] = None
    apollo_id: Optional[str] = None


@dataclass
class ApolloCompanyResult:
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    revenue: Optional[str] = None
    founded_year: Optional[int] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    keywords: Optional[List[str]] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    apollo_id: Optional[str] = None
    total_funding: Optional[float] = None
    latest_funding_date: Optional[str] = None


class ApolloClient:
    def __init__(self, api_key: str, timeout_seconds: float = 15.0) -> None:
        self.api_key = api_key
        self.timeout = timeout_seconds

    def _headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Accept": "application/json",
        }

    # ── People Search (free, no credits, requires master key) ─────────────

    def people_search(
        self,
        *,
        organization_domains: Optional[List[str]] = None,
        person_titles: Optional[List[str]] = None,
        person_seniorities: Optional[List[str]] = None,
        person_locations: Optional[List[str]] = None,
        q_keywords: Optional[str] = None,
        per_page: int = 25,
        page: int = 1,
    ) -> Dict[str, Any]:
        url = f"{APOLLO_BASE}/mixed_people/search"
        body: Dict[str, Any] = {
            "per_page": min(per_page, 100),
            "page": page,
        }
        if organization_domains:
            body["q_organization_domains_list"] = organization_domains[:200]
        if person_titles:
            body["person_titles"] = person_titles
        if person_seniorities:
            body["person_seniorities"] = person_seniorities
        if person_locations:
            body["person_locations"] = person_locations
        if q_keywords:
            body["q_keywords"] = q_keywords

        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                resp = client.post(url, json=body, headers=self._headers())
                _log.info("Apollo people_search status=%d domains=%s", resp.status_code, organization_domains)
                if resp.status_code == 429:
                    _log.warning("Apollo rate limited on people_search")
                    return {"people": []}
                if resp.status_code in (401, 403):
                    _log.warning("Apollo auth error %d — check API key (master key required)", resp.status_code)
                    return {"people": []}
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            _log.exception("Apollo people_search failed: %s", str(e)[:200])
            return {"people": []}

    def extract_people(self, raw: Dict[str, Any]) -> List[ApolloPersonResult]:
        people_list = raw.get("people") or []
        out: List[ApolloPersonResult] = []
        for p in people_list:
            if not isinstance(p, dict):
                continue
            first = str(p.get("first_name") or "").strip()
            last = str(p.get("last_name") or "").strip()
            name = f"{first} {last}".strip()
            title = str(p.get("title") or "").strip()
            if not name or not title:
                continue

            org = p.get("organization") or {}
            linkedin = p.get("linkedin_url") or ""
            if linkedin and not linkedin.startswith("http"):
                linkedin = f"https://www.linkedin.com/{linkedin.lstrip('/')}"

            location_parts = [
                str(p.get("city") or "").strip(),
                str(p.get("state") or "").strip(),
                str(p.get("country") or "").strip(),
            ]

            out.append(ApolloPersonResult(
                name=name,
                title=title,
                linkedin_url=linkedin or None,
                company=str(org.get("name") or p.get("organization_name") or "").strip() or None,
                email=str(p.get("email") or "").strip() or None,
                email_status=str(p.get("email_status") or "").strip() or None,
                city=str(p.get("city") or "").strip() or None,
                state=str(p.get("state") or "").strip() or None,
                country=str(p.get("country") or "").strip() or None,
                seniority=str(p.get("seniority") or "").strip() or None,
                departments=[str(d) for d in (p.get("departments") or []) if d] or None,
                headline=str(p.get("headline") or "").strip() or None,
                photo_url=str(p.get("photo_url") or "").strip() or None,
                twitter_url=str(p.get("twitter_url") or "").strip() or None,
                github_url=str(p.get("github_url") or "").strip() or None,
                facebook_url=str(p.get("facebook_url") or "").strip() or None,
                employment_history=p.get("employment_history") if isinstance(p.get("employment_history"), list) else None,
                organization_id=str(org.get("id") or "").strip() or None,
                org_name=str(org.get("name") or "").strip() or None,
                org_website=str(org.get("website_url") or org.get("primary_domain") or "").strip() or None,
                org_industry=str(org.get("industry") or "").strip() or None,
                org_employee_count=org.get("estimated_num_employees") if isinstance(org.get("estimated_num_employees"), int) else None,
                org_revenue=str(org.get("organization_revenue") or "").strip() or None,
                org_founded_year=org.get("founded_year") if isinstance(org.get("founded_year"), int) else None,
                org_linkedin_url=str(org.get("linkedin_url") or "").strip() or None,
                org_keywords=[str(k) for k in (org.get("keywords") or []) if k] or None,
                apollo_id=str(p.get("id") or "").strip() or None,
            ))
        return out

    # ── People Enrichment (1 credit per email found) ──────────────────────

    def person_enrich(
        self,
        *,
        first_name: str = "",
        last_name: str = "",
        email: str = "",
        linkedin_url: str = "",
        organization_name: str = "",
        domain: str = "",
    ) -> Dict[str, Any]:
        url = f"{APOLLO_BASE}/people/match"
        body: Dict[str, Any] = {}
        if first_name:
            body["first_name"] = first_name
        if last_name:
            body["last_name"] = last_name
        if email:
            body["email"] = email
        if linkedin_url:
            body["linkedin_url"] = linkedin_url
        if organization_name:
            body["organization_name"] = organization_name
        if domain:
            body["domain"] = domain
        if not body:
            return {}

        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                resp = client.post(url, json=body, headers=self._headers())
                if resp.status_code in (401, 402, 403, 404, 429):
                    _log.info("Apollo person_enrich status=%d", resp.status_code)
                    return {}
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            _log.debug("Apollo person_enrich failed: %s", str(e)[:120])
            return {}

    # ── Company Enrichment ────────────────────────────────────────────────

    def company_enrich(self, domain: str) -> Optional[ApolloCompanyResult]:
        url = f"{APOLLO_BASE}/organizations/enrich"
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                resp = client.get(url, params={"domain": domain}, headers=self._headers())
                if resp.status_code in (401, 402, 403, 404, 429):
                    _log.info("Apollo company_enrich status=%d for '%s'", resp.status_code, domain)
                    return None
                resp.raise_for_status()
                data = resp.json()
                org = data.get("organization") or data
                if not isinstance(org, dict):
                    return None
                return ApolloCompanyResult(
                    name=str(org.get("name") or "").strip(),
                    domain=str(org.get("primary_domain") or domain).strip(),
                    industry=str(org.get("industry") or "").strip() or None,
                    employee_count=org.get("estimated_num_employees") if isinstance(org.get("estimated_num_employees"), int) else None,
                    revenue=str(org.get("organization_revenue") or "").strip() or None,
                    founded_year=org.get("founded_year") if isinstance(org.get("founded_year"), int) else None,
                    linkedin_url=str(org.get("linkedin_url") or "").strip() or None,
                    website_url=str(org.get("website_url") or "").strip() or None,
                    keywords=[str(k) for k in (org.get("keywords") or []) if k] or None,
                    city=str(org.get("city") or "").strip() or None,
                    state=str(org.get("state") or "").strip() or None,
                    country=str(org.get("country") or "").strip() or None,
                    phone=str(org.get("phone") or "").strip() or None,
                    logo_url=str(org.get("logo_url") or "").strip() or None,
                    apollo_id=str(org.get("id") or "").strip() or None,
                    total_funding=org.get("total_funding") if isinstance(org.get("total_funding"), (int, float)) else None,
                    latest_funding_date=str(org.get("latest_funding_stage_date") or "").strip() or None,
                )
        except Exception as e:
            _log.debug("Apollo company_enrich failed for '%s': %s", domain, str(e)[:120])
            return None

    # ── Organization Job Postings ─────────────────────────────────────────

    def org_job_postings(self, organization_id: str, per_page: int = 25) -> List[Dict[str, Any]]:
        url = f"{APOLLO_BASE}/organizations/{organization_id}/job_postings"
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                resp = client.get(url, params={"per_page": per_page}, headers=self._headers())
                if resp.status_code >= 400:
                    return []
                resp.raise_for_status()
                data = resp.json()
                return data.get("job_postings") or []
        except Exception:
            return []

    # ── News Articles ─────────────────────────────────────────────────────

    def news_search(self, organization_ids: List[str], per_page: int = 10) -> List[Dict[str, Any]]:
        url = f"{APOLLO_BASE}/news_articles/search"
        body = {
            "organization_ids": organization_ids[:10],
            "per_page": per_page,
        }
        try:
            with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                resp = client.post(url, json=body, headers=self._headers())
                if resp.status_code >= 400:
                    return []
                resp.raise_for_status()
                data = resp.json()
                return data.get("news_articles") or []
        except Exception:
            return []


def apollo_seniority_to_level(seniority: Optional[str]) -> str:
    return _SENIORITY_MAP.get((seniority or "").lower().strip(), "Senior")


def extract_apollo_person_signals(p: ApolloPersonResult) -> List[Dict[str, str]]:
    signals: List[Dict[str, str]] = []
    if p.headline:
        signals.append({"label": "Headline", "value": p.headline[:200], "category": "bio"})
    if p.departments:
        signals.append({"label": "Departments", "value": ", ".join(p.departments[:4]), "category": "role"})
    if p.employment_history and len(p.employment_history) >= 2:
        prev = p.employment_history[1] if isinstance(p.employment_history[1], dict) else {}
        prev_title = str(prev.get("title") or "").strip()
        prev_co = str(prev.get("organization_name") or "").strip()
        if prev_title and prev_co:
            signals.append({"label": "Previous Role", "value": f"{prev_title} at {prev_co}", "category": "experience"})
    loc_parts = [x for x in [p.city, p.state, p.country] if x]
    if loc_parts:
        signals.append({"label": "Location", "value": ", ".join(loc_parts), "category": "location"})
    if p.seniority:
        signals.append({"label": "Seniority", "value": p.seniority.replace("_", " ").title(), "category": "level"})
    return signals[:6]


def extract_apollo_company_signals(p: ApolloPersonResult) -> List[Dict[str, str]]:
    signals: List[Dict[str, str]] = []
    if p.org_industry:
        signals.append({"label": "Industry", "value": p.org_industry.title(), "category": "industry"})
    if p.org_employee_count:
        signals.append({"label": "Employee Count", "value": f"{p.org_employee_count:,}", "category": "headcount"})
    if p.org_revenue:
        signals.append({"label": "Revenue", "value": p.org_revenue, "category": "revenue"})
    if p.org_founded_year:
        signals.append({"label": "Founded", "value": str(p.org_founded_year), "category": "founded"})
    if p.org_website:
        signals.append({"label": "Website", "value": p.org_website, "category": "website"})
    if p.org_keywords:
        signals.append({"label": "Keywords", "value": ", ".join(p.org_keywords[:6]), "category": "tags"})
    return signals[:6]
