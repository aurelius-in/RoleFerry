from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from ..config import settings


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
def run_pipeline(payload: PipelineRunRequest) -> Dict[str, Any]:
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

    # Deterministic stubbed response
    domains = list(dict.fromkeys([d.strip().lower() for d in payload.domains if d.strip()]))[:10]
    prospects = []
    for d in domains:
        prospects.append({
            "domain": d,
            "top_prospect": {
                "name": "Jordan Example",
                "title": "CEO",
                "linkedin_url": f"https://www.linkedin.com/in/{d.replace('.', '-')}-ceo",
                "decision": "yes",
                "reason": f"Likely decision maker for {payload.role_query}",
                "email": f"jordan@example.{d.split('.')[-1]}",
                "verification_status": "valid",
                "verification_score": 90,
                "cost_usd": 0.06,
            }
        })
    telemetry = {"counts": {"domains": len(domains), "prospects": len(prospects)}, "avg_cost_per_qualified": 0.06}
    return {"ok": True, "summary": telemetry, "results": prospects}


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


