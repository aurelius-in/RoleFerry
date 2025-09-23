from fastapi import APIRouter
from pydantic import BaseModel


class WarmAnglesRequest(BaseModel):
    linkedin: str | None = None
    domain: str | None = None
    schools: list[str] | None = None


router = APIRouter()


@router.post("/warm-angles/find")
def find_warm_angles(payload: WarmAnglesRequest):
    return {"warm_angles": [
        {"type": "mutual", "detail": "You and Alex both know Jordan"},
        {"type": "alma_mater", "detail": "Shared school: State U"},
    ]}

