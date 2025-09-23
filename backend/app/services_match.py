from typing import Dict, Any, List


def normalize_title(title: str) -> str:
    return title.lower().strip()


def score_match(candidate: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    score = 0
    reasons: List[str] = []
    blockers: List[str] = []
    evidence: List[str] = []

    ct = normalize_title(candidate.get("title", candidate.get("seniority", "")))
    jt = normalize_title(job.get("title", ""))
    if ct and jt and any(k in jt for k in ct.split()):
        score += 30
        reasons.append("Title alignment")
        evidence.append(f"Job title '{job.get('title')}' overlaps with candidate '{candidate.get('title','') or candidate.get('seniority','')}'.")

    cand_domains = [d.lower() for d in candidate.get("domains", [])]
    if cand_domains and any(d in jt for d in cand_domains):
        score += 20
        reasons.append("Domain match")
        evidence.append(f"Domains {cand_domains} appear relevant to '{job.get('title')}'.")

    loc = job.get("location")
    if loc and ("remote" in loc.lower()):
        score += 10
        reasons.append("Remote OK")
        evidence.append("Job marked remote, broadening fit.")

    if score == 0:
        blockers.append("Insufficient overlap")

    # Level gap blocker (very basic heuristic)
    cand_level = (candidate.get("seniority") or "").lower()
    if "director" in jt and cand_level and cand_level not in ("director", "head", "vp", "principal"):
        blockers.append("Level gap vs Director role")

    # Evidence from resume metrics/positions if provided
    metrics = []
    sections = candidate.get("metrics_json") or {}
    if isinstance(sections, dict):
        metrics = sections.get("KeyMetrics") or sections.get("NotableAccomplishments") or []
    for m in metrics[:3]:
        evidence.append(m)

    return {
        "score": min(100, score),
        "reasons": reasons,
        "blockers": blockers,
        "evidence": evidence[:6],
    }

