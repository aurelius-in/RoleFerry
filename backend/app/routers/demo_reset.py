from fastapi import APIRouter, HTTPException
from sqlalchemy import text as sql_text

from ..config import settings
from ..db import get_engine


router = APIRouter()
engine = get_engine()

DEMO_USER_ID = "demo-user"


@router.post("/demo/reset")
async def reset_demo_data():
    """
    Dev-only helper to reset demo-user data across Week 9–12 tables.

    This endpoint is only available when running in dev or mock_mode. It allows
    internal testers to return the system to a clean state between walkthroughs.
    """
    if not (settings.environment.lower() == "dev" or settings.mock_mode):
        raise HTTPException(status_code=403, detail="Demo reset is only available in dev/mock mode")

    try:
        async with engine.begin() as conn:
            # Order matters for FKs (child tables first). Execute individual
            # statements so we don't run into asyncpg's multi-statement limits.
            await conn.execute(
                sql_text("DELETE FROM pain_point_match WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
            await conn.execute(
                sql_text("DELETE FROM offer WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
            await conn.execute(
                sql_text("DELETE FROM outreach WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
            await conn.execute(
                sql_text("DELETE FROM application WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
            await conn.execute(
                sql_text("DELETE FROM job WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
            await conn.execute(
                sql_text("DELETE FROM resume WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
            await conn.execute(
                sql_text("DELETE FROM job_preferences WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
            await conn.execute(
                sql_text("DELETE FROM beta_feedback WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )

        return {"success": True, "message": "Demo data reset for demo-user"}
    except Exception:
        # We don't expose internal errors here; tests can still assert on success flag.
        raise HTTPException(status_code=500, detail="Failed to reset demo data")



