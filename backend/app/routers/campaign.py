from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import csv
import io
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
            {"user_id": user_id, "name": name, "status": status, "meta": meta},
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
            {"id": cid, "user_id": user_id, "name": name, "status": status, "meta": meta},
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
        "context": pick("context") or {},
        "emails": pick("emails") or {},
        "state": pick("state") or {},
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
            {"emails": existing, "rid": rid, "cid": cid, "user_id": user_id},
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
                "recruiter": "Ultra concise, logistics-forward, easy yes/no.",
                "manager": "Competent + collaborative, emphasizes team impact.",
                "exec": "Outcome/ROI + risk reduction, strategic framing.",
                "developer": "Technical specificity, concrete implementation details, no fluff.",
                "sales": "Crisp proof points, clear next step, confident but not pushy.",
                "startup": "High-ownership, fast-moving, momentum and iteration.",
                "enterprise": "Process-aware, risk-aware, stakeholders + delivery predictability.",
            }.get(t, "")

            hail = {
                "hilarious": "Funny and memorable, but still respectful and professional; no sarcasm that reads hostile.",
                "silly": "Playful and light; no cringe; keep it short and kind.",
                "wacky": "Unexpected and quirky, but still professional; do NOT be random; keep it tied to the role.",
                "alarmist": "Urgent framing without fear-mongering; no threats; no manipulation; keep it ethical.",
                "flirty": "Warm and charming, but NEVER sexual or suggestive; keep it workplace-safe; no pet names.",
                "sad": "Vulnerable but confident; no guilt-tripping; no desperation.",
                "ridiculous": "Absurdly playful in a safe way; no profanity; no insults; still about the role.",
            }.get(t, "")

            guard = "Hard safety: do not be inappropriate, sexual, hostile, or manipulative. No guilt trips."
            parts = [p for p in [base, hail, guard] if p]
            return " ".join(parts).strip()

        special = str(payload.special_instructions or "").strip()
        ctx = payload.context or {}

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

        # For the LLM path, compact the context to avoid huge payloads.
        llm_ctx = _compact_context(ctx)

        # Deterministic fallback: decent but basic.
        def _fallback() -> tuple[str, str]:
            contact = ctx.get("contact") if isinstance(ctx, dict) else {}
            job = ctx.get("selected_job_description") if isinstance(ctx, dict) else {}
            links = ctx.get("links") if isinstance(ctx, dict) else {}

            first = ""
            company_name = ""
            job_title = ""
            try:
                first = str((contact or {}).get("name") or "").strip().split(" ")[0]
            except Exception:
                first = ""
            try:
                company_name = str((contact or {}).get("company") or (ctx.get("company_name") if isinstance(ctx, dict) else "") or "").strip()
            except Exception:
                company_name = ""
            try:
                job_title = str((job or {}).get("title") or (job or {}).get("role") or "").strip()
            except Exception:
                job_title = ""

            greet_name = first or "there"
            subj = f"Quick follow-up on {job_title or 'the role'}"
            if step == 1:
                subj = f"{job_title or 'Role'} at {company_name or 'your team'} - quick idea"
            elif step == 2:
                subj = f"Re: {job_title or 'the role'} @ {company_name or 'your team'}"
            elif step == 3:
                subj = f"One more idea for {company_name or 'your team'}"
            elif step == 4:
                subj = "Closing the loop?"

            body_bits: List[str] = [f"Hi {greet_name},\n\n"]
            if step == 1:
                body_bits.append(f"Saw the {job_title or 'role'} at {company_name or 'your team'} and wanted to share one quick idea.\n\n")
                body_bits.append("- One idea I’d bring: (add your offer snippet)\n")
                body_bits.append("- Relevant proof: (add one proof point)\n\n")
                body_bits.append("Open to a quick 10-15 minute chat?\n\n")
            elif step == 2:
                body_bits.append(f"Quick follow-up - is there a better person to route this to for the {job_title or 'role'}?\n\n")
                body_bits.append("If helpful, I can share a short 2-3 bullet plan.\n\n")
            elif step == 3:
                body_bits.append("Following up once more - I can tailor a quick plan to your top priority.\n\n")
                body_bits.append("Want me to send a short 3-bullet plan?\n\n")
            else:
                body_bits.append("Last note from me. If this isn’t a fit, no worries - just reply “no” and I’ll close the loop.\n\n")
                body_bits.append("If you are the right person, is it worth a quick chat?\n\n")

            # Optional: include bio/work links if provided in context
            bio = str(((links or {}).get("bio_page_url")) or "").strip()
            work = str(((links or {}).get("work_link")) or "").strip()
            if bio:
                body_bits.append(f"Bio: {bio}\n")
            if work:
                body_bits.append(f"Work: {work}\n")
            body = _append_signature("".join(body_bits))
            return subj, body

        # LLM generation if available; else fallback.
        if not client.should_use_real_llm:
            subj, body = _fallback()
            return CampaignGenerateStepResponse(
                success=True,
                message="Generated (deterministic fallback)",
                subject=_normalize_message_text(_no_em_dashes(subj)),
                body=_normalize_message_text(_no_em_dashes(body)),
                helper={"used_llm": False},
            )

        # Step-specific intent to reduce generic output.
        step_intent = {
            1: "Primary cold email. Strong opener + one clear idea + one proof + simple CTA.",
            2: "Short follow-up. Add one new helpful detail, do not repeat the whole pitch.",
            3: "Different angle. Offer a tiny 2-3 bullet plan or alternate proof. Keep it warm and specific.",
            4: "Breakup / last follow-up. Respectful, easy out, easy yes. Can be playful but workplace-safe.",
        }.get(step, "Email step")

        # Expand "custom" tone into concrete instructions for the model.
        tone_line = f"Tone: {tone}."
        if tone == "custom" and custom_tone:
            # Keep this workplace-safe even if the user experiments (e.g., "wacky clown on drugs").
            # We treat custom_tone as *style direction*, not permission to be inappropriate.
            tone_line = (
                "Tone: custom.\n"
                f"Custom tone description (style-only, workplace-safe): {custom_tone}\n"
                "Important: Do not mention drugs/alcohol/explicit content. Keep it professional and kind."
            )

        system = (
            "You are RoleFerry's outreach copilot. Draft ONE email step in a 4-email sequence.\n\n"
            "Hard style constraints:\n"
            "- Do NOT use em dashes or en dashes. Use commas, parentheses, or simple hyphens.\n"
            "- Hard ban: no canned openers like 'I hope you're doing well'.\n"
            "- After any greeting, the next sentence must be value-first (offer/painpoint/proof/ask).\n"
            "- Keep it plain-language and specific.\n"
            "- Avoid startup jargon (e.g., 'ship outcomes', 'drive impact', 'move the needle'). Prefer human phrasing.\n"
            "- Voice must be first-person singular for an individual job seeker: use I/me/my, not we/us/our.\n"
            "- Use real names/companies ONLY if provided in the context JSON. Do not invent.\n"
            "- Do NOT output template placeholders like {{first_name}}.\n\n"
            f"Sequence step: {step} of 4.\n"
            f"Step intent: {step_intent}\n\n"
            f"{tone_line}\n"
            f"Tone guardrails: {_tone_guardrails(tone)}\n\n"
            "Personalization rules:\n"
            "- If context contains offer (value prop), use its one-liner and 1 proof point to avoid generic claims.\n"
            "- If context contains company_research or contact_research, reference at least ONE concrete, non-creepy detail from it.\n"
            "- If no research is present, reference the role and one pain point (from painpoint_matches or gap_analysis or job text).\n"
            "- Use at most 1-2 research details total (avoid overstuffing).\n"
            "- Do not mention that you used AI or 'research'.\n\n"
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
            max_tokens=700,
            stub_json={"subject": _fallback()[0], "body": _fallback()[1], "rationale": "fallback"},
        )

        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or {}
        subject = str(data.get("subject") or "").strip() or _fallback()[0]
        body = str(data.get("body") or "").strip() or _fallback()[1]

        # Enforce quality rules even if the model drifts.
        # IMPORTANT: Never return an email that is only a signature block.
        body_core = _strip_existing_signature(_strip_fluff_openers(body)).strip()
        if len(body_core) < 40:
            # Model likely returned only a closing/signature (or we stripped everything).
            # Fall back to a deterministic, non-empty body so the UI always shows an actual email.
            fb_subj, fb_body = _fallback()
            if not subject:
                subject = fb_subj
            # _fallback() already includes signature; strip it back to core then append canonical signature below.
            body_core = _strip_existing_signature(_strip_fluff_openers(fb_body)).strip()

        body = _append_signature(body_core)
        body = _no_em_dashes(body)
        subject = _no_em_dashes(subject)
        body = _normalize_message_text(body)
        subject = _normalize_message_text(subject)

        # Basic sanity: avoid accidental over-long subjects.
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
