from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..storage import store


class OnePagerRequest(BaseModel):
    candidate_id: str
    job_id: str | None = None


router = APIRouter()


@router.post("/onepager/generate")
def generate_onepager(payload: OnePagerRequest):
    # Persist a mock one-pager entry
    op = {
        "candidate_id": payload.candidate_id,
        "job_id": payload.job_id,
        "url": "https://example.com/onepager.pdf",
        "portfolio_url": "https://portfolio.example.com/alex",
        "deck_url": "https://drive.example.com/deck",
        "video_url": "https://video.example.com/intro",
        "blurb": "Concise proof points tailored to the role",
    }
    store.upsert_onepager(op)
    return op


@router.get("/onepager")
def list_onepagers():
    return {"onepagers": store.list_onepagers()}


@router.get("/onepager/{onepager_id}")
def get_onepager(onepager_id: str):
    op = store.get_onepager(onepager_id)
    if not op:
        raise HTTPException(status_code=404, detail="One-pager not found")
    return op

