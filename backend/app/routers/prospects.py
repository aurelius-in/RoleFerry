from fastapi import APIRouter
from typing import Optional, Dict, Any
from sqlalchemy import text
from ..db import get_engine


router = APIRouter(prefix="", tags=["prospects"]) 


@router.get("/prospects")
async def list_prospects(decision: Optional[str] = None, verification_status: Optional[str] = None, domain: Optional[str] = None) -> Dict[str, Any]:
    engine = get_engine()
    clauses = []
    params: Dict[str, Any] = {}
    if decision:
        clauses.append("decision = :decision")
        params["decision"] = decision
    if verification_status:
        clauses.append("verification_status = :vs")
        params["vs"] = verification_status
    if domain:
        clauses.append("domain ILIKE :domain")
        params["domain"] = f"%{domain}%"
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = text("SELECT domain, name, title, linkedin_url, decision, reason, email, verification_status, verification_score, total_cost_usd as cost_usd FROM v_prospect_summary" + where + " ORDER BY domain")
    async with engine.connect() as conn:
        res = await conn.execute(sql, params)
        rows = [dict(r._mapping) for r in res]
    return {"prospects": rows, "count": len(rows)}


