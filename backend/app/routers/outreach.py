from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict
from ..services import generate_outreach_variant


class OutreachGenerateRequest(BaseModel):
    mode: str
    length: str
    variables: Dict[str, str]


router = APIRouter()


@router.post("/generate")
def generate_outreach(payload: OutreachGenerateRequest):
    variants = [
        {"variant": "A", **generate_outreach_variant(payload.mode, payload.length, payload.variables)},
        {"variant": "B", **generate_outreach_variant(payload.mode, payload.length, payload.variables)},
        {"variant": "C", **generate_outreach_variant(payload.mode, payload.length, payload.variables)},
    ]
    return {"variants": variants}

