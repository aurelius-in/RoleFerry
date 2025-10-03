from typing import Dict, Any, List


class GammaProvider:
    async def create_deck(self, company: str, role: str, candidate_profile: Dict[str, Any], problems: List[str], uvp: str, evidence_links: List[str]) -> Dict[str, Any]:
        # Stub: return a fake hosted URL
        return {"deck_url": f"https://gamma.app/deck/{company.lower()}-{role.lower()}"}


