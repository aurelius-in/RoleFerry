from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()

class JobPreferences(BaseModel):
    values: List[str]
    role_categories: List[str]
    location_preferences: List[str]
    work_type: List[str]
    role_type: List[str]
    company_size: List[str]
    industries: List[str]
    skills: List[str]
    minimum_salary: str
    job_search_status: str
    state: Optional[str] = None
    user_mode: str = "job-seeker"  # job-seeker or recruiter

class JobPreferencesResponse(BaseModel):
    success: bool
    message: str
    preferences: Optional[JobPreferences] = None

@router.post("/save", response_model=JobPreferencesResponse)
async def save_job_preferences(preferences: JobPreferences):
    """
    Save job preferences for a user.
    In a real implementation, this would save to database.
    """
    try:
        # In a real app, save to database with user_id
        # For now, just return success
        return JobPreferencesResponse(
            success=True,
            message="Job preferences saved successfully",
            preferences=preferences
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save preferences: {str(e)}")

@router.get("/{user_id}", response_model=JobPreferencesResponse)
async def get_job_preferences(user_id: str):
    """
    Get job preferences for a user.
    In a real implementation, this would fetch from database.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_preferences = JobPreferences(
            values=["Impactful work", "Work-life balance"],
            role_categories=["Technical & Engineering"],
            location_preferences=["Remote", "Hybrid"],
            work_type=["Remote", "Hybrid"],
            role_type=["Full-Time"],
            company_size=["51-200 employees", "201-500 employees"],
            industries=["Enterprise Software", "AI & Machine Learning"],
            skills=["Python", "JavaScript", "React"],
            minimum_salary="$80,000",
            job_search_status="Actively looking",
            state="California",
            user_mode="job-seeker"
        )
        
        return JobPreferencesResponse(
            success=True,
            message="Job preferences retrieved successfully",
            preferences=mock_preferences
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")

@router.put("/{user_id}", response_model=JobPreferencesResponse)
async def update_job_preferences(user_id: str, preferences: JobPreferences):
    """
    Update job preferences for a user.
    """
    try:
        # In a real app, update in database
        return JobPreferencesResponse(
            success=True,
            message="Job preferences updated successfully",
            preferences=preferences
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {str(e)}")

@router.delete("/{user_id}")
async def delete_job_preferences(user_id: str):
    """
    Delete job preferences for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Job preferences deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete preferences: {str(e)}")

@router.get("/options/values")
async def get_values_options():
    """Get available values options."""
    return {
        "values": [
            "Diversity & inclusion",
            "Impactful work", 
            "Independence & autonomy",
            "Innovative product & tech",
            "Mentorship & career development",
            "Progressive leadership",
            "Recognition & reward",
            "Role mobility",
            "Social responsibility & sustainability",
            "Transparency & communication",
            "Work-life balance"
        ]
    }

@router.get("/options/role-categories")
async def get_role_categories():
    """Get available role categories."""
    return {
        "role_categories": [
            "Technical & Engineering",
            "Finance & Operations & Strategy", 
            "Creative & Design",
            "Education & Training",
            "Legal & Support & Administration",
            "Life Sciences"
        ]
    }

@router.get("/options/industries")
async def get_industries():
    """Get available industries."""
    return {
        "industries": [
            "Aerospace", "AI & Machine Learning", "Automotive & Transportation", 
            "Biotechnology", "Consulting", "Consumer Goods", "Consumer Software",
            "Crypto & Web3", "Cybersecurity", "Data & Analytics", "Defense",
            "Design", "Education", "Energy", "Enterprise Software", "Entertainment",
            "Financial Services", "Fintech", "Food & Agriculture", "Gaming",
            "Government & Public Sector", "Hardware", "Healthcare",
            "Industrial & Manufacturing", "Legal", "Quantitative Finance",
            "Real Estate", "Robotics & Automation", "Social Impact",
            "Venture Capital", "VR & AR"
        ]
    }

@router.get("/options/skills")
async def get_skills():
    """Get available skills."""
    return {
        "skills": [
            "Adobe Illustrator", "Business Analytics", "Excel/Numbers/Sheets", "Git",
            "HTML/CSS", "Java", "MailChimp", "MATLAB", "Operations Research", 
            "Python", "SEO", "Zendesk"
        ]
    }
