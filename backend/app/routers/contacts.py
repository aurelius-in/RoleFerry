from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional


class ContactFindRequest(BaseModel):
    company: str
    titles: Optional[List[str]] = None
    location: Optional[str] = None


router = APIRouter()


@router.post("/find")
def find_contacts(payload: ContactFindRequest):
    return {
        "contacts": [
            {
                "id": "c_demo_1",
                "company": payload.company,
                "name": "Alex Example",
                "title": "Director of Product",
                "seniority": "Director",
                "tenure_months": 18,
                "email": "alex@example.com",
                "linkedin": "https://linkedin.com/in/example",
                "city": "NYC",
                "state": "NY",
                "country": "US",
                "source": "demo",
                "valid": None,
                "verification_status": None,
                "verification_score": None,
                "verified_at": None,
                "verifier": None,
                "warm_angles": [],
                "notes": None,
            }
        ]
    }

