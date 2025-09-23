from typing import Dict, Any, List


class InMemoryStore:
    def __init__(self) -> None:
        self.ijps: Dict[str, Dict[str, Any]] = {}
        self.jobs: Dict[str, List[Dict[str, Any]]] = {}

    def save_ijp(self, ijp_id: str, filters: Dict[str, Any]) -> None:
        self.ijps[ijp_id] = filters

    def get_ijp(self, ijp_id: str) -> Dict[str, Any] | None:
        return self.ijps.get(ijp_id)

    def save_jobs(self, job_id: str, postings: List[Dict[str, Any]]) -> None:
        self.jobs[job_id] = postings

    def get_jobs(self, job_id: str) -> List[Dict[str, Any]]:
        return self.jobs.get(job_id, [])


store = InMemoryStore()

