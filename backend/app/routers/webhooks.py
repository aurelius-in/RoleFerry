from fastapi import APIRouter, Request
from ..storage import store


router = APIRouter()


@router.post("/webhooks/instantly")
async def instantly_webhook(request: Request):
    payload = await request.json()
    event = payload.get("event") or payload.get("type") or "instantly_event"
    store.add_audit(None, f"instantly_webhook:{event}", payload)
    return {"received": True}

