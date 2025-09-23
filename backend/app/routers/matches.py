from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from ..storage import store
from ..services_match import score_match


class MatchScoreRequest(BaseModel):
    candidate_id: str
    job_ids: List[str]


router = APIRouter()


@router.post("/score")
def score_matches(payload: MatchScoreRequest):
    candidate = store.get_candidate() or {"id": payload.candidate_id, "title": "Senior PM", "domains": ["product"]}
    matches = []
    for job_id in payload.job_ids:
        postings = store.get_jobs(job_id)
        job = postings[0] if postings else {"id": job_id, "title": "Director of Product", "location": "Remote"}
        s = score_match(candidate, job)
        matches.append({
            "candidate_id": payload.candidate_id,
            "job_id": job_id,
            "score": s["score"],
            "reasons": s["reasons"],
            "blockers": s["blockers"],
            "evidence": s.get("evidence", []),
        })
    return {"matches": matches}

