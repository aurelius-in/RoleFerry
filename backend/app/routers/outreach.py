from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict
from ..services import generate_outreach_variant, generate_ghostwriter_variants


class OutreachGenerateRequest(BaseModel):
    mode: str
    length: str
    variables: Dict[str, str]


router = APIRouter()


@router.post("/generate")
def generate_outreach(payload: OutreachGenerateRequest):
    variants = generate_ghostwriter_variants(payload.mode, payload.length, payload.variables)
    return {"variants": variants}

