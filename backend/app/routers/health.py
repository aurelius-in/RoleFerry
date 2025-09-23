from fastapi import APIRouter
from ..config import settings
from fastapi import APIRouter
from datetime import datetime, timezone


router = APIRouter()


@router.get("/health")
def healthcheck():
    return {"status": "ok", "env": settings.environment, "version": settings.app_version, "ts": datetime.now(timezone.utc).isoformat()}


@router.get("/")
def root():
    return {"name": "RoleFerry API", "env": settings.environment, "version": settings.app_version}


@router.get("/ping")
def ping():
    return {"pong": True}


@router.get("/version")
def version():
    return {"version": settings.app_version}

