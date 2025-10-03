from __future__ import annotations
from typing import Iterable
import os
import asyncio
import glob

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from .config import settings


def _normalize_db_url(url: str) -> str:
    # Allow postgres:// to work with asyncpg
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def get_engine() -> AsyncEngine:
    url = _normalize_db_url(settings.database_url)
    return create_async_engine(url, pool_pre_ping=True, future=True)


async def _exec_sql_files(engine: AsyncEngine, files: Iterable[str]) -> None:
    from sqlalchemy import text
    async with engine.begin() as conn:
        for fp in files:
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    sql = f.read()
                await conn.execute(text(sql))
            except Exception:
                # Best-effort during scaffold; ignore idempotent failures
                continue


async def run_migrations() -> None:
    # Only attempt for postgres
    if not (settings.database_url and settings.database_url.startswith("postgres")):
        return
    engine = get_engine()
    folder = os.path.join(os.path.dirname(__file__), "migrations")
    files = sorted(glob.glob(os.path.join(folder, "*.sql")))
    await _exec_sql_files(engine, files)


def run_migrations_blocking() -> None:
    try:
        asyncio.run(run_migrations())
    except RuntimeError:
        # If already running in an event loop, schedule and wait
        loop = asyncio.get_event_loop()
        loop.run_until_complete(run_migrations())


