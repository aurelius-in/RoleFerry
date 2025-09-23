from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, List
from ..storage import store


router = APIRouter()


@router.get("/crm/board")
def get_board():
    return {"lanes": store.crm_lanes}


class BoardUpdate(BaseModel):
    lanes: Dict[str, List[dict]]


@router.post("/crm/board")
def set_board(payload: BoardUpdate):
    store.set_crm_board(payload.lanes)
    return {"ok": True}


class NoteUpdate(BaseModel):
    id: str
    note: str


@router.post("/crm/note")
def set_note(payload: NoteUpdate):
    store.set_crm_note(payload.id, payload.note)
    return {"ok": True}

