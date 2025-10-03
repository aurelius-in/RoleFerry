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
    temperature: float = 0.2


@router.post("/lead-domains/import-csv")
async def import_csv(payload: DomainsCSVImportRequest) -> Dict[str, Any]:
    # Stub: accept CSV and return count; actual DB insert will be added later
    if not payload.csv_text.strip():
        raise HTTPException(status_code=422, detail="CSV text is empty")
    lines = [l.strip() for l in payload.csv_text.splitlines() if l.strip()]
    header = lines[0].lower().split(",") if lines else []
    if "domain" not in header:
        raise HTTPException(status_code=422, detail="CSV must include 'domain' column")
    domains: List[str] = []
    for row in lines[1:]:
        parts = [c.strip() for c in row.split(",")]
        try:
            idx = header.index("domain")
        except ValueError:
            idx = 0
        if idx < len(parts):
            domains.append(parts[idx])
    # Persist
    repo = LeadsRepo(get_engine())
    inserted = 0
    for d in domains:
        await repo.upsert_domain(d, source="csv")
        inserted += 1
    return {"inserted": inserted, "source": "csv", "domains": domains[:10]}


@router.post("/lead-domains/import-sheets")
async def import_sheets(payload: DomainsSheetsImportRequest) -> Dict[str, Any]:
    # Stub: verify config presence in non-mock mode
    if not settings.mock_mode and not (settings.gsheet_service_json_path and (payload.sheet_id or settings.gsheet_sheet_id)):
        raise HTTPException(status_code=422, detail="Google Sheets not configured; enable mock mode or provide credentials")
    # Real pull if configured, else mock sample
    domains: List[str] = []
    if settings.gsheet_service_json_path and (payload.sheet_id or settings.gsheet_sheet_id):
        try:
            import gspread
            from google.oauth2.service_account import Credentials
            creds = Credentials.from_service_account_file(settings.gsheet_service_json_path, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
            gc = gspread.authorize(creds)
            sh = gc.open_by_key(payload.sheet_id or settings.gsheet_sheet_id)
            ws = sh.sheet1
            values = ws.col_values(1)
            for v in values:
                v = (v or "").strip()
                if v and v.lower() != "domain":
                    domains.append(v)
        except Exception:
            domains = ["acme.com", "globex.com", "initech.com"]
    else:
        domains = ["acme.com", "globex.com", "initech.com"]
    repo = LeadsRepo(get_engine())
    for d in domains:
        await repo.upsert_domain(d, source="sheets")
    return {"inserted": len(domains), "source": "sheets", "domains": domains[:10]}


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
    telemetry = {"steps": {"serper": {"count": 0}, "gpt": {"count": 0}, "findymail": {"count": 0}, "neverbounce": {"count": 0}}, "failures": 0}

    for d in domains:
        domain_id = await repo.upsert_domain(d, source="api")
        # Serper step
        try:
            hits = search_linkedin(d, payload.role_query)
        except Exception:
            telemetry["failures"] += 1
            hits = []
        cost = cost_record("serper", None, 1, "request", None, {"domain": d})
        total_cost += cost["est_cost_usd"]
        await repo.add_cost(locals().get("pid"), "serper", cost["units"], cost["unit_type"], cost["est_cost_usd"], cost["meta"]) if locals().get("pid") else None
        telemetry["steps"]["serper"]["count"] += 1

        top = hits[0] if hits else {"title": payload.role_query, "url": f"https://www.linkedin.com/search/results/people/?keywords={d}", "snippet": ""}
        preview = {"name": top.get("title", ""), "title": top.get("title", ""), "linkedin_url": top.get("url", ""), "company": d}
        pid = await repo.create_prospect(domain_id, preview)

        # Qualifier
        try:
            qual = qualify_prospect(preview, temperature=payload.temperature)
        except Exception:
            telemetry["failures"] += 1
            qual = {"decision": "maybe", "reason": "Qualifier error", "model": "stub", "latency_ms": 0}
        await repo.add_qualification(pid, qual["decision"], qual["reason"], qual["model"], int(qual["latency_ms"]))
        gpt_cost = cost_record("gpt", pid, 1, "token", 0.003, {"model": qual["model"]})
        total_cost += gpt_cost["est_cost_usd"]
        await repo.add_cost(pid, "gpt", gpt_cost["units"], gpt_cost["unit_type"], gpt_cost["est_cost_usd"], gpt_cost["meta"])
        telemetry["steps"]["gpt"]["count"] += 1

        decision = qual["decision"]
        contact_summary: Dict[str, Any] = {"email": None, "verification_status": None, "verification_score": None}
        if decision == "yes":
            # Enrich
            try:
                contact = enrich_contact(preview.get("name") or "Contact", d)
            except Exception:
                telemetry["failures"] += 1
                contact = {"email": None, "phone": None}
            cid = await repo.add_contact(pid, contact.get("email"), contact.get("phone"), provider="findymail")
            fm_cost = cost_record("findymail", pid, 1, "lookup", None, {})
            total_cost += fm_cost["est_cost_usd"]
            await repo.add_cost(pid, "findymail", fm_cost["units"], fm_cost["unit_type"], fm_cost["est_cost_usd"], fm_cost["meta"])
            telemetry["steps"]["findymail"]["count"] += 1
            # Verify
            try:
                v = verify_email(contact.get("email")) if contact.get("email") else {"status": "unknown", "score": None}
            except Exception:
                telemetry["failures"] += 1
                v = {"status": "unknown", "score": None}
            await repo.update_contact_verification(cid, v.get("status", "unknown"), v.get("score"), "neverbounce")
            nb_cost = cost_record("neverbounce", pid, 1, "verify", None, {})
            total_cost += nb_cost["est_cost_usd"]
            await repo.add_cost(pid, "neverbounce", nb_cost["units"], nb_cost["unit_type"], nb_cost["est_cost_usd"], nb_cost["meta"])
            telemetry["steps"]["neverbounce"]["count"] += 1
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

    summary = {
        "counts": {"domains": len(domains), "prospects": len(results)},
        "steps": telemetry["steps"],
        "avg_cost_per_qualified": round(total_cost / max(1, len([r for r in results if r["top_prospect"]["decision"] == "yes"])), 4) if results else 0.0,
        "total_cost": round(total_cost, 4),
    }
    return {"ok": True, "summary": summary, "results": results}


@router.get("/prospects")
async def list_prospects(decision: Optional[str] = None, verification_status: Optional[str] = None, domain: Optional[str] = None) -> Dict[str, Any]:
    # Query view
    from sqlalchemy import text
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


