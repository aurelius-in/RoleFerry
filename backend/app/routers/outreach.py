from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict


class OutreachGenerateRequest(BaseModel):
    mode: str
    length: str
    variables: Dict[str, str]


router = APIRouter()


@router.post("/generate")
def generate_outreach(payload: OutreachGenerateRequest):
    subject = f"Quick intro on {payload.variables.get('RoleTitle', 'the role')} at {payload.variables.get('Company', '')}"
    body = (
        f"Hi {payload.variables.get('FirstName', 'there')}, I mapped a few ideas. "
        f"Calendar: {payload.variables.get('CalendlyURL', '')}"
    )
    return {"variants": [{"variant": "A", "subject": subject, "body": body}]}

