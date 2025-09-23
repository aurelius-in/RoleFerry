from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from ..services import gate_sendability


class VerifyBatchRequest(BaseModel):
    contact_ids: List[str]


router = APIRouter()


@router.post("/verify")
def verify_contacts(payload: VerifyBatchRequest):
    results = []
    for cid in payload.contact_ids:
        verification_status = "accept_all" if cid.endswith("a") else "valid"
        verification_score = 0.82 if verification_status == "accept_all" else 1.0
        sendable = gate_sendability(verification_status, verification_score)
        results.append(
            {
                "contact_id": cid,
                "verification_status": verification_status,
                "verification_score": verification_score,
                "sendable": sendable,
            }
        )
    return {"results": results}

