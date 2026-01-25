from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import json
import re

from sqlalchemy import text as sql_text

from ..db import get_engine
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..storage import store

router = APIRouter()
engine = get_engine()
logger = logging.getLogger(__name__)
DEMO_USER_ID = "demo-user"

class PainPointMatch(BaseModel):
    painpoint_1: str
    jd_evidence_1: Optional[str] = ""
    solution_1: str
    resume_evidence_1: Optional[str] = ""
    metric_1: str
    overlap_1: Optional[str] = ""
    painpoint_2: str
    jd_evidence_2: Optional[str] = ""
    solution_2: str
    resume_evidence_2: Optional[str] = ""
    metric_2: str
    overlap_2: Optional[str] = ""
    painpoint_3: str
    jd_evidence_3: Optional[str] = ""
    solution_3: str
    resume_evidence_3: Optional[str] = ""
    metric_3: str
    overlap_3: Optional[str] = ""
    alignment_score: float


class PainPointMatchResponse(BaseModel):
    success: bool
    message: str
    matches: List[PainPointMatch]

class MatchRequest(BaseModel):
    job_description_id: str
    resume_extract_id: str
    # Optional fallback from frontend when the job isn't present in DB/demo store.
    job_description: Optional[Dict[str, Any]] = None
    # Optional fallback from frontend when the resume isn't present in DB/demo store.
    resume_extract: Optional[Dict[str, Any]] = None


def _tokenize(s: str) -> List[str]:
    return [t for t in re.split(r"[^a-z0-9]+", (s or "").lower()) if t and len(t) > 2]


def _is_fluff_line(s: str) -> bool:
    low = (s or "").lower()
    # Filter aggregator/marketing/UI copy that is not a responsibility/problem-to-solve
    bad = [
        "kickstart your job search",
        "get access now",
        "meet jobcopilot",
        "try it now",
        "similar remote jobs",
        "beware of scams",
        "please mention that you come from",
        "do you have experience",
        "find out how your skills align",
        "discover valuable connections",
        "get 3x more responses",
        "beyond your network",
        "find any email",
        "apply for this position",
        "apply now",
        "save",
        "premium",
        # A.Team / community marketing (not a concrete problem)
        "invited to impactful missions",
        "match your interests",
        "off-the-record gatherings",
        "micro-communities",
        "we quietly launched",
        "our long-term vision",
        "we call them",
        "invite-only",
    ]
    if any(b in low for b in bad):
        return True
    # Generic role descriptors are not pain points (common scrape failure)
    if re.match(r"^(developer|software developer|engineer|software engineer)\b.*\bworking on\b", low):
        return True
    if re.match(r"^(developer|software developer|engineer|software engineer)\b.*\bmaintenance\b", low) and "reduce" not in low and "improve" not in low:
        return True
    # Section headers (esp. with colon)
    if s.strip().endswith(":"):
        return True
    # Too short to be useful
    if len(s.strip()) < 12:
        return True
    return False


def _clean_candidates(items: Any, *, max_len: int = 240) -> List[str]:
    if not isinstance(items, list):
        return []
    out: List[str] = []
    seen = set()
    for it in items:
        s = str(it or "").strip().lstrip("•-* ").strip()
        if not s:
            continue
        s = " ".join(s.split())
        if _is_fluff_line(s):
            continue
        if len(s) > max_len:
            s = s[: max_len - 1].rstrip() + "…"
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def _best_evidence(target: str, candidates: List[str]) -> str:
    """
    Pick the closest candidate line to the target based on token overlap.
    """
    t = (target or "").strip()
    if not t:
        return ""
    if not candidates:
        return t[:220]
    tt = set(_tokenize(t))
    best = ""
    best_score = -1
    for c in candidates:
        cc = set(_tokenize(c))
        score = len(tt.intersection(cc))
        # Prefer lines that share more words; small bias for shorter quotes.
        score = score * 10 - int(len(c) / 60)
        if score > best_score:
            best_score = score
            best = c
    return (best or t)[:220]


@router.post("/generate", response_model=PainPointMatchResponse)
async def generate_painpoint_matches(request: MatchRequest):
    """
    Generate pain point matches between job description pain points and resume solutions.
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

        # Prefer DB if available, otherwise use in-memory demo cache; finally accept client payload.
        if not job_row and request.job_description_id in store.demo_job_descriptions:
            jd_parsed = store.demo_job_descriptions[request.job_description_id].get("parsed_json") or {}
        else:
            jd_parsed = (job_row.parsed_json if job_row else {}) or {}

        if not jd_parsed and isinstance(request.job_description, dict):
            jd_parsed = request.job_description or {}

        if not resume_row and store.demo_latest_resume:
            resume_parsed = store.demo_latest_resume or {}
        else:
            resume_parsed = (resume_row.parsed_json if resume_row else {}) or {}

        if not resume_parsed and isinstance(request.resume_extract, dict):
            resume_parsed = request.resume_extract or {}

        jd_pain_points = jd_parsed.get("pain_points") or []
        jd_responsibilities = jd_parsed.get("responsibilities") or []
        jd_requirements = jd_parsed.get("requirements") or []
        jd_required_skills = jd_parsed.get("required_skills") or []
        jd_success_metrics = jd_parsed.get("success_metrics") or []
        def _to_text(x: Any) -> str:
            if x is None:
                return ""
            if isinstance(x, str):
                return x
            if isinstance(x, dict):
                # Common resume shapes
                for k in ("accomplishment", "context", "metric", "value", "description", "text"):
                    v = x.get(k)
                    if isinstance(v, str) and v.strip():
                        return v
                try:
                    return json.dumps(x, ensure_ascii=False)
                except Exception:
                    return str(x)
            return str(x)

        def _looks_like_pdf_garbage(s: str) -> bool:
            t = (s or "").strip()
            if not t:
                return True
            if t.startswith("%PDF-"):
                return True
            if " obj" in t and "endobj" in t:
                return True
            if "/Creator" in t or "/Producer" in t:
                return True
            if "stream" in t and "endstream" in t:
                return True
            return False

        raw_accomplishments = (
            resume_parsed.get("NotableAccomplishments")
            or resume_parsed.get("accomplishments")
            or resume_parsed.get("KeyMetrics")
            or resume_parsed.get("keyMetrics")
            or resume_parsed.get("key_metrics")
            or []
        )
        # Normalize + filter out PDF/binary artifacts so we never show them as "solutions".
        resume_accomplishments = []
        if isinstance(raw_accomplishments, list):
            for a in raw_accomplishments:
                txt = _to_text(a).strip()
                if not txt or _looks_like_pdf_garbage(txt):
                    continue
                resume_accomplishments.append(txt)
        else:
            txt = _to_text(raw_accomplishments).strip()
            if txt and not _looks_like_pdf_garbage(txt):
                resume_accomplishments = [txt]

        # Metrics pool: prefer numeric values; otherwise keep qualitative metrics as "Qualitative: <metric>"
        metric_candidates: List[str] = []
        for m in (resume_parsed.get("KeyMetrics") or resume_parsed.get("key_metrics") or resume_parsed.get("keyMetrics") or [])[:40]:
            if isinstance(m, dict):
                metric = str(m.get("metric") or "").strip()
                value = str(m.get("value") or "").strip()
                ctx = str(m.get("context") or "").strip()
                if value:
                    metric_candidates.append(" — ".join([x for x in [metric, value, ctx] if x]).strip(" —")[:240])
                elif metric:
                    metric_candidates.append(f"Qualitative: {metric}"[:240])
        metric_candidates = [x for x in metric_candidates if x and not _is_fluff_line(x)]

        # Helper: rule-based pairing (avoid demo defaults; allow 0–3 alignments)
        def build_rule_based_match() -> PainPointMatch:
            # Prefer concrete items; responsibilities/requirements tend to be most concrete.
            resp = _clean_candidates(jd_responsibilities)
            reqs = _clean_candidates(jd_requirements)
            pps = _clean_candidates(jd_pain_points)
            sms = _clean_candidates(jd_success_metrics)

            # Candidate JD evidence pool (ordered by relevance)
            jd_candidates = (resp + reqs + pps + sms)[:30]
            def _pp_score(line: str) -> int:
                low = (line or "").lower()
                sc = 0
                sc += 15 if any(k in low for k in ["reduce", "improve", "increase", "scale", "optimiz", "reliab", "latency", "cost", "incident", "uptime", "performance"]) else 0
                sc += 8 if any(k in low for k in ["deliver", "ship", "build", "implement", "migrate", "automate"]) else 0
                sc -= 12 if "working on" in low else 0
                sc -= 8 if low.startswith(("developer ", "engineer ", "software engineer", "software developer")) else 0
                sc -= max(0, len(line) - 140) // 20
                return sc
            pp = sorted(jd_candidates, key=_pp_score, reverse=True)[:10]

            acc = [str(x).strip() for x in (resume_accomplishments or []) if str(x).strip()]
            # Resume evidence pool: accomplishments + role descriptions + key metric contexts
            resume_candidates: List[str] = []
            for a in acc[:25]:
                if a and not _is_fluff_line(a):
                    resume_candidates.append(a[:240])
            for p in (resume_parsed.get("Positions") or resume_parsed.get("positions") or [])[:25]:
                if isinstance(p, dict):
                    d = str(p.get("description") or "").strip()
                    if d and not _is_fluff_line(d):
                        resume_candidates.append(d[:240])
            for m in (resume_parsed.get("KeyMetrics") or resume_parsed.get("key_metrics") or resume_parsed.get("keyMetrics") or resume_parsed.get("keyMetrics") or [])[:25]:
                if isinstance(m, dict):
                    ctx = str(m.get("context") or "").strip()
                    metric = str(m.get("metric") or "").strip()
                    val = str(m.get("value") or "").strip()
                    s = " — ".join([x for x in [metric, val, ctx] if x])
                    if s and not _is_fluff_line(s):
                        resume_candidates.append(s[:240])

            # Solutions: prefer accomplishments, then key metric lines, then role description lines.
            solution_pool = []
            solution_pool.extend([a for a in acc[:10] if a and not _is_fluff_line(a)])
            solution_pool.extend([m for m in resume_candidates[:15] if m and not _is_fluff_line(m)])
            if not solution_pool:
                solution_pool = resume_candidates[:10]

            def _safe_get(items, idx) -> str:
                return items[idx] if idx < len(items) else ""

            # Best-effort score: more real inputs -> higher confidence
            score = 0.55
            score += 0.1 if len(pp) >= 1 else 0.0
            score += 0.1 if len(solution_pool) >= 1 else 0.0
            score += 0.05 if len(pp) >= 2 else 0.0
            score += 0.05 if len(solution_pool) >= 2 else 0.0
            score = min(score, 0.9)

            # Metric: never leave empty; prefer numeric, else qualitative.
            metric_default = metric_candidates[0] if metric_candidates else "Qualitative: improved outcomes (confirm metric in resume bullets)."

            return PainPointMatch(
                painpoint_1=_safe_get(pp, 0),
                jd_evidence_1=_best_evidence(_safe_get(pp, 0), jd_candidates),
                solution_1=_safe_get(solution_pool, 0),
                resume_evidence_1=_best_evidence(_safe_get(solution_pool, 0), resume_candidates),
                metric_1=metric_default,
                overlap_1="",
                painpoint_2=_safe_get(pp, 1),
                jd_evidence_2=_best_evidence(_safe_get(pp, 1), jd_candidates),
                solution_2=_safe_get(solution_pool, 1),
                resume_evidence_2=_best_evidence(_safe_get(solution_pool, 1), resume_candidates),
                metric_2=metric_default,
                overlap_2="",
                painpoint_3=_safe_get(pp, 2),
                jd_evidence_3=_best_evidence(_safe_get(pp, 2), jd_candidates),
                solution_3=_safe_get(solution_pool, 2),
                resume_evidence_3=_best_evidence(_safe_get(solution_pool, 2), resume_candidates),
                metric_3=metric_default,
                overlap_3="",
                alignment_score=score,
            )

        # Try GPT-backed matching first when configured
        client = get_openai_client()
        match: PainPointMatch

        has_jd_signal = bool(jd_pain_points or jd_responsibilities or jd_requirements or jd_required_skills or jd_success_metrics)
        has_resume_signal = bool(
            resume_accomplishments
            or (resume_parsed.get("Positions") or resume_parsed.get("positions") or resume_parsed.get("positions"))
            or (resume_parsed.get("Skills") or resume_parsed.get("skills") or resume_parsed.get("skills"))
            or (resume_parsed.get("KeyMetrics") or resume_parsed.get("key_metrics") or resume_parsed.get("keyMetrics"))
            or (resume_parsed.get("NotableAccomplishments") or resume_parsed.get("accomplishments") or resume_parsed.get("accomplishments"))
        )

        if client.should_use_real_llm and (has_jd_signal and has_resume_signal):
            try:
                # Build compact text blobs for GPT
                jd_blob = json.dumps(
                    {
                        "pain_points": jd_pain_points,
                        "responsibilities": jd_responsibilities,
                        "requirements": jd_requirements,
                        "required_skills": jd_required_skills,
                        "success_metrics": jd_success_metrics,
                    },
                    ensure_ascii=False,
                )
                resume_blob = json.dumps(
                    {
                        "positions": resume_parsed.get("Positions") or resume_parsed.get("positions") or [],
                        "skills": resume_parsed.get("Skills") or resume_parsed.get("skills") or [],
                        "accomplishments": resume_parsed.get("NotableAccomplishments") or resume_parsed.get("accomplishments") or [],
                        "key_metrics": resume_parsed.get("KeyMetrics") or resume_parsed.get("key_metrics") or resume_parsed.get("keyMetrics") or [],
                        "business_challenges": resume_parsed.get("BusinessChallenges") or resume_parsed.get("business_challenges") or [],
                        "education": resume_parsed.get("Education") or resume_parsed.get("education") or [],
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

                def _safe_list_get(items: list, idx: int) -> str:
                    try:
                        v = items[idx]
                        return str(v).strip()
                    except Exception:
                        return ""

                match = PainPointMatch(
                    painpoint_1=str(p1.get("jd_snippet") or _safe_list_get(jd_pain_points, 0)).strip(),
                    jd_evidence_1=str(p1.get("jd_evidence") or "").strip(),
                    solution_1=str(p1.get("resume_snippet") or _safe_list_get(resume_accomplishments, 0)).strip(),
                    resume_evidence_1=str(p1.get("resume_evidence") or "").strip(),
                    metric_1=str(p1.get("metric") or "").strip(),
                    overlap_1=str(p1.get("overlap") or "").strip(),
                    painpoint_2=str(p2.get("jd_snippet") or _safe_list_get(jd_pain_points, 1)).strip(),
                    jd_evidence_2=str(p2.get("jd_evidence") or "").strip(),
                    solution_2=str(p2.get("resume_snippet") or _safe_list_get(resume_accomplishments, 1)).strip(),
                    resume_evidence_2=str(p2.get("resume_evidence") or "").strip(),
                    metric_2=str(p2.get("metric") or "").strip(),
                    overlap_2=str(p2.get("overlap") or "").strip(),
                    painpoint_3=str(p3.get("jd_snippet") or _safe_list_get(jd_pain_points, 2)).strip(),
                    jd_evidence_3=str(p3.get("jd_evidence") or "").strip(),
                    solution_3=str(p3.get("resume_snippet") or _safe_list_get(resume_accomplishments, 2)).strip(),
                    resume_evidence_3=str(p3.get("resume_evidence") or "").strip(),
                    metric_3=str(p3.get("metric") or "").strip(),
                    overlap_3=str(p3.get("overlap") or "").strip(),
                    alignment_score=alignment_score,
                )
            except Exception:
                match = build_rule_based_match()
        else:
            match = build_rule_based_match()

        # Post-process: ensure evidence is never blank, and avoid fluff pain points.
        jd_candidates = _clean_candidates(jd_responsibilities) + _clean_candidates(jd_requirements) + _clean_candidates(jd_pain_points) + _clean_candidates(jd_success_metrics)
        resume_candidates: List[str] = []
        resume_candidates.extend(_clean_candidates(resume_parsed.get("accomplishments") or resume_parsed.get("NotableAccomplishments") or []))
        resume_candidates.extend(_clean_candidates(resume_parsed.get("skills") or resume_parsed.get("Skills") or []))
        for p in (resume_parsed.get("positions") or resume_parsed.get("Positions") or [])[:40]:
            if isinstance(p, dict):
                d = str(p.get("description") or "").strip()
                if d and not _is_fluff_line(d):
                    resume_candidates.append(" ".join(d.split())[:240])
        for m in (resume_parsed.get("keyMetrics") or resume_parsed.get("KeyMetrics") or resume_parsed.get("key_metrics") or [])[:40]:
            if isinstance(m, dict):
                s = " — ".join([str(m.get("metric") or "").strip(), str(m.get("value") or "").strip(), str(m.get("context") or "").strip()]).strip(" —")
                if s and not _is_fluff_line(s):
                    resume_candidates.append(" ".join(s.split())[:240])

        for n in (1, 2, 3):
            pp = str(getattr(match, f"painpoint_{n}", "") or "").strip()
            jde = str(getattr(match, f"jd_evidence_{n}", "") or "").strip()
            sol = str(getattr(match, f"solution_{n}", "") or "").strip()
            rse = str(getattr(match, f"resume_evidence_{n}", "") or "").strip()
            met = str(getattr(match, f"metric_{n}", "") or "").strip()

            # If pain point itself is fluff, try to replace from candidates
            if pp and _is_fluff_line(pp) and jd_candidates:
                pp = jd_candidates[min(n - 1, len(jd_candidates) - 1)]
                setattr(match, f"painpoint_{n}", pp)

            if pp and not jde:
                setattr(match, f"jd_evidence_{n}", _best_evidence(pp, jd_candidates))
            if sol and not rse:
                setattr(match, f"resume_evidence_{n}", _best_evidence(sol, resume_candidates))
            # Never return empty metric; prefer extracted key metrics, otherwise a qualitative placeholder.
            if not met:
                setattr(
                    match,
                    f"metric_{n}",
                    (metric_candidates[n - 1] if len(metric_candidates) >= n else (metric_candidates[0] if metric_candidates else "Qualitative: positive impact (confirm metric from resume).")),
                )

        # Persist each (challenge, solution) pair into pain_point_match table (best-effort).
        try:
            async with engine.begin() as conn:
                challenge_solution_pairs = [
                    (match.painpoint_1, match.solution_1),
                    (match.painpoint_2, match.solution_2),
                    (match.painpoint_3, match.solution_3),
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

        return PainPointMatchResponse(
            success=True,
            message="Pain point matches generated successfully",
            matches=[match],
        )
    except Exception as e:
        logger.exception("Error generating pain point matches")
        raise HTTPException(status_code=500, detail="Failed to generate matches")

@router.post("/save", response_model=PainPointMatchResponse)
async def save_painpoint_matches(matches: List[PainPointMatch]):
    """
    Save pain point matches for a user.
    """
    try:
        # In a real app, save to database with user_id
        return PainPointMatchResponse(
            success=True,
            message="Pain point matches saved successfully",
            matches=matches
        )
    except Exception as e:
        logger.exception("Error saving pain point matches")
        raise HTTPException(status_code=500, detail="Failed to save matches")

@router.get("/{user_id}", response_model=PainPointMatchResponse)
async def get_painpoint_matches(user_id: str):
    """
    Get pain point matches for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_matches = [
            PainPointMatch(
                painpoint_1="Need to reduce time-to-fill for engineering roles",
                solution_1="Reduced TTF by 40% using ATS optimization and streamlined hiring process",
                metric_1="40% reduction, 18 vs 30 days average",
                painpoint_2="Struggling with candidate quality and cultural fit",
                solution_2="Implemented structured interview process with cultural fit assessment",
                metric_2="Improved candidate quality scores by 35%",
                painpoint_3="High turnover in engineering team affecting project delivery",
                solution_3="Built team retention program with career development focus",
                metric_3="Reduced turnover by 25% in 6 months",
                alignment_score=0.85
            )
        ]
        
        return PainPointMatchResponse(
            success=True,
            message="Pain point matches retrieved successfully",
            matches=mock_matches
        )
    except Exception as e:
        logger.exception("Error retrieving pain point matches")
        raise HTTPException(status_code=500, detail="Failed to get matches")

@router.put("/{user_id}", response_model=PainPointMatchResponse)
async def update_painpoint_matches(user_id: str, matches: List[PainPointMatch]):
    """
    Update pain point matches for a user.
    """
    try:
        # In a real app, update in database
        return PainPointMatchResponse(
            success=True,
            message="Pain point matches updated successfully",
            matches=matches
        )
    except Exception as e:
        logger.exception("Error updating pain point matches")
        raise HTTPException(status_code=500, detail="Failed to update matches")

@router.delete("/{user_id}")
async def delete_painpoint_matches(user_id: str):
    """
    Delete pain point matches for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Pain point matches deleted successfully"}
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
