from typing import List, Dict


class ApifyClient:
    def __init__(self, token: str | None = None) -> None:
        self.token = token

    def get_job_postings(self, job_id: str) -> List[Dict]:
        # Stub: return demo postings
        return [
            {"id": f"{job_id}_1", "title": "Director of Product", "company": "Acme", "location": "Remote", "jd_url": "https://example.com/jd1"},
            {"id": f"{job_id}_2", "title": "Senior Product Manager", "company": "Globex", "location": "NYC", "jd_url": "https://example.com/jd2"},
        ]

