from fastapi import APIRouter, Request
from ..storage import store


router = APIRouter()


@router.post("/webhooks/instantly")
async def instantly_webhook(request: Request):
    payload = await request.json()
    event = payload.get("event") or payload.get("type") or "instantly_event"
    store.add_audit(None, f"instantly_webhook:{event}", payload)
    # Basic event mapping
    email = payload.get("email") or payload.get("recipient") or payload.get("to")
    if email:
        if event in ("open", "opened"):
            store.update_message(email, opened=True)
        elif event in ("reply", "replied"):
            label = payload.get("label") or "reply"
            store.update_message(email, replied=True, label=label)
    return {"received": True}

