from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

from sqlalchemy import text as sql_text

from ..db import get_engine


router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)

DEMO_USER_ID = "demo-user"


class BetaFeedbackCreate(BaseModel):
    email: Optional[str] = Field(default=None, description="Responder email (optional)")
    nps_score: Optional[int] = Field(
        default=None, ge=0, le=10, description="Net Promoter Score 0–10"
    )
    would_pay_499: Optional[bool] = Field(
        default=None,
        description="Whether the responder would pay $499 for the tool at full price",
    )
    suggested_price: Optional[str] = Field(
        default=None,
        description="Free-form answer to 'If not $499, what price point makes sense?'",
    )
    feedback_text: Optional[str] = Field(
        default=None,
        description="Open-ended qualitative feedback about the product",
    )


class BetaFeedbackRow(BetaFeedbackCreate):
    id: str
    created_at: str


class BetaFeedbackList(BaseModel):
    items: List[BetaFeedbackRow]


@router.post("/beta-feedback/submit", response_model=BetaFeedbackRow)
async def submit_beta_feedback(payload: BetaFeedbackCreate):
    """
    Week 12: store a single beta feedback survey response in Postgres.

    Uses a stubbed demo user_id for now; later weeks can wire this to real auth.
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    INSERT INTO beta_feedback (user_id, email, nps_score, would_pay_499, suggested_price, feedback_text)
                    VALUES (:user_id, :email, :nps_score, :would_pay_499, :suggested_price, :feedback_text)
                    RETURNING id, email, nps_score, would_pay_499, suggested_price, feedback_text, created_at
                    """
                ),
                {
                    "user_id": DEMO_USER_ID,
                    "email": payload.email,
                    "nps_score": payload.nps_score,
                    "would_pay_499": payload.would_pay_499,
                    "suggested_price": payload.suggested_price,
                    "feedback_text": payload.feedback_text,
                },
            )
            row = result.first()

        if not row:
            raise HTTPException(status_code=500, detail="Failed to insert feedback")

        return BetaFeedbackRow(
            id=str(row.id),
            email=row.email,
            nps_score=row.nps_score,
            would_pay_499=row.would_pay_499,
            suggested_price=row.suggested_price,
            feedback_text=row.feedback_text,
            created_at=row.created_at.isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error submitting beta feedback")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


@router.get("/beta-feedback", response_model=BetaFeedbackList)
async def list_beta_feedback():
    """
    List recent beta feedback responses for the demo user.

    This is primarily for internal review in Week 12.
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    SELECT id, email, nps_score, would_pay_499, suggested_price, feedback_text, created_at
                    FROM beta_feedback
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT 50
                    """
                ),
                {"user_id": DEMO_USER_ID},
            )
            rows = result.fetchall()

        items: List[BetaFeedbackRow] = []
        for row in rows or []:
            items.append(
                BetaFeedbackRow(
                    id=str(row.id),
                    email=row.email,
                    nps_score=row.nps_score,
                    would_pay_499=row.would_pay_499,
                    suggested_price=row.suggested_price,
                    feedback_text=row.feedback_text,
                    created_at=row.created_at.isoformat(),
                )
            )

        return BetaFeedbackList(items=items)
    except Exception as e:
        logger.exception("Error listing beta feedback")
        # If anything goes wrong during listing, return an empty set rather than 500
        return BetaFeedbackList(items=[])



