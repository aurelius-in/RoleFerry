from fastapi import APIRouter
from ..config import settings
from pydantic import BaseModel


router = APIRouter()


@router.get("/settings")
def get_settings():
  return {
      "environment": settings.environment,
      "mv_threshold": settings.mv_threshold,
      "cors_origins": settings.cors_origins,
      "instantly_enabled": settings.instantly_enabled,
  }


class SettingsUpdate(BaseModel):
  mv_threshold: float


@router.put("/settings")
def update_settings(payload: SettingsUpdate):
  settings.mv_threshold = float(payload.mv_threshold)
  return {"ok": True, "mv_threshold": settings.mv_threshold}

