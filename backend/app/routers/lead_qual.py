from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from ..config import settings
from ..db import get_engine
from ..repos.leads_repo import LeadsRepo
from ..services.serper_client import search_linkedin
from ..services.ai_qualifier import qualify_prospect
from ..services.findymail_client import enrich_contact
from ..services.email_verifier import verify as verify_email
from ..services.cost_meter import record as cost_record


router = APIRouter(prefix="/lead-qual", tags=["lead-qual"])


class DomainsCSVImportRequest(BaseModel):
    csv_text: str = Field(..., description="CSV content with a 'domain' header")


class DomainsSheetsImportRequest(BaseModel):
    sheet_id: Optional[str] = None


class PipelineRunRequest(BaseModel):
    domains: List[str]
    role_query: str


@router.post("/lead-domains/import-csv")
def import_csv(payload: DomainsCSVImportRequest) -> Dict[str, Any]:
    # Stub: accept CSV and return count; actual DB insert will be added later
    if not payload.csv_text.strip():
        raise HTTPException(status_code=422, detail="CSV text is empty")
    lines = [l.strip() for l in payload.csv_text.splitlines() if l.strip()]
    header = lines[0].lower().split(",") if lines else []
    if "domain" not in header:
        raise HTTPException(status_code=422, detail="CSV must include 'domain' column")
    domains = []
    for row in lines[1:]:
        parts = [c.strip() for c in row.split(",")]
        try:
            idx = header.index("domain")
        except ValueError:
            idx = 0
        if idx < len(parts):
            domains.append(parts[idx])
    return {"inserted": len(domains), "source": "csv", "domains": domains[:10]}


@router.post("/lead-domains/import-sheets")
def import_sheets(payload: DomainsSheetsImportRequest) -> Dict[str, Any]:
    # Stub: verify config presence in non-mock mode
    if not settings.mock_mode and not (settings.gsheet_service_json_path and (payload.sheet_id or settings.gsheet_sheet_id)):
        raise HTTPException(status_code=422, detail="Google Sheets not configured; enable mock mode or provide credentials")
    sample = ["acme.com", "globex.com", "initech.com"]
    return {"inserted": len(sample), "source": "sheets", "domains": sample}


@router.post("/pipeline/run")
async def run_pipeline(payload: PipelineRunRequest) -> Dict[str, Any]:
    # Stub: enforce mock behavior when keys are missing
    required = {
        "serper": settings.serper_api_key,
        "openai": settings.openai_api_key,
        "findymail": settings.findymail_api_key,
        "neverbounce": settings.neverbounce_api_key or settings.mv_api_key,
    }
    missing = [k for k, v in required.items() if not v]
    if missing and not settings.mock_mode:
        raise HTTPException(status_code=422, detail=f"Missing provider keys: {', '.join(missing)}. Enable mock mode or provide keys.")

    # Normalize domains
    domains = list(dict.fromkeys([d.strip().lower() for d in payload.domains if d.strip()]))[:25]
    engine = get_engine()
    repo = LeadsRepo(engine)
    results: List[Dict[str, Any]] = []
    total_cost = 0.0

    for d in domains:
        domain_id = await repo.upsert_domain(d, source="api")
        # Serper step
        hits = search_linkedin(d, payload.role_query)
        cost = cost_record("serper", None, 1, "request", None, {"domain": d})
        total_cost += cost["est_cost_usd"]

        top = hits[0] if hits else {"title": payload.role_query, "url": f"https://www.linkedin.com/search/results/people/?keywords={d}", "snippet": ""}
        preview = {"name": top.get("title", ""), "title": top.get("title", ""), "linkedin_url": top.get("url", ""), "company": d}
        pid = await repo.create_prospect(domain_id, preview)

        # Qualifier
        qual = qualify_prospect(preview)
        await repo.add_qualification(pid, qual["decision"], qual["reason"], qual["model"], int(qual["latency_ms"]))
        total_cost += cost_record("gpt", pid, 1, "token", 0.003, {"model": qual["model"]})["est_cost_usd"]

        decision = qual["decision"]
        contact_summary: Dict[str, Any] = {"email": None, "verification_status": None, "verification_score": None}
        if decision == "yes":
            # Enrich
            contact = enrich_contact(preview.get("name") or "Contact", d)
            cid = await repo.add_contact(pid, contact.get("email"), contact.get("phone"), provider="findymail")
            total_cost += cost_record("findymail", pid, 1, "lookup", None, {})["est_cost_usd"]
            # Verify
            v = verify_email(contact.get("email")) if contact.get("email") else {"status": "unknown", "score": None}
            await repo.update_contact_verification(cid, v.get("status", "unknown"), v.get("score"), "neverbounce")
            total_cost += cost_record("neverbounce", pid, 1, "verify", None, {})["est_cost_usd"]
            contact_summary = {"email": contact.get("email"), "verification_status": v.get("status"), "verification_score": v.get("score")}

        results.append({
            "domain": d,
            "top_prospect": {
                "name": preview.get("name") or "—",
                "title": preview.get("title") or payload.role_query,
                "linkedin_url": preview.get("linkedin_url"),
                "decision": decision,
                "reason": qual["reason"],
                **contact_summary,
                "cost_usd": round(total_cost / max(1, len(results) + 1), 2),
            }
        })

    telemetry = {"counts": {"domains": len(domains), "prospects": len(results)}, "avg_cost_per_qualified": round(total_cost / max(1, len([r for r in results if r["top_prospect"]["decision"] == "yes"])), 4) if results else 0.0}
    return {"ok": True, "summary": telemetry, "results": results}


@router.get("/prospects")
def list_prospects(decision: Optional[str] = None, verification_status: Optional[str] = None, domain: Optional[str] = None) -> Dict[str, Any]:
    # Stub dataset for UI wiring
    rows = [
        {"domain": "acme.com", "name": "Alex Doe", "title": "CEO", "linkedin_url": "https://linkedin.com/in/alex-doe", "decision": "yes", "reason": "Founder/CEO", "email": "alex@acme.com", "verification_status": "valid", "verification_score": 95, "cost_usd": 0.07},
        {"domain": "globex.com", "name": "Jamie Roe", "title": "Head of Talent", "linkedin_url": "https://linkedin.com/in/jamie-roe", "decision": "maybe", "reason": "Influencer", "email": None, "verification_status": "unknown", "verification_score": None, "cost_usd": 0.03},
    ]
    def ok(r: Dict[str, Any]) -> bool:
        if decision and r.get("decision") != decision:
            return False
        if verification_status and r.get("verification_status") != verification_status:
            return False
        if domain and domain not in r.get("domain", ""):
            return False
        return True
    filtered = [r for r in rows if ok(r)]
    return {"prospects": filtered, "count": len(filtered)}


