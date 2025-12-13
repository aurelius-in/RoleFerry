import asyncio
import os
import sys

from sqlalchemy import text

# Ensure backend root is importable as `app`
BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.db import get_engine


async def main() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        try:
            result = await conn.execute(
                text("SELECT user_id, data, updated_at FROM job_preferences")
            )
            rows = result.fetchall()
            print("job_preferences rows:", rows)
        except Exception as e:
            print("Error selecting from job_preferences:", repr(e))


if __name__ == "__main__":
    asyncio.run(main())


