from typing import Dict, List
import re


COMMON_TITLES = [
    "intern",
    "junior",
    "associate",
    "engineer",
    "developer",
    "analyst",
    "manager",
    "lead",
    "senior",
    "director",
    "vp",
    "vice president",
    "head",
    "principal",
    "chief",
    "cto",
    "cpo",
    "product",
]


def infer_seniority_from_text(text: str) -> str:
    t = text.lower()
    if "director" in t or "head of" in t or "lead" in t:
        return "Director"
    if "senior" in t or "sr." in t:
        return "Senior"
    if "principal" in t:
        return "Principal"
    if "vp" in t or "vice president" in t:
        return "VP"
    return "Mid"


def extract_key_metrics(lines: List[str]) -> List[str]:
    # Lines with numbers/percents often are metrics
    metrics: List[str] = []
    for l in lines:
        if re.search(r"(\d+%|\b\d+[kKmM]?\b)", l):
            metrics.append(l)
    return metrics[:10]


def extract_problems_and_accomplishments(lines: List[str]) -> Dict[str, List[str]]:
    bullets = [l for l in lines if l.startswith(("- ", "• ", "* "))]
    problems = bullets[:10]
    accomplishments = [l for l in bullets if re.search(r"(launched|shipped|improved|reduced|increased)", l, re.I)]
    return {
        "ProblemsSolved": problems[:10],
        "NotableAccomplishments": accomplishments[:10],
    }


def extract_positions(lines: List[str]) -> List[Dict[str, str]]:
    positions: List[Dict[str, str]] = []
    for l in lines:
        if any(t in l.lower() for t in COMMON_TITLES):
            # naive position parsing
            parts = re.split(r"\s+at\s+|\s+-\s+|,\s*", l)
            if len(parts) >= 1:
                positions.append({
                    "title": parts[0][:80],
                    "company": parts[1][:80] if len(parts) > 1 else "",
                    "start_date": None,
                    "end_date": None,
                })
    # de-dup by title+company order preserved
    seen = set()
    unique: List[Dict[str, str]] = []
    for p in positions:
        key = (p.get("title"), p.get("company"))
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique[:8]


def extract_domains(text: str) -> List[str]:
    domains = []
    keywords = ["product", "growth", "platform", "data", "ml", "ai", "b2b", "b2c", "enterprise", "saas"]
    t = text.lower()
    for k in keywords:
        if k in t:
            domains.append(k)
    return domains[:6]


def parse_resume(text: str) -> Dict[str, object]:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    key_metrics = extract_key_metrics(lines)
    pa = extract_problems_and_accomplishments(lines)
    positions = extract_positions(lines)
    domains = extract_domains(text)
    seniority = infer_seniority_from_text(text)
    return {
        "KeyMetrics": key_metrics,
        "ProblemsSolved": pa["ProblemsSolved"],
        "NotableAccomplishments": pa["NotableAccomplishments"],
        "Positions": positions,
        "Tenure": [],
        "Domains": domains,
        "Seniority": seniority,
    }

