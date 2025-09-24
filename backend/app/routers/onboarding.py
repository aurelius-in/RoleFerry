from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ..storage import store


router = APIRouter()


class OnboardingTask(BaseModel):
    id: str
    title: str
    done: bool = False
    link: Optional[str] = None


@router.get("/onboarding")
def list_onboarding():
    return {"tasks": store.list_onboarding()}


@router.post("/onboarding")
def set_onboarding(tasks: List[OnboardingTask]):
    store.set_onboarding([t.model_dump() for t in tasks])
    return {"ok": True}


