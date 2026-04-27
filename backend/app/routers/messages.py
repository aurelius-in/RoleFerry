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


async def _db_list_messages() -> List[Dict[str, Any]]:
    engine = get_engine()
    async with engine.begin() as conn:
        rows = await conn.execute(
            sql_text("""
                SELECT
                    o.id::text,
                    o.contact_email,
                    o.campaign_id,
                    o.subject,
                    o.body,
                    o.status,
                    o.sent_at,
                    o.opened_at,
                    o.replied_at,
                    o.reply_body,
                    o.reply_label
                FROM outreach o
                WHERE o.user_id = :uid
                ORDER BY o.sent_at DESC
                LIMIT 200
            """),
            {"uid": DEMO_USER_ID},
        )
        out: List[Dict[str, Any]] = []
        for r in rows:
            m = dict(r._mapping)
            out.append({
                "id": m["contact_email"],
                "db_id": m["id"],
                "campaign_id": m.get("campaign_id"),
                "subject": m.get("subject") or "",
                "body": m.get("body") or "",
                "sent_at": m["sent_at"].isoformat() if m.get("sent_at") else None,
                "opened": m.get("opened_at") is not None,
                "replied": m.get("replied_at") is not None,
                "label": m.get("reply_label"),
                "reply_body": m.get("reply_body"),
            })
        return out


@router.get("/messages")
async def list_messages():
    try:
        db_messages = await _db_list_messages()
        if db_messages:
            return {"messages": db_messages}
    except Exception:
        pass
    return {"messages": store.messages}


class MessageMockRequest(BaseModel):
    id: str
    opened: bool | None = None
    replied: bool | None = None
    label: str | None = None


@router.post("/messages/mock")
def mock_message(payload: MessageMockRequest):
    updates: Dict[str, Any] = {}
    if payload.opened is not None:
        updates["opened"] = payload.opened
    if payload.replied is not None:
        updates["replied"] = payload.replied
    if payload.label is not None:
        updates["label"] = payload.label
    store.update_message(payload.id, **updates)
    return {"ok": True}
