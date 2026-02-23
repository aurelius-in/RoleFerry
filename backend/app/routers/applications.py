"""
Applications API - core apply/tracker workflow
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime
import csv
import io

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


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


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


@router.post("/api/applications")
async def create_application(payload: ApplicationCreate):
    app = _create_application_from_payload(payload, auto_apply=bool(payload.auto_apply), profile=None)
    return {"application": app, "status": "created"}


@router.post("/api/applications/bulk")
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


@router.get("/api/applications")
async def list_applications(mode: Optional[str] = "jobseeker"):
    return {
        "applications": applications_db,
        "mode": mode
    }


@router.get("/api/applications/export")
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


@router.get("/api/applications/{application_id}")
async def get_application(application_id: int):
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"application": app}


@router.patch("/api/applications/{application_id}")
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


@router.post("/api/applications/{application_id}/interviews")
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


@router.post("/api/applications/{application_id}/offer")
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

