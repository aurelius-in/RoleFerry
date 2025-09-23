from fastapi import APIRouter
from pydantic import BaseModel
from typing import List


class MatchScoreRequest(BaseModel):
    candidate_id: str
    job_ids: List[str]


router = APIRouter()


@router.post("/score")
def score_matches(payload: MatchScoreRequest):
    matches = [
        {
            "candidate_id": payload.candidate_id,
            "job_id": job_id,
            "score": 87,
            "reasons": ["Relevant title", "Strong metrics"],
            "blockers": ["Location uncertain"],
            "evidence_json": {},
        }
        for job_id in payload.job_ids
    ]
    return {"matches": matches}

