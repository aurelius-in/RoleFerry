from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, List
from ..services.research.company_probe import probe


router = APIRouter(prefix="/research", tags=["research"]) 


class ProbeRequest(BaseModel):
    company: str
    jd_url: str | None = None


@router.post("/company-problems")
async def company_problems(payload: ProbeRequest) -> Dict[str, Any]:
    return await probe(payload.company, payload.jd_url)


