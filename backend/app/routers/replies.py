from fastapi import APIRouter
from pydantic import BaseModel
from ..storage import store


class ClassifyRequest(BaseModel):
    text: str


router = APIRouter()


@router.post("/replies/classify")
def classify_reply(payload: ClassifyRequest):
    txt = payload.text.lower()
    label = "positive" if any(k in txt for k in ["yes", "interested", "let's talk"]) else (
        "ooo" if "out of office" in txt else ("objection" if any(k in txt for k in ["not now", "no budget"]) else "neutral")
    )
    return {"label": label}


@router.get("/replies")
def list_replies():
    return {"replies": store.list_replies()}


class ReplyMockRequest(BaseModel):
    id: str
    message_id: str
    contact_id: str | None = None
    body: str
    label: str


@router.post("/replies/mock")
def mock_reply(payload: ReplyMockRequest):
    replies = store.list_replies()
    replies.append(payload.model_dump())
    store.set_replies(replies)
    # Optionally mark message as replied/positive
    for m in store.messages:
        if m.get("id") == payload.message_id:
            m["replied"] = True
            if payload.label == "positive":
                m["label"] = "positive"
            break
    return {"ok": True}

