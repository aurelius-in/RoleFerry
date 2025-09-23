from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ..storage import store


class JobIngestRequest(BaseModel):
    query: Optional[str] = None
    jd_urls: Optional[List[str]] = None


router = APIRouter()


@router.post("/ingest")
def ingest_jobs(payload: JobIngestRequest):
    job_id = "apify_job_demo_1"
    store.save_jobs(job_id, [])
    return {"job_id": job_id, "status": "started"}


@router.get("/{job_id}")
def get_jobs(job_id: str):
    return {"job_id": job_id, "postings": store.get_jobs(job_id)}

