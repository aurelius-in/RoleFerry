from typing import Dict, Any, List


class InMemoryStore:
    def __init__(self) -> None:
        self.ijps: Dict[str, Dict[str, Any]] = {}
        self.jobs: Dict[str, List[Dict[str, Any]]] = {}
        self.audit: List[Dict[str, Any]] = []
        self.messages: List[Dict[str, Any]] = []
        self.last_candidate: Dict[str, Any] | None = None
        self.run_to_dataset: Dict[str, str] = {}

    def save_ijp(self, ijp_id: str, filters: Dict[str, Any]) -> None:
        self.ijps[ijp_id] = filters

    def get_ijp(self, ijp_id: str) -> Dict[str, Any] | None:
        return self.ijps.get(ijp_id)

    def save_jobs(self, job_id: str, postings: List[Dict[str, Any]]) -> None:
        self.jobs[job_id] = postings

    def get_jobs(self, job_id: str) -> List[Dict[str, Any]]:
        return self.jobs.get(job_id, [])

    def add_audit(self, user_id: str | None, action: str, payload: Dict[str, Any]) -> None:
        self.audit.append({"user_id": user_id, "action": action, "payload": payload})

    def seed_messages(self, messages: List[Dict[str, Any]]) -> None:
        self.messages = list(messages)

    def clear_messages(self) -> None:
        self.messages = []

    def save_candidate(self, candidate: Dict[str, Any]) -> None:
        self.last_candidate = candidate

    def get_candidate(self) -> Dict[str, Any] | None:
        return self.last_candidate

    def map_run_to_dataset(self, run_id: str, dataset_id: str) -> None:
        self.run_to_dataset[run_id] = dataset_id

    def get_dataset_for_run(self, run_id: str) -> str | None:
        return self.run_to_dataset.get(run_id)

    def update_message(self, message_id: str, **fields: Any) -> None:
        for m in self.messages:
            if m.get("id") == message_id:
                m.update(fields)
                break


store = InMemoryStore()

