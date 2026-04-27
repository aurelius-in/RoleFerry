from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from sqlalchemy import text as sql_text

from ..db import get_engine
from ..storage import store

logger = logging.getLogger(__name__)

router = APIRouter()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _classify_reply(body: str) -> str:
    low = (body or "").lower()
    if any(k in low for k in ["out of office", "ooo", "away from", "on leave", "vacation", "auto-reply", "automatic reply"]):
        return "ooo"
    if any(k in low for k in ["unsubscribe", "remove me", "stop emailing", "opt out", "take me off"]):
        return "unsubscribe"
    if any(k in low for k in ["not interested", "no thanks", "no budget", "not a good time", "not now", "pass on this", "we're set", "already have"]):
        return "objection"
    if any(k in low for k in [
        "yes", "interested", "let's talk", "let's chat", "sounds good", "tell me more",
        "love to", "would like to", "set up a time", "schedule a call", "book a time",
        "open to", "looking forward", "count me in",
    ]):
        return "positive"
    return "neutral"


def _extract_email_field(payload: Dict[str, Any], *keys: str) -> str:
    """Extract an email string from a webhook payload, trying multiple key paths."""
    for k in keys:
        val = payload.get(k)
        if val and isinstance(val, str) and "@" in val:
            return val.strip().lower()
        if isinstance(val, dict):
            inner = val.get("email") or val.get("address") or ""
            if inner and "@" in str(inner):
                return str(inner).strip().lower()
    data = payload.get("data") or {}
    if isinstance(data, dict):
        for k in keys:
            val = data.get(k)
            if val and isinstance(val, str) and "@" in val:
                return val.strip().lower()
    return ""


async def _persist_reply(
    *,
    campaign_id: str,
    contact_email: str,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    label: str,
    received_at: datetime,
    source: str = "webhook",
) -> Optional[str]:
    """Insert a reply into the DB and update the parent outreach row. Returns reply ID or None."""
    reply_id = str(uuid.uuid4())
    engine = get_engine()

    try:
        async with engine.begin() as conn:
            # Find the outreach row for this contact + campaign
            outreach_row = await conn.execute(
                sql_text("""
                    SELECT id FROM outreach
                    WHERE contact_email = :email
                    AND (:cid IS NULL OR campaign_id = :cid)
                    ORDER BY sent_at DESC LIMIT 1
                """),
                {"email": contact_email, "cid": campaign_id or None},
            )
            outreach = outreach_row.first()
            outreach_id = outreach[0] if outreach else None

            # Insert reply
            await conn.execute(
                sql_text("""
                    INSERT INTO reply (id, outreach_id, campaign_id, contact_email,
                                       from_email, to_email, subject, body, label,
                                       source, received_at)
                    VALUES (:id, :outreach_id, :campaign_id, :contact_email,
                            :from_email, :to_email, :subject, :body, :label,
                            :source, :received_at)
                """),
                {
                    "id": reply_id,
                    "outreach_id": outreach_id,
                    "campaign_id": campaign_id or None,
                    "contact_email": contact_email,
                    "from_email": from_email,
                    "to_email": to_email,
                    "subject": subject,
                    "body": body,
                    "label": label,
                    "source": source,
                    "received_at": received_at,
                },
            )

            # Update outreach row with reply timestamp and latest reply
            if outreach_id:
                await conn.execute(
                    sql_text("""
                        UPDATE outreach
                        SET replied_at = COALESCE(replied_at, :ts),
                            reply_body = :body,
                            reply_label = :label
                        WHERE id = :oid
                    """),
                    {"ts": received_at, "body": body[:2000] if body else "", "label": label, "oid": outreach_id},
                )

        return reply_id
    except Exception:
        logger.exception("Failed to persist reply for %s", contact_email)
        return None


@router.post("/webhooks/instantly")
async def instantly_webhook(request: Request):
    """
    Receives webhook events from Instantly.ai.

    Instantly posts events for: reply, open/opened, click/clicked, bounce/bounced,
    complaint/complained, unsubscribe/unsubscribed.

    Payload shape varies by event but typically includes:
      { event_type, campaign_id, timestamp, email/lead_email/from_email,
        subject, text_body/body, ... }
    """
    payload = await request.json()
    event = (
        payload.get("event_type")
        or payload.get("event")
        or payload.get("type")
        or "unknown"
    ).lower().strip()

    store.add_audit(None, f"instantly_webhook:{event}", payload)

    # Normalize contact email from various payload shapes
    contact_email = _extract_email_field(
        payload, "lead_email", "email", "from_email", "recipient", "from", "to"
    )
    campaign_id = str(payload.get("campaign_id") or payload.get("campaign") or "").strip()
    timestamp_str = str(payload.get("timestamp") or payload.get("sent_at") or "").strip()
    now = _now_utc()
    try:
        received_at = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00")) if timestamp_str else now
    except (ValueError, TypeError):
        received_at = now

    if not contact_email:
        logger.warning("Instantly webhook missing contact email: %s", event)
        return {"received": True, "warning": "no contact email found"}

    if event in ("reply", "replied", "reply_received"):
        subject = str(payload.get("subject") or payload.get("email_subject") or "").strip()
        body = str(
            payload.get("text_body")
            or payload.get("body")
            or payload.get("plain_text")
            or payload.get("text")
            or ""
        ).strip()
        from_email = _extract_email_field(payload, "from_email", "from", "lead_email", "email")
        to_email = _extract_email_field(payload, "to_email", "to", "account_email")
        label = _classify_reply(body)

        # Persist to DB
        reply_id = await _persist_reply(
            campaign_id=campaign_id,
            contact_email=contact_email,
            from_email=from_email or contact_email,
            to_email=to_email,
            subject=subject,
            body=body,
            label=label,
            received_at=received_at,
            source="webhook",
        )

        # Also update in-memory store for real-time UI
        store.update_message(contact_email, replied=True, label=label)
        reply_record = {
            "id": reply_id or str(uuid.uuid4()),
            "message_id": contact_email,
            "contact_id": contact_email,
            "body": body,
            "label": label,
            "from": from_email or contact_email,
            "to": to_email,
            "received_at": received_at.isoformat(),
            "created_at": now.isoformat(),
        }
        store.replies.append(reply_record)

        logger.info("Instantly reply from %s classified as '%s'", contact_email, label)

    elif event in ("open", "opened", "email_opened"):
        store.update_message(contact_email, opened=True)
        # Update DB
        try:
            engine = get_engine()
            async with engine.begin() as conn:
                await conn.execute(
                    sql_text("""
                        UPDATE outreach SET opened_at = COALESCE(opened_at, :ts)
                        WHERE contact_email = :email
                        AND (:cid = '' OR campaign_id = :cid)
                    """),
                    {"ts": received_at, "email": contact_email, "cid": campaign_id},
                )
        except Exception:
            pass

    elif event in ("click", "clicked", "email_clicked"):
        store.update_message(contact_email, opened=True)

    elif event in ("bounce", "bounced", "email_bounced"):
        store.update_message(contact_email, label="bounce")

    elif event in ("complaint", "complained"):
        store.update_message(contact_email, label="complaint")

    elif event in ("unsubscribe", "unsubscribed", "lead_unsubscribed"):
        store.update_message(contact_email, label="unsubscribe")

    else:
        logger.info("Instantly webhook event '%s' (unhandled type)", event)

    return {"received": True, "event": event, "contact": contact_email}


@router.post("/webhooks/sync-replies")
async def sync_replies_from_instantly():
    """
    Polling fallback: fetch recent replies from Instantly's unibox API
    and persist any that aren't already in our DB. Call this from the
    frontend's Refresh button or on a cron schedule.
    """
    from ..clients.instantly import InstantlyClient
    from ..config import settings

    if not settings.instantly_enabled:
        return {"synced": 0, "message": "Instantly is not configured"}

    client = InstantlyClient(settings.instantly_api_key or "")
    result = await client.get_unibox_replies(limit=50)
    if not result.get("ok"):
        return {"synced": 0, "error": result.get("error", "API call failed")}

    raw = result.get("raw") or {}
    items = raw.get("data") or raw.get("emails") or raw.get("items") or []
    if isinstance(raw, list):
        items = raw

    synced = 0
    now = _now_utc()

    for item in items:
        if not isinstance(item, dict):
            continue

        contact_email = (
            str(item.get("from_address") or item.get("from_email") or item.get("from") or "")
            .strip().lower()
        )
        if not contact_email or "@" not in contact_email:
            continue

        body = str(item.get("text_body") or item.get("body") or item.get("text") or "").strip()
        if not body:
            continue

        subject = str(item.get("subject") or "").strip()
        campaign_id = str(item.get("campaign_id") or "").strip()
        to_email = str(item.get("to_address") or item.get("to_email") or item.get("to") or "").strip()
        ts_str = str(item.get("timestamp") or item.get("received_at") or item.get("date") or "").strip()
        try:
            received_at = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else now
        except (ValueError, TypeError):
            received_at = now

        label = _classify_reply(body)

        # Check for duplicates (same contact + body hash within last day)
        try:
            engine = get_engine()
            async with engine.begin() as conn:
                dup = await conn.execute(
                    sql_text("""
                        SELECT id FROM reply
                        WHERE contact_email = :email
                        AND body = :body
                        AND received_at > now() - interval '2 days'
                        LIMIT 1
                    """),
                    {"email": contact_email, "body": body[:2000]},
                )
                if dup.first():
                    continue
        except Exception:
            pass

        reply_id = await _persist_reply(
            campaign_id=campaign_id,
            contact_email=contact_email,
            from_email=contact_email,
            to_email=to_email,
            subject=subject,
            body=body,
            label=label,
            received_at=received_at,
            source="poll",
        )

        if reply_id:
            store.update_message(contact_email, replied=True, label=label)
            store.replies.append({
                "id": reply_id,
                "message_id": contact_email,
                "contact_id": contact_email,
                "body": body,
                "label": label,
                "from": contact_email,
                "to": to_email,
                "received_at": received_at.isoformat(),
                "created_at": now.isoformat(),
            })
            synced += 1

    return {"synced": synced, "total_checked": len(items)}
