from fastapi import APIRouter
from fastapi import Response
from ..storage import store


router = APIRouter()


@router.get("/campaign")
def analytics_campaign():
    store.add_audit(None, "analytics_campaign", {})
    msgs = store.messages or [
        {"opened": True, "replied": False, "label": None, "variant": "preset_short_email_pm"},
        {"opened": True, "replied": True, "label": "positive", "variant": "preset_email_long_ai_ops"},
        {"opened": True, "replied": True, "label": "reply", "variant": "preset_email_long_billing"},
        {"opened": False, "replied": False, "label": None, "variant": "preset_email_medium_security"},
    ]
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


@router.get("/csv")
def analytics_csv():
    data = analytics_campaign()
    lines = ["metric,value"]
    lines.append(f"delivered,{data['delivered']}")
    lines.append(f"open,{data['open']}")
    lines.append(f"reply,{data['reply']}")
    lines.append(f"positive,{data['positive']}")
    lines.append(f"meetings,{data['meetings']}")
    # Variants breakdown
    lines.append("")
    lines.append("variant,delivered,open,reply,positive")
    for v, row in (data.get("variants") or {}).items():
        lines.append(f"{v},{row.get('delivered',0)},{row.get('open',0)},{row.get('reply',0)},{row.get('positive',0)}")
    csv_body = "\n".join(lines)
    return Response(content=csv_body, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=analytics.csv"})


@router.get("/timeseries")
def analytics_timeseries():
    return {"points": store.list_timeseries()}

