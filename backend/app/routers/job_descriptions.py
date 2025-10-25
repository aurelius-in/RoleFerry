from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()

class JobDescription(BaseModel):
    id: str
    title: str
    company: str
    url: Optional[str] = None
    content: str
    pain_points: List[str]
    required_skills: List[str]
    success_metrics: List[str]
    parsed_at: str

class JobDescriptionResponse(BaseModel):
    success: bool
    message: str
    job_description: Optional[JobDescription] = None

class JobDescriptionsListResponse(BaseModel):
    success: bool
    message: str
    job_descriptions: List[JobDescription]

@router.post("/import", response_model=JobDescriptionResponse)
async def import_job_description(url: Optional[str] = None, text: Optional[str] = None):
    """
    Import and parse job description from URL or text.
    """
    try:
        if not url and not text:
            raise HTTPException(status_code=400, detail="Either URL or text must be provided")
        
        # In a real implementation, this would use AI/ML to parse the job description
        # For now, return mock data
        mock_jd = JobDescription(
            id="jd_123",
            title="Senior Software Engineer",
            company="TechCorp Inc.",
            url=url,
            content=text or "Job description content from URL...",
            pain_points=[
                "Need to reduce time-to-fill for engineering roles",
                "Struggling with candidate quality and cultural fit",
                "High turnover in engineering team affecting project delivery"
            ],
            required_skills=[
                "Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "PostgreSQL"
            ],
            success_metrics=[
                "Reduce time-to-hire by 30%",
                "Improve candidate quality scores",
                "Increase team retention by 25%"
            ],
            parsed_at="2024-01-15T10:30:00Z"
        )
        
        return JobDescriptionResponse(
            success=True,
            message="Job description parsed successfully",
            job_description=mock_jd
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse job description: {str(e)}")

@router.post("/save", response_model=JobDescriptionResponse)
async def save_job_description(job_description: JobDescription):
    """
    Save job description for a user.
    """
    try:
        # In a real app, save to database with user_id
        return JobDescriptionResponse(
            success=True,
            message="Job description saved successfully",
            job_description=job_description
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save job description: {str(e)}")

@router.get("/{user_id}", response_model=JobDescriptionsListResponse)
async def get_job_descriptions(user_id: str):
    """
    Get all job descriptions for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_jds = [
            JobDescription(
                id="jd_123",
                title="Senior Software Engineer",
                company="TechCorp Inc.",
                url="https://techcorp.com/jobs/senior-engineer",
                content="Job description content...",
                pain_points=[
                    "Need to reduce time-to-fill for engineering roles",
                    "Struggling with candidate quality and cultural fit"
                ],
                required_skills=["Python", "JavaScript", "React", "Node.js"],
                success_metrics=[
                    "Reduce time-to-hire by 30%",
                    "Improve candidate quality scores"
                ],
                parsed_at="2024-01-15T10:30:00Z"
            ),
            JobDescription(
                id="jd_124",
                title="Product Manager",
                company="StartupXYZ",
                url="https://startupxyz.com/jobs/product-manager",
                content="Job description content...",
                pain_points=[
                    "Need to improve product-market fit",
                    "Struggling with user engagement metrics"
                ],
                required_skills=["Product Management", "Analytics", "User Research"],
                success_metrics=[
                    "Increase user engagement by 40%",
                    "Improve product-market fit scores"
                ],
                parsed_at="2024-01-14T15:45:00Z"
            )
        ]
        
        return JobDescriptionsListResponse(
            success=True,
            message="Job descriptions retrieved successfully",
            job_descriptions=mock_jds
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job descriptions: {str(e)}")

@router.get("/{user_id}/{jd_id}", response_model=JobDescriptionResponse)
async def get_job_description(user_id: str, jd_id: str):
    """
    Get a specific job description for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_jd = JobDescription(
            id=jd_id,
            title="Senior Software Engineer",
            company="TechCorp Inc.",
            url="https://techcorp.com/jobs/senior-engineer",
            content="Job description content...",
            pain_points=[
                "Need to reduce time-to-fill for engineering roles",
                "Struggling with candidate quality and cultural fit"
            ],
            required_skills=["Python", "JavaScript", "React", "Node.js"],
            success_metrics=[
                "Reduce time-to-hire by 30%",
                "Improve candidate quality scores"
            ],
            parsed_at="2024-01-15T10:30:00Z"
        )
        
        return JobDescriptionResponse(
            success=True,
            message="Job description retrieved successfully",
            job_description=mock_jd
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job description: {str(e)}")

@router.put("/{user_id}/{jd_id}", response_model=JobDescriptionResponse)
async def update_job_description(user_id: str, jd_id: str, job_description: JobDescription):
    """
    Update a job description for a user.
    """
    try:
        # In a real app, update in database
        return JobDescriptionResponse(
            success=True,
            message="Job description updated successfully",
            job_description=job_description
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update job description: {str(e)}")

@router.delete("/{user_id}/{jd_id}")
async def delete_job_description(user_id: str, jd_id: str):
    """
    Delete a job description for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Job description deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete job description: {str(e)}")
