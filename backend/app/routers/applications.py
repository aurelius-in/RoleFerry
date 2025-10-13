"""
Applications API - Core tracker functionality
Handles job applications, status updates, notes, interviews
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

# Mock data store (in production: PostgreSQL)
applications_db = []
next_id = 1


class ApplicationCreate(BaseModel):
    jobId: int
    source: Optional[str] = "jobright"
    jobUrl: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    replyState: Optional[str] = None
    notes: Optional[str] = None


class InterviewCreate(BaseModel):
    date: str
    type: str
    interviewer: str


@router.post("/api/applications")
async def create_application(payload: ApplicationCreate):
    """
    Create new application (triggered by Apply button)
    Auto-queues enrichment job to find contacts
    """
    global next_id
    
    application = {
        "id": next_id,
        "jobId": payload.jobId,
        "source": payload.source,
        "status": "applied",
        "createdAt": datetime.utcnow().isoformat(),
        "lastActionAt": datetime.utcnow().isoformat(),
        "sequenceId": None,
        "replyState": None,
        "interviews": [],
        "notes": [],
        "offer": None
    }
    
    applications_db.append(application)
    next_id += 1
    
    # TODO: Queue enrichment job (Clay/Apollo)
    # enrich_application.delay(application['id'])
    
    return {"application": application, "status": "created"}


@router.get("/api/applications")
async def list_applications(mode: Optional[str] = "jobseeker"):
    """
    Get all applications for current user
    Supports jobseeker and recruiter modes
    """
    return {
        "applications": applications_db,
        "mode": mode
    }


@router.get("/api/applications/{application_id}")
async def get_application(application_id: int):
    """Get single application with full details"""
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"application": app}


@router.patch("/api/applications/{application_id}")
async def update_application(application_id: int, payload: ApplicationUpdate):
    """Update application status, notes, reply state"""
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if payload.status:
        app['status'] = payload.status
    if payload.replyState:
        app['replyState'] = payload.replyState
    if payload.notes:
        if 'notes' not in app:
            app['notes'] = []
        app['notes'].append({
            "text": payload.notes,
            "createdAt": datetime.utcnow().isoformat()
        })
    
    app['lastActionAt'] = datetime.utcnow().isoformat()
    
    return {"application": app}


@router.post("/api/applications/{application_id}/interviews")
async def add_interview(application_id: int, payload: InterviewCreate):
    """Log interview for application"""
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    interview = {
        "date": payload.date,
        "type": payload.type,
        "interviewer": payload.interviewer,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    if 'interviews' not in app:
        app['interviews'] = []
    app['interviews'].append(interview)
    
    return {"interview": interview}


@router.post("/api/applications/{application_id}/offer")
async def add_offer(application_id: int, amount: int, equity: Optional[str] = None):
    """Record job offer"""
    app = next((a for a in applications_db if a['id'] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    app['offer'] = {
        "amount": amount,
        "equity": equity,
        "receivedAt": datetime.utcnow().isoformat()
    }
    app['status'] = 'offer'
    
    return {"offer": app['offer']}

