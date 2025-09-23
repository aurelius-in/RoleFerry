from fastapi import APIRouter
from pydantic import BaseModel


class ClassifyRequest(BaseModel):
    text: str


router = APIRouter()


@router.post("/replies/classify")
def classify_reply(payload: ClassifyRequest):
    txt = payload.text.lower()
    label = "positive" if any(k in txt for k in ["yes", "interested", "let's talk"]) else (
        "ooo" if "out of office" in txt else ("objection" if any(k in txt for k in ["not now", "no budget"]) else "neutral")
    )
    return {"label": label}

