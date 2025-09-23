from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from ..services import gate_sendability
from ..config import settings
from ..clients.mv import MillionVerifierClient


class VerifyBatchRequest(BaseModel):
    contact_ids: List[str]


router = APIRouter()


@router.post("/verify")
async def verify_contacts(payload: VerifyBatchRequest):
    client = MillionVerifierClient(settings.mv_api_key)
    results = []
    for cid in payload.contact_ids:
        # In real life, we'd map contact_id->email; for MVP assume id is email
        r = await client.verify_email(cid)
        status = r.get("result", "unknown")
        score = r.get("score", 0)
        sendable = gate_sendability(status, score)
        results.append(
            {
                "contact_id": cid,
                "verification_status": status,
                "verification_score": score,
                "sendable": sendable,
            }
        )
    return {"results": results}

