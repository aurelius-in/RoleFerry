from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional


class IJPRequest(BaseModel):
    company_sizes: Optional[List[str]] = None
    industries: Optional[List[str]] = None
    levels: Optional[List[str]] = None
    titles: Optional[List[str]] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    locations: Optional[List[str]] = None
    skills_must: Optional[List[str]] = None
    skills_nice: Optional[List[str]] = None


router = APIRouter()


@router.post("")
def create_or_update_ijp(payload: IJPRequest):
    return {"id": "ijp_demo_1", "saved": True, "filters": payload.model_dump()}

