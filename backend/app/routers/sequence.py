from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional


class SequenceExportRequest(BaseModel):
    contacts: List[dict]


class SequencePushRequest(BaseModel):
    list_name: Optional[str] = None
    contacts: List[dict]


router = APIRouter()


@router.post("/export")
def export_csv(payload: SequenceExportRequest):
    return {"file_url": "https://example.com/instantly.csv"}


@router.post("/push")
def push_to_instantly(payload: SequencePushRequest):
    return {"status": "queued", "list_name": payload.list_name or "RoleFerry Run"}

