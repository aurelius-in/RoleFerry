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


class CardUpdate(BaseModel):
    id: str
    assignee: str | None = None
    due_date: str | None = None


@router.post("/crm/card")
def update_card(payload: CardUpdate):
    updates = {}
    if payload.assignee is not None:
        updates["assignee"] = payload.assignee
    if payload.due_date is not None:
        updates["due_date"] = payload.due_date
    store.update_crm_card(payload.id, **updates)
    return {"ok": True}


class AddCard(BaseModel):
    id: str
    name: str | None = None


@router.post("/crm/add")
def add_card(payload: AddCard):
    board = store.crm_lanes
    card = {"id": payload.id, "name": payload.name or payload.id, "note": "", "assignee": "", "due_date": None}
    board.setdefault("People", [])
    # Avoid duplicates
    if not any(c.get("id") == card["id"] for c in board["People"]):
        board["People"].append(card)
    store.set_crm_board(board)
    return {"ok": True}

