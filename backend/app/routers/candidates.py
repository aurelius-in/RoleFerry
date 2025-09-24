from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ..services_resume import parse_resume
from ..storage import store


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
    result = {
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
    store.save_candidate(result["candidate"])
    return result


@router.get("")
def list_candidates():
    return {"candidates": store.list_candidates()}


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str):
    cand = store.get_candidate_by_id(candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return cand


@router.get("/{candidate_id}/experience")
def get_candidate_experience(candidate_id: str, min_tenure: int | None = None, company: str | None = None, title: str | None = None):
    items = store.get_candidate_experience(candidate_id)
    if min_tenure is not None:
        items = [i for i in items if int(i.get("tenure_months") or 0) >= min_tenure]
    if company:
        items = [i for i in items if (i.get("company") or "").lower() == company.lower()]
    if title:
        items = [i for i in items if title.lower() in (i.get("title") or "").lower()]
    return {"experience": items}


@router.get("/{candidate_id}/portfolio")
def get_candidate_portfolio(candidate_id: str, tag: str | None = None, kind: str | None = None, source: str | None = None, min_relevance: float | None = None):
    assets = store.list_portfolio_assets(candidate_id)
    if tag:
        assets = [a for a in assets if tag in (a.get("tags") or []) or tag in (a.get("categories") or [])]
    if kind:
        assets = [a for a in assets if (a.get("type") or "").lower() == kind.lower()]
    if source:
        assets = [a for a in assets if (a.get("source") or "").lower() == source.lower()]
    if min_relevance is not None:
        assets = [a for a in assets if float(a.get("relevance_score") or 0) >= float(min_relevance)]
    return {"assets": assets}

