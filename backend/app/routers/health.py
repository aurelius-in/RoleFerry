from fastapi import APIRouter
from ..config import settings
from fastapi import APIRouter
from datetime import datetime, timezone
from prometheus_client import Counter, generate_latest


router = APIRouter()

requests_total = Counter("rf_requests_total", "Total API requests")


@router.get("/health")
def healthcheck():
    requests_total.inc()
    providers = {
        "serper": bool(settings.serper_api_key),
        "openai": bool(settings.openai_api_key),
        "findymail": bool(settings.findymail_api_key),
        "neverbounce": bool(settings.neverbounce_api_key),
        "millionverifier": bool(settings.mv_api_key),
    }
    return {
        "status": "ok",
        "env": settings.environment,
        "version": settings.app_version,
        "mock_mode": settings.mock_mode,
        "providers": providers,
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

