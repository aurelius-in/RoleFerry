from fastapi import APIRouter
from ..storage import store


router = APIRouter()


@router.post("/demo/seed")
def seed_demo():
    demo_msgs = [
        {"id": "m1", "opened": True, "replied": False, "label": None},
        {"id": "m2", "opened": True, "replied": True, "label": "positive"},
        {"id": "m3", "opened": False, "replied": False, "label": None},
    ]
    store.seed_messages(demo_msgs)
    return {"seeded": len(demo_msgs)}


@router.post("/demo/cleanup")
def cleanup_demo():
    store.clear_messages()
    return {"cleared": True}

