from fastapi import APIRouter
from ..storage import store
from pydantic import BaseModel


router = APIRouter()


@router.get("/messages")
def list_messages():
    return {"messages": store.messages}


class MessageMockRequest(BaseModel):
    id: str
    opened: bool | None = None
    replied: bool | None = None
    label: str | None = None


@router.post("/messages/mock")
def mock_message(payload: MessageMockRequest):
    updates = {}
    if payload.opened is not None:
        updates["opened"] = payload.opened
    if payload.replied is not None:
        updates["replied"] = payload.replied
    if payload.label is not None:
        updates["label"] = payload.label
    store.update_message(payload.id, **updates)
    return {"ok": True}

