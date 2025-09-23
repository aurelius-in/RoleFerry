from fastapi import APIRouter
from ..config import settings


router = APIRouter()


@router.get("/settings")
def get_settings():
  return {
      "environment": settings.environment,
      "mv_threshold": settings.mv_threshold,
      "cors_origins": settings.cors_origins,
  }

