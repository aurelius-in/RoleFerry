from fastapi import APIRouter
from ..storage import store


router = APIRouter()


@router.get("/audit")
def list_audit():
    return {"logs": store.audit[-100:][::-1]}

