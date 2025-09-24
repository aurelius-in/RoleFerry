from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict
from ..services import generate_outreach_variant, generate_ghostwriter_variants
from ..storage import store


class OutreachGenerateRequest(BaseModel):
    mode: str
    length: str
    variables: Dict[str, str]


router = APIRouter()


@router.post("/generate")
def generate_outreach(payload: OutreachGenerateRequest):
    variants = generate_ghostwriter_variants(payload.mode, payload.length, payload.variables)
    return {"variants": variants}


@router.get("/presets")
def list_outreach_presets():
    return {"presets": store.list_outreach_presets()}


@router.get("/presets/{preset_id}")
def get_outreach_preset(preset_id: str):
    p = store.get_outreach_preset(preset_id)
    if not p:
        raise HTTPException(status_code=404, detail="Preset not found")
    return p

