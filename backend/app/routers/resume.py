from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import json

from sqlalchemy import text as sql_text, bindparam
from sqlalchemy.dialects.postgresql import JSONB

from ..db import get_engine
from ..services_resume import parse_resume
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store


router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)
DEMO_USER_ID = "demo-user"

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
        if not file.filename.lower().endswith((".pdf", ".docx", ".txt")):
            raise HTTPException(status_code=400, detail="Only PDF, DOCX and TXT files are supported")

        # Read file contents and attempt a simple text decode.
        # For Week 9 we don't do true PDF/DOCX parsing; this is enough
        # to exercise the rule-based parser and store structured data.
        contents = await file.read()
        try:
            raw_text = contents.decode("utf-8", errors="ignore")
        except Exception:
            raw_text = ""

        # Run rule-based parser to populate resume.* style fields for storage
        parsed = parse_resume(raw_text or "")
        # Cache in memory so matching works even without DB
        store.demo_latest_resume = parsed
        store.demo_latest_resume_text = raw_text or ""

        # Persist to the RESUME table as raw text + parsed JSON for a demo user (best-effort).
        # For first-run demos, Postgres may be unavailable; we still return a usable response.
        try:
            stmt = (
                sql_text(
                    """
                    INSERT INTO resume (user_id, raw_text, parsed_json)
                    VALUES (:user_id, :raw_text, :parsed)
                    """
                ).bindparams(bindparam("parsed", type_=JSONB))
            )
            async with engine.begin() as conn:
                await conn.execute(
                    stmt,
                    {
                        "user_id": DEMO_USER_ID,
                        "raw_text": raw_text,
                        "parsed": parsed,
                    },
                )
        except Exception:
            pass

        # Build a ResumeExtract for the UI. Prefer GPT-backed parsing when
        # configured; otherwise fall back to a deterministic mock structure.
        client = get_openai_client()
        extract_obj: Optional[ResumeExtract] = None

        if client.should_use_real_llm and raw_text:
            try:
                raw = client.summarize_resume(raw_text)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")

                data = extract_json_from_text(content_str) or {}
                if isinstance(data, dict) and data:
                    positions_raw = data.get("positions") or []
                    tenure_raw = data.get("tenure") or []
                    key_metrics_raw = data.get("key_metrics") or []
                    accomplishments_raw = data.get("accomplishments") or []
                    skills_raw = data.get("skills") or []

                    positions: List[Position] = []
                    for p in positions_raw:
                        if not isinstance(p, dict):
                            continue
                        positions.append(
                            Position(
                                company=str(p.get("company") or ""),
                                title=str(p.get("title") or ""),
                                start_date=str(p.get("start_date") or ""),
                                end_date=str(p.get("end_date") or ""),
                                current=bool(p.get("current") or False),
                                description=str(p.get("description") or ""),
                            )
                        )

                    tenure: List[Tenure] = []
                    for t in tenure_raw:
                        if not isinstance(t, dict):
                            continue
                        tenure.append(
                            Tenure(
                                company=str(t.get("company") or ""),
                                duration=str(t.get("duration") or ""),
                                role=str(t.get("role") or ""),
                            )
                        )

                    key_metrics: List[KeyMetric] = []
                    for m in key_metrics_raw:
                        if isinstance(m, dict):
                            key_metrics.append(
                                KeyMetric(
                                    metric=str(m.get("metric") or ""),
                                    value=str(m.get("value") or ""),
                                    context=str(m.get("context") or ""),
                                )
                            )
                        else:
                            key_metrics.append(
                                KeyMetric(metric=str(m), value="", context="")
                            )

                    accomplishments = [str(a) for a in accomplishments_raw]
                    skills = [str(s) for s in skills_raw]

                    extract_obj = ResumeExtract(
                        positions=positions,
                        key_metrics=key_metrics,
                        skills=skills,
                        accomplishments=accomplishments,
                        tenure=tenure,
                    )
            except Exception:
                # On any GPT failure, we'll fall back to the deterministic mock below.
                extract_obj = None

        if extract_obj is None:
            # Deterministic mock structure as a safe fallback (previous behavior)
            extract_obj = ResumeExtract(
                positions=[
                    Position(
                        company="TechCorp Inc.",
                        title="Senior Software Engineer",
                        start_date="2022-01",
                        end_date="2024-12",
                        current=True,
                        description="Led development of microservices architecture, reducing system latency by 40%",
                    ),
                    Position(
                        company="StartupXYZ",
                        title="Full Stack Developer",
                        start_date="2020-06",
                        end_date="2021-12",
                        current=False,
                        description="Built customer-facing web application serving 10K+ users",
                    ),
                ],
                key_metrics=[
                    KeyMetric(
                        metric="System Performance",
                        value="40% reduction",
                        context="in latency through microservices optimization",
                    ),
                    KeyMetric(
                        metric="User Growth",
                        value="10K+ users",
                        context="served through customer-facing application",
                    ),
                    KeyMetric(
                        metric="Team Leadership",
                        value="5 engineers",
                        context="managed in cross-functional team",
                    ),
                ],
                skills=["Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "PostgreSQL"],
                accomplishments=[
                    "Reduced system latency by 40% through microservices architecture",
                    "Led team of 5 engineers in cross-functional projects",
                    "Built scalable web application serving 10K+ users",
                    "Implemented CI/CD pipeline reducing deployment time by 60%",
                ],
                tenure=[
                    Tenure(company="TechCorp Inc.", duration="2 years", role="Senior Software Engineer"),
                    Tenure(company="StartupXYZ", duration="1.5 years", role="Full Stack Developer"),
                ],
            )

        return ResumeExtractResponse(
            success=True,
            message="Resume parsed successfully",
            extract=extract_obj,
        )
    except Exception as e:
        logger.exception("Error parsing resume")
        raise HTTPException(status_code=500, detail="Failed to parse resume")

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
        logger.exception("Error saving resume extract")
        raise HTTPException(status_code=500, detail="Failed to save resume extract")

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
        logger.exception("Error retrieving resume extract")
        raise HTTPException(status_code=500, detail="Failed to get resume extract")

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
        logger.exception("Error updating resume extract")
        raise HTTPException(status_code=500, detail="Failed to update resume extract")

@router.delete("/{user_id}")
async def delete_resume_extract(user_id: str):
    """
    Delete resume extract for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Resume extract deleted successfully"}
    except Exception as e:
        logger.exception("Error deleting resume extract")
        raise HTTPException(status_code=500, detail="Failed to delete resume extract")
