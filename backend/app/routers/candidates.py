from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ..services_resume import parse_resume


class CandidateParseRequest(BaseModel):
    resume_text: str


def parse_resume_sections(text: str) -> dict:
    # Very simple stub: split by lines and infer fields
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    metrics = [l for l in lines if any(k in l.lower() for k in ["%", "+", "x", "reduced", "increased"])]
    return {
        "KeyMetrics": metrics[:5],
        "ProblemsSolved": lines[:5],
        "NotableAccomplishments": metrics[:3],
        "Positions": [],
        "Tenure": [],
    }


router = APIRouter()


@router.post("/parse")
def parse_candidate(payload: CandidateParseRequest):
    sections = parse_resume(payload.resume_text)
    return {
        "candidate": {
            "id": "cand_demo_1",
            "name": "Demo Candidate",
            "email": None,
            "linkedin": None,
            "seniority": sections.get("Seniority", "Senior"),
            "domains": sections.get("Domains", ["product"]),
            "resume_text": payload.resume_text[:2000],
            "metrics_json": sections,
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

