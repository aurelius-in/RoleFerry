from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()

class Position(BaseModel):
    company: str
    title: str
    start_date: str
    end_date: str
    current: bool
    description: str

class KeyMetric(BaseModel):
    metric: str
    value: str
    context: str

class Tenure(BaseModel):
    company: str
    duration: str
    role: str

class ResumeExtract(BaseModel):
    positions: List[Position]
    key_metrics: List[KeyMetric]
    skills: List[str]
    accomplishments: List[str]
    tenure: List[Tenure]

class ResumeExtractResponse(BaseModel):
    success: bool
    message: str
    extract: Optional[ResumeExtract] = None

@router.post("/upload", response_model=ResumeExtractResponse)
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload and parse resume file to extract key information.
    """
    try:
        # Validate file type
        if not file.filename.lower().endswith(('.pdf', '.docx')):
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
        
        # In a real implementation, this would use AI/ML to parse the resume
        # For now, return mock data
        mock_extract = ResumeExtract(
            positions=[
                Position(
                    company="TechCorp Inc.",
                    title="Senior Software Engineer",
                    start_date="2022-01",
                    end_date="2024-12",
                    current=True,
                    description="Led development of microservices architecture, reducing system latency by 40%"
                ),
                Position(
                    company="StartupXYZ",
                    title="Full Stack Developer",
                    start_date="2020-06",
                    end_date="2021-12",
                    current=False,
                    description="Built customer-facing web application serving 10K+ users"
                )
            ],
            key_metrics=[
                KeyMetric(
                    metric="System Performance",
                    value="40% reduction",
                    context="in latency through microservices optimization"
                ),
                KeyMetric(
                    metric="User Growth",
                    value="10K+ users",
                    context="served through customer-facing application"
                ),
                KeyMetric(
                    metric="Team Leadership",
                    value="5 engineers",
                    context="managed in cross-functional team"
                )
            ],
            skills=["Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "PostgreSQL"],
            accomplishments=[
                "Reduced system latency by 40% through microservices architecture",
                "Led team of 5 engineers in cross-functional projects",
                "Built scalable web application serving 10K+ users",
                "Implemented CI/CD pipeline reducing deployment time by 60%"
            ],
            tenure=[
                Tenure(company="TechCorp Inc.", duration="2 years", role="Senior Software Engineer"),
                Tenure(company="StartupXYZ", duration="1.5 years", role="Full Stack Developer")
            ]
        )
        
        return ResumeExtractResponse(
            success=True,
            message="Resume parsed successfully",
            extract=mock_extract
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")

@router.post("/save", response_model=ResumeExtractResponse)
async def save_resume_extract(extract: ResumeExtract):
    """
    Save resume extract for a user.
    """
    try:
        # In a real app, save to database with user_id
        return ResumeExtractResponse(
            success=True,
            message="Resume extract saved successfully",
            extract=extract
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save resume extract: {str(e)}")

@router.get("/{user_id}", response_model=ResumeExtractResponse)
async def get_resume_extract(user_id: str):
    """
    Get resume extract for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_extract = ResumeExtract(
            positions=[
                Position(
                    company="TechCorp Inc.",
                    title="Senior Software Engineer",
                    start_date="2022-01",
                    end_date="2024-12",
                    current=True,
                    description="Led development of microservices architecture, reducing system latency by 40%"
                )
            ],
            key_metrics=[
                KeyMetric(
                    metric="System Performance",
                    value="40% reduction",
                    context="in latency through microservices optimization"
                )
            ],
            skills=["Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "PostgreSQL"],
            accomplishments=[
                "Reduced system latency by 40% through microservices architecture"
            ],
            tenure=[
                Tenure(company="TechCorp Inc.", duration="2 years", role="Senior Software Engineer")
            ]
        )
        
        return ResumeExtractResponse(
            success=True,
            message="Resume extract retrieved successfully",
            extract=mock_extract
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get resume extract: {str(e)}")

@router.put("/{user_id}", response_model=ResumeExtractResponse)
async def update_resume_extract(user_id: str, extract: ResumeExtract):
    """
    Update resume extract for a user.
    """
    try:
        # In a real app, update in database
        return ResumeExtractResponse(
            success=True,
            message="Resume extract updated successfully",
            extract=extract
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update resume extract: {str(e)}")

@router.delete("/{user_id}")
async def delete_resume_extract(user_id: str):
    """
    Delete resume extract for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Resume extract deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete resume extract: {str(e)}")
