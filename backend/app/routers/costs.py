from fastapi import APIRouter, Query
from typing import Dict, Any
import os
from sqlalchemy import text
from ..db import get_engine


router = APIRouter(prefix="/costs", tags=["costs"]) 


MESH_PER_LEAD = float(os.getenv("MESH_PER_LEAD_USD", "0.25"))
MESH_MONTHLY_BASE = float(os.getenv("MESH_MONTHLY_BASE_USD", "350"))


@router.get("/compare")
async def compare(sample: int = Query(10)) -> Dict[str, Any]:
    engine = get_engine()
    sql = text(
        """
        SELECT total_cost_usd
        FROM v_prospect_summary
        WHERE decision = 'yes'
        ORDER BY total_cost_usd DESC
        LIMIT :n
        """
    )
    costs = []
    async with engine.connect() as conn:
        res = await conn.execute(sql, {"n": max(1, int(sample))})
        costs = [float(r[0] or 0.0) for r in res]

    if not costs:
        # Default to a tiny estimate if none exist
        costs = [0.06]

    rf_per_lead = sum(costs) / len(costs)
    clay_per_lead = MESH_PER_LEAD
    # Monthly estimates over the same sample count
    return {
        "per_lead": {
            "roleferry": round(rf_per_lead, 4),
            "clay": round(clay_per_lead, 4),
        },
        "monthly": {
            "roleferry": round(sum(costs), 2),
            "clay": round(MESH_MONTHLY_BASE + clay_per_lead * len(costs), 2),
        },
        "sample": len(costs),
    }


