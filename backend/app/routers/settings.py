from fastapi import APIRouter
from ..config import settings
from pydantic import BaseModel


router = APIRouter()


@router.get("/settings")
def get_settings():
  return {
      "environment": settings.environment,
      "mv_threshold": settings.mv_threshold,
      "preferred_email_verifier": settings.preferred_email_verifier,
      "cors_origins": settings.cors_origins,
      "instantly_enabled": settings.instantly_enabled,
  }


class SettingsUpdate(BaseModel):
  mv_threshold: float
  preferred_email_verifier: str | None = None


@router.put("/settings")
def update_settings(payload: SettingsUpdate):
  settings.mv_threshold = float(payload.mv_threshold)
  if payload.preferred_email_verifier:
    settings.preferred_email_verifier = payload.preferred_email_verifier
  return {"ok": True, "mv_threshold": settings.mv_threshold, "preferred_email_verifier": settings.preferred_email_verifier}

