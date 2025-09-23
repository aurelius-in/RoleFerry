from fastapi import APIRouter
from ..config import settings
from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def healthcheck():
    return {"status": "ok", "env": settings.environment, "version": settings.app_version}


@router.get("/")
def root():
    return {"name": "RoleFerry API", "env": settings.environment, "version": settings.app_version}

