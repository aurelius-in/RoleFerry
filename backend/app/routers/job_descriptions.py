from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import json

from sqlalchemy import text as sql_text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from ..db import get_engine
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store

router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)
DEMO_USER_ID = "demo-user"

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

class JobImportRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None


@router.post("/import", response_model=JobDescriptionResponse)
async def import_job_description(payload: JobImportRequest):
    """
    Import and parse job description from URL or text.
    """
    try:
        url = payload.url
        text = payload.text

        if not url and not text:
            raise HTTPException(status_code=400, detail="Either URL or text must be provided")

        # For Week 10, prefer GPT-backed parsing when configured; otherwise
        # fall back to a simple deterministic parser.
        content = text or "Job description content from URL..."

        # --- Deterministic defaults (previous behavior) -----------------
        # Improve first-run demo quality by pulling a best-effort title from the text.
        # (When GPT is enabled, it may override these.)
        title = "Senior Software Engineer"
        company = "TechCorp Inc."
        try:
            lines = [ln.strip() for ln in (content or "").splitlines() if ln.strip()]
            if lines:
                # Heuristic: first line often contains the job title.
                title = lines[0][:120]
            # Heuristic: if a line starts with "Company:", use it.
            for ln in lines[:20]:
                if ln.lower().startswith("company:"):
                    company = ln.split(":", 1)[1].strip()[:120] or company
                    break
        except Exception:
            pass
        pain_points: List[str] = [
            "Need to reduce time-to-fill for engineering roles",
            "Struggling with candidate quality and cultural fit",
            "High turnover in engineering team affecting project delivery",
        ]
        required_skills: List[str] = [
            "Python",
            "JavaScript",
            "React",
            "Node.js",
            "AWS",
            "Docker",
            "PostgreSQL",
        ]
        success_metrics: List[str] = [
            "Reduce time-to-hire by 30%",
            "Improve candidate quality scores",
            "Increase team retention by 25%",
        ]

        parsed_json: Dict[str, Any] = {
            "pain_points": pain_points,
            "required_skills": required_skills,
            "success_metrics": success_metrics,
        }

        # --- Optional GPT-backed parsing via OpenAIClient ---------------
        client = get_openai_client()
        if client.should_use_real_llm:
            try:
                raw = client.extract_job_structure(content)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")

                data = extract_json_from_text(content_str) or {}
                if isinstance(data, dict) and data:
                    # Let GPT override title/company when provided
                    title = str(data.get("title") or title)
                    company = str(data.get("company") or company)
                    pain_points = [str(p) for p in (data.get("pain_points") or pain_points)]
                    required_skills = [str(s) for s in (data.get("required_skills") or required_skills)]
                    success_metrics = [str(m) for m in (data.get("success_metrics") or success_metrics)]
                    parsed_json = {
                        "pain_points": pain_points,
                        "required_skills": required_skills,
                        "success_metrics": success_metrics,
                    }
            except Exception:
                # On any GPT failure, keep deterministic defaults.
                pass

        # Persist job + a starter application row for demo user (best-effort).
        # For first-run demos, Postgres may be unavailable; in that case we still
        # return a usable response and let the frontend keep state in localStorage.
        job_id = f"jd_demo_{len(store.demo_job_descriptions) + 1}"
        try:
            stmt_job = (
                sql_text(
                    """
                    INSERT INTO job (user_id, title, company, url, content, parsed_json)
                    VALUES (:user_id, :title, :company, :url, :content, :parsed)
                    RETURNING id
                    """
                ).bindparams(bindparam("parsed", type_=JSONB))
            )

            async with engine.begin() as conn:
                result = await conn.execute(
                    stmt_job,
                    {
                        "user_id": DEMO_USER_ID,
                        "title": title,
                        "company": company,
                        "url": url,
                        "content": content,
                        "parsed": parsed_json,
                    },
                )
                row = result.first()
                job_id = str(row[0]) if row else job_id

                # Auto-create an APPLICATION row in status "saved"
                if row:
                    await conn.execute(
                        sql_text(
                            """
                            INSERT INTO application (user_id, job_id, status, created_at)
                            VALUES (:user_id, :job_id, 'saved', now())
                            """
                        ),
                        {"user_id": DEMO_USER_ID, "job_id": row[0]},
                    )
        except Exception:
            # DB is optional for demo; proceed without persistence.
            pass

        # Always cache in memory for first-run demos (so downstream steps can work without DB).
        store.demo_job_descriptions[job_id] = {
            "id": job_id,
            "title": title,
            "company": company,
            "url": url,
            "content": content,
            "parsed_json": parsed_json,
        }

        jd = JobDescription(
            id=job_id,
            title=title,
            company=company,
            url=url,
            content=content,
            pain_points=pain_points,
            required_skills=required_skills,
            success_metrics=success_metrics,
            parsed_at="2024-01-15T10:30:00Z",
        )

        return JobDescriptionResponse(
            success=True,
            message="Job description parsed and stored successfully",
            job_description=jd,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error importing job description")
        raise HTTPException(status_code=500, detail="Failed to parse job description")

@router.post("/save", response_model=JobDescriptionResponse)
async def save_job_description(job_description: JobDescription):
    """
    Save job description for a user.
    """
    try:
        parsed_json = {
            "pain_points": job_description.pain_points,
            "required_skills": job_description.required_skills,
            "success_metrics": job_description.success_metrics,
        }
        stmt = (
            sql_text(
                """
                INSERT INTO job (user_id, title, company, url, content, parsed_json)
                VALUES (:user_id, :title, :company, :url, :content, :parsed)
                """
            ).bindparams(bindparam("parsed", type_=JSONB))
        )
        async with engine.begin() as conn:
            # For Week 9, treat this as an append-only insert; let DB assign UUID
            await conn.execute(
                stmt,
                {
                    "user_id": DEMO_USER_ID,
                    "title": job_description.title,
                    "company": job_description.company,
                    "url": job_description.url,
                    "content": job_description.content,
                    "parsed": parsed_json,
                },
            )

        return JobDescriptionResponse(
            success=True,
            message="Job description saved successfully",
            job_description=job_description,
        )
    except Exception as e:
        logger.exception("Error saving job description")
        raise HTTPException(status_code=500, detail="Failed to save job description")

@router.get("/{user_id}", response_model=JobDescriptionsListResponse)
async def get_job_descriptions(user_id: str):
    """
    Get all job descriptions for a user.
    """
    try:
        # For Week 9, fetch any jobs stored for the demo user; fall back to mocks if empty
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    SELECT id, title, company, url, content, parsed_json, created_at
                    FROM job
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    """
                ),
                {"user_id": DEMO_USER_ID},
            )
            rows = result.fetchall()

        job_descriptions: List[JobDescription] = []
        for row in rows:
            parsed = row.parsed_json or {}
            job_descriptions.append(
                JobDescription(
                    id=str(row.id),
                    title=row.title,
                    company=row.company,
                    url=row.url,
                    content=row.content or "",
                    pain_points=parsed.get("pain_points", []),
                    required_skills=parsed.get("required_skills", []),
                    success_metrics=parsed.get("success_metrics", []),
                    parsed_at=row.created_at.isoformat() if getattr(row, "created_at", None) else "",
                )
            )

        if not job_descriptions:
            # Fallback to mock data if DB is empty
            job_descriptions = [
                JobDescription(
                    id="jd_123",
                    title="Senior Software Engineer",
                    company="TechCorp Inc.",
                    url="https://techcorp.com/jobs/senior-engineer",
                    content="Job description content...",
                    pain_points=[
                        "Need to reduce time-to-fill for engineering roles",
                        "Struggling with candidate quality and cultural fit",
                    ],
                    required_skills=["Python", "JavaScript", "React", "Node.js"],
                    success_metrics=[
                        "Reduce time-to-hire by 30%",
                        "Improve candidate quality scores",
                    ],
                    parsed_at="2024-01-15T10:30:00Z",
                )
            ]

        return JobDescriptionsListResponse(
            success=True,
            message="Job descriptions retrieved successfully",
            job_descriptions=job_descriptions,
        )
    except Exception as e:
        logger.exception("Error listing job descriptions")
        raise HTTPException(status_code=500, detail="Failed to get job descriptions")

@router.get("/{user_id}/{jd_id}", response_model=JobDescriptionResponse)
async def get_job_description(user_id: str, jd_id: str):
    """
    Get a specific job description for a user.
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(
                sql_text(
                    """
                    SELECT id, title, company, url, content, parsed_json, created_at
                    FROM job
                    WHERE user_id = :user_id AND id = :job_id::uuid
                    """
                ),
                {"user_id": DEMO_USER_ID, "job_id": jd_id},
            )
            row = result.first()

        if row:
            parsed = row.parsed_json or {}
            jd = JobDescription(
                id=str(row.id),
                title=row.title,
                company=row.company,
                url=row.url,
                content=row.content or "",
                pain_points=parsed.get("pain_points", []),
                required_skills=parsed.get("required_skills", []),
                success_metrics=parsed.get("success_metrics", []),
                parsed_at=row.created_at.isoformat() if getattr(row, "created_at", None) else "",
            )
        else:
            # Fallback to mock data if not found in DB
            jd = JobDescription(
                id=jd_id,
                title="Senior Software Engineer",
                company="TechCorp Inc.",
                url="https://techcorp.com/jobs/senior-engineer",
                content="Job description content...",
                pain_points=[
                    "Need to reduce time-to-fill for engineering roles",
                    "Struggling with candidate quality and cultural fit",
                ],
                required_skills=["Python", "JavaScript", "React", "Node.js"],
                success_metrics=[
                    "Reduce time-to-hire by 30%",
                    "Improve candidate quality scores",
                ],
                parsed_at="2024-01-15T10:30:00Z",
            )

        return JobDescriptionResponse(
            success=True,
            message="Job description retrieved successfully",
            job_description=jd,
        )
    except Exception as e:
        logger.exception("Error retrieving job description")
        raise HTTPException(status_code=500, detail="Failed to get job description")

@router.put("/{user_id}/{jd_id}", response_model=JobDescriptionResponse)
async def update_job_description(user_id: str, jd_id: str, job_description: JobDescription):
    """
    Update a job description for a user.
    """
    try:
        parsed_json = {
            "pain_points": job_description.pain_points,
            "required_skills": job_description.required_skills,
            "success_metrics": job_description.success_metrics,
        }
        stmt = (
            sql_text(
                """
                UPDATE job
                SET title = :title,
                    company = :company,
                    url = :url,
                    content = :content,
                    parsed_json = :parsed
                WHERE id = :id::uuid AND user_id = :user_id
                """
            ).bindparams(bindparam("parsed", type_=JSONB))
        )
        async with engine.begin() as conn:
            await conn.execute(
                stmt,
                {
                    "id": jd_id,
                    "user_id": DEMO_USER_ID,
                    "title": job_description.title,
                    "company": job_description.company,
                    "url": job_description.url,
                    "content": job_description.content,
                    "parsed": parsed_json,
                },
            )

        return JobDescriptionResponse(
            success=True,
            message="Job description updated successfully",
            job_description=job_description,
        )
    except Exception as e:
        logger.exception("Error updating job description")
        raise HTTPException(status_code=500, detail="Failed to update job description")

@router.delete("/{user_id}/{jd_id}")
async def delete_job_description(user_id: str, jd_id: str):
    """
    Delete a job description for a user.
    """
    try:
        async with engine.begin() as conn:
            await conn.execute(
                sql_text("DELETE FROM job WHERE id = :id::uuid AND user_id = :user_id"),
                {"id": jd_id, "user_id": DEMO_USER_ID},
            )
        return {"success": True, "message": "Job description deleted successfully"}
    except Exception as e:
        logger.exception("Error deleting job description")
        raise HTTPException(status_code=500, detail="Failed to delete job description")
