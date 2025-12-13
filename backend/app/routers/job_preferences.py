from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from ..db import get_engine


router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)

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

DEMO_USER_ID = "demo-user"


@router.post("/save", response_model=JobPreferencesResponse)
async def save_job_preferences(preferences: JobPreferences):
    """
    Save job preferences for a user.
    In a real implementation, this would save to database.
    """
    try:
        # Persist as structured JSONB against a stubbed demo user
        data_obj = preferences.model_dump()
        stmt = (
            text(
                """
                INSERT INTO job_preferences (user_id, data, updated_at)
                VALUES (:user_id, :data, now())
                ON CONFLICT (user_id)
                DO UPDATE SET data = EXCLUDED.data, updated_at = now()
                """
            ).bindparams(bindparam("data", type_=JSONB))
        )
        async with engine.begin() as conn:
            await conn.execute(stmt, {"user_id": DEMO_USER_ID, "data": data_obj})

        return JobPreferencesResponse(
            success=True,
            message="Job preferences saved successfully",
            preferences=preferences,
        )
    except Exception as e:
        logger.exception("Error saving job preferences")
        raise HTTPException(status_code=500, detail="Failed to save preferences")

@router.get("/{user_id}", response_model=JobPreferencesResponse)
async def get_job_preferences(user_id: str):
    """
    Get job preferences for a user.
    In a real implementation, this would fetch from database.
    """
    # For Week 9, we treat all traffic as a single demo user
    _user_id = DEMO_USER_ID
    try:
        async with engine.begin() as conn:
            result = await conn.execute(
                text("SELECT data FROM job_preferences WHERE user_id = :user_id"),
                {"user_id": _user_id},
            )
            row = result.first()

        if row and row[0]:
            # row[0] is a JSON/JSONB object
            prefs_obj = JobPreferences(**row[0])
            return JobPreferencesResponse(
                success=True,
                message="Job preferences retrieved successfully",
                preferences=prefs_obj,
            )
    except Exception:
        # If anything goes wrong with the DB, fall back to mock defaults
        pass

    # Fallback to existing mock defaults if nothing stored yet or DB unavailable
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
        user_mode="job-seeker",
    )

    return JobPreferencesResponse(
        success=True,
        message="Job preferences retrieved successfully",
        preferences=mock_preferences,
    )

@router.put("/{user_id}", response_model=JobPreferencesResponse)
async def update_job_preferences(user_id: str, preferences: JobPreferences):
    """
    Update job preferences for a user.
    """
    try:
        data_obj = preferences.model_dump()
        stmt = (
            text(
                """
                INSERT INTO job_preferences (user_id, data, updated_at)
                VALUES (:user_id, :data, now())
                ON CONFLICT (user_id)
                DO UPDATE SET data = EXCLUDED.data, updated_at = now()
                """
            ).bindparams(bindparam("data", type_=JSONB))
        )
        async with engine.begin() as conn:
            await conn.execute(stmt, {"user_id": DEMO_USER_ID, "data": data_obj})
        return JobPreferencesResponse(
            success=True,
            message="Job preferences updated successfully",
            preferences=preferences,
        )
    except Exception as e:
        logger.exception("Error updating job preferences")
        raise HTTPException(status_code=500, detail="Failed to update preferences")

@router.delete("/{user_id}")
async def delete_job_preferences(user_id: str):
    """
    Delete job preferences for a user.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM job_preferences WHERE user_id = :user_id"),
                {"user_id": DEMO_USER_ID},
            )
        return {"success": True, "message": "Job preferences deleted successfully"}
    except Exception as e:
        logger.exception("Error deleting job preferences")
        raise HTTPException(status_code=500, detail="Failed to delete preferences")

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
