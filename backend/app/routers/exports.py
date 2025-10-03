from fastapi import APIRouter, Response, Query
from typing import List
from sqlalchemy import text
from ..db import get_engine


router = APIRouter(prefix="/exports", tags=["exports"]) 


@router.get("/instantly.csv")
async def export_instantly(sendable_only: bool = Query(True)) -> Response:
    """DB-backed Instantly export from summary view.
    Columns: email,first_name,last_name,company,title,linkedin_url,domain,decision,reason,verification_status,verification_score
    """
    engine = get_engine()
    sql = text("""
        SELECT name, title, linkedin_url, domain, decision, reason, email, verification_status, verification_score
        FROM v_prospect_summary
        ORDER BY domain
    """)
    rows = []
    async with engine.connect() as conn:
        res = await conn.execute(sql)
        rows = [dict(r._mapping) for r in res]
    headers = [
        "email","first_name","last_name","company","title","linkedin_url","domain","decision","reason","verification_status","verification_score"
    ]
    out: List[str] = [",".join(headers)]
    for r in rows:
        email = r.get("email") or ""
        if sendable_only and not email:
            continue
        name = r.get("name") or ""
        parts = name.split()
        first_name = parts[0] if parts else ""
        last_name = parts[-1] if len(parts) > 1 else ""
        company = (r.get("domain") or "").split(".")[0].title()
        out.append(
            ",".join([
                email,
                first_name,
                last_name,
                company,
                r.get("title") or "",
                r.get("linkedin_url") or "",
                r.get("domain") or "",
                r.get("decision") or "",
                r.get("reason") or "",
                r.get("verification_status") or "",
                str(r.get("verification_score") or ""),
            ])
        )
    csv = "\n".join(out) + "\n"
    return Response(content=csv, media_type="text/csv")


@router.get("/prospects.csv")
def export_prospects() -> Response:
    """Stub full prospects CSV export."""
    headers = [
        "domain","name","title","linkedin_url","decision","reason","email","verification_status","verification_score","cost_usd"
    ]
    rows = [
        ["acme.com","Alex Doe","CEO","https://linkedin.com/in/alex-doe","yes","Founder/CEO","alex@acme.com","valid","95","0.07"],
        ["globex.com","Jamie Roe","Head of Talent","https://linkedin.com/in/jamie-roe","maybe","Influencer","","unknown","","0.03"],
    ]
    data = [",".join(headers)] + [",".join(map(str, r)) for r in rows]
    return Response(content="\n".join(data) + "\n", media_type="text/csv")


