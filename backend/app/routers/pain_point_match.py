from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import logging
import json

from sqlalchemy import text as sql_text

from ..db import get_engine
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store

router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)
DEMO_USER_ID = "demo-user"

class PinpointMatch(BaseModel):
    pinpoint_1: str
    solution_1: str
    metric_1: str
    pinpoint_2: str
    solution_2: str
    metric_2: str
    pinpoint_3: str
    solution_3: str
    metric_3: str
    alignment_score: float

class PinpointMatchResponse(BaseModel):
    success: bool
    message: str
    matches: List[PinpointMatch]

class MatchRequest(BaseModel):
    job_description_id: str
    resume_extract_id: str

@router.post("/generate", response_model=PinpointMatchResponse)
async def generate_pinpoint_matches(request: MatchRequest):
    """
    Generate pinpoint matches between job description pain points and resume solutions.
    """
    try:
        # Look up the selected job and the latest resume for the demo user.
        # In first-run demos Postgres may be unavailable; fall back to empty rows.
        job_row = None
        resume_row = None
        try:
            async with engine.begin() as conn:
                if request.job_description_id:
                    result = await conn.execute(
                        sql_text(
                            """
                            SELECT id, parsed_json
                            FROM job
                            WHERE id = :job_id AND user_id = :user_id
                            """
                        ),
                        {
                            "job_id": request.job_description_id,
                            "user_id": DEMO_USER_ID,
                        },
                    )
                    job_row = result.first()

                res = await conn.execute(
                    sql_text(
                        """
                        SELECT id, parsed_json
                        FROM resume
                        WHERE user_id = :user_id
                        ORDER BY created_at DESC
                        LIMIT 1
                        """
                    ),
                    {"user_id": DEMO_USER_ID},
                )
                resume_row = res.first()
        except Exception:
            job_row = None
            resume_row = None

        # Prefer DB if available, otherwise use in-memory demo cache
        if not job_row and request.job_description_id in store.demo_job_descriptions:
            jd_parsed = store.demo_job_descriptions[request.job_description_id].get("parsed_json") or {}
        else:
            jd_parsed = (job_row.parsed_json if job_row else {}) or {}

        if not resume_row and store.demo_latest_resume:
            resume_parsed = store.demo_latest_resume or {}
        else:
            resume_parsed = (resume_row.parsed_json if resume_row else {}) or {}

        jd_pain_points = jd_parsed.get("pain_points") or []
        resume_accomplishments = (
            resume_parsed.get("NotableAccomplishments")
            or resume_parsed.get("KeyMetrics")
            or []
        )

        # Helper: rule-based pairing (previous behavior)
        def build_rule_based_match() -> PinpointMatch:
            pp = list(jd_pain_points)[:3]
            acc = list(resume_accomplishments)[:3]

            def _safe_get(items, idx, default=""):
                return items[idx] if idx < len(items) else default

            return PinpointMatch(
                pinpoint_1=_safe_get(pp, 0, "Need to reduce time-to-fill for engineering roles"),
                solution_1=_safe_get(
                    acc,
                    0,
                    "Reduced TTF by 40% using ATS optimization and streamlined hiring process",
                ),
                metric_1="",
                pinpoint_2=_safe_get(
                    pp,
                    1,
                    "Struggling with candidate quality and cultural fit",
                ),
                solution_2=_safe_get(
                    acc,
                    1,
                    "Implemented structured interview process with cultural fit assessment",
                ),
                metric_2="",
                pinpoint_3=_safe_get(
                    pp,
                    2,
                    "High turnover in engineering team affecting project delivery",
                ),
                solution_3=_safe_get(
                    acc,
                    2,
                    "Built team retention program with career development focus",
                ),
                metric_3="",
                alignment_score=0.8,
            )

        # Try GPT-backed matching first when configured
        client = get_openai_client()
        match: PinpointMatch

        if client.should_use_real_llm and (jd_pain_points or resume_accomplishments):
            try:
                # Build compact text blobs for GPT
                jd_blob = json.dumps(
                    {
                        "pain_points": jd_pain_points,
                        "success_metrics": jd_parsed.get("success_metrics") or [],
                    },
                    ensure_ascii=False,
                )
                resume_blob = json.dumps(
                    {
                        "notable_accomplishments": resume_parsed.get("NotableAccomplishments") or [],
                        "key_metrics": resume_parsed.get("KeyMetrics") or [],
                    },
                    ensure_ascii=False,
                )
                raw = client.generate_pain_point_map(jd_blob, resume_blob)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")
                data = extract_json_from_text(content_str) or {}

                pairs = data.get("pairs") or []
                alignment_score = float(data.get("alignment_score") or 0.8)

                def _pair(idx: int) -> Dict[str, Any]:
                    return pairs[idx] if idx < len(pairs) else {}

                p1 = _pair(0)
                p2 = _pair(1)
                p3 = _pair(2)

                match = PinpointMatch(
                    pinpoint_1=str(p1.get("jd_snippet") or (jd_pain_points[0] if jd_pain_points else "")),
                    solution_1=str(p1.get("resume_snippet") or (resume_accomplishments[0] if resume_accomplishments else "")),
                    metric_1=str(p1.get("metric") or ""),
                    pinpoint_2=str(p2.get("jd_snippet") or (jd_pain_points[1] if len(jd_pain_points) > 1 else "")),
                    solution_2=str(p2.get("resume_snippet") or (resume_accomplishments[1] if len(resume_accomplishments) > 1 else "")),
                    metric_2=str(p2.get("metric") or ""),
                    pinpoint_3=str(p3.get("jd_snippet") or (jd_pain_points[2] if len(jd_pain_points) > 2 else "")),
                    solution_3=str(p3.get("resume_snippet") or (resume_accomplishments[2] if len(resume_accomplishments) > 2 else "")),
                    metric_3=str(p3.get("metric") or ""),
                    alignment_score=alignment_score,
                )
            except Exception:
                match = build_rule_based_match()
        else:
            match = build_rule_based_match()

        # Persist each (challenge, solution) pair into pain_point_match table (best-effort).
        try:
            async with engine.begin() as conn:
                challenge_solution_pairs = [
                    (match.pinpoint_1, match.solution_1),
                    (match.pinpoint_2, match.solution_2),
                    (match.pinpoint_3, match.solution_3),
                ]
                for ch, sol in challenge_solution_pairs:
                    if not ch or not sol:
                        continue
                    await conn.execute(
                        sql_text(
                            """
                            INSERT INTO pain_point_match (user_id, job_id, resume_id, challenge_text, solution_text, relevance_score)
                            VALUES (:user_id, :job_id, :resume_id, :challenge_text, :solution_text, :score)
                            """
                        ),
                        {
                            "user_id": DEMO_USER_ID,
                            "job_id": job_row.id if job_row else None,
                            "resume_id": resume_row.id if resume_row else None,
                            "challenge_text": ch,
                            "solution_text": sol,
                            "score": match.alignment_score,
                        },
                    )
        except Exception:
            pass

        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches generated successfully",
            matches=[match],
        )
    except Exception as e:
        logger.exception("Error generating pain point matches")
        raise HTTPException(status_code=500, detail="Failed to generate matches")

@router.post("/save", response_model=PinpointMatchResponse)
async def save_pinpoint_matches(matches: List[PinpointMatch]):
    """
    Save pinpoint matches for a user.
    """
    try:
        # In a real app, save to database with user_id
        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches saved successfully",
            matches=matches
        )
    except Exception as e:
        logger.exception("Error saving pain point matches")
        raise HTTPException(status_code=500, detail="Failed to save matches")

@router.get("/{user_id}", response_model=PinpointMatchResponse)
async def get_pinpoint_matches(user_id: str):
    """
    Get pinpoint matches for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_matches = [
            PinpointMatch(
                pinpoint_1="Need to reduce time-to-fill for engineering roles",
                solution_1="Reduced TTF by 40% using ATS optimization and streamlined hiring process",
                metric_1="40% reduction, 18 vs 30 days average",
                pinpoint_2="Struggling with candidate quality and cultural fit",
                solution_2="Implemented structured interview process with cultural fit assessment",
                metric_2="Improved candidate quality scores by 35%",
                pinpoint_3="High turnover in engineering team affecting project delivery",
                solution_3="Built team retention program with career development focus",
                metric_3="Reduced turnover by 25% in 6 months",
                alignment_score=0.85
            )
        ]
        
        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches retrieved successfully",
            matches=mock_matches
        )
    except Exception as e:
        logger.exception("Error retrieving pain point matches")
        raise HTTPException(status_code=500, detail="Failed to get matches")

@router.put("/{user_id}", response_model=PinpointMatchResponse)
async def update_pinpoint_matches(user_id: str, matches: List[PinpointMatch]):
    """
    Update pinpoint matches for a user.
    """
    try:
        # In a real app, update in database
        return PinpointMatchResponse(
            success=True,
            message="Pinpoint matches updated successfully",
            matches=matches
        )
    except Exception as e:
        logger.exception("Error updating pain point matches")
        raise HTTPException(status_code=500, detail="Failed to update matches")

@router.delete("/{user_id}")
async def delete_pinpoint_matches(user_id: str):
    """
    Delete pinpoint matches for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Pinpoint matches deleted successfully"}
    except Exception as e:
        logger.exception("Error deleting pain point matches")
        raise HTTPException(status_code=500, detail="Failed to delete matches")

@router.get("/{user_id}/score")
async def get_alignment_score(user_id: str):
    """
    Get the overall alignment score for a user's matches.
    """
    try:
        # In a real app, calculate from stored matches
        # For now, return mock data
        return {
            "success": True,
            "alignment_score": 0.85,
            "score_label": "Excellent Match",
            "message": "Alignment score retrieved successfully"
        }
    except Exception as e:
        logger.exception("Error retrieving alignment score")
        raise HTTPException(status_code=500, detail="Failed to get alignment score")
