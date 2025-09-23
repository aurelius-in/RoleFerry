from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ..storage import store
from ..clients.apify import ApifyClient
from ..config import settings


class JobIngestRequest(BaseModel):
    query: Optional[str] = None
    jd_urls: Optional[List[str]] = None


router = APIRouter()


@router.post("/ingest")
async def ingest_jobs(payload: JobIngestRequest):
    job_id = "apify_job_demo_1"
    store.save_jobs(job_id, [])
    if settings.apify_token and settings.apify_indeed_actor_id:
        client = ApifyClient(settings.apify_token)
        input_payload = {"search": payload.query or "product manager", "urls": payload.jd_urls or []}
        run = await client.start_actor_run(settings.apify_indeed_actor_id, input_payload)
        dataset_id = run.get("defaultDatasetId")
        run_id = run.get("id", job_id)
        if dataset_id:
            store.map_run_to_dataset(run_id, dataset_id)
            job_id = run_id
    return {"job_id": job_id, "status": "started"}


@router.get("/{job_id}")
def get_jobs(job_id: str):
    postings = store.get_jobs(job_id)
    if not postings:
        postings = [
            {
                "id": "demo_post_1",
                "title": "Director of Product",
                "company": "Acme",
                "location": "Remote",
                "jd_url": "https://example.com/job",
            }
        ]
    return {"job_id": job_id, "postings": postings}


@router.post("/poll/{job_id}")
async def poll_job(job_id: str):
    client = ApifyClient(settings.apify_token)
    dataset_id = store.get_dataset_for_run(job_id) or job_id
    postings = await client.list_dataset_items(dataset_id)
    normalized = [
        {
            "id": p.get("id") or p.get("_id") or f"{job_id}_{i}",
            "title": p.get("title") or p.get("position") or "",
            "company": p.get("company") or p.get("employer") or "",
            "location": p.get("location") or "",
            "jd_url": p.get("url") or p.get("jd_url") or "",
        }
        for i, p in enumerate(postings)
    ]
    store.save_jobs(job_id, normalized)
    return {"job_id": job_id, "count": len(normalized)}

