from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any


router = APIRouter(prefix="/hooks/n8n", tags=["n8n"]) 


class IngestHook(BaseModel):
    domain: str


class QualifyHook(BaseModel):
    name: str
    title: str
    linkedin_url: str
    company: str
    domain: str


@router.post("/ingest")
def ingest(payload: IngestHook) -> Dict[str, Any]:
    if not payload.domain:
        raise HTTPException(status_code=422, detail="domain required")
    return {"ack": True, "action": "append_domain", "domain": payload.domain}


@router.post("/qualify")
def qualify(payload: QualifyHook) -> Dict[str, Any]:
    if not payload.linkedin_url:
        raise HTTPException(status_code=422, detail="linkedin_url required")
    # Stubbed qualifier result
    result = {
        "decision": "yes" if "head" in payload.title.lower() or "ceo" in payload.title.lower() else "maybe",
        "reason": "Title indicates decision maker" if "yes" else "Needs review",
        "contact": {
            "email": f"{payload.name.split()[0].lower()}.{payload.name.split()[-1].lower()}@{payload.domain}",
            "verification_status": "valid",
            "verification_score": 90,
        },
    }
    return {"ack": True, "summary": result}


