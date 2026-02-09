from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime, timezone

from ..storage import store


router = APIRouter(prefix="/leads", tags=["leads"])


class LeadCaptureRequest(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    source_url: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


@router.post("/capture")
async def capture_lead(payload: LeadCaptureRequest, http_request: Request) -> Dict[str, Any]:
    """
    Public lead capture endpoint (no auth required).
    """
    full_name = str(payload.full_name or "").strip()
    email = str(payload.email or "").strip()
    phone = str(payload.phone or "").strip()

    if not full_name:
        raise HTTPException(status_code=422, detail="full_name is required")
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="email is required")

    ip = http_request.client.host if http_request.client else None
    ua = str(http_request.headers.get("user-agent") or "").strip()

    record: Dict[str, Any] = {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "source_url": str(payload.source_url or "").strip(),
        "meta": payload.meta or {},
        "ip": ip,
        "user_agent": ua,
        "captured_at": datetime.now(timezone.utc).isoformat(),
    }

    # For now, store in audit log (works in demo + without DB).
    store.add_audit(None, "lead_capture", record)
    return {"success": True, "message": "Captured"}

