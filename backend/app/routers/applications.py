"""
Applications API - core apply/tracker workflow + cover letter generation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime
import csv
import io
import re
import hashlib
import logging

from ..clients.openai_client import get_openai_client, extract_json_from_text

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store (safe fallback for demo/dev)
applications_db: List[Dict[str, Any]] = []
next_id = 1

ApplyStatus = Literal["queued", "applied", "failed", "skipped", "interviewing", "offer", "rejected"]


class CandidateProfile(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    citizenship_country: Optional[str] = None
    citizenship_status: Optional[str] = None
    resume_present: Optional[bool] = None


class ApplicationCreate(BaseModel):
    jobId: str
    source: Optional[str] = "manual"
    jobUrl: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    match_score: Optional[int] = None
    eligible: Optional[bool] = True
    auto_apply: Optional[bool] = False
    status: Optional[ApplyStatus] = None
    failure_reason: Optional[str] = None


class BulkApplyRequest(BaseModel):
    roles: List[ApplicationCreate] = Field(default_factory=list)
    auto_apply: bool = False
    profile: Optional[CandidateProfile] = None


class ApplicationUpdate(BaseModel):
    status: Optional[ApplyStatus] = None
    replyState: Optional[str] = None
    notes: Optional[str] = None
    failure_reason: Optional[str] = None


class InterviewCreate(BaseModel):
    date: str
    type: str
    interviewer: str


class ExportContact(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    verification_status: Optional[str] = None
    verification_score: Optional[float] = None


class ExportRoleRow(BaseModel):
    job_id: str
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    job_url: Optional[str] = None
    match_score: Optional[int] = None
    eligible: Optional[bool] = None
    requirements_summary: Optional[str] = None
    date_posted: Optional[str] = None


class EnrichedExportRequest(BaseModel):
    customer_name: Optional[str] = None
    roles: List[ExportRoleRow] = Field(default_factory=list)
    contacts: List[ExportContact] = Field(default_factory=list)


class MatchesCsvImportRequest(BaseModel):
    csv_content: str


class ImportedRoleRow(BaseModel):
    id: str
    title: str
    company: str
    url: str
    location: Optional[str] = None
    match_score: Optional[int] = None
    salary_range: Optional[str] = None
    posted_date: Optional[str] = None
    posted_text: Optional[str] = None
    requirements_summary: Optional[str] = None
    eligible: Optional[bool] = None
    source: Optional[str] = None


class MatchesCsvImportResponse(BaseModel):
    success: bool
    message: str
    imported_roles: List[ImportedRoleRow] = Field(default_factory=list)
    helper: Dict[str, Any] = Field(default_factory=dict)


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _clean_cell(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def _company_key(v: Any) -> str:
    s = _clean_cell(v).lower()
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def _pick_contacts_for_company(contacts: List[ExportContact], company: str) -> List[ExportContact]:
    key = _company_key(company)
    if not contacts:
        return []
    if not key:
        return contacts[:3]
    same = [c for c in contacts if _company_key(c.company) == key]
    if len(same) >= 1:
        return same[:3]
    return contacts[:3]


def _today_stamp() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def _slug_id(parts: List[str]) -> str:
    src = "|".join([_clean_cell(x) for x in parts if _clean_cell(x)])
    if not src:
        src = _now_iso()
    return "imp_" + hashlib.sha1(src.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _parse_bool_maybe(v: Any) -> Optional[bool]:
    s = _clean_cell(v).lower()
    if not s:
        return None
    if s in {"yes", "true", "1", "y"}:
        return True
    if s in {"no", "false", "0", "n"}:
        return False
    return None


def _parse_int_maybe(v: Any) -> Optional[int]:
    s = _clean_cell(v)
    if not s:
        return None
    m = re.search(r"(\d{1,3})", s)
    if not m:
        return None
    try:
        n = int(m.group(1))
    except Exception:
        return None
    return max(0, min(100, n))


def _validate_auto_apply_profile(profile: Optional[CandidateProfile]) -> List[str]:
    p = profile or CandidateProfile()
    missing: List[str] = []
    if not str(p.first_name or "").strip():
        missing.append("First name")
    if not str(p.last_name or "").strip():
        missing.append("Last name")
    if not str(p.email or "").strip():
        missing.append("Email")
    if not str(p.phone or "").strip():
        missing.append("Phone")
    if not str(p.city or "").strip():
        missing.append("City")
    if not str(p.postal_code or "").strip():
        missing.append("Postal code")
    if not bool(p.resume_present):
        missing.append("Resume")
    return missing


def _create_application_from_payload(payload: ApplicationCreate, *, auto_apply: bool, profile: Optional[CandidateProfile]) -> Dict[str, Any]:
    global next_id
    now = _now_iso()

    requested_status: ApplyStatus = payload.status or "queued"
    effective_status: ApplyStatus = requested_status
    failure_reason = str(payload.failure_reason or "").strip() or None

    if auto_apply:
        missing = _validate_auto_apply_profile(profile)
        if missing:
            effective_status = "failed"
            failure_reason = f"Missing required profile fields: {', '.join(missing)}"
        elif payload.eligible is False:
            effective_status = "skipped"
            failure_reason = failure_reason or "Role is not currently eligible for auto-apply."
        else:
            effective_status = "applied"
    else:
        if requested_status == "queued":
            effective_status = "applied"

    app = {
        "id": next_id,
        "jobId": str(payload.jobId),
        "source": payload.source or "manual",
        "status": effective_status,
        "createdAt": now,
        "lastActionAt": now,
        "appliedAt": now if effective_status == "applied" else None,
        "sequenceId": None,
        "replyState": None,
        "interviews": [],
        "notes": [],
        "offer": None,
        "failureReason": failure_reason,
        "eligible": bool(payload.eligible if payload.eligible is not None else True),
        "autoApply": bool(auto_apply),
        "job": {
            "id": str(payload.jobId),
            "title": payload.title or "",
            "company": payload.company or "",
            "location": payload.location or "",
            "url": payload.jobUrl or "",
            "match_score": int(payload.match_score or 0),
        },
    }
    applications_db.append(app)
    next_id += 1
    return app


@router.post("/applications")
async def create_application(payload: ApplicationCreate):
    app = _create_application_from_payload(payload, auto_apply=bool(payload.auto_apply), profile=None)
    return {"application": app, "status": "created"}


@router.post("/applications/bulk")
async def bulk_apply(payload: BulkApplyRequest):
    if not isinstance(payload.roles, list) or not payload.roles:
        raise HTTPException(status_code=400, detail="roles is required")

    created: List[Dict[str, Any]] = []
    for role in payload.roles:
        created.append(
            _create_application_from_payload(
                role,
                auto_apply=bool(payload.auto_apply),
                profile=payload.profile,
            )
        )

    summary = {
        "applied": sum(1 for a in created if a.get("status") == "applied"),
        "failed": sum(1 for a in created if a.get("status") == "failed"),
        "skipped": sum(1 for a in created if a.get("status") == "skipped"),
        "queued": sum(1 for a in created if a.get("status") == "queued"),
    }
    return {"applications": created, "summary": summary}


@router.get("/applications")
async def list_applications(mode: Optional[str] = "jobseeker"):
    return {
        "applications": applications_db,
        "mode": mode
    }


@router.get("/applications/export")
async def export_applications_csv():
    fieldnames = [
        "application_id",
        "job_id",
        "title",
        "company",
        "location",
        "source",
        "status",
        "eligible",
        "auto_apply",
        "failure_reason",
        "applied_at",
        "created_at",
        "job_url",
        "match_score",
    ]
    buff = io.StringIO()
    writer = csv.DictWriter(buff, fieldnames=fieldnames)
    writer.writeheader()
    for app in applications_db:
        job = app.get("job") if isinstance(app.get("job"), dict) else {}
        writer.writerow(
            {
                "application_id": app.get("id"),
                "job_id": app.get("jobId"),
                "title": job.get("title") or "",
                "company": job.get("company") or "",
                "location": job.get("location") or "",
                "source": app.get("source") or "",
                "status": app.get("status") or "",
                "eligible": app.get("eligible"),
                "auto_apply": app.get("autoApply"),
                "failure_reason": app.get("failureReason") or "",
                "applied_at": app.get("appliedAt") or "",
                "created_at": app.get("createdAt") or "",
                "job_url": job.get("url") or "",
                "match_score": job.get("match_score") or "",
            }
        )
    return {"filename": "applications_export.csv", "content": buff.getvalue()}


@router.post("/applications/export/enriched")
async def export_enriched_matches_csv(payload: EnrichedExportRequest):
    fieldnames = [
        "Date Posted",
        "Date Applied",
        "Apply Failure Reason",
        "Match Percentage",
        "Location",
        "Job Title",
        "Company",
        "Requirements Summary",
        "Job URL",
        "Eligible",
        "Application Status",
        "Source",
        "Contact 1 Name",
        "Contact 1 Title",
        "Contact 1 Email",
        "Contact 1 LinkedIn",
        "Contact 2 Name",
        "Contact 2 Title",
        "Contact 2 Email",
        "Contact 2 LinkedIn",
        "Contact 3 Name",
        "Contact 3 Title",
        "Contact 3 Email",
        "Contact 3 LinkedIn",
        "Contacts Count (Company)",
    ]

    apps_by_job: Dict[str, Dict[str, Any]] = {}
    for app in applications_db:
        jid = str(app.get("jobId") or "").strip()
        if not jid:
            continue
        apps_by_job[jid] = app

    buff = io.StringIO()
    writer = csv.DictWriter(buff, fieldnames=fieldnames)
    writer.writeheader()

    for role in payload.roles:
        app = apps_by_job.get(str(role.job_id or "").strip()) or {}
        job = app.get("job") if isinstance(app.get("job"), dict) else {}
        company = _clean_cell(role.company or job.get("company") or "")
        contacts = _pick_contacts_for_company(payload.contacts, company)
        c1 = contacts[0] if len(contacts) > 0 else None
        c2 = contacts[1] if len(contacts) > 1 else None
        c3 = contacts[2] if len(contacts) > 2 else None
        writer.writerow(
            {
                "Date Posted": _clean_cell(role.date_posted),
                "Date Applied": _clean_cell(app.get("appliedAt")),
                "Apply Failure Reason": _clean_cell(app.get("failureReason")),
                "Match Percentage": str(int(role.match_score or job.get("match_score") or 0)),
                "Location": _clean_cell(role.location or job.get("location")),
                "Job Title": _clean_cell(role.title or job.get("title")),
                "Company": company,
                "Requirements Summary": _clean_cell(role.requirements_summary),
                "Job URL": _clean_cell(role.job_url or job.get("url")),
                "Eligible": "Yes" if bool(role.eligible if role.eligible is not None else app.get("eligible", True)) else "No",
                "Application Status": _clean_cell(app.get("status") or "pending"),
                "Source": _clean_cell(app.get("source") or "manual"),
                "Contact 1 Name": _clean_cell(c1.name if c1 else ""),
                "Contact 1 Title": _clean_cell(c1.title if c1 else ""),
                "Contact 1 Email": _clean_cell(c1.email if c1 else ""),
                "Contact 1 LinkedIn": _clean_cell(c1.linkedin_url if c1 else ""),
                "Contact 2 Name": _clean_cell(c2.name if c2 else ""),
                "Contact 2 Title": _clean_cell(c2.title if c2 else ""),
                "Contact 2 Email": _clean_cell(c2.email if c2 else ""),
                "Contact 2 LinkedIn": _clean_cell(c2.linkedin_url if c2 else ""),
                "Contact 3 Name": _clean_cell(c3.name if c3 else ""),
                "Contact 3 Title": _clean_cell(c3.title if c3 else ""),
                "Contact 3 Email": _clean_cell(c3.email if c3 else ""),
                "Contact 3 LinkedIn": _clean_cell(c3.linkedin_url if c3 else ""),
                "Contacts Count (Company)": str(len(contacts)),
            }
        )

    safe_customer = re.sub(r"[^A-Za-z0-9_-]+", "_", _clean_cell(payload.customer_name or "customer")).strip("_") or "customer"
    return {
        "filename": f"{safe_customer}_job_matches_enriched_{_today_stamp()}.csv",
        "content": buff.getvalue(),
        "columns": fieldnames,
    }


@router.post("/applications/import/matches-csv", response_model=MatchesCsvImportResponse)
async def import_matches_csv(payload: MatchesCsvImportRequest):
    raw = str(payload.csv_content or "")
    if not raw.strip():
        raise HTTPException(status_code=400, detail="csv_content is required")

    try:
        reader = csv.DictReader(io.StringIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV content: {exc}")

    rows = list(reader or [])
    if not rows:
        return MatchesCsvImportResponse(
            success=True,
            message="No rows found in CSV.",
            imported_roles=[],
            helper={"input_rows": 0, "imported": 0},
        )

    def pick(d: Dict[str, Any], names: List[str]) -> str:
        lower_map = {str(k).strip().lower(): v for k, v in (d or {}).items()}
        for n in names:
            v = lower_map.get(str(n).strip().lower())
            if v is not None and _clean_cell(v):
                return _clean_cell(v)
        return ""

    out: List[ImportedRoleRow] = []
    seen_ids: set[str] = set()
    for r in rows:
        title = pick(r, ["Job Title", "title", "role", "position"])
        company = pick(r, ["Company", "company", "employer"])
        url = pick(r, ["Job URL", "url", "link"])
        location = pick(r, ["Location", "location", "city"])
        posted = pick(r, ["Date Posted", "date_posted", "posted", "posted_date"])
        posted_text = pick(r, ["Posted Text", "posted_text", "reposted", "posted"])
        req_summary = pick(r, ["Requirements Summary", "requirements_summary", "requirements", "summary"])
        salary = pick(r, ["Salary", "salary", "salary_range", "salary range"])
        score = _parse_int_maybe(pick(r, ["Match Percentage", "match_percentage", "match", "relevancy"]))
        eligible = _parse_bool_maybe(pick(r, ["Eligible", "eligible"]))
        source = pick(r, ["Source", "source"])
        if not (title or company or url):
            continue
        rid = _slug_id([company, title, url, location])
        if rid in seen_ids:
            continue
        seen_ids.add(rid)
        out.append(
            ImportedRoleRow(
                id=rid,
                title=title or "Role",
                company=company or "Unknown",
                url=url,
                location=location or None,
                match_score=score,
                salary_range=salary or None,
                posted_date=posted or None,
                posted_text=posted_text or None,
                requirements_summary=req_summary or None,
                eligible=eligible,
                source=source or "Imported CSV",
            )
        )

    return MatchesCsvImportResponse(
        success=True,
        message=f"Imported {len(out)} role rows from CSV.",
        imported_roles=out,
        helper={
            "input_rows": len(rows),
            "imported": len(out),
            "dropped": max(0, len(rows) - len(out)),
        },
    )


@router.get("/applications/{application_id}")
async def get_application(application_id: int):
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"application": app}


@router.patch("/applications/{application_id}")
async def update_application(application_id: int, payload: ApplicationUpdate):
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if payload.status:
        app['status'] = payload.status
        if payload.status == "applied":
            app["appliedAt"] = app.get("appliedAt") or _now_iso()
    if payload.replyState:
        app['replyState'] = payload.replyState
    if payload.failure_reason is not None:
        app["failureReason"] = str(payload.failure_reason or "").strip() or None
    if payload.notes:
        if 'notes' not in app:
            app['notes'] = []
        app['notes'].append({
            "text": payload.notes,
            "createdAt": _now_iso()
        })

    app['lastActionAt'] = _now_iso()
    return {"application": app}


@router.post("/applications/{application_id}/interviews")
async def add_interview(application_id: int, payload: InterviewCreate):
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    interview = {
        "date": payload.date,
        "type": payload.type,
        "interviewer": payload.interviewer,
        "createdAt": _now_iso()
    }

    if 'interviews' not in app:
        app['interviews'] = []
    app['interviews'].append(interview)

    return {"interview": interview}


@router.post("/applications/{application_id}/offer")
async def add_offer(application_id: int, amount: int, equity: Optional[str] = None):
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app['offer'] = {
        "amount": amount,
        "equity": equity,
        "receivedAt": _now_iso()
    }
    app['status'] = 'offer'
    app['lastActionAt'] = _now_iso()

    return {"offer": app['offer']}


# ---------------------------------------------------------------------------
# Cover Letter Generation
# ---------------------------------------------------------------------------

class CoverLetterContext(BaseModel):
    resume: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None
    personality: Optional[Dict[str, Any]] = None
    temperament: Optional[Dict[str, Any]] = None
    role: Optional[Dict[str, Any]] = None
    company_research: Optional[Dict[str, Any]] = None
    company_signals: Optional[List[Dict[str, Any]]] = None
    painpoint_match: Optional[Dict[str, Any]] = None
    contact_signals: Optional[List[Dict[str, Any]]] = None
    tone: Optional[str] = "professional yet personable"
    extra_instructions: Optional[str] = None


class CoverLetterResponse(BaseModel):
    success: bool
    cover_letter: str = ""
    word_count: int = 0
    message: str = ""


def _summarize_for_prompt(label: str, data: Any, *, max_chars: int = 1200) -> str:
    """Compact a dict/list into a readable block for the LLM prompt."""
    if not data:
        return ""
    import json
    try:
        text = json.dumps(data, indent=None, default=str)
    except Exception:
        text = str(data)
    if len(text) > max_chars:
        text = text[:max_chars] + "..."
    return f"\n### {label}\n{text}\n"


@router.post("/applications/cover-letter", response_model=CoverLetterResponse)
async def generate_cover_letter(ctx: CoverLetterContext):
    client = get_openai_client()

    resume = ctx.resume or {}
    prefs = ctx.preferences or {}
    personality = ctx.personality or {}
    role = ctx.role or {}
    research = ctx.company_research or {}
    pain = ctx.painpoint_match or {}

    candidate_name = (
        str(resume.get("name") or "").strip()
        or str(resume.get("full_name") or "").strip()
        or "the candidate"
    )
    role_title = str(role.get("title") or "").strip() or "the role"
    company = str(role.get("company") or research.get("company_name") or "").strip() or "the company"

    values_list = prefs.get("values") or prefs.get("Values") or []
    values_str = ", ".join(str(v) for v in values_list) if values_list else ""

    skills_list = resume.get("skills") or resume.get("Skills") or prefs.get("skills") or []
    skills_str = ", ".join(str(s) for s in skills_list[:15]) if skills_list else ""

    strengths = personality.get("strengths") or []
    strengths_str = ", ".join(str(s) for s in strengths[:6]) if strengths else ""

    context_blocks = ""
    context_blocks += _summarize_for_prompt("Resume Summary", {
        k: resume.get(k) for k in [
            "summary", "positions", "accomplishments", "key_metrics",
            "total_years_experience", "education",
        ] if resume.get(k)
    })
    context_blocks += _summarize_for_prompt("Role Details", {
        k: role.get(k) for k in [
            "title", "company", "location", "content", "requiredSkills",
            "required_skills", "description", "salaryRange", "salary_range",
        ] if role.get(k)
    })
    context_blocks += _summarize_for_prompt("Company Research", {
        k: research.get(k) for k in [
            "company_summary", "culture_values", "market_position",
            "product_launches", "leadership_changes", "recent_news",
        ] if research.get(k)
    })
    if ctx.company_signals:
        context_blocks += _summarize_for_prompt(
            "Company Signals",
            [{"label": s.get("label"), "value": s.get("value")} for s in ctx.company_signals[:6]],
        )
    context_blocks += _summarize_for_prompt("Pain Point Alignment", {
        k: pain.get(k) for k in [
            "alignment_score", "pain_points", "alignment_reasons",
            "relevant_experience", "suggested_talking_points",
        ] if pain.get(k)
    })
    if ctx.contact_signals:
        context_blocks += _summarize_for_prompt(
            "Contact / Decision-Maker Signals",
            [{"label": s.get("label"), "value": s.get("value")} for s in ctx.contact_signals[:6]],
        )

    system_prompt = (
        "You are an expert career coach and cover letter writer. "
        "Write a compelling, honest cover letter for a job application. "
        "The letter should:\n"
        "- Open with a genuine hook that shows knowledge of the company (use the research)\n"
        "- Highlight 2-3 specific accomplishments from the resume that align with the role\n"
        "- Reference the company's pain points and explain how the candidate can solve them\n"
        "- Reflect the candidate's personality and communication style\n"
        "- Mention what the candidate values in a role (aligning with company culture)\n"
        "- Close with confidence and a clear next step\n"
        "- Be 250-400 words, professional yet warm, and never generic or formulaic\n"
        "- NEVER fabricate facts. Only reference information provided in the context.\n"
        "- Do NOT use placeholder brackets like [Company] or [Name]. Use the actual values.\n"
        "Return ONLY the cover letter text, no JSON wrapper or markdown formatting."
    )

    user_prompt = f"Write a cover letter for {candidate_name} applying to {role_title} at {company}.\n"
    if values_str:
        user_prompt += f"\nWhat they value in a role: {values_str}"
    if skills_str:
        user_prompt += f"\nKey skills: {skills_str}"
    if strengths_str:
        user_prompt += f"\nPersonality strengths: {strengths_str}"
    if personality.get("summary"):
        user_prompt += f"\nPersonality summary: {personality['summary']}"
    user_prompt += f"\nDesired tone: {ctx.tone or 'professional yet personable'}"
    if ctx.extra_instructions:
        user_prompt += f"\nAdditional instructions: {ctx.extra_instructions}"
    user_prompt += f"\n\n--- CONTEXT ---\n{context_blocks}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    stub_text = (
        f"Dear Hiring Manager,\n\n"
        f"I am writing to express my strong interest in the {role_title} position at {company}. "
        f"With my background in {skills_str or 'relevant skills'}, I am confident I can contribute meaningfully to your team.\n\n"
        f"Thank you for considering my application. I look forward to discussing how my experience aligns with your needs.\n\n"
        f"Sincerely,\n{candidate_name}"
    )

    try:
        raw = client.run_chat_completion(
            messages,
            temperature=0.7,
            max_tokens=1200,
            stub_json={"choices": [{"message": {"content": stub_text}}]},
        )
        choices = raw.get("choices") or []
        content = str((choices[0].get("message") if choices else {}).get("content") or "").strip()
        if not content:
            content = stub_text
    except Exception as exc:
        logger.warning("Cover letter generation failed: %s", exc)
        content = stub_text

    word_count = len(content.split())
    return CoverLetterResponse(
        success=True,
        cover_letter=content,
        word_count=word_count,
        message=f"Generated {word_count}-word cover letter for {role_title} at {company}.",
    )

