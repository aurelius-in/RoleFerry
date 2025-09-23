from typing import List, Dict
import httpx


class ApifyClient:
    def __init__(self, token: str | None = None) -> None:
        self.token = token
        self.base_url = "https://api.apify.com/v2"

    def get_job_postings(self, job_id: str) -> List[Dict]:
        # Stub: return demo postings
        return [
            {"id": f"{job_id}_1", "title": "Director of Product", "company": "Acme", "location": "Remote", "jd_url": "https://example.com/jd1"},
            {"id": f"{job_id}_2", "title": "Senior Product Manager", "company": "Globex", "location": "NYC", "jd_url": "https://example.com/jd2"},
        ]

    async def start_actor_run(self, actor_id: str, input_payload: Dict) -> Dict:
        if not self.token:
            return {"id": "demo_run", "defaultDatasetId": "demo_dataset"}
        url = f"{self.base_url}/acts/{actor_id}/runs?token={self.token}"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json=input_payload)
            r.raise_for_status()
            return r.json().get("data", {})

    async def list_dataset_items(self, dataset_id: str, limit: int = 100) -> List[Dict]:
        if not self.token:
            return self.get_job_postings(dataset_id)
        url = f"{self.base_url}/datasets/{dataset_id}/items?token={self.token}&limit={limit}"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(url)
            r.raise_for_status()
            return r.json()

