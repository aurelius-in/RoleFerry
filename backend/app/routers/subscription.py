from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import logging

from sqlalchemy import text as sql_text

from ..db import get_engine


router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)

DEMO_USER_ID = "demo-user"


class SubscriptionStatus(BaseModel):
    plan: str = Field(..., description="Current plan identifier, e.g. free/beta/pro")
    plan_label: str = Field(..., description="Human readable label for the plan")
    status: str = Field(..., description="active/canceled/trialing")
    seats: int = Field(..., description="Number of seats included")
    renews_on: Optional[str] = Field(
        default=None, description="ISO date the plan renews, if applicable"
    )
    limits: dict = Field(
        default_factory=dict,
        description="Soft product limits for this plan (campaigns, contacts, etc.)",
    )


class SubscriptionUpgrade(BaseModel):
    plan: str = Field(..., description="Target plan identifier to upgrade to")


class SubscriptionCancel(BaseModel):
    reason: Optional[str] = Field(
        default=None, description="Optional free-form cancellation reason"
    )


@router.get("/subscription/status", response_model=SubscriptionStatus)
async def get_subscription_status():
    """
    Stubbed subscription status for Week 9–12.

    Returns a hard-coded 'beta' plan for the demo user. No real billing provider
    is called here; this is intentionally a pure mock for demos.
    """
    return SubscriptionStatus(
        plan="beta",
        plan_label="Beta tester (50% off)",
        status="active",
        seats=1,
        renews_on=None,
        limits={
            "max_campaigns": 3,
            "max_contacts": 250,
            "max_warm_inboxes": 1,
        },
    )


@router.post("/subscription/upgrade")
async def upgrade_subscription(payload: SubscriptionUpgrade):
    """
    Record an intent to upgrade the demo user to a different plan.

    This only writes to the subscription_intent table; it does NOT contact
    Stripe, Paddle, or any other billing provider.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(
                sql_text(
                    """
                    INSERT INTO subscription_intent (user_id, action, target_plan)
                    VALUES (:user_id, :action, :target_plan)
                    """
                ),
                {
                    "user_id": DEMO_USER_ID,
                    "action": "upgrade",
                    "target_plan": payload.plan,
                },
            )
        return {
            "ok": True,
            "message": f"Upgrade intent recorded for plan '{payload.plan}'. No card will be charged in this demo.",
        }
    except Exception:
        logger.exception("Error recording subscription upgrade intent")
        raise HTTPException(
            status_code=500, detail="Failed to record subscription upgrade intent"
        )


@router.post("/subscription/cancel")
async def cancel_subscription(payload: SubscriptionCancel):
    """
    Record an intent to cancel the current plan.

    As with upgrade, this is a pure stub — it only records the action for
    internal review and does not talk to any external billing system.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(
                sql_text(
                    """
                    INSERT INTO subscription_intent (user_id, action, target_plan)
                    VALUES (:user_id, :action, NULL)
                    """
                ),
                {
                    "user_id": DEMO_USER_ID,
                    "action": "cancel",
                },
            )
        return {
            "ok": True,
            "message": "Cancellation intent recorded. Your beta access remains active in this demo.",
        }
    except Exception:
        logger.exception("Error recording subscription cancel intent")
        raise HTTPException(
            status_code=500, detail="Failed to record subscription cancel intent"
        )



