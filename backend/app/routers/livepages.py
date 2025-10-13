"""
LivePages API - Personalized landing pages for email outreach
Tracks views, clicks, scroll depth
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

livepages_db = []
next_id = 1


class LivePageCreate(BaseModel):
    applicationId: int
    contactName: str
    companyName: str
    role: str
    gif: Optional[str] = None
    video: Optional[str] = None
    calendarLink: str
    metrics: List[str]


class LivePageView(BaseModel):
    pageId: int
    scrollDepth: int
    ctaClicked: bool


@router.post("/api/livepages")
async def create_livepage(payload: LivePageCreate):
    """
    Create personalized LivePage for application
    Returns unique URL for email link
    """
    global next_id
    
    livepage = {
        "id": next_id,
        "applicationId": payload.applicationId,
        "contactName": payload.contactName,
        "companyName": payload.companyName,
        "role": payload.role,
        "gif": payload.gif,
        "video": payload.video,
        "calendarLink": payload.calendarLink,
        "metrics": payload.metrics,
        "url": f"https://pages.roleferry.com/{next_id}",
        "views": 0,
        "ctaClicks": 0,
        "avgScrollDepth": 0,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    livepages_db.append(livepage)
    next_id += 1
    
    return {"livepage": livepage}


@router.get("/api/livepages")
async def list_livepages():
    """Get all LivePages for current user"""
    return {"livepages": livepages_db}


@router.get("/api/livepages/{page_id}")
async def get_livepage(page_id: int):
    """Get specific LivePage with analytics"""
    page = next((p for p in livepages_db if p['id'] == page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="LivePage not found")
    return {"livepage": page}


@router.post("/api/livepages/{page_id}/view")
async def track_view(page_id: int, payload: LivePageView):
    """
    Track LivePage view event
    Updates analytics (views, scroll depth, CTA clicks)
    """
    page = next((p for p in livepages_db if p['id'] == page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="LivePage not found")
    
    page['views'] += 1
    if payload.ctaClicked:
        page['ctaClicks'] += 1
    
    # Update average scroll depth
    current_avg = page.get('avgScrollDepth', 0)
    page['avgScrollDepth'] = (current_avg * (page['views'] - 1) + payload.scrollDepth) / page['views']
    
    return {"success": True, "views": page['views']}

