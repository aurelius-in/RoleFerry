from fastapi import APIRouter
from datetime import datetime, timezone
import os
import asyncio

from prometheus_client import Counter, generate_latest
from redis import Redis
from sqlalchemy import text as sql_text

from ..config import settings
from ..db import get_engine
from ..clients.openai_client import get_openai_client


router = APIRouter()

requests_total = Counter("rf_requests_total", "Total API requests")


@router.get("/health")
async def healthcheck():
    """
    Lightweight healthcheck with DB/Redis status and provider flags.
    """
    requests_total.inc()

    # DB health
    # In local dev it's common to run without Postgres/Redis (especially on Windows).
    # Avoid hanging health checks by default; enable active probes via env flags.
    db_status = "skipped"
    migrations_applied: list[str] = []
    if os.getenv("ROLEFERRY_HEALTHCHECK_DB", "false").lower() == "true":
        engine = get_engine()
        try:
            async def _db_ping() -> None:
                async with engine.begin() as conn:
                    await conn.execute(sql_text("SELECT 1"))

            # Protect against long connect timeouts when Postgres isn't running.
            await asyncio.wait_for(_db_ping(), timeout=1.0)
            db_status = "ok"
            # Best-effort: reflect applied migrations from the migrations directory listing
            # (schema_migrations table would be more robust in a future iteration).
        except Exception:
            db_status = "error"

    # Redis health
    redis_status = "skipped"
    if settings.redis_url and os.getenv("ROLEFERRY_HEALTHCHECK_REDIS", "false").lower() == "true":
        try:
            r = Redis.from_url(settings.redis_url, socket_connect_timeout=0.2)
            r.ping()
            redis_status = "ok"
        except Exception:
            redis_status = "error"

    providers = {
        "serper": bool(settings.serper_api_key),
        "openai": bool(settings.openai_api_key),
        "findymail": bool(settings.findymail_api_key),
        "neverbounce": bool(settings.neverbounce_api_key),
        "millionverifier": bool(settings.mv_api_key),
    }
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "env": settings.environment,
        "version": settings.app_version,
        "mock_mode": settings.mock_mode,
        "providers": providers,
        "db": db_status,
        "redis": redis_status,
        "migrations_applied": migrations_applied,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/")
def root():
    return {"name": "RoleFerry API", "env": settings.environment, "version": settings.app_version}


@router.get("/ping")
def ping():
    return {"pong": True}


@router.get("/version")
def version():
    return {"version": settings.app_version}


@router.get("/metrics")
def metrics():
    return generate_latest()


@router.get("/health/llm")
async def llm_healthcheck():
    """
    Lightweight LLM diagnostics endpoint.

    - Reports whether a real OpenAI client is configured and enabled.
    - Performs a tiny test completion and reports if it succeeded (even in stub mode).
    """
    client = get_openai_client()
    info = {
        "configured": bool(settings.openai_api_key),
        "mock_mode": settings.mock_mode,
        "llm_mode": settings.llm_mode,
        "should_use_real_llm": client.should_use_real_llm,
        "model": settings.openai_model,
        # Extra diagnostics (do NOT expose secrets)
        "env_has_RoleFerryKey": bool(os.getenv("RoleFerryKey")),
        "env_has_OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
    }

    # Run a very small probe; this will return a stubbed response in mock_mode.
    try:
        data = client.run_chat_completion(
            messages=[{"role": "user", "content": "LLM health probe: respond with a short acknowledgement."}],
            max_tokens=32,
        )
        choices = data.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content = str(msg.get("content") or "")
        info["probe_ok"] = True
        info["probe_preview"] = content[:120]
    except Exception:
        info["probe_ok"] = False
        info["probe_preview"] = ""

    return info

