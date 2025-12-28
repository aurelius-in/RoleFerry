from fastapi import APIRouter, Response, Request, HTTPException
from sqlalchemy import text as sql_text

from ..storage import store
from ..db import get_engine
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..auth import require_current_user
import json


router = APIRouter()
engine = get_engine()


@router.get("/overview")
async def analytics_overview(http_request: Request):
    """
    Week 11+ analytics overview.
    Derives KPIs from application + outreach tables for the demo user...
    """
    user = await require_current_user(http_request)
    user_id = user.id
    
    app_rows = []
    sent_row = None
    verification_rows = []

    # DB is optional for demo; fall back to in-memory metrics when unavailable.
    try:
        async with engine.begin() as conn:
            # Count applications by status for the demo user
            result = await conn.execute(
                sql_text(
                    """
                    SELECT status, COUNT(*) AS count
                    FROM application
                    WHERE user_id = :user_id
                    GROUP BY status
                    """
                ),
                {"user_id": user_id},
            )
            app_rows = result.fetchall()

            # Count outreach rows as "real" sends
            result = await conn.execute(
                sql_text(
                    """
                    SELECT COUNT(*) AS sent_count
                    FROM outreach
                    WHERE user_id = :user_id
                    """
                ),
                {"user_id": user_id},
            )
            sent_row = result.first()

            # Verification breakdown from outreach
            result = await conn.execute(
                sql_text(
                    """
                    SELECT COALESCE(verification_status, 'unknown') AS status,
                           COUNT(*) AS count
                    FROM outreach
                    WHERE user_id = :user_id
                    GROUP BY COALESCE(verification_status, 'unknown')
                    """
                ),
                {"user_id": user_id},
            )
            verification_rows = result.fetchall()
    except BaseException:
        # fall back to store-only below
        app_rows = []
        sent_row = None
        verification_rows = []

    by_status = {row.status: row.count for row in app_rows} if app_rows else {}

    # Treat any non-"saved" application as a "role applied"
    roles_applied = sum(
        count for status, count in by_status.items() if status and status.lower() != "saved"
    )

    total_sent = int(getattr(sent_row, "sent_count", 0) or 0) if sent_row else 0

    # Fetch recent sends
    recent_sends = []
    try:
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    SELECT id, contact_email, subject, sent_at, verification_status, verification_score
                    FROM outreach
                    WHERE user_id = :user_id
                    ORDER BY sent_at DESC
                    LIMIT 5
                    """
                ),
                {"user_id": user_id},
            )
            for row in result.fetchall():
                recent_sends.append({
                    "id": str(row.id),
                    "contact_email": row.contact_email,
                    "subject": row.subject,
                    "sent_at": row.sent_at.isoformat() if row.sent_at else "",
                    "verification_status": row.verification_status,
                    "verification_score": row.verification_score,
                })
    except Exception:
        pass

    # Use in-memory message mocks (if any) to approximate click/reply rates
    msgs = store.messages or []
    delivered = total_sent or len(msgs)
    reply_count = sum(1 for m in msgs if m.get("replied"))
    click_count = sum(1 for m in msgs if m.get("opened"))

    click_rate = (click_count / delivered * 100) if delivered else 0.0
    reply_rate = (reply_count / delivered * 100) if delivered else 0.0

    # Build verification breakdown with stable keys
    verification_breakdown = {
        "valid": 0,
        "risky": 0,
        "invalid": 0,
        "unknown": 0,
    }
    for row in verification_rows or []:
        key = (getattr(row, "status", None) or "unknown").lower()
        if key not in verification_breakdown:
            verification_breakdown[key] = 0
        verification_breakdown[key] += int(row.count or 0)

    verified_total = verification_breakdown.get("valid", 0) + verification_breakdown.get(
        "risky", 0
    )
    verified_ratio = (verified_total / total_sent * 100) if total_sent else 0.0

    return {
        "total_sent": delivered,
        "click_rate": round(click_rate, 1),
        "reply_rate": round(reply_rate, 1),
        "roles_applied": roles_applied,
        "by_status": by_status,
        "verification_breakdown": verification_breakdown,
        "verified_ratio": round(verified_ratio, 1),
        "recent_sends": recent_sends,
    }


@router.get("/campaign")
def analytics_campaign():
    store.add_audit(None, "analytics_campaign", {})
    msgs = store.messages or [
        {"opened": True, "replied": False, "label": None, "variant": "preset_short_email_pm", "alignment_score": 85},
        {"opened": True, "replied": True, "label": "positive", "variant": "preset_email_long_ai_ops", "alignment_score": 92},
        {"opened": True, "replied": True, "label": "reply", "variant": "preset_email_long_billing", "alignment_score": 78},
        {"opened": False, "replied": False, "label": None, "variant": "preset_email_medium_security", "alignment_score": 65},
    ]
    delivered = len(msgs) if msgs else 100
    open_count = sum(1 for m in msgs if m.get("opened")) if msgs else 62
    reply_count = sum(1 for m in msgs if m.get("replied")) if msgs else 14
    positive = sum(1 for m in msgs if m.get("label") == "positive") if msgs else 8
    meetings = sum(1 for m in msgs if m.get("label") == "meeting") if msgs else 3
    
    # New metrics calculations
    alignment_scores = [m.get("alignment_score", 0) for m in msgs if m.get("alignment_score")]
    average_alignment_score = sum(alignment_scores) / len(alignment_scores) if alignment_scores else 80
    
    # Calculate alignment correlation (mock calculation)
    alignment_correlation = 0.75  # Mock correlation between alignment score and reply rate
    
    # Calculate cost per qualified lead (mock calculation)
    total_cost = 1500  # Mock total campaign cost
    qualified_leads = positive + meetings
    cost_per_qualified_lead = total_cost / qualified_leads if qualified_leads > 0 else 0
    
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
        "alignment_correlation": alignment_correlation,
        "cost_per_qualified_lead": round(cost_per_qualified_lead, 2),
        "total_campaigns": 12,  # Mock total campaigns
        "average_alignment_score": round(average_alignment_score, 1),
        "conversion_rate": round((positive + meetings) / delivered * 100, 1) if delivered > 0 else 0,
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


@router.get("/explain")
async def analytics_explain(http_request: Request):
    """
    GPT-backed explanatory analytics.

    Source of truth for counts remains deterministic (DB/store). GPT adds narrative:
    - insights
    - risks
    - next_actions
    """
    metrics = await analytics_overview(http_request)
    campaign = analytics_campaign()

    context = {
        "metrics": metrics,
        "campaign": campaign,
        "notes": "Explain what is working and what to change next. Keep it concise and practical.",
    }

    client = get_openai_client()
    messages = [
        {
            "role": "system",
            "content": (
                "You are a deliverability and outreach analytics analyst.\n\n"
                "Given JSON metrics, produce an executive-friendly explanation.\n"
                "Return ONLY a JSON object with keys:\n"
                "- insights: array of strings\n"
                "- risks: array of strings\n"
                "- next_actions: array of strings\n"
                "- confidence: number 0-1\n"
            ),
        },
        {"role": "user", "content": json.dumps(context)},
    ]

    stub_json = {
        "insights": [
            "Reply rate is driven by higher alignment scores; the top variant is outperforming.",
            "Verification is strong; maintain list hygiene to protect deliverability.",
        ],
        "risks": [
            "Some variants are underperforming—subject lines may be too generic.",
            "If verified_ratio drops, expect bounce rate and spam placement to worsen.",
        ],
        "next_actions": [
            "A/B test a shorter subject and a more specific first line tied to the top pain point.",
            "Trim or re-verify any risky contacts before the next send batch.",
            "Increase personalization for the bottom-performing variant and re-run deliverability check.",
        ],
        "confidence": 0.72,
    }

    raw = client.run_chat_completion(messages, temperature=0.25, max_tokens=700, stub_json=stub_json)
    choices = raw.get("choices") or []
    msg = (choices[0].get("message") if choices else {}) or {}
    content_str = str(msg.get("content") or "")
    data = extract_json_from_text(content_str) or stub_json

    return {
        "success": True,
        "explanation": data,
        "inputs": {"metrics": metrics, "campaign": campaign},
    }

