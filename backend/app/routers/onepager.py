from fastapi import APIRouter
from pydantic import BaseModel


class OnePagerRequest(BaseModel):
    candidate_id: str
    job_id: str | None = None


router = APIRouter()


@router.post("/onepager/generate")
def generate_onepager(payload: OnePagerRequest):
    return {"url": "https://example.com/onepager.pdf"}

