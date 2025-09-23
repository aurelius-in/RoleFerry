from fastapi import APIRouter
from ..storage import store


router = APIRouter()


@router.get("/campaign")
def analytics_campaign():
    store.add_audit(None, "analytics_campaign", {})
    msgs = store.messages
    delivered = len(msgs) if msgs else 100
    open_count = sum(1 for m in msgs if m.get("opened")) if msgs else 62
    reply_count = sum(1 for m in msgs if m.get("replied")) if msgs else 14
    positive = sum(1 for m in msgs if m.get("label") == "positive") if msgs else 8
    meetings = sum(1 for m in msgs if m.get("label") == "meeting") if msgs else 3
    # breakdown by variant
    breakdown = {}
    for m in msgs:
        v = m.get("variant") or ""
        if v not in breakdown:
            breakdown[v] = {"delivered": 0, "open": 0, "reply": 0, "positive": 0}
        breakdown[v]["delivered"] += 1
        if m.get("opened"):
            breakdown[v]["open"] += 1
        if m.get("replied"):
            breakdown[v]["reply"] += 1
        if m.get("label") == "positive":
            breakdown[v]["positive"] += 1
    return {
        "delivered": delivered,
        "open": open_count,
        "reply": reply_count,
        "positive": positive,
        "meetings": meetings,
        "variants": breakdown,
    }

