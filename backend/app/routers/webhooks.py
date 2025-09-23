from fastapi import APIRouter, Request
from ..storage import store


router = APIRouter()


@router.post("/webhooks/instantly")
async def instantly_webhook(request: Request):
    payload = await request.json()
    store.add_audit(None, "instantly_webhook", payload)
    return {"received": True}

