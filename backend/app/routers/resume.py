from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import json
import io

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

        # Read file contents and extract text. We prefer true PDF/DOCX parsing;
        # if we can't extract meaningful text, we return an explicit error rather
        # than showing canned demo content (which confuses demos).
        contents = await file.read()

        def extract_text_from_pdf(data: bytes) -> str:
            try:
                from pypdf import PdfReader  # type: ignore
            except Exception as e:
                raise HTTPException(status_code=500, detail="PDF parsing dependency missing") from e
            reader = PdfReader(io.BytesIO(data))
            parts: List[str] = []
            for page in reader.pages:
                try:
                    t = page.extract_text() or ""
                except Exception:
                    t = ""
                if t.strip():
                    parts.append(t)
            return "\n\n".join(parts).strip()

        def extract_text_from_docx(data: bytes) -> str:
            try:
                import docx  # type: ignore
            except Exception as e:
                raise HTTPException(status_code=500, detail="DOCX parsing dependency missing") from e
            d = docx.Document(io.BytesIO(data))
            parts: List[str] = []
            for p in d.paragraphs:
                if p.text and p.text.strip():
                    parts.append(p.text.strip())
            # Tables (some resumes are table-heavy)
            for table in d.tables:
                for row in table.rows:
                    for cell in row.cells:
                        txt = (cell.text or "").strip()
                        if txt:
                            parts.append(txt)
            return "\n".join(parts).strip()

        filename = (file.filename or "").lower()
        raw_text = ""
        if filename.endswith(".pdf"):
            raw_text = extract_text_from_pdf(contents)
        elif filename.endswith(".docx"):
            raw_text = extract_text_from_docx(contents)
        else:
            try:
                raw_text = contents.decode("utf-8", errors="ignore")
            except Exception:
                raw_text = ""

        # If we couldn't extract real text, stop and tell the user what happened.
        # (Common cause: scanned/image-only PDFs; requires OCR.)
        if not raw_text or len(raw_text.strip()) < 200:
            raise HTTPException(
                status_code=400,
                detail="Could not extract readable text from this file. If it's a scanned PDF, export as text-based PDF or upload a DOCX/TXT instead.",
            )

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

        # Build a ResumeExtract for the UI. Prefer GPT-backed parsing when configured.
        # We no longer fall back to canned demo resume content here; if GPT fails,
        # we fall back to a minimal structure derived from the rule-based parser.
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
                # On any GPT failure, we'll fall back to the rule-based parser output below.
                extract_obj = None

        # If GPT succeeded but missed fields, backfill from rule-based parsing
        if extract_obj is not None:
            if not extract_obj.skills:
                extract_obj.skills = [str(s) for s in (parsed.get("Skills") or [])]
            if not extract_obj.accomplishments:
                extract_obj.accomplishments = [str(a) for a in (parsed.get("NotableAccomplishments") or [])]
            if not extract_obj.tenure:
                tenure_raw = parsed.get("Tenure") or []
                if isinstance(tenure_raw, list):
                    extract_obj.tenure = [
                        Tenure(
                            company=str(t.get("company") or ""),
                            duration=str(t.get("duration") or ""),
                            role=str(t.get("role") or ""),
                        )
                        for t in tenure_raw
                        if isinstance(t, dict)
                    ]

        if extract_obj is None:
            # Rule-based fallback derived from the parsed resume (best-effort).
            # This should still reflect the uploaded resume text, not canned demo data.
            positions: List[Position] = []
            for p in (parsed.get("WorkExperience") or parsed.get("positions") or [])[:6]:
                if isinstance(p, dict):
                    positions.append(
                        Position(
                            company=str(p.get("company") or p.get("Company") or ""),
                            title=str(p.get("title") or p.get("Title") or ""),
                            start_date=str(p.get("start_date") or p.get("StartDate") or ""),
                            end_date=str(p.get("end_date") or p.get("EndDate") or ""),
                            current=bool(p.get("current") or False),
                            description=str(p.get("description") or p.get("Description") or ""),
                        )
                    )

            key_metrics: List[KeyMetric] = []
            for m in (parsed.get("KeyMetrics") or parsed.get("key_metrics") or [])[:10]:
                if isinstance(m, dict):
                    key_metrics.append(
                        KeyMetric(
                            metric=str(m.get("metric") or m.get("Metric") or ""),
                            value=str(m.get("value") or m.get("Value") or ""),
                            context=str(m.get("context") or m.get("Context") or ""),
                        )
                    )
                else:
                    key_metrics.append(KeyMetric(metric=str(m), value="", context=""))

            skills = [str(s) for s in (parsed.get("Skills") or parsed.get("skills") or [])][:40]
            accomplishments = [str(a) for a in (parsed.get("NotableAccomplishments") or parsed.get("accomplishments") or [])][:25]
            tenure: List[Tenure] = []
            for t in (parsed.get("Tenure") or parsed.get("tenure") or [])[:10]:
                if isinstance(t, dict):
                    tenure.append(
                        Tenure(
                            company=str(t.get("company") or t.get("Company") or ""),
                            duration=str(t.get("duration") or t.get("Duration") or ""),
                            role=str(t.get("role") or t.get("Role") or ""),
                        )
                    )

            extract_obj = ResumeExtract(
                positions=positions,
                key_metrics=key_metrics,
                skills=skills,
                accomplishments=accomplishments,
                tenure=tenure,
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
