from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ..storage import store


class ContactFindRequest(BaseModel):
    company: str
    titles: Optional[List[str]] = None
    location: Optional[str] = None


router = APIRouter()


@router.post("/find")
def find_contacts(payload: ContactFindRequest):
    # Simple filter over in-memory contacts
    contacts = [c for c in store.list_contacts() if c.get("company","" ).lower() == (payload.company or "").lower()]
    if payload.titles:
        titles_lower = {t.lower() for t in payload.titles}
        contacts = [c for c in contacts if c.get("title","" ).lower() in titles_lower]
    if payload.location:
        loc = payload.location.lower()
        contacts = [c for c in contacts if loc in (c.get("city","" ).lower() + " " + c.get("country","" ).lower())]
    return {"contacts": contacts}


@router.get("")
def list_contacts():
    return {"contacts": store.list_contacts()}


@router.get("/{contact_id}")
def get_contact(contact_id: str):
    c = store.get_contact(contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    return c

