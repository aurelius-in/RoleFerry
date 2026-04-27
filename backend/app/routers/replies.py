from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text as sql_text

from ..db import get_engine
from ..storage import store

logger = logging.getLogger(__name__)

router = APIRouter()

DEMO_USER_ID = "demo-user"


def _classify_text(text: str) -> str:
    txt = (text or "").lower()
    if any(k in txt for k in ["out of office", "ooo", "away from", "on leave", "vacation"]):
        return "ooo"
    if any(k in txt for k in ["unsubscribe", "remove me", "stop emailing"]):
        return "unsubscribe"
    if any(k in txt for k in ["not interested", "no thanks", "no budget", "not now", "pass on this"]):
        return "objection"
    if any(k in txt for k in ["yes", "interested", "let's talk", "sounds good", "tell me more", "love to"]):
        return "positive"
    return "neutral"


class ClassifyRequest(BaseModel):
    text: str


@router.post("/replies/classify")
def classify_reply(payload: ClassifyRequest):
    return {"label": _classify_text(payload.text)}


async def _db_list_replies() -> List[Dict[str, Any]]:
    engine = get_engine()
    async with engine.begin() as conn:
        rows = await conn.execute(
            sql_text("""
                SELECT
                    r.id::text,
                    r.outreach_id::text,
                    r.campaign_id,
                    r.contact_email,
                    r.from_email,
                    r.to_email,
                    r.subject,
                    r.body,
                    r.label,
                    r.source,
                    r.received_at,
                    r.created_at
                FROM reply r
                WHERE r.user_id = :uid
                ORDER BY r.received_at DESC
                LIMIT 200
            """),
            {"uid": DEMO_USER_ID},
        )
        out: List[Dict[str, Any]] = []
        for r in rows:
            m = dict(r._mapping)
            out.append({
                "id": m["id"],
                "message_id": m["contact_email"],
                "contact_id": m["contact_email"],
                "from": m.get("from_email") or m["contact_email"],
                "to": m.get("to_email") or "",
                "subject": m.get("subject") or "",
                "body": m.get("body") or "",
                "label": m.get("label") or "neutral",
                "source": m.get("source") or "webhook",
                "received_at": m["received_at"].isoformat() if m.get("received_at") else None,
                "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
            })
        return out


@router.get("/replies")
async def list_replies():
    try:
        db_replies = await _db_list_replies()
        if db_replies:
            return {"replies": db_replies}
    except Exception:
        pass
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
    for m in store.messages:
        if m.get("id") == payload.message_id:
            m["replied"] = True
            if payload.label == "positive":
                m["label"] = "positive"
            break
    return {"ok": True}
