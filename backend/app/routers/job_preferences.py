from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import json

from sqlalchemy import text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from ..db import get_engine
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store


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
    helper: Optional[Dict[str, Any]] = None

DEMO_USER_ID = "demo-user"


@router.post("/save", response_model=JobPreferencesResponse)
async def save_job_preferences(preferences: JobPreferences):
    """
    Save job preferences for a user.
    In a real implementation, this would save to database.
    """
    try:
        # Always cache for demo continuity (even if Postgres is down)
        store.demo_job_preferences = preferences.model_dump()

        # Persist as structured JSONB against a stubbed demo user (best-effort)
        data_obj = preferences.model_dump()
        try:
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
        except BaseException:
            pass

        # GPT helper: normalize skills + suggest adjacent improvements.
        client = get_openai_client()
        helper_context = {
            "values": preferences.values,
            "role_categories": preferences.role_categories,
            "location_preferences": preferences.location_preferences,
            "industries": preferences.industries,
            "skills": preferences.skills,
            "work_type": preferences.work_type,
            "company_size": preferences.company_size,
            "user_mode": preferences.user_mode,
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a job preferences normalization assistant.\n\n"
                    "Return ONLY JSON with keys:\n"
                    "- normalized_skills: array of strings (deduped, consistent casing)\n"
                    "- suggested_skills: array of strings (3-8 items)\n"
                    "- suggested_role_categories: array of strings (0-3 items)\n"
                    "- notes: array of strings (short, actionable)\n"
                ),
            },
            {"role": "user", "content": json.dumps(helper_context)},
        ]
        stub_json = {
            "normalized_skills": sorted({s.strip() for s in (preferences.skills or []) if str(s).strip()}),
            "suggested_skills": ["Product analytics", "Experiment design", "SQL", "Stakeholder management"],
            "suggested_role_categories": preferences.role_categories[:1],
            "notes": [
                "Keep skills to 8–12 high-signal items; remove near-duplicates.",
                "Add 1–2 domain skills that match your target industry (e.g., onboarding/activation).",
            ],
        }
        raw = client.run_chat_completion(messages, temperature=0.1, max_tokens=450, stub_json=stub_json)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        helper = extract_json_from_text(content_str) or stub_json

        return JobPreferencesResponse(
            success=True,
            message="Job preferences saved successfully",
            preferences=preferences,
            helper=helper,
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

    # Prefer demo cache if available
    if store.demo_job_preferences:
        try:
            prefs_obj = JobPreferences(**store.demo_job_preferences)
            return JobPreferencesResponse(
                success=True,
                message="Job preferences retrieved successfully",
                preferences=prefs_obj,
                helper={
                    "normalized_skills": sorted({s.strip() for s in (prefs_obj.skills or []) if str(s).strip()}),
                    "suggested_skills": ["SQL", "Experimentation", "Analytics", "Stakeholder management"],
                    "suggested_role_categories": prefs_obj.role_categories[:1],
                    "notes": ["Loaded from demo cache (DB unavailable)."],
                },
            )
        except Exception:
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
        helper={
            "normalized_skills": sorted({s.strip() for s in (mock_preferences.skills or []) if str(s).strip()}),
            "suggested_skills": ["SQL", "Experimentation", "Analytics", "System design"],
            "suggested_role_categories": mock_preferences.role_categories[:1],
            "notes": ["These are seeded demo preferences; edit them to match your target role."],
        },
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
