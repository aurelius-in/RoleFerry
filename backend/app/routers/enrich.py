"""
Enrichment API - Contact discovery and company enrichment
Implements Clay-style waterfall: domain → people → email → verification
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

# Mock enrichment results
enrichments_db = []


class EnrichmentRequest(BaseModel):
    applicationId: int
    companyName: str
    ruleset: Optional[str] = "hiring-manager"  # or "recruiter", "all"


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
    1. Get company domain (Clearbit/Google)
    2. Find people at company (Apollo/Clay)
    3. Enrich person details
    4. Verify work email (NeverBounce/Findymail)
    """
    
    # Simulate enrichment (in production: actual API calls)
    enrichment_result = {
        "id": len(enrichments_db) + 1,
        "applicationId": payload.applicationId,
        "companyName": payload.companyName,
        "status": "completed",
        "contacts": [
            {
                "id": 1,
                "name": "Sarah Chen",
                "title": "VP Product",
                "email": "sarah@example.com",
                "verified": True,
                "linkedin": "https://linkedin.com/in/sarachen",
                "source": "Apollo"
            },
            {
                "id": 2,
                "name": "Tom Wilson",
                "title": "Senior Recruiter",
                "email": "tom@example.com",
                "verified": True,
                "linkedin": "https://linkedin.com/in/tomwilson",
                "source": "Clay"
            }
        ],
        "companyData": {
            "domain": "example.com",
            "size": "201-500",
            "industry": "SaaS",
            "techStack": ["React", "Python", "AWS"],
            "funding": "Series B",
            "signals": ["Hiring aggressively", "Recent funding"]
        },
        "createdAt": datetime.utcnow().isoformat(),
        "cost": 0.08
    }
    
    enrichments_db.append(enrichment_result)
    
    return enrichment_result


@router.get("/api/enrich/history")
async def get_enrichment_history(limit: int = 50):
    """Get recent enrichments"""
    return {
        "enrichments": enrichments_db[:limit]
    }


@router.post("/api/enrich/persona")
async def enrich_with_persona(companyName: str, persona: PersonaFilter):
    """
    Find contacts matching persona criteria
    (Apollo-style filters)
    """
    
    # Mock filtered results
    filtered_contacts = [
        {
            "name": "Michael Torres",
            "title": persona.titles[0] if persona.titles else "VP",
            "email": f"contact@{companyName.lower().replace(' ', '')}.com",
            "verified": True,
            "matchedCriteria": {
                "title": True,
                "level": True if persona.managementLevel else None,
                "location": True if persona.locations else None
            }
        }
    ]
    
    return {
        "companyName": companyName,
        "persona": persona.dict(),
        "contacts": filtered_contacts,
        "matchCount": len(filtered_contacts)
    }

