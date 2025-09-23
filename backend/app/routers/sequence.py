from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import csv
import io


class SequenceExportRequest(BaseModel):
    contacts: List[dict]


class SequencePushRequest(BaseModel):
    list_name: Optional[str] = None
    contacts: List[dict]


router = APIRouter()


@router.post("/export")
def export_csv(payload: SequenceExportRequest):
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
    for row in payload.contacts:
        writer.writerow({k: row.get(k, "") for k in fieldnames})
    csv_content = buffer.getvalue()
    return {"filename": "instantly.csv", "content": csv_content}


@router.post("/push")
def push_to_instantly(payload: SequencePushRequest):
    return {"status": "queued", "list_name": payload.list_name or "RoleFerry Run"}

