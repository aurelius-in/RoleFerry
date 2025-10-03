from fastapi import APIRouter, Response, Query
from typing import List


router = APIRouter(prefix="/exports", tags=["exports"]) 


@router.get("/instantly.csv")
def export_instantly(sendable_only: bool = Query(True)) -> Response:
    """Stub Instantly export CSV. Excludes rows without email when sendable_only.
    Columns per README: email,first_name,last_name,company,title,linkedin_url,domain,decision,reason,verification_status,verification_score
    """
    rows = [
        {
            "email": "alex@acme.com",
            "first_name": "Alex",
            "last_name": "Doe",
            "company": "Acme",
            "title": "CEO",
            "linkedin_url": "https://linkedin.com/in/alex-doe",
            "domain": "acme.com",
            "decision": "yes",
            "reason": "Founder/CEO",
            "verification_status": "valid",
            "verification_score": 95,
        },
        {
            "email": "",
            "first_name": "Jamie",
            "last_name": "Roe",
            "company": "Globex",
            "title": "Head of Talent",
            "linkedin_url": "https://linkedin.com/in/jamie-roe",
            "domain": "globex.com",
            "decision": "maybe",
            "reason": "Influencer",
            "verification_status": "unknown",
            "verification_score": "",
        },
    ]
    headers = [
        "email","first_name","last_name","company","title","linkedin_url","domain","decision","reason","verification_status","verification_score"
    ]
    out: List[str] = [",".join(headers)]
    for r in rows:
        if sendable_only and not r.get("email"):
            continue
        out.append(
            ",".join([str(r.get(h, "")) for h in headers])
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


