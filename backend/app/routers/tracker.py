"""
Tracker API - Application pipeline management
Supports Kanban board and table views with CSV import/export
"""
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import csv
import io
from datetime import datetime

router = APIRouter()


class TrackerFilter(BaseModel):
    mode: Optional[str] = "jobseeker"  # or "recruiter"
    status: Optional[List[str]] = None


@router.get("/api/tracker")
async def get_tracker(mode: str = "jobseeker"):
    """
    Get all applications organized for tracker view
    Returns columns based on mode (jobseeker vs recruiter)
    """
    
    # Mock data
    applications = [
        {
            "id": 1,
            "jobId": 1,
            "company": "DataFlow",
            "role": "Senior PM",
            "status": "applied",
            "appliedDate": "2025-01-10",
            "lastContact": "2025-01-10",
            "replyStatus": None,
            "sequenceStatus": "sent"
        },
        {
            "id": 2,
            "jobId": 2,
            "company": "GlobalTech",
            "role": "Director of Product",
            "status": "interviewing",
            "appliedDate": "2025-01-08",
            "lastContact": "2025-01-13",
            "replyStatus": "replied",
            "sequenceStatus": "stopped",
            "interviews": 2
        }
    ]
    
    columns = {
        "jobseeker": ["Saved", "Applied", "Interviewing", "Offer", "Rejected"],
        "recruiter": ["Leads", "Contacted", "Appointments", "Offers", "Won/Lost"]
    }
    
    return {
        "mode": mode,
        "columns": columns.get(mode, columns["jobseeker"]),
        "applications": applications
    }


@router.post("/api/tracker/import")
async def import_csv(file: UploadFile = File(...)):
    """
    Import applications from CSV
    Supports round-trip with exported format
    """
    contents = await file.read()
    decoded = contents.decode('utf-8')
    
    reader = csv.DictReader(io.StringIO(decoded))
    imported = []
    
    for row in reader:
        # Parse CSV row and create application
        application = {
            "company": row.get('Company', ''),
            "role": row.get('Role', ''),
            "status": row.get('Status', 'saved'),
            "appliedDate": row.get('Applied Date', datetime.utcnow().isoformat()),
            "notes": row.get('Notes', '')
        }
        imported.append(application)
    
    return {
        "imported": len(imported),
        "applications": imported
    }


@router.get("/api/tracker/export")
async def export_csv():
    """
    Export applications to CSV
    UTF-8 encoded for compatibility
    """
    
    # Mock data
    applications = [
        {
            "Company": "DataFlow",
            "Role": "Senior PM",
            "Status": "applied",
            "Applied Date": "2025-01-10",
            "Last Contact": "2025-01-10",
            "Reply Status": "No reply",
            "Notes": "Strong fit"
        }
    ]
    
    output = io.StringIO()
    fieldnames = ["Company", "Role", "Status", "Applied Date", "Last Contact", "Reply Status", "Notes"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    
    writer.writeheader()
    for app in applications:
        writer.writerow(app)
    
    csv_content = output.getvalue()
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tracker-export.csv"}
    )


@router.get("/api/tracker/insights")
async def get_insights():
    """
    Get tracker analytics and insights
    """
    
    return {
        "totalApplications": 23,
        "replyRate": 0.17,
        "interviewsThisWeek": 2,
        "offers": 1,
        "avgTimeToInterview": 7,  # days
        "avgTimeToOffer": 14,
        "byStatus": {
            "saved": 5,
            "applied": 12,
            "interviewing": 4,
            "offer": 1,
            "rejected": 1
        },
        "sequenceEffectiveness": {
            "3-Step": {"sent": 15, "replies": 3, "replyRate": 0.20},
            "2-Step": {"sent": 8, "replies": 1, "replyRate": 0.125}
        }
    }

