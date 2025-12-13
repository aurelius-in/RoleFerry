from __future__ import annotations

from typing import Optional

from sqlalchemy import text as sql_text

from ..db import get_engine
from ..storage import store
from .email_verifier import verify_email_async


engine = get_engine()
DEMO_USER_ID = "demo-user"


async def record_outreach_send(
    campaign_id: Optional[str],
    contact_email: str,
    subject: str,
    body: str,
    variant: str | None = None,
) -> None:
    """
    Week 11 helper: record a single outreach "send" both in Postgres and
    in the in-memory message store that powers analytics, including a
    verification snapshot using NeverBounce/MillionVerifier (mocked when
    ROLEFERRY_MOCK_MODE is enabled).

    Actual email delivery is still mocked; this function is the single place
    to plug in a real transactional provider later.
    """
    # Verify email before recording send (mocked in dev/mock_mode)
    verification = await verify_email_async(contact_email)
    v_status = verification.get("status")
    v_score = verification.get("score")

    # Persist to outreach table with verification snapshot
    async with engine.begin() as conn:
        await conn.execute(
            sql_text(
                """
                INSERT INTO outreach (user_id, campaign_id, contact_email, subject, body, status, sent_at, verification_status, verification_score)
                VALUES (:user_id, :campaign_id, :contact_email, :subject, :body, 'sent', now(), :verification_status, :verification_score)
                """
            ),
            {
                "user_id": DEMO_USER_ID,
                "campaign_id": campaign_id,
                "contact_email": contact_email,
                "subject": subject,
                "body": body,
                "verification_status": v_status,
                "verification_score": v_score,
            },
        )

    # Mirror into in-memory messages for click/reply mock tracking
    store.messages.append(
        {
            "id": contact_email,
            "opened": False,
            "replied": False,
            "label": None,
            "variant": variant or "",
        }
    )




