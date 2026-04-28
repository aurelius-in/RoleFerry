"""
Enrichment API - Contact discovery and company enrichment
Implements waterfall: domain -> people -> email -> verification
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from ..config import settings
from ..clients.apollo import ApolloClient, extract_apollo_person_signals, extract_apollo_company_signals
from ..services.pdl_client import PDLClient

_log = logging.getLogger(__name__)

router = APIRouter()

enrichments_db: list = []


class EnrichmentRequest(BaseModel):
    applicationId: int
    companyName: str
    ruleset: Optional[str] = "hiring-manager"


class PersonaFilter(BaseModel):
    titles: List[str]
    departments: Optional[List[str]] = None
    managementLevel: Optional[List[str]] = None
    locations: Optional[List[str]] = None
    employeeCount: Optional[List[str]] = None


@router.post("/api/enrich")
async def enrich_application(payload: EnrichmentRequest):
    """
    Run enrichment waterfall for application:
    1. Resolve company domain
    2. Apollo company enrichment (firmographics, funding, headcount)
    3. Apollo people search (decision makers at company)
    4. PDL person enrichment fallback
    """
    company = (payload.companyName or "").strip()
    if not company:
        raise HTTPException(status_code=400, detail="Company name is required")

    domain_guess = company.lower().replace(" ", "").replace(",", "").replace(".", "") + ".com"
    company_data = {}
    contacts = []
    apollo_org_id = None

    # Apollo company enrichment
    if settings.apollo_api_key:
        try:
            apollo = ApolloClient(settings.apollo_api_key, timeout_seconds=10.0)
            ac = apollo.company_enrich(domain_guess)
            if ac:
                apollo_org_id = ac.apollo_id
                company_data = {
                    "domain": ac.domain or domain_guess,
                    "size": f"{ac.employee_count:,}" if ac.employee_count else "Unknown",
                    "industry": ac.industry or "Unknown",
                    "funding": f"${ac.total_funding / 1_000_000:.0f}M" if ac.total_funding and ac.total_funding >= 1_000_000 else None,
                    "revenue": ac.revenue,
                    "founded": ac.founded_year,
                    "keywords": ac.keywords or [],
                    "linkedin_url": ac.linkedin_url,
                    "website_url": ac.website_url,
                    "signals": [],
                }
                _log.info("Apollo company enrichment for '%s': %s", company, ac.industry)

            # People search
            seniority_map = {
                "hiring-manager": ["manager", "director", "head"],
                "recruiter": ["manager", "senior"],
                "all": ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager"],
            }
            seniorities = seniority_map.get(payload.ruleset or "hiring-manager", ["manager", "director"])
            raw = apollo.people_search(
                organization_domains=[ac.domain or domain_guess] if ac else [domain_guess],
                person_seniorities=seniorities,
                per_page=10,
            )
            people = apollo.extract_people(raw)
            for p in people[:8]:
                contacts.append({
                    "name": p.name,
                    "title": p.title,
                    "email": p.email,
                    "verified": p.email_status == "verified" if p.email else False,
                    "linkedin": p.linkedin_url,
                    "source": "Apollo",
                    "person_signals": [s for s in extract_apollo_person_signals(p)],
                    "company_signals": [s for s in extract_apollo_company_signals(p)],
                })
            _log.info("Apollo people search for '%s': %d contacts", company, len(contacts))
        except Exception as e:
            _log.debug("Apollo enrichment failed for '%s': %s", company, e)

    # PDL company enrichment fallback
    if settings.pdl_api_key and not company_data:
        try:
            pdl = PDLClient(settings.pdl_api_key, timeout_seconds=10.0)
            pdl_co = pdl.company_enrich(domain_guess)
            if pdl_co and isinstance(pdl_co, dict):
                company_data = {
                    "domain": pdl_co.get("primary_domain") or domain_guess,
                    "size": str(pdl_co.get("size") or pdl_co.get("employee_count") or "Unknown"),
                    "industry": str(pdl_co.get("industry") or "Unknown"),
                    "signals": [],
                }
        except Exception as e:
            _log.debug("PDL company enrichment failed for '%s': %s", company, e)

    if not company_data:
        company_data = {"domain": domain_guess, "size": "Unknown", "industry": "Unknown", "signals": []}

    enrichment_result = {
        "id": len(enrichments_db) + 1,
        "applicationId": payload.applicationId,
        "companyName": company,
        "status": "completed",
        "contacts": contacts,
        "companyData": company_data,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "cost": 0.0,
    }

    enrichments_db.append(enrichment_result)
    return enrichment_result


@router.get("/api/enrich/history")
async def get_enrichment_history(limit: int = 50):
    return {"enrichments": enrichments_db[:limit]}


@router.post("/api/enrich/persona")
async def enrich_with_persona(companyName: str, persona: PersonaFilter):
    """Find contacts matching persona criteria via Apollo people search."""
    company = (companyName or "").strip()
    domain_guess = company.lower().replace(" ", "").replace(",", "") + ".com"
    contacts = []

    if settings.apollo_api_key:
        try:
            apollo = ApolloClient(settings.apollo_api_key, timeout_seconds=10.0)
            raw = apollo.people_search(
                organization_domains=[domain_guess],
                person_titles=persona.titles[:5] if persona.titles else None,
                person_seniorities=persona.managementLevel[:5] if persona.managementLevel else None,
                person_locations=persona.locations[:5] if persona.locations else None,
                per_page=25,
            )
            people = apollo.extract_people(raw)
            for p in people:
                contacts.append({
                    "name": p.name,
                    "title": p.title,
                    "email": p.email,
                    "verified": p.email_status == "verified" if p.email else False,
                    "linkedin": p.linkedin_url,
                    "matchedCriteria": {
                        "title": any(t.lower() in (p.title or "").lower() for t in persona.titles) if persona.titles else None,
                        "level": bool(p.seniority) if persona.managementLevel else None,
                        "location": bool(p.city or p.state) if persona.locations else None,
                    },
                })
        except Exception as e:
            _log.debug("Apollo persona search failed for '%s': %s", company, e)

    return {
        "companyName": company,
        "persona": persona.model_dump(),
        "contacts": contacts,
        "matchCount": len(contacts),
    }
