from fastapi import APIRouter
from pydantic import BaseModel
from typing import List


class VerifyBatchRequest(BaseModel):
    contact_ids: List[str]


router = APIRouter()


@router.post("/verify")
def verify_contacts(payload: VerifyBatchRequest):
    return {
        "results": [
            {
                "contact_id": cid,
                "verification_status": "valid",
                "verification_score": 0.98,
                "sendable": True,
            }
            for cid in payload.contact_ids
        ]
    }

