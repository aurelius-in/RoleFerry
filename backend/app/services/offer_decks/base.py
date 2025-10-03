from __future__ import annotations
from typing import Protocol, Dict, Any


class OfferDeckProvider(Protocol):
    async def create_deck(self, company: str, role: str, candidate_profile: Dict[str, Any], problems: list[str], uvp: str, evidence_links: list[str]) -> Dict[str, Any]:
        ...


