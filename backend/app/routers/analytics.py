from fastapi import APIRouter


router = APIRouter()


@router.get("/campaign")
def analytics_campaign():
    return {
        "delivered": 100,
        "open": 62,
        "reply": 14,
        "positive": 8,
        "meetings": 3,
    }

