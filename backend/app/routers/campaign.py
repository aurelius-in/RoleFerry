from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import csv
import io
import json
import re
import html

from ..auth import get_current_user_optional
from ..clients.openai_client import get_openai_client, extract_json_from_text, _strip_fluff_openers
from ..config import settings
from ..clients.instantly import InstantlyClient
from ..db import get_engine
from ..storage import store
from sqlalchemy import text as sql_text


engine = get_engine()


class CampaignExportRequest(BaseModel):
    contacts: List[dict]


class CampaignPushRequest(BaseModel):
    list_name: Optional[str] = None
    contacts: List[dict]

class SenderProfile(BaseModel):
    full_name: str = ""
    phone: str = ""
    linkedin_url: str = ""
    email: str = ""


class CampaignGenerateStepRequest(BaseModel):
    # Which email in the sequence is being generated (1..4)
    step_number: int
    # Tone per email (includes hail-mary tones for step 4)
    tone: str
    custom_tone: Optional[str] = None
    # Hidden accordion text (user-editable); treated as instructions the model must follow.
    special_instructions: Optional[str] = None
    # 10-layer context toggles (frontend-defined). Backend treats this as a hint; frontend should also filter payload.
    enabled_context_layers: Optional[Dict[str, bool]] = None
    # The structured context payload for THIS contact, already filtered to enabled layers.
    context: Dict[str, Any]
    # Signature line preferences (name is always included; other lines optional).
    signature_prefs: Optional[Dict[str, Any]] = None
    # Optional sender profile if user isn't logged in (demo/non-auth flow).
    sender_profile: Optional[SenderProfile] = None


class CampaignGenerateStepResponse(BaseModel):
    success: bool
    message: str
    subject: str
    body: str
    helper: Optional[Dict[str, Any]] = None


router = APIRouter()


@router.post("/export")
def export_csv(payload: CampaignExportRequest):
    # V1 CSV columns per spec
    fieldnames = [
        "email",
        "first_name",
        "last_name",
        "company",
        "title",
        "jd_link",
        "portfolio_url",
        "match_score",
        "verification_status",
        "verification_score",
        "subject",
        "message",
    ]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for idx, row in enumerate(payload.contacts):
        missing = [k for k in fieldnames if k not in row]
        if missing:
            raise HTTPException(status_code=400, detail={"row": idx, "missing": missing})
        writer.writerow({k: row.get(k, "") for k in fieldnames})
    csv_content = buffer.getvalue()
    return {"filename": "instantly.csv", "content": csv_content}


@router.get("")
def list_campaign_rows():
    return {"rows": store.list_sequence_rows()}


@router.get("/runs")
def list_runs():
    return {"runs": store.list_sequence_runs()}


@router.get("/instantly-campaigns")
def list_instantly_campaigns(status: str | None = None, variant: str | None = None, min_list: int | None = None):
    items = store.list_campaigns()
    if status:
        items = [c for c in items if (c.get("status") or "").lower() == status.lower()]
    if variant:
        items = [c for c in items if (c.get("variant") or "").lower() == variant.lower()]
    if min_list is not None:
        items = [c for c in items if int(c.get("list_size") or 0) >= int(min_list)]
    return {"campaigns": items}


class PersistedCampaignCreateRequest(BaseModel):
    name: str = ""
    status: str = "draft"
    meta: Dict[str, Any] = {}


class PersistedCampaignUpdateRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class PersistedCampaignRowUpsertRequest(BaseModel):
    rows: List[Dict[str, Any]]


def _resolve_user_id(user: Any) -> str:
    """
    Campaign persistence supports both authenticated and demo/anon sessions.
    """
    try:
        uid = str(getattr(user, "id", "") or "").strip()
        return uid or "anon"
    except Exception:
        return "anon"


@router.get("/campaigns")
async def list_persisted_campaigns(http_request: Request):
    """
    List persisted campaigns for the current user (Postgres).
    """
    user_id = _resolve_user_id(await get_current_user_optional(http_request))
    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                SELECT id::text, user_id, name, status, meta, created_at, updated_at
                FROM campaign
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT 50
                """
            ),
            {"user_id": user_id},
        )
        items = [dict(r._mapping) for r in res.fetchall()]
        return {"campaigns": items}


@router.post("/campaigns")
async def create_persisted_campaign(payload: PersistedCampaignCreateRequest, http_request: Request):
    user_id = _resolve_user_id(await get_current_user_optional(http_request))
    name = str(payload.name or "").strip()
    status = str(payload.status or "draft").strip() or "draft"
    meta = payload.meta or {}
    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                INSERT INTO campaign (user_id, name, status, meta)
                VALUES (:user_id, :name, :status, :meta)
                RETURNING id::text, user_id, name, status, meta, created_at, updated_at
                """
            ),
            {"user_id": user_id, "name": name, "status": status, "meta": json.dumps(meta)},
        )
        row = res.first()
        return {"campaign": dict(row._mapping) if row else None}


@router.patch("/campaigns/{campaign_id}")
async def update_persisted_campaign(campaign_id: str, payload: PersistedCampaignUpdateRequest, http_request: Request):
    user_id = _resolve_user_id(await get_current_user_optional(http_request))
    cid = str(campaign_id or "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="campaign_id is required")
    name = payload.name
    status = payload.status
    meta = payload.meta
    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                UPDATE campaign
                SET
                  name = COALESCE(:name, name),
                  status = COALESCE(:status, status),
                  meta = COALESCE(:meta, meta),
                  updated_at = now()
                WHERE id = :id::uuid AND user_id = :user_id
                RETURNING id::text, user_id, name, status, meta, created_at, updated_at
                """
            ),
            {"id": cid, "user_id": user_id, "name": name, "status": status, "meta": json.dumps(meta) if meta is not None else None},
        )
        row = res.first()
        if not row:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return {"campaign": dict(row._mapping)}


@router.get("/campaigns/{campaign_id}")
async def get_persisted_campaign(campaign_id: str, http_request: Request):
    user_id = _resolve_user_id(await get_current_user_optional(http_request))
    cid = str(campaign_id or "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="campaign_id is required")
    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                SELECT id::text, user_id, name, status, meta, created_at, updated_at
                FROM campaign
                WHERE id = :id::uuid AND user_id = :user_id
                LIMIT 1
                """
            ),
            {"id": cid, "user_id": user_id},
        )
        camp = res.first()
        if not camp:
            raise HTTPException(status_code=404, detail="Campaign not found")
        res_rows = await conn.execute(
            sql_text(
                """
                SELECT
                  id::text,
                  campaign_id::text,
                  user_id,
                  email,
                  email_provider,
                  lead_status,
                  first_name,
                  last_name,
                  verification_status,
                  interest_status,
                  website,
                  job_title,
                  linkedin,
                  employees,
                  company_name,
                  applied_job_link,
                  applied_job_title,
                  personalized_page,
                  context,
                  emails,
                  state,
                  created_at,
                  updated_at
                FROM campaign_row
                WHERE campaign_id = :id::uuid AND user_id = :user_id
                ORDER BY created_at ASC
                """
            ),
            {"id": cid, "user_id": user_id},
        )
        rows = [dict(r._mapping) for r in res_rows.fetchall()]
        return {"campaign": dict(camp._mapping), "rows": rows}


def _row_params_from_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a generic row dict (frontend payload) into campaign_row columns.
    Accepts both snake_case and common CSV-like key variants.
    """
    def pick(*keys: str) -> Any:
        for k in keys:
            if k in raw:
                return raw.get(k)
        return None

    employees = pick("employees", "Employees")
    try:
        employees_i = int(employees) if employees is not None and str(employees).strip() != "" else None
    except Exception:
        employees_i = None

    return {
        "email": pick("email", "Email"),
        "email_provider": pick("email_provider", "emailProvider", "Email Provider"),
        "lead_status": pick("lead_status", "leadStatus", "Lead Status"),
        "first_name": pick("first_name", "firstName", "First Name"),
        "last_name": pick("last_name", "lastName", "Last Name"),
        "verification_status": pick("verification_status", "verificationStatus", "Verification Status"),
        "interest_status": pick("interest_status", "interestStatus", "Interest Status"),
        "website": pick("website", "Website"),
        "job_title": pick("job_title", "jobTitle", "Job Title"),
        "linkedin": pick("linkedin", "linkedIn", "LinkedIn"),
        "employees": employees_i,
        "company_name": pick("company_name", "companyName", "Company"),
        "applied_job_link": pick("applied_job_link", "appliedJobLink", "Applied Job Link"),
        "applied_job_title": pick("applied_job_title", "appliedJobTitle", "Applied Job Title"),
        "personalized_page": pick("personalized_page", "personalizedPage", "Personalized page", "Personalized Page"),
        "context": json.dumps(pick("context") or {}),
        "emails": json.dumps(pick("emails") or {}),
        "state": json.dumps(pick("state") or {}),
    }


@router.post("/campaigns/{campaign_id}/rows:upsert")
@router.post("/campaigns/{campaign_id}/rows/upsert")
async def upsert_campaign_rows(campaign_id: str, payload: PersistedCampaignRowUpsertRequest, http_request: Request):
    user_id = _resolve_user_id(await get_current_user_optional(http_request))
    cid = str(campaign_id or "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="campaign_id is required")

    rows_in = payload.rows or []
    if not isinstance(rows_in, list):
        raise HTTPException(status_code=400, detail="rows must be a list")

    out_ids: List[str] = []
    async with engine.begin() as conn:
        # Validate campaign ownership first
        camp = await conn.execute(
            sql_text("SELECT 1 FROM campaign WHERE id = :id::uuid AND user_id = :user_id LIMIT 1"),
            {"id": cid, "user_id": user_id},
        )
        if not camp.first():
            raise HTTPException(status_code=404, detail="Campaign not found")

        for r in rows_in:
            raw = r if isinstance(r, dict) else {}
            rid = str(raw.get("id") or "").strip()
            params = _row_params_from_dict(raw)
            params_base = {"campaign_id": cid, "user_id": user_id, **params}

            if rid:
                res = await conn.execute(
                    sql_text(
                        """
                        UPDATE campaign_row
                        SET
                          email = :email,
                          email_provider = :email_provider,
                          lead_status = :lead_status,
                          first_name = :first_name,
                          last_name = :last_name,
                          verification_status = :verification_status,
                          interest_status = :interest_status,
                          website = :website,
                          job_title = :job_title,
                          linkedin = :linkedin,
                          employees = :employees,
                          company_name = :company_name,
                          applied_job_link = :applied_job_link,
                          applied_job_title = :applied_job_title,
                          personalized_page = :personalized_page,
                          context = :context,
                          emails = :emails,
                          state = :state,
                          updated_at = now()
                        WHERE id = :id::uuid AND campaign_id = :campaign_id::uuid AND user_id = :user_id
                        RETURNING id::text
                        """
                    ),
                    {"id": rid, **params_base},
                )
                row = res.first()
                if row:
                    out_ids.append(str(row[0]))
                    continue

            # Insert new row (or if update didn't match)
            res2 = await conn.execute(
                sql_text(
                    """
                    INSERT INTO campaign_row (
                      campaign_id,
                      user_id,
                      email,
                      email_provider,
                      lead_status,
                      first_name,
                      last_name,
                      verification_status,
                      interest_status,
                      website,
                      job_title,
                      linkedin,
                      employees,
                      company_name,
                      applied_job_link,
                      applied_job_title,
                      personalized_page,
                      context,
                      emails,
                      state
                    )
                    VALUES (
                      :campaign_id::uuid,
                      :user_id,
                      :email,
                      :email_provider,
                      :lead_status,
                      :first_name,
                      :last_name,
                      :verification_status,
                      :interest_status,
                      :website,
                      :job_title,
                      :linkedin,
                      :employees,
                      :company_name,
                      :applied_job_link,
                      :applied_job_title,
                      :personalized_page,
                      :context,
                      :emails,
                      :state
                    )
                    RETURNING id::text
                    """
                ),
                params_base,
            )
            row2 = res2.first()
            if row2:
                out_ids.append(str(row2[0]))

    return {"row_ids": out_ids}


@router.get("/campaigns/{campaign_id}/export.csv")
async def export_campaign_csv(campaign_id: str, http_request: Request):
    """
    Export persisted campaign rows as a CSV shaped like example_campaign_spreadsheet.csv
    (plus the ability to expand later).
    """
    user_id = _resolve_user_id(await get_current_user_optional(http_request))
    cid = str(campaign_id or "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="campaign_id is required")

    async with engine.begin() as conn:
        res = await conn.execute(
            sql_text(
                """
                SELECT
                  email,
                  email_provider,
                  lead_status,
                  first_name,
                  last_name,
                  verification_status,
                  interest_status,
                  website,
                  job_title,
                  linkedin,
                  employees,
                  company_name,
                  applied_job_link,
                  applied_job_title,
                  personalized_page
                FROM campaign_row
                WHERE campaign_id = :id::uuid AND user_id = :user_id
                ORDER BY created_at ASC
                """
            ),
            {"id": cid, "user_id": user_id},
        )
        rows = [dict(r._mapping) for r in res.fetchall()]

    # Match the example spreadsheet header naming/casing closely.
    fieldnames = [
        "Email",
        "Email Provider",
        "Lead Status",
        "First Name",
        "Last Name",
        "Verification Status",
        "Interest Status",
        "website",
        "jobTitle",
        "linkedIn",
        "Employees",
        "companyName",
        "Applied Job Link",
        "Applied Job Title",
        "Personalized page",
    ]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(
            {
                "Email": r.get("email") or "",
                "Email Provider": r.get("email_provider") or "",
                "Lead Status": r.get("lead_status") or "",
                "First Name": r.get("first_name") or "",
                "Last Name": r.get("last_name") or "",
                "Verification Status": r.get("verification_status") or "",
                "Interest Status": r.get("interest_status") or "",
                "website": r.get("website") or "",
                "jobTitle": r.get("job_title") or "",
                "linkedIn": r.get("linkedin") or "",
                "Employees": r.get("employees") or "",
                "companyName": r.get("company_name") or "",
                "Applied Job Link": r.get("applied_job_link") or "",
                "Applied Job Title": r.get("applied_job_title") or "",
                "Personalized page": r.get("personalized_page") or "",
            }
        )
    return {"filename": f"campaign_{cid}.csv", "content": buffer.getvalue()}


class CampaignRowGenerateEmailRequest(CampaignGenerateStepRequest):
    """
    Same shape as /campaign/generate-step, but persists results to campaign_row.emails.
    """
    pass


@router.post("/campaigns/{campaign_id}/rows/{row_id}/generate-email", response_model=CampaignGenerateStepResponse)
async def generate_email_for_campaign_row(
    campaign_id: str,
    row_id: str,
    payload: CampaignRowGenerateEmailRequest,
    http_request: Request,
):
    user_id = _resolve_user_id(await get_current_user_optional(http_request))
    cid = str(campaign_id or "").strip()
    rid = str(row_id or "").strip()
    if not cid or not rid:
        raise HTTPException(status_code=400, detail="campaign_id and row_id are required")

    # Generate using the existing logic
    result = await generate_campaign_step(payload, http_request)

    # Persist into campaign_row.emails JSONB as emails.email_{n} = {...}
    step_n = int(payload.step_number or 0)
    if step_n < 1 or step_n > 4:
        return result  # already validated by generate_campaign_step, but keep safe

    entry = {
        "email_number": step_n,
        "subject": result.subject,
        "body": result.body,
        "tone": str(payload.tone or ""),
        "custom_tone": str(payload.custom_tone or ""),
        "special_instructions": str(payload.special_instructions or ""),
        "generated_at": None,  # server time is implicit via updated_at; keep placeholder for later
    }

    async with engine.begin() as conn:
        # Ensure ownership
        res = await conn.execute(
            sql_text(
                """
                SELECT emails
                FROM campaign_row
                WHERE id = :rid::uuid AND campaign_id = :cid::uuid AND user_id = :user_id
                LIMIT 1
                """
            ),
            {"rid": rid, "cid": cid, "user_id": user_id},
        )
        row = res.first()
        if not row:
            raise HTTPException(status_code=404, detail="Campaign row not found")
        existing = row[0] if row[0] is not None else {}
        if not isinstance(existing, dict):
            existing = {}
        existing.setdefault("emails", {})
        if not isinstance(existing.get("emails"), dict):
            existing["emails"] = {}
        existing["emails"][f"email_{step_n}"] = entry

        await conn.execute(
            sql_text(
                """
                UPDATE campaign_row
                SET emails = :emails, updated_at = now()
                WHERE id = :rid::uuid AND campaign_id = :cid::uuid AND user_id = :user_id
                """
            ),
            {"emails": json.dumps(existing), "rid": rid, "cid": cid, "user_id": user_id},
        )

    return result


@router.post("/push")
async def push_to_instantly(payload: CampaignPushRequest):
    list_name = payload.list_name or "RoleFerry Run"
    if settings.instantly_enabled:
        client = InstantlyClient(settings.instantly_api_key or "")
        result = await client.push_contacts(list_name, payload.contacts)
        store.add_audit(None, "instantly_push", {"list_name": list_name, "count": len(payload.contacts), "result": result})
        # Store minimal message data for analytics
        for c in payload.contacts:
            store.messages.append({
                "id": c.get("email"),
                "opened": False,
                "replied": False,
                "label": None,
                "variant": c.get("variant") or "",
            })
        return result
    store.add_audit(None, "instantly_push_csv", {"list_name": list_name, "count": len(payload.contacts)})
    return {"status": "fallback_csv", "list_name": list_name}


@router.post("/generate-step", response_model=CampaignGenerateStepResponse)
async def generate_campaign_step(payload: CampaignGenerateStepRequest, http_request: Request):
    """
    Generate a single email step for the Campaign sequence.

    This replaces the old Compose dependency: Campaign is now the main composer.
    """
    try:
        step = int(payload.step_number or 0)
        if step < 1 or step > 4:
            raise HTTPException(status_code=400, detail="step_number must be 1..4")

        tone = str(payload.tone or "").strip().lower()
        custom_tone = str(payload.custom_tone or "").strip()
        if tone == "custom" and not custom_tone:
            raise HTTPException(status_code=400, detail="custom_tone is required when tone=custom")

        # Prefer authenticated user profile for signature; fall back to caller-provided sender_profile.
        user = await get_current_user_optional(http_request)
        sender = payload.sender_profile or SenderProfile()
        if user:
            sender = SenderProfile(
                full_name=str(getattr(user, "full_name", "") or "").strip(),
                phone=str(getattr(user, "phone", "") or "").strip(),
                linkedin_url=str(getattr(user, "linkedin_url", "") or "").strip(),
                email=str(getattr(user, "email", "") or "").strip(),
            )

        def _sig_bool(key: str, default: bool = True) -> bool:
            try:
                prefs = payload.signature_prefs or {}
                v = prefs.get(key)
                if v is None:
                    return bool(default)
                return bool(v)
            except Exception:
                return bool(default)

        def _sig_str(key: str) -> str:
            try:
                prefs = payload.signature_prefs or {}
                return str(prefs.get(key) or "").strip()
            except Exception:
                return ""

        def _signature_block(bio_url: str = "") -> str:
            # Name is always included.
            lines = [sender.full_name]
            if _sig_bool("include_phone", True) and sender.phone:
                lines.append(sender.phone)
            if _sig_bool("include_email", True) and sender.email:
                lines.append(sender.email)
            if _sig_bool("include_bio_link", True) and bio_url:
                lines.append(bio_url)
            if _sig_bool("include_linkedin", True) and sender.linkedin_url:
                lines.append(sender.linkedin_url)
            other = _sig_str("other_link_url")
            if _sig_bool("include_other_link", False) and other and (other.startswith("http://") or other.startswith("https://")):
                lines.append(other)
            return "\n".join([ln for ln in lines if str(ln).strip()]).strip()

        # Bio URL is optional, and only present if the Campaign context layer "Bio Page" was enabled.
        ctx_for_sig = payload.context or {}
        links_for_sig = ctx_for_sig.get("links") if isinstance(ctx_for_sig, dict) else {}
        bio_for_sig = str(((links_for_sig or {}).get("bio_page_url")) or "").strip()
        signature = _signature_block(bio_for_sig)

        def _append_signature(msg_body: str) -> str:
            s = str(msg_body or "").rstrip()
            if not signature:
                return s
            return (s + "\n\nBest,\n" + signature + "\n").strip() + "\n"

        def _strip_existing_signature(msg_body: str) -> str:
            """
            Prevent duplicate signatures. If the model already wrote a closing/signature,
            strip it and let us append one canonical signature block.

            Conservative rules:
            - Only strip if we see at least one known signature line (name/phone/linkedin/bio)
              near the end, OR a common closing followed by the sender name.
            """
            raw = str(msg_body or "").rstrip()
            if not raw:
                return raw
            sig_lines = [sender.full_name]
            if _sig_bool("include_phone", True) and sender.phone:
                sig_lines.append(sender.phone)
            if _sig_bool("include_email", True) and sender.email:
                sig_lines.append(sender.email)
            if _sig_bool("include_bio_link", True) and bio_for_sig:
                sig_lines.append(bio_for_sig)
            if _sig_bool("include_linkedin", True) and sender.linkedin_url:
                sig_lines.append(sender.linkedin_url)
            other = _sig_str("other_link_url")
            if _sig_bool("include_other_link", False) and other:
                sig_lines.append(other)
            sig_lines = [str(x).strip() for x in sig_lines if str(x).strip()]
            if not sig_lines:
                return raw

            lines = raw.splitlines()
            if not lines:
                return raw

            # Look only at the tail to reduce false positives.
            tail_window = 14
            start = max(0, len(lines) - tail_window)
            tail = lines[start:]
            tail_norm = [str(ln).strip().lower() for ln in tail]
            sig_norm = [s.lower() for s in sig_lines]

            # Find any direct signature line hit in the tail.
            hit_idx = None
            for i, ln in enumerate(tail_norm):
                if not ln:
                    continue
                if any(ln == s for s in sig_norm):
                    hit_idx = i
                    break

            # If no direct hit, allow "closing + name" pattern.
            if hit_idx is None and sender.full_name:
                sender_full = str(sender.full_name or "").strip().lower()
                sender_first = sender_full.split(" ")[0] if sender_full else ""
                closing_tokens = {
                    "best",
                    "best,",
                    "thanks",
                    "thanks,",
                    "thank you",
                    "thank you,",
                    "sincerely",
                    "sincerely,",
                    "regards",
                    "regards,",
                    "cheers",
                    "cheers,",
                }
                # Scan tail for a closing token followed by sender name/first name within 1-3 lines.
                for i, ln in enumerate(tail_norm):
                    if ln in closing_tokens:
                        for j in range(i + 1, min(i + 4, len(tail_norm))):
                            nm = tail_norm[j]
                            if not nm:
                                continue
                            if nm == sender_full or (sender_first and nm == sender_first):
                                hit_idx = i
                                break
                    if hit_idx is not None:
                        break

            if hit_idx is None:
                return raw

            # Back up to include preceding blank line(s).
            cut_tail_idx = hit_idx
            while cut_tail_idx > 0 and tail_norm[cut_tail_idx - 1] == "":
                cut_tail_idx -= 1

            cut_global = start + cut_tail_idx
            kept = lines[:cut_global]
            # Trim trailing blank lines in kept.
            while kept and str(kept[-1]).strip() == "":
                kept.pop()
            return "\n".join(kept).rstrip()

        def _no_em_dashes(s: str) -> str:
            return str(s or "").replace("—", "-").replace("–", "-")

        def _normalize_message_text(s: str) -> str:
            """
            Remove HTML entities/non-breaking spaces so raw markup never leaks
            into user-visible message text.
            """
            t = str(s or "")
            # Handle malformed entity variants first, then unescape standard HTML entities.
            t = re.sub(r"&nbsp;?", " ", t, flags=re.I)
            t = html.unescape(t)
            t = t.replace("\u00A0", " ")
            t = t.replace("\r\n", "\n").replace("\r", "\n")
            t = re.sub(r"[ \t]+\n", "\n", t)
            t = re.sub(r"\n{3,}", "\n\n", t)
            # Strip markdown formatting so final messages are plain text.
            t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)  # headings
            t = re.sub(r"\*\*(.*?)\*\*", r"\1", t, flags=re.S)   # bold **
            t = re.sub(r"__(.*?)__", r"\1", t, flags=re.S)       # bold __
            t = re.sub(r"`([^`]+)`", r"\1", t)                   # inline code
            t = re.sub(r"^\s*[*+-]\s+", "", t, flags=re.M)       # list markers
            t = re.sub(r"(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)", r"\1", t, flags=re.S)  # italic *
            t = re.sub(r"(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)", r"\1", t, flags=re.S)         # italic _
            t = t.replace("*", "")                               # stray stars
            # Job-seeker voice normalization: first-person singular only.
            swaps = [
                (r"\bwe can\b", "I can"),
                (r"\bwe will\b", "I will"),
                (r"\bwe have\b", "I have"),
                (r"\bwe've\b", "I've"),
                (r"\bwe are\b", "I am"),
                (r"\bwe're\b", "I'm"),
                (r"\blet us\b", "let me"),
                (r"\bour team\b", "my background"),
                (r"\bour\b", "my"),
                (r"\bus\b", "me"),
                (r"\bwe\b", "I"),
            ]
            for pat, repl in swaps:
                t = re.sub(pat, repl, t, flags=re.I)
            # Fix common grammar artifacts after pronoun swaps.
            t = re.sub(r"\bI has\b", "I have", t, flags=re.I)
            t = re.sub(r"\bI are\b", "I am", t, flags=re.I)
            t = re.sub(r"\bI do not have\b", "I don't have", t, flags=re.I)
            return t.strip()

        def _tone_guardrails(t: str) -> str:
            """
            Expand tone into explicit guardrails, especially for step 4 hail-mary tones.
            """
            base = {
                "recruiter": "Ultra concise, logistics-forward, easy yes/no. Write like a recruiter who gets 200 emails a day - short, clear, direct. No flowery language.",
                "manager": "Competent and collaborative. Emphasize team impact and leadership. Write like a peer manager sharing how you could strengthen their team.",
                "exec": "Strategic, outcome-focused. Lead with ROI and risk reduction. Write like you are briefing a VP - no filler, every sentence earns its place.",
                "developer": "Technical specificity, concrete implementation details, no fluff. Mention specific technologies, architectures, or methodologies. Write like an engineer talking to another engineer.",
                "sales": "Crisp proof points, clear next step, confident but not pushy. Structure like a short sales note with a clear value proposition.",
                "startup": "High-energy, ownership-oriented, fast-moving. Emphasize shipping speed, iteration, and wearing multiple hats. Write like someone who thrives in ambiguity.",
                "enterprise": "Process-aware, risk-aware. Emphasize stakeholder management, delivery predictability, and compliance. Write like someone who has navigated large-org complexity.",
            }.get(t, "")

            hail = {
                "hilarious": (
                    "Write a GENUINELY FUNNY email. Use wordplay, clever analogies, unexpected comparisons, "
                    "or self-deprecating humor. The reader should actually smile or laugh. Think late-night talk show "
                    "monologue energy applied to a job search. Still professional enough to send, but unmistakably comedic. "
                    "Do NOT write a normal email with one joke - the whole email should be entertaining."
                ),
                "silly": (
                    "Write in a playful, whimsical style. Light-hearted metaphors, fun word choices, maybe a running gag. "
                    "Think of a friendly colleague who always makes meetings fun. No cringe; keep it kind and warm."
                ),
                "wacky": (
                    "Unexpected and quirky. Use surprising metaphors, absurd-but-apt comparisons, unconventional structure. "
                    "The reader should think 'I've never gotten an email like this before.' Still tied to the role and professional."
                ),
                "alarmist": (
                    "Write with dramatic urgency - like a movie trailer narrator. Bold claims, exclamation energy, 'this can't wait' framing. "
                    "Keep it ethical and factual, but make it feel like the most important email they'll read today."
                ),
                "flirty": (
                    "Warm, charming, and confident. Playful compliments about their company or work. Think suave networking, not dating. "
                    "NEVER sexual or suggestive; keep it workplace-safe; no pet names."
                ),
                "sad": (
                    "Write with genuine vulnerability and emotional honesty. Acknowledge the inherent awkwardness of cold outreach. "
                    "Be self-aware and a little melancholy but still hopeful. Think indie movie protagonist energy. "
                    "Not desperate or guilt-tripping - just authentically human and a bit wistful."
                ),
                "ridiculous": (
                    "Go absurdly over the top in a delightful way. Dramatic metaphors, comically formal language for mundane things, "
                    "treat the job application like an epic quest or a nature documentary. Still about the role, but entertainingly unhinged. "
                    "No profanity or insults."
                ),
            }.get(t, "")

            guard = "Hard safety: do not be inappropriate, sexual, hostile, or manipulative. No guilt trips."
            parts = [p for p in [base, hail, guard] if p]
            return " ".join(parts).strip()

        special = str(payload.special_instructions or "").strip()
        ctx = payload.context or {}

        # Sequence-aware CTA strategy from Offer context.
        offer_ctx = ctx.get("offer") if isinstance(ctx, dict) and isinstance(ctx.get("offer"), dict) else {}
        soft_cta = str((offer_ctx or {}).get("soft_cta") or "").strip()
        hard_cta = str((offer_ctx or {}).get("hard_cta") or (offer_ctx or {}).get("default_cta") or "").strip()

        prefer_hard = step == 2
        preferred_cta = hard_cta if prefer_hard else soft_cta
        fallback_cta = soft_cta if prefer_hard else hard_cta
        chosen_cta = str(preferred_cta or fallback_cta or "").strip()

        cta_strategy = {
            "step_number": step,
            "preferred_type": "hard" if prefer_hard else "soft",
            "preferred_cta": preferred_cta,
            "secondary_cta": fallback_cta,
            "chosen_cta": chosen_cta,
        }

        client = get_openai_client()

        def _compact_context(obj: Any, *, max_depth: int = 4, max_list: int = 10, max_str: int = 1800) -> Any:
            """
            Reduce context size deterministically so the model stays focused and we avoid token blowups.
            - Limits recursion depth
            - Caps list sizes
            - Trims long strings
            """
            if max_depth <= 0:
                return None
            if obj is None:
                return None
            if isinstance(obj, (int, float, bool)):
                return obj
            if isinstance(obj, str):
                s = " ".join(obj.split()).strip()
                if len(s) <= max_str:
                    return s
                cut = s.rfind(" ", 0, max_str)
                if cut < 80:
                    cut = max_str
                return s[:cut].rstrip() + "…"
            if isinstance(obj, list):
                out = []
                for it in obj[: max_list]:
                    out.append(_compact_context(it, max_depth=max_depth - 1, max_list=max_list, max_str=max_str))
                return out
            if isinstance(obj, dict):
                out: Dict[str, Any] = {}
                # Keep key order stable (Python 3.7+ preserves insertion order, but we also sort).
                for k in sorted(obj.keys(), key=lambda x: str(x)):
                    kk = str(k)
                    if not kk:
                        continue
                    out[kk] = _compact_context(obj.get(k), max_depth=max_depth - 1, max_list=max_list, max_str=max_str)
                return out
            # fallback for other types
            return str(obj)

        def _as_list(v: Any) -> List[Any]:
            if isinstance(v, list):
                return v
            if v is None:
                return []
            return [v]

        def _short_text(v: Any, max_len: int = 220) -> str:
            s = " ".join(str(v or "").split()).strip()
            if not s:
                return ""
            if len(s) <= max_len:
                return s
            cut = s.rfind(" ", 0, max_len)
            if cut < 40:
                cut = max_len
            return s[:cut].rstrip() + "..."

        def _push_unique(bucket: List[str], value: str, limit: int) -> None:
            s = _short_text(value)
            if not s:
                return
            seen = {x.lower() for x in bucket}
            if s.lower() in seen:
                return
            if len(bucket) < limit:
                bucket.append(s)

        def _build_research_brief(context_obj: Any) -> Dict[str, Any]:
            """
            Build a compact, source-forward brief so email generation can reliably
            use concrete company/contact details without overstuffing.
            """
            if not isinstance(context_obj, dict):
                return {}

            job = context_obj.get("selected_job_description") if isinstance(context_obj.get("selected_job_description"), dict) else {}
            comp = context_obj.get("company_research") if isinstance(context_obj.get("company_research"), dict) else {}
            ctc = context_obj.get("contact_research") if isinstance(context_obj.get("contact_research"), dict) else {}

            role_scope_signals: List[str] = []
            company_signals: List[str] = []
            contact_signals: List[str] = []
            source_urls: List[str] = []

            # Role scope from selected JD.
            role_title = str(job.get("title") or "").strip()
            role_company = str(job.get("company") or context_obj.get("company_name") or "").strip()
            if role_title:
                _push_unique(
                    role_scope_signals,
                    f"Target role: {role_title}" + (f" at {role_company}" if role_company else ""),
                    6,
                )
            for p in _as_list(job.get("pain_points"))[:3]:
                _push_unique(role_scope_signals, f"Role pain point: {p}", 6)
            for s in _as_list(job.get("success_metrics"))[:2]:
                _push_unique(role_scope_signals, f"Role success metric: {s}", 6)
            for s in _as_list(job.get("required_skills"))[:3]:
                _push_unique(role_scope_signals, f"Role required skill: {s}", 6)

            # Company signals from research output.
            theme = str(comp.get("theme") or "").strip()
            if theme and theme.lower() != "no data found":
                first_theme_line = theme.split("\n")[0].strip()
                _push_unique(company_signals, f"Company theme signal: {first_theme_line}", 7)

            for k, label in [
                ("company_market_position", "Market position"),
                ("company_product_launches", "Products/launches"),
                ("company_other_hiring_signals", "Hiring signal"),
                ("company_recent_posts", "Recent post"),
                ("company_publications", "Publication"),
            ]:
                v = str(comp.get(k) or "").strip()
                if v and v.lower() != "no data found":
                    first = v.split("\n")[0].strip()
                    _push_unique(company_signals, f"{label}: {first}", 7)

            for n in _as_list(comp.get("recent_news"))[:4]:
                if not isinstance(n, dict):
                    continue
                title = str(n.get("title") or "").strip()
                summary = _short_text(n.get("summary"), 160)
                source = str(n.get("source") or "").strip()
                url = str(n.get("url") or "").strip()
                line = title
                if source:
                    line = f"{line} ({source})"
                if summary:
                    line = f"{line}: {summary}"
                _push_unique(company_signals, line, 7)
                if url and len(source_urls) < 6 and url not in source_urls:
                    source_urls.append(url)

            # Structured company signals (from PDL/Apollo via company_signals list)
            for sig in _as_list(comp.get("company_signals") or context_obj.get("selected_company_signals"))[:6]:
                if isinstance(sig, dict):
                    label = str(sig.get("label") or "").strip()
                    value = str(sig.get("value") or sig.get("text") or "").strip()
                    if label and value and value.lower() not in ("unknown", "none", "n/a"):
                        _push_unique(company_signals, f"{label}: {value}", 9)
                elif isinstance(sig, str) and sig.strip():
                    _push_unique(company_signals, sig.strip(), 9)

            # Contact signals from contact research + sourced facts.
            contact_bios = _as_list(ctc.get("contact_bios"))
            b0 = contact_bios[0] if contact_bios and isinstance(contact_bios[0], dict) else {}
            outreach_angles: List[str] = []
            urgency_info = ""
            if isinstance(b0, dict):
                for v in _as_list(b0.get("public_profile_highlights"))[:3]:
                    _push_unique(contact_signals, f"Profile highlight: {v}", 8)
                for v in _as_list(b0.get("post_topics"))[:2]:
                    _push_unique(contact_signals, f"Posts about: {v}", 8)
                for f in _as_list(b0.get("interesting_facts"))[:5]:
                    if not isinstance(f, dict):
                        continue
                    fact = str(f.get("fact") or "").strip()
                    src_title = str(f.get("source_title") or "").strip()
                    src_url = str(f.get("source_url") or "").strip()
                    signal_type = str(f.get("signal_type") or "").strip()
                    if fact:
                        prefix = {
                            "web_activity": "Activity",
                            "career_move": "Career move",
                            "company_news": "Company news",
                            "hiring_signal": "Hiring",
                        }.get(signal_type, "Signal")
                        combined = f"{prefix}: {fact}" if not src_title else f"{prefix}: {fact} ({src_title})"
                        _push_unique(contact_signals, combined, 8)
                    if src_url and len(source_urls) < 8 and src_url not in source_urls:
                        source_urls.append(src_url)
                outreach_angles = _as_list(b0.get("outreach_angles"))[:4]
                u_score = int(b0.get("urgency_score") or 0)
                u_reason = str(b0.get("urgency_reason") or "").strip()
                if u_score > 0 and u_reason:
                    urgency_info = f"Urgency: {u_score}/100 - {u_reason}"

            # Also pull from user-selected signals stored in context.
            selected_signals = _as_list(context_obj.get("selected_contact_signals"))
            for sel in selected_signals[:3]:
                if isinstance(sel, dict):
                    t = str(sel.get("text") or "").strip()
                    if t:
                        _push_unique(contact_signals, f"[SELECTED] {t}", 8)
                elif isinstance(sel, str) and sel.strip():
                    _push_unique(contact_signals, f"[SELECTED] {sel.strip()}", 8)

            out: Dict[str, Any] = {
                "role_scope_signals": role_scope_signals,
                "company_signals": company_signals,
                "contact_signals": contact_signals,
                "source_urls": source_urls,
            }
            if outreach_angles:
                out["outreach_angles"] = outreach_angles
            if urgency_info:
                out["urgency_info"] = urgency_info
            has_any = any(bool(out.get(k)) for k in ("role_scope_signals", "company_signals", "contact_signals"))
            return out if has_any else {}

        # Build a compact research brief and include it in LLM context.
        llm_context_obj = dict(ctx) if isinstance(ctx, dict) else {}
        research_brief = _build_research_brief(llm_context_obj)
        if research_brief:
            llm_context_obj["research_brief"] = research_brief
        if chosen_cta:
            llm_context_obj["cta_strategy"] = cta_strategy

        # For the LLM path, compact the context to avoid huge payloads.
        llm_ctx = _compact_context(llm_context_obj)

        # Deterministic fallback: decent but basic.
        def _fallback() -> tuple[str, str]:
            contact = ctx.get("contact") if isinstance(ctx, dict) else {}
            job = ctx.get("selected_job_description") if isinstance(ctx, dict) else {}
            links = ctx.get("links") if isinstance(ctx, dict) else {}

            first = ""
            company_name = ""
            job_title_raw = ""
            try:
                first = str((contact or {}).get("name") or "").strip().split(" ")[0]
            except Exception:
                first = ""
            try:
                company_name = str((contact or {}).get("company") or (ctx.get("company_name") if isinstance(ctx, dict) else "") or "").strip()
            except Exception:
                company_name = ""
            try:
                job_title_raw = str((job or {}).get("title") or (job or {}).get("role") or "").strip()
            except Exception:
                job_title_raw = ""

            def _sentence_title(t: str) -> str:
                """Format a job title for natural sentence use.
                'Director, Software Engineering - Product Platform' -> 'Director of Software Engineering'
                """
                s = str(t or "").strip()
                if not s:
                    return "the role"
                # Drop parenthetical suffixes and dash-separated platform/team qualifiers.
                s = re.sub(r"\s*[-–—]\s+.*$", "", s)
                s = re.sub(r"\s*\(.*?\)\s*$", "", s)
                # "Director, Software Engineering" -> "Director of Software Engineering"
                parts = [p.strip() for p in s.split(",", 1)]
                if len(parts) == 2 and parts[1]:
                    s = f"{parts[0]} of {parts[1]}"
                return s.strip() or "the role"

            job_title = _sentence_title(job_title_raw)
            greet_name = first or "there"

            subj = f"Quick follow-up on {job_title}"
            if step == 1:
                subj = f"{job_title} at {company_name or 'your team'}"
            elif step == 2:
                subj = f"Re: {job_title} at {company_name or 'your team'}"
            elif step == 3:
                subj = f"One more idea for {company_name or 'your team'}"
            elif step == 4:
                subj = "Closing the loop"

            rb = _build_research_brief(ctx)

            def _strip_signal_label(s: str) -> str:
                """Remove internal labels and filter out instruction-like text."""
                t = str(s or "").strip()
                t = re.sub(
                    r"^(Company theme signal|Market position|Products?/launches?|Hiring signal|"
                    r"Recent post|Publication|Role success metric|Role required skill|Role pain point|"
                    r"Profile highlight|Posts about|Interesting fact|Theme|Signal|Activity|"
                    r"Career move|Company news|Hiring|Target role|What the company cares about):\s*",
                    "", t, flags=re.I,
                )
                # Filter out text that looks like LLM instructions or prompt fragments.
                if re.search(r"(Reference a|without claiming|plausible priority|offer a \d)", t, flags=re.I):
                    return ""
                if len(t) > 200:
                    return ""
                return t.strip()

            def _clean_signal(s: str) -> str:
                """Strip labels and validate the signal is usable text."""
                c = _strip_signal_label(s)
                if not c or len(c) < 8:
                    return ""
                # Reject signals that look like placeholders or instructions.
                if any(x in c.lower() for x in ["no data found", "n/a", "placeholder", "example:", "template"]):
                    return ""
                return c

            raw_company_sigs = rb.get("company_signals") or [] if isinstance(rb, dict) else []
            company_sig = ""
            for rs in raw_company_sigs:
                c = _clean_signal(rs)
                if c:
                    company_sig = c
                    break

            cta_line = chosen_cta or "Open to a quick 10-15 minute chat?"

            offer_ctx_fb = ctx.get("offer") if isinstance(ctx, dict) else {}
            one_liner = str((offer_ctx_fb or {}).get("one_liner") or "").strip()
            raw_proof_points = [str(p).strip() for p in _as_list((offer_ctx_fb or {}).get("proof_points"))[:4] if str(p).strip()]

            # Deduplicate proof points: remove points where one is a substring of another.
            deduped_pps: List[str] = []
            for pp in raw_proof_points:
                pp_low = pp.lower()
                is_dup = False
                new_deduped: List[str] = []
                for existing in deduped_pps:
                    ex_low = existing.lower()
                    if pp_low in ex_low:
                        is_dup = True
                        new_deduped.append(existing)
                    elif ex_low in pp_low:
                        # Keep the longer (more detailed) version.
                        new_deduped.append(pp)
                        is_dup = True
                    else:
                        new_deduped.append(existing)
                deduped_pps = new_deduped
                if not is_dup:
                    deduped_pps.append(pp)
            proof_points = deduped_pps[:2]

            # Tone-aware framing for the fallback path.
            tone_label = tone or "recruiter"
            if tone_label == "custom" and custom_tone:
                tone_label = custom_tone.lower()

            def _tone_opener() -> str:
                """Return a tone-appropriate bridge sentence."""
                bridges = {
                    "exec": f"I have been following {company_name or 'the company'}'s trajectory and believe my background could contribute to your goals.",
                    "manager": f"I came across the {job_title} opening and wanted to share some context on how my experience aligns.",
                    "developer": f"I noticed the {job_title} opening and wanted to share a few specifics on my relevant work.",
                    "sales": f"I have a background that maps directly to the challenges facing {company_name or 'your team'}, and I wanted to introduce myself.",
                    "startup": f"I am drawn to what {company_name or 'the team'} is building and think my experience shipping fast could be valuable.",
                    "enterprise": f"I have experience navigating the kind of scale and process rigor that {company_name or 'your team'} demands.",
                }
                return bridges.get(tone_label, f"I came across the {job_title} opening and wanted to introduce myself.")

            body_bits: List[str] = [f"Hi {greet_name},\n\n"]
            if step == 1:
                if company_sig and len(company_sig) > 10:
                    # Use the signal as a natural opener.
                    sig_lower = company_sig[0].lower() + company_sig[1:] if company_sig else ""
                    body_bits.append(f"I noticed {company_name or 'your team'} {sig_lower.rstrip('.')}. ")
                    if one_liner:
                        body_bits.append(f"{one_liner.rstrip('.')}.")
                    if proof_points:
                        body_bits.append(f" For example, I {proof_points[0][0].lower()}{proof_points[0][1:].rstrip('.')}.")
                else:
                    body_bits.append(_tone_opener())
                    if one_liner:
                        body_bits.append(f" {one_liner.rstrip('.')}.")
                body_bits.append(f"\n\n{cta_line}\n\n")
            elif step == 2:
                body_bits.append(f"Just following up on my previous note about the {job_title}. ")
                body_bits.append(f"I am still very interested and would be happy to speak briefly if the role is still open.\n\n")
                body_bits.append(f"{cta_line}\n\n")
            elif step == 3:
                body_bits.append(f"I wanted to share a few highlights from my work that align with what teams typically need in a {job_title}.\n\n")
                if proof_points:
                    for pp in proof_points:
                        clean_pp = pp.rstrip(".")
                        body_bits.append(f"{clean_pp}.\n\n")
                body_bits.append(f"\n{cta_line}\n\n")
            else:
                body_bits.append(f"I realize your time is limited, so this will be my last note. If the role has been filled or I am not the right fit, no worries at all.\n\n")
                body_bits.append(f"{cta_line}\n\n")

            bio = str(((links or {}).get("bio_page_url")) or "").strip()
            work = str(((links or {}).get("work_link")) or "").strip()
            if bio:
                body_bits.append(f"I put together a brief overview of my background here: {bio}\n")
            if work:
                body_bits.append(f"Work samples: {work}\n")
            body = "".join(body_bits).rstrip()
            return subj, body

        # LLM generation if available; else fallback.
        if not client.should_use_real_llm:
            subj, body = _fallback()
            body = _append_signature(body)
            return CampaignGenerateStepResponse(
                success=True,
                message="Generated (deterministic fallback)",
                subject=_normalize_message_text(_no_em_dashes(subj)),
                body=_normalize_message_text(_no_em_dashes(body)),
                helper={"used_llm": False},
            )

        # Step-specific intent -- each email must take a DIFFERENT angle.
        step_intent = {
            1: (
                "Primary cold email. Lead with ONE specific signal about the contact or company "
                "(recent post, career move, company news, hiring signal). Bridge to ONE proof point from "
                "your resume. Simple soft CTA. 4-6 sentences max."
            ),
            2: (
                "Follow-up with a NEW angle. Do NOT repeat step 1. Pick a DIFFERENT signal or pain point. "
                "Share one additional proof point or mini-insight. Keep it under 4 sentences."
            ),
            3: (
                "Value-add email. Offer something useful: a 2-3 bullet mini-plan, a relevant framework, "
                "or a quick-win suggestion tied to a SPECIFIC role challenge. Show you understand their world. "
                "Harder CTA (specific time ask)."
            ),
            4: (
                "Breakup / final message. Gracious, brief, easy out. Acknowledge they're busy. "
                "If there's a referral ask, include it. Can be slightly warmer in tone. 2-3 sentences."
            ),
        }.get(step, "Email step")

        # Expand "custom" tone into concrete instructions for the model.
        _creative_tones = {"hilarious", "silly", "wacky", "alarmist", "flirty", "sad", "ridiculous"}
        if tone in _creative_tones:
            tone_line = f"Tone: {tone}. This is a CREATIVE tone — the email must read dramatically different from a standard professional email. A reader should immediately notice the distinctive style."
        else:
            tone_line = f"Tone: {tone}."
        if tone == "custom" and custom_tone:
            # Keep this workplace-safe even if the user experiments (e.g., "wacky clown on drugs").
            # We treat custom_tone as *style direction*, not permission to be inappropriate.
            tone_line = (
                "Tone: custom.\n"
                f"Custom tone description (style-only, workplace-safe): {custom_tone}\n"
                "Important: Do not mention drugs/alcohol/explicit content. Keep it professional and kind."
            )

        cta_guidance = (
            f"CTA sequence policy: This is email step {step}. "
            + (
                "Use a hard CTA (clear commitment/time ask) for step 2 only."
                if prefer_hard
                else "Use a soft CTA (low-friction, easy reply) for steps 1, 3, and 4."
            )
            + "\n"
            + (f"Preferred CTA from context: {preferred_cta}\n" if preferred_cta else "")
            + (f"Secondary CTA from context: {fallback_cta}\n" if fallback_cta else "")
            + (
                "If one CTA is available, use it once near the end. "
                "Do not include both CTA types in the same email."
            )
        )

        system = (
            "You are RoleFerry's outreach copilot. Draft ONE email step in a 4-email sequence.\n\n"
            "IDEAL MESSAGE STRUCTURE (follow this flow exactly):\n"
            "1. Signal hook: Open with a SPECIFIC signal about the person or their company. This proves you did research.\n"
            "   Good signals: their recent LinkedIn post, a company product launch, a hiring push, a conference talk they gave.\n"
            "   BAD: 'I noticed your company is doing great things' (vague). GOOD: 'I saw your post about scaling the data pipeline team from 3 to 12' (specific).\n"
            "2. Bridge: Connect that signal to YOUR relevant expertise in one sentence.\n"
            "3. Proof: One concrete result (metric, shipped project, measurable outcome).\n"
            "4. CTA: One clear, low-friction ask.\n\n"
            "EXAMPLE of a good Step 1:\n"
            "\"Hi Sarah,\n\n"
            "I saw your recent post about scaling Acme's threat detection team and the challenge "
            "of validating alerts at 3x volume. That's exactly the problem I solved at my current company, "
            "where I built a triage framework that cut false-positive rates by 40%.\n\n"
            "Would you be open to a quick 10-minute chat about how I could help with the Security Engineering Lead role?\n\n"
            "Best,\nJohn\"\n\n"
            "EXAMPLE of a good Step 2 (different angle):\n"
            "\"Hi Sarah,\n\n"
            "Quick follow-up. I noticed Acme just announced the SOC automation roadmap. In my current role, "
            "I led a similar initiative that reduced mean-time-to-respond from 45min to under 8.\n\n"
            "Happy to share specifics if helpful.\n\nJohn\"\n\n"
            "EXAMPLE of a good Step 4 (breakup):\n"
            "\"Hi Sarah,\n\n"
            "This will be my last note. If the timing isn't right or the role's been filled, completely understand. "
            "If there's someone else on your team I should connect with, I'd appreciate an intro.\n\n"
            "Thanks for your time,\nJohn\"\n\n"
            "Hard style constraints:\n"
            "- Do NOT use em dashes or en dashes. Use commas, parentheses, or simple hyphens.\n"
            "- Hard ban: no canned openers like 'I hope you're doing well'.\n"
            "- After any greeting, the next sentence must be value-first (offer/painpoint/proof/ask).\n"
            "- Keep it plain-language and specific.\n"
            "- Avoid startup jargon (e.g., 'ship outcomes', 'drive impact', 'move the needle'). Prefer human phrasing.\n"
            "- Voice must be first-person singular for an individual job seeker: use I/me/my, not we/us/our.\n"
            "- Use real names/companies ONLY if provided in the context JSON. Do not invent.\n"
            "- Do NOT output template placeholders like {{first_name}}.\n"
            "- NEVER include internal signal labels in the email body (e.g., 'Company theme signal:', 'Market position:', 'Profile highlight:', 'Theme:'). These are context for you, not email text.\n"
            "- If a bio_page_url is provided in the links, include it with a brief intro like 'I put together a brief overview of my background here: [url]'. Do NOT just drop the URL without context.\n\n"
            f"Sequence step: {step} of 4.\n"
            f"Step intent: {step_intent}\n\n"
            f"TONE (CRITICAL - this MUST shape every sentence you write):\n"
            f"{tone_line}\n"
            f"{_tone_guardrails(tone)}\n"
            f"The tone is the user's primary style choice. The email must unmistakably reflect it.\n\n"
            f"{cta_guidance}\n\n"
            "Personalization rules (CRITICAL for quality):\n"
            "- The research_brief in context contains categorized signals. USE THEM.\n"
            "- contact_signals marked [SELECTED] are the ones the user specifically chose. Prioritize these.\n"
            "- For step 1: Use 1 contact signal (activity, career move, or post) as your opener hook.\n"
            "- For step 2: Use a DIFFERENT signal than step 1 (company news, product launch, or hiring signal).\n"
            "- For step 3: Connect a role pain point to a specific proof point from the offer/resume.\n"
            "- If research_brief.outreach_angles is provided, use one of them as your approach angle.\n"
            "- If context contains offer (value prop), use its one-liner and 1 proof point.\n"
            "- Prefer details tied to the role scope and public company signals.\n"
            "- Keep contact references light-touch and publicly sourced only.\n"
            "- Do not claim private knowledge, and do not invent facts.\n"
            "- If no research signals exist, reference the role and one pain point from the job posting.\n"
            "- Use at most 2 research details per email (avoid overstuffing).\n"
            "- Do not mention that you used AI or 'research'.\n"
            "- NEVER be generic. Every sentence must contain a specific detail.\n\n"
            "Social appropriateness rules (the 'networking event' standard):\n"
            "- Only reference information that is PUBLIC and would be normal to discuss with a stranger at a professional event.\n"
            "- GOOD to reference: their published articles, blog posts, public talks, company product launches, mergers, news, awards, job title.\n"
            "- DO NOT reference: where they live, personal life details, job tenure/history, salary, how long they've been at the company.\n"
            "- DO NOT say 'I noticed you work at [Company]' — it sounds like surveillance. Instead, reference the company's work or news.\n"
            "- DO NOT open with the contact's name + company in a way that sounds like you're reading from a database.\n"
            "- The email should feel like it was written by someone who knows the industry, not someone who researched this specific person.\n"
            "- If referencing company news, frame it positively — never mention layoffs, bankruptcies, or other negative events.\n\n"
            "CTA output rules:\n"
            "- Include exactly ONE CTA sentence/question near the end.\n"
            "- Steps 1, 3, 4: use the soft CTA (low-friction, easy reply).\n"
            "- Step 2 only: use the hard CTA (clear commitment/specific time ask).\n"
            "- The CTA MUST appear in the email body. Do not omit it.\n\n"
            "Special instructions (must follow):\n"
            + (special if special else "(none)") +
            "\n\n"
            "Return ONLY valid JSON with keys: subject, body, rationale.\n"
        )

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Context JSON:\n{llm_ctx}"},
        ]

        raw = client.run_chat_completion(
            messages,
            temperature=0.35 if step in (1, 2) else (0.45 if step == 3 else 0.55),
            max_tokens=900,
            stub_json={"subject": _fallback()[0], "body": _fallback()[1], "rationale": "fallback"},
        )

        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or {}
        subject = str(data.get("subject") or "").strip() or _fallback()[0]
        body = str(data.get("body") or "").strip() or _fallback()[1]

        body = re.sub(r"(?:Company theme signal|Market position|Products?/launches?|Hiring signal|Recent post|Publication|Profile highlight|Posts about|Interesting fact|Theme|Role pain point|Target role|What the company cares about|Signal|Activity|Career move|Company news):\s*", "", body, flags=re.I)

        # Enforce quality rules even if the model drifts.
        # IMPORTANT: Never return an email that is only a signature block.
        body_core = _strip_existing_signature(_strip_fluff_openers(body)).strip()
        if len(body_core) < 40:
            fb_subj, fb_body = _fallback()
            if not subject:
                subject = fb_subj
            body_core = _strip_existing_signature(_strip_fluff_openers(fb_body)).strip()

        # Deterministic CTA injection: only add if the body has no question/ask near the end.
        _has_cta = False
        if chosen_cta and chosen_cta.lower() in body_core.lower():
            _has_cta = True
        else:
            # Check if the last ~200 chars already contain a question or CTA-like phrase
            tail = body_core[-200:].lower() if len(body_core) > 200 else body_core.lower()
            if "?" in tail or any(k in tail for k in ["worth exploring", "open to", "happy to", "interested in", "let me know", "would you be", "chat", "connect", "conversation", "call", "meet"]):
                _has_cta = True
        if chosen_cta and not _has_cta:
            cta_sentence = chosen_cta.strip()
            if not cta_sentence[-1:] in ".?!":
                cta_sentence += "?"
            body_core = body_core.rstrip() + "\n\n" + cta_sentence

        body = _append_signature(body_core)
        body = _no_em_dashes(body)
        subject = _no_em_dashes(subject)
        body = _normalize_message_text(body)
        subject = _normalize_message_text(subject)

        # Fix duplicate closings like "Best,\n\nBest," or "Best,\nBest,".
        body = re.sub(r"(Best,\s*\n)\s*Best,", r"\1", body, flags=re.I)

        # AI quality filter: polish the final output so nothing awkward reaches the user.
        try:
            polished = client.quality_filter_message(subject, body, cta_text=chosen_cta, step=step)
            subject = polished.get("subject") or subject
            body = polished.get("body") or body
        except Exception:
            pass

        # Final safety: strip duplicate closings that might survive quality filter.
        body = re.sub(r"(Best,\s*\n)\s*Best,", r"\1", body, flags=re.I)
        subject = re.sub(r"\s+", " ", subject).strip()[:140]

        return CampaignGenerateStepResponse(
            success=True,
            message="Generated",
            subject=subject,
            body=body,
            helper={
                "used_llm": True,
                "tone": tone,
                "custom_tone": custom_tone if tone == "custom" else "",
                "rationale": str(data.get("rationale") or "").strip(),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate campaign email: {str(e)}")
