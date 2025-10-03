from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from ..repos.leads_repo import LeadsRepo
from ..db import get_engine
from ..services.ai_qualifier import qualify_prospect
from ..services.findymail_client import enrich_contact
from ..services.email_verifier import verify as verify_email
from ..config import settings


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
    # Persist domain asynchronously if possible
    repo = LeadsRepo(get_engine())
    try:
        import anyio
        async def _persist():
            await repo.upsert_domain(payload.domain, source="n8n")
        anyio.from_thread.run(_persist)
    except Exception:
        pass
    return {"ack": True, "action": "append_domain", "domain": payload.domain}


@router.post("/qualify")
async def qualify(payload: QualifyHook) -> Dict[str, Any]:
    if not payload.linkedin_url:
        raise HTTPException(status_code=422, detail="linkedin_url required")
    # Enforce keys if mock is off
    missing = []
    if not settings.openai_api_key:
        missing.append("openai")
    if (not settings.findymail_api_key) and (not settings.mock_mode):
        missing.append("findymail")
    if (not settings.neverbounce_api_key and not settings.mv_api_key) and (not settings.mock_mode):
        missing.append("verifier")
    if missing and not settings.mock_mode:
        raise HTTPException(status_code=422, detail=f"Missing provider keys: {', '.join(missing)}. Enable mock mode or provide keys.")

    repo = LeadsRepo(get_engine())
    domain_id = await repo.upsert_domain(payload.domain, source="n8n")
    preview = {"name": payload.name, "title": payload.title, "linkedin_url": payload.linkedin_url, "company": payload.company}
    pid = await repo.create_prospect(domain_id, preview)
    qual = qualify_prospect(preview)
    await repo.add_qualification(pid, qual["decision"], qual["reason"], qual["model"], int(qual["latency_ms"]))
    contact = enrich_contact(payload.name, payload.domain) if qual["decision"] == "yes" else {"email": None, "phone": None}
    cid = None
    verification = {"status": "unknown", "score": None}
    if contact.get("email"):
        cid = await repo.add_contact(pid, contact.get("email"), contact.get("phone"), provider="findymail")
        verification = verify_email(contact.get("email"))
        await repo.update_contact_verification(cid, verification.get("status", "unknown"), verification.get("score"), "neverbounce")
    return {
        "ack": True,
        "summary": {
            "decision": qual["decision"],
            "reason": qual["reason"],
            "email": contact.get("email"),
            "verification_status": verification.get("status"),
            "verification_score": verification.get("score"),
        },
    }


