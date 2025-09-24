from fastapi import APIRouter
from pydantic import BaseModel
from ..storage import store


class WarmAnglesRequest(BaseModel):
    linkedin: str | None = None
    domain: str | None = None
    schools: list[str] | None = None


router = APIRouter()


@router.post("/warm-angles/find")
def find_warm_angles(payload: WarmAnglesRequest):
    keys = []
    if payload.linkedin:
        keys.append(f"li:{payload.linkedin}")
    if payload.domain:
        keys.append(f"domain:{payload.domain}")
    if payload.schools:
        for s in payload.schools:
            keys.append(f"school:{s}")
    results = []
    for k in keys:
        results.extend(store.get_warm_angles(k))
    # de-dup by (type, detail)
    seen = set()
    dedup = []
    for a in results:
        key = (a.get("type"), a.get("detail"))
        if key in seen:
            continue
        seen.add(key)
        dedup.append(a)
    return {"warm_angles": dedup}

