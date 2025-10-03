from typing import Dict, Any, List


class PPTXProvider:
    async def create_deck(self, company: str, role: str, candidate_profile: Dict[str, Any], problems: List[str], uvp: str, evidence_links: List[str]) -> Dict[str, Any]:
        # Stub: return a local file path (not actually generating)
        return {"download_path": f"/exports/offer_{company.lower()}_{role.lower()}.pptx"}


