from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from ..storage import store


router = APIRouter()


class ComplianceRule(BaseModel):
    region: str
    rules: List[str]


class DNCEntry(BaseModel):
    id: str
    reason: str


@router.get("/compliance/rules")
def list_rules():
    return {"rules": store.list_compliance_rules()}


@router.post("/compliance/rules")
def set_rules(rules: List[ComplianceRule]):
    store.set_compliance_rules([r.model_dump() for r in rules])
    return {"ok": True}


@router.get("/compliance/dnc")
def list_dnc():
    return {"dnc": store.list_dnc()}


@router.post("/compliance/dnc")
def set_dnc(entries: List[DNCEntry]):
    store.set_dnc([e.model_dump() for e in entries])
    return {"ok": True}


