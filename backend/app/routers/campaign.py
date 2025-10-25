from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import csv
import io
from ..config import settings
from ..clients.instantly import InstantlyClient
from ..storage import store


class CampaignExportRequest(BaseModel):
    contacts: List[dict]


class CampaignPushRequest(BaseModel):
    list_name: Optional[str] = None
    contacts: List[dict]


router = APIRouter()


@router.post("/export")
def export_csv(payload: CampaignExportRequest):
    # V1 CSV columns per spec
    fieldnames = [
        "email",
        "first_name",
        "last_name",
        "company",
        "title",
        "jd_link",
        "portfolio_url",
        "match_score",
        "verification_status",
        "verification_score",
        "subject",
        "message",
    ]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for idx, row in enumerate(payload.contacts):
        missing = [k for k in fieldnames if k not in row]
        if missing:
            raise HTTPException(status_code=400, detail={"row": idx, "missing": missing})
        writer.writerow({k: row.get(k, "") for k in fieldnames})
    csv_content = buffer.getvalue()
    return {"filename": "instantly.csv", "content": csv_content}


@router.get("")
def list_campaign_rows():
    return {"rows": store.list_sequence_rows()}


@router.get("/runs")
def list_runs():
    return {"runs": store.list_sequence_runs()}


@router.get("/campaigns")
def list_campaigns(status: str | None = None, variant: str | None = None, min_list: int | None = None):
    items = store.list_campaigns()
    if status:
        items = [c for c in items if (c.get("status") or "").lower() == status.lower()]
    if variant:
        items = [c for c in items if (c.get("variant") or "").lower() == variant.lower()]
    if min_list is not None:
        items = [c for c in items if int(c.get("list_size") or 0) >= int(min_list)]
    return {"campaigns": items}


@router.post("/push")
async def push_to_instantly(payload: CampaignPushRequest):
    list_name = payload.list_name or "RoleFerry Run"
    if settings.instantly_enabled:
        client = InstantlyClient(settings.instantly_api_key or "")
        result = await client.push_contacts(list_name, payload.contacts)
        store.add_audit(None, "instantly_push", {"list_name": list_name, "count": len(payload.contacts), "result": result})
        # Store minimal message data for analytics
        for c in payload.contacts:
            store.messages.append({
                "id": c.get("email"),
                "opened": False,
                "replied": False,
                "label": None,
                "variant": c.get("variant") or "",
            })
        return result
    store.add_audit(None, "instantly_push_csv", {"list_name": list_name, "count": len(payload.contacts)})
    return {"status": "fallback_csv", "list_name": list_name}
