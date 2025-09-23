from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional


class CandidateParseRequest(BaseModel):
    resume_text: str


router = APIRouter()


@router.post("/parse")
def parse_candidate(payload: CandidateParseRequest):
    return {
        "candidate": {
            "id": "cand_demo_1",
            "name": "Demo Candidate",
            "email": None,
            "linkedin": None,
            "seniority": "Senior",
            "domains": ["Product"],
            "resume_text": payload.resume_text[:2000],
            "metrics_json": {"example": True},
        },
        "experience": [
            {
                "title": "Senior PM",
                "company": "Acme",
                "start_date": "2022-01-01",
                "end_date": None,
                "bullets": ["Shipped things"],
            }
        ],
    }

