from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict
from ..storage import store


router = APIRouter()


class AskRequest(BaseModel):
    prompt: str
    context: Dict[str, Any] | None = None


@router.post("/ask")
async def ask_gpt(payload: AskRequest):
    # Mock GPT-5 response that inspects data counts and suggests next actions
    reply = {
        "answer": "This is a demo GPT-5 response. I can see your latest runs and matches; ask me to export, verify, or sequence.",
        "insights": {
            "candidates": len(store.list_candidates()),
            "contacts": len(store.list_contacts()),
            "matches": len(store.list_matches()),
            "sequence_rows": len(store.list_sequence_rows()),
        },
        "actions": [
            {"label": "Export Instantly CSV", "endpoint": "/sequence/export"},
            {"label": "Verify recent contacts", "endpoint": "/contacts/verify"},
            {"label": "List campaigns", "endpoint": "/sequence/campaigns"},
        ],
    }
    return reply


