from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from ..storage import store


router = APIRouter()


class DeliTask(BaseModel):
    id: str
    title: str
    done: bool = False


@router.get("/deliverability")
def list_deliverability():
    return {"tasks": store.list_deliverability()}


@router.post("/deliverability")
def set_deliverability(tasks: List[DeliTask]):
    store.set_deliverability([t.model_dump() for t in tasks])
    return {"ok": True}


