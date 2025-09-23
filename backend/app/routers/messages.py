from fastapi import APIRouter
from ..storage import store


router = APIRouter()


@router.get("/messages")
def list_messages():
    return {"messages": store.messages}

