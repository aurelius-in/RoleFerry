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
        elif event in ("bounce", "bounced"):
            store.update_message(email, label="bounce")
        elif event in ("complaint", "complained"):
            store.update_message(email, label="complaint")
        elif event in ("unsubscribe", "unsubscribed"):
            store.update_message(email, label="unsubscribe")
        elif event in ("click", "clicked"):
            # Treat click as implicit open for metrics
            store.update_message(email, opened=True)
    return {"received": True}

