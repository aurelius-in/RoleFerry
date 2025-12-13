import asyncio
import os
import sys

from sqlalchemy import text

# Ensure backend root is on sys.path so `app` is importable when run as a script
BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.db import get_engine


async def main() -> None:
    engine = get_engine()
    folder = os.path.join(os.path.dirname(__file__), "..", "app", "migrations")
    path = os.path.normpath(os.path.join(folder, "0002_core_entities.sql"))
    print("Executing migration file:", path)

    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()

    async with engine.begin() as conn:
        try:
            await conn.execute(text(sql))
            print("0002_core_entities.sql executed successfully.")
        except Exception as e:
            print("Error executing 0002_core_entities.sql:", repr(e))


if __name__ == "__main__":
    asyncio.run(main())



