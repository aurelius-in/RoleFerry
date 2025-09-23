from fastapi import APIRouter
from ..config import settings


router = APIRouter()


@router.get("/health")
def healthcheck():
    return {"status": "ok", "env": settings.environment, "version": settings.app_version}

