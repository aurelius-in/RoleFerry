from typing import Dict, Any, List


def normalize_title(title: str) -> str:
    return title.lower().strip()


def score_match(candidate: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    score = 0
    reasons: List[str] = []
    blockers: List[str] = []

    ct = normalize_title(candidate.get("title", candidate.get("seniority", "")))
    jt = normalize_title(job.get("title", ""))
    if ct and jt and any(k in jt for k in ct.split()):
        score += 30
        reasons.append("Title alignment")

    cand_domains = [d.lower() for d in candidate.get("domains", [])]
    if cand_domains and any(d in jt for d in cand_domains):
        score += 20
        reasons.append("Domain match")

    loc = job.get("location")
    if loc and ("remote" in loc.lower()):
        score += 10
        reasons.append("Remote OK")

    if score == 0:
        blockers.append("Insufficient overlap")

    return {
        "score": min(100, score),
        "reasons": reasons,
        "blockers": blockers,
    }

