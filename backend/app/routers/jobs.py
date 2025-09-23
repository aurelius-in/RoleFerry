from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional


class JobIngestRequest(BaseModel):
    query: Optional[str] = None
    jd_urls: Optional[List[str]] = None


router = APIRouter()


@router.post("/ingest")
def ingest_jobs(payload: JobIngestRequest):
    return {"job_id": "apify_job_demo_1", "status": "started"}


@router.get("/{job_id}")
def get_jobs(job_id: str):
    return {"job_id": job_id, "postings": []}

