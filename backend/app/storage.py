from typing import Dict, Any, List
from datetime import datetime, timezone


class InMemoryStore:
    def __init__(self) -> None:
        self.ijps: Dict[str, Dict[str, Any]] = {}
        self.jobs: Dict[str, List[Dict[str, Any]]] = {}
        self.audit: List[Dict[str, Any]] = []
        self.messages: List[Dict[str, Any]] = []
        self.last_candidate: Dict[str, Any] | None = None
        self.candidates: Dict[str, Dict[str, Any]] = {}
        self.contacts: Dict[str, Dict[str, Any]] = {}
        self.outreach_presets: Dict[str, Dict[str, Any]] = {}
        self.sequence_rows: List[Dict[str, Any]] = []
        self.warm_angles_index: Dict[str, List[Dict[str, Any]]] = {}
        self.replies: List[Dict[str, Any]] = []
        self.onepagers: Dict[str, Dict[str, Any]] = {}
        self.onboarding_tasks: List[Dict[str, Any]] = []
        self.deliverability_tasks: List[Dict[str, Any]] = []
        self.compliance_rules: List[Dict[str, Any]] = []
        self.dnc_list: List[Dict[str, Any]] = []
        self.sequence_runs: List[Dict[str, Any]] = []
        self.matches: List[Dict[str, Any]] = []
        self.analytics_timeseries: List[Dict[str, Any]] = []
        self.candidate_experiences: Dict[str, List[Dict[str, Any]]] = {}
        self.portfolio_assets: Dict[str, List[Dict[str, Any]]] = {}
        self.instantly_campaigns: List[Dict[str, Any]] = []
        self.run_to_dataset: Dict[str, str] = {}
        self.crm_lanes: Dict[str, list] = {
            "People": [{"id": "alex@example.com", "name": "Alex Example", "note": "", "assignee": "", "due_date": None}],
            "Conversation": [],
            "Meeting": [],
            "Deal": [],
        }
        # Week 10 demo-first caches for 12-step workflow
        # (used when Postgres is unavailable)
        self.demo_job_descriptions: Dict[str, Dict[str, Any]] = {}
        self.demo_latest_resume: Dict[str, Any] | None = None
        self.demo_latest_resume_text: str | None = None
        self.demo_job_preferences: Dict[str, Any] | None = None
        self.demo_job_recommendations: List[Dict[str, Any]] = []
        self.demo_selected_contacts: List[Dict[str, Any]] = []
        self.demo_research: Dict[str, Any] | None = None
        self.demo_painpoint_matches: List[Dict[str, Any]] = []
        self.demo_offer: Dict[str, Any] | None = None
        # Offer library per user (used when Postgres is unavailable)
        self.demo_offer_library_by_user: Dict[str, List[Dict[str, Any]]] = {}
        # Bio Pages (demo + public published-by-slug)
        self.demo_bio_pages_by_user: Dict[str, Dict[str, Any]] = {}
        self.bio_pages_by_slug: Dict[str, Dict[str, Any]] = {}
        self.demo_compose: Dict[str, Any] | None = None
        self.demo_campaign: Dict[str, Any] | None = None

    def save_ijp(self, ijp_id: str, filters: Dict[str, Any]) -> None:
        self.ijps[ijp_id] = filters

    def get_ijp(self, ijp_id: str) -> Dict[str, Any] | None:
        return self.ijps.get(ijp_id)

    def save_jobs(self, job_id: str, postings: List[Dict[str, Any]]) -> None:
        self.jobs[job_id] = postings

    def get_jobs(self, job_id: str) -> List[Dict[str, Any]]:
        return self.jobs.get(job_id, [])

    def add_audit(self, user_id: str | None, action: str, payload: Dict[str, Any]) -> None:
        self.audit.append({
            "user_id": user_id,
            "action": action,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def seed_messages(self, messages: List[Dict[str, Any]]) -> None:
        self.messages = list(messages)

    def clear_messages(self) -> None:
        self.messages = []

    def save_candidate(self, candidate: Dict[str, Any]) -> None:
        self.last_candidate = candidate

    def get_candidate(self) -> Dict[str, Any] | None:
        return self.last_candidate

    # Candidate list management for mocks
    def upsert_candidate(self, candidate: Dict[str, Any]) -> None:
        cid = candidate.get("id") or f"cand_{len(self.candidates)+1}"
        candidate["id"] = cid
        self.candidates[cid] = candidate

    def list_candidates(self) -> List[Dict[str, Any]]:
        return list(self.candidates.values())

    def get_candidate_by_id(self, candidate_id: str) -> Dict[str, Any] | None:
        return self.candidates.get(candidate_id)

    # Contacts management
    def upsert_contact(self, contact: Dict[str, Any]) -> None:
        cid = contact.get("id") or contact.get("email") or f"contact_{len(self.contacts)+1}"
        contact["id"] = cid
        self.contacts[cid] = contact

    def list_contacts(self) -> List[Dict[str, Any]]:
        return list(self.contacts.values())

    def get_contact(self, contact_id: str) -> Dict[str, Any] | None:
        return self.contacts.get(contact_id)

    # Outreach presets
    def upsert_outreach_preset(self, preset: Dict[str, Any]) -> None:
        pid = preset.get("id") or f"preset_{len(self.outreach_presets)+1}"
        preset["id"] = pid
        self.outreach_presets[pid] = preset

    def list_outreach_presets(self) -> List[Dict[str, Any]]:
        return list(self.outreach_presets.values())

    def get_outreach_preset(self, preset_id: str) -> Dict[str, Any] | None:
        return self.outreach_presets.get(preset_id)

    # Sequence rows
    def set_sequence_rows(self, rows: List[Dict[str, Any]]) -> None:
        self.sequence_rows = list(rows)

    def list_sequence_rows(self) -> List[Dict[str, Any]]:
        return list(self.sequence_rows)

    # Warm angles
    def upsert_warm_angles(self, key: str, angles: List[Dict[str, Any]]) -> None:
        self.warm_angles_index[key] = list(angles)

    def get_warm_angles(self, key: str) -> List[Dict[str, Any]]:
        return self.warm_angles_index.get(key, [])

    # Replies
    def set_replies(self, replies: List[Dict[str, Any]]) -> None:
        self.replies = list(replies)

    def list_replies(self) -> List[Dict[str, Any]]:
        return list(self.replies)

    # One-pagers / Offer bundles
    def upsert_onepager(self, onepager: Dict[str, Any]) -> None:
        oid = onepager.get("id") or f"op_{len(self.onepagers)+1}"
        onepager["id"] = oid
        self.onepagers[oid] = onepager

    def list_onepagers(self) -> List[Dict[str, Any]]:
        return list(self.onepagers.values())

    def get_onepager(self, onepager_id: str) -> Dict[str, Any] | None:
        return self.onepagers.get(onepager_id)

    # Onboarding tasks
    def set_onboarding(self, tasks: List[Dict[str, Any]]) -> None:
        self.onboarding_tasks = list(tasks)

    def list_onboarding(self) -> List[Dict[str, Any]]:
        return list(self.onboarding_tasks)

    # Deliverability checklist
    def set_deliverability(self, tasks: List[Dict[str, Any]]) -> None:
        self.deliverability_tasks = list(tasks)

    def list_deliverability(self) -> List[Dict[str, Any]]:
        return list(self.deliverability_tasks)

    # Compliance
    def set_compliance_rules(self, rules: List[Dict[str, Any]]) -> None:
        self.compliance_rules = list(rules)

    def list_compliance_rules(self) -> List[Dict[str, Any]]:
        return list(self.compliance_rules)

    def set_dnc(self, dnc: List[Dict[str, Any]]) -> None:
        self.dnc_list = list(dnc)

    def list_dnc(self) -> List[Dict[str, Any]]:
        return list(self.dnc_list)

    # Sequence runs
    def add_sequence_run(self, run: Dict[str, Any]) -> None:
        self.sequence_runs.append(run)

    def list_sequence_runs(self) -> List[Dict[str, Any]]:
        return list(self.sequence_runs)

    # Matches
    def set_matches(self, matches: List[Dict[str, Any]]) -> None:
        self.matches = list(matches)

    def list_matches(self) -> List[Dict[str, Any]]:
        return list(self.matches)

    # Analytics timeseries
    def set_timeseries(self, points: List[Dict[str, Any]]) -> None:
        self.analytics_timeseries = list(points)

    def list_timeseries(self) -> List[Dict[str, Any]]:
        return list(self.analytics_timeseries)

    # Candidate Experience
    def set_candidate_experience(self, candidate_id: str, items: List[Dict[str, Any]]) -> None:
        self.candidate_experiences[candidate_id] = list(items)

    def get_candidate_experience(self, candidate_id: str) -> List[Dict[str, Any]]:
        return self.candidate_experiences.get(candidate_id, [])

    # Portfolio Assets
    def set_portfolio_assets(self, candidate_id: str, items: List[Dict[str, Any]]) -> None:
        self.portfolio_assets[candidate_id] = list(items)

    def list_portfolio_assets(self, candidate_id: str) -> List[Dict[str, Any]]:
        return self.portfolio_assets.get(candidate_id, [])

    # Instantly Campaigns (mock)
    def add_campaign(self, campaign: Dict[str, Any]) -> None:
        self.instantly_campaigns.append(campaign)

    def list_campaigns(self) -> List[Dict[str, Any]]:
        return list(self.instantly_campaigns)

    def map_run_to_dataset(self, run_id: str, dataset_id: str) -> None:
        self.run_to_dataset[run_id] = dataset_id

    def get_dataset_for_run(self, run_id: str) -> str | None:
        return self.run_to_dataset.get(run_id)

    def update_message(self, message_id: str, **fields: Any) -> None:
        for m in self.messages:
            if m.get("id") == message_id:
                m.update(fields)
                break

    def set_crm_board(self, board: Dict[str, list]) -> None:
        self.crm_lanes = board

    def set_crm_note(self, contact_id: str, note: str) -> None:
        for lane in self.crm_lanes.values():
            for card in lane:
                if card.get("id") == contact_id:
                    card["note"] = note
                    return

    def update_crm_card(self, contact_id: str, **fields: Any) -> None:
        for lane in self.crm_lanes.values():
            for card in lane:
                if card.get("id") == contact_id:
                    card.update(fields)
                    return

    def delete_crm_card(self, contact_id: str) -> None:
        for lane in self.crm_lanes.keys():
            self.crm_lanes[lane] = [c for c in self.crm_lanes[lane] if c.get("id") != contact_id]

    def move_crm_card(self, contact_id: str, target_lane: str) -> None:
        card_to_move = None
        for lane, cards in self.crm_lanes.items():
            for c in cards:
                if c.get("id") == contact_id:
                    card_to_move = c
                    break
            if card_to_move:
                self.crm_lanes[lane] = [c for c in cards if c.get("id") != contact_id]
                break
        if card_to_move:
            self.crm_lanes.setdefault(target_lane, [])
            self.crm_lanes[target_lane].append(card_to_move)


store = InMemoryStore()

