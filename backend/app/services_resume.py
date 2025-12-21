from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Tuple
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


_MAJOR_HEADINGS = {
    "SUMMARY",
    "EXPERIENCE",
    "EDUCATION",
    "SKILLS",
    "PUBLICATIONS",
    "BOOKS",
    "AWARDS",
    "WORK REFERENCES",
    "SOFTWARE PORTFOLIO",
}


def _normalize_text(s: str) -> str:
    # Remove common PDF null separators and normalize whitespace.
    s = (s or "").replace("\x00", " ").replace("\u0000", " ")
    s = s.replace("\u2013", "-").replace("\u2014", "-")
    # Collapse repeated spaces but keep newlines for section logic.
    s = re.sub(r"[ \t]+", " ", s)
    return s


def _is_heading(line: str) -> bool:
    t = re.sub(r"[^A-Za-z &/]+", "", (line or "").strip())
    if not t:
        return False
    return t.upper() in _MAJOR_HEADINGS


def _slice_sections(text: str) -> Dict[str, List[str]]:
    """
    Split extracted resume text into rough sections keyed by major headings.
    If a heading appears multiple times, keep the longest section content.
    """
    text = _normalize_text(text)
    lines = [l.strip() for l in text.splitlines()]
    sections: Dict[str, List[str]] = {}
    current: Optional[str] = None
    buf: List[str] = []

    def flush() -> None:
        nonlocal buf, current
        if current is None:
            buf = []
            return
        content = [x for x in buf if x and x.strip()]
        if not content:
            buf = []
            return
        prev = sections.get(current) or []
        if len(content) > len(prev):
            sections[current] = content
        buf = []

    for line in lines:
        if _is_heading(line):
            flush()
            current = line.strip().upper()
            continue
        if current is not None:
            buf.append(line)

    flush()
    return sections


def extract_skills_from_sections(sections: Dict[str, List[str]]) -> List[str]:
    """
    Extract skills from SKILLS section like Oliver-Oct.pdf:
    - category headings like "AI & ML" appear inline; we skip category tokens.
    - skills are comma-separated across wrapped lines.
    """
    raw_lines = sections.get("SKILLS") or []
    if not raw_lines:
        return []

    # Join with spaces so wrapped skills like "ML\nEngineering" stay intact.
    joined = " ".join(raw_lines)
    joined = _normalize_text(joined)
    # Force category markers to become explicit separators; PDF extraction often
    # drops commas/newlines and merges the last skill with the next category.
    category_markers = [
        "AI & ML",
        "DATA ENGINEERING",
        "PROGRAMMING & FRAMEWORKS",
        "CLOUD DEVOPS",
        "ROBOTICS & ROBOTIC SYSTEMS",
    ]
    for m in category_markers:
        joined = re.sub(rf"\\s+{re.escape(m)}\\s*", f", {m}, ", joined, flags=re.I)
    # Remove obvious garbage rows / artifacts.
    joined = re.sub(r"[•�]{2,}", " ", joined)
    joined = re.sub(r"\b[Ee]\s*\?\b", " ", joined)

    # Split by commas; most resumes list skills comma-separated.
    tokens = [t.strip(" ,;:\n\t") for t in joined.split(",")]

    category_set = {m.upper() for m in category_markers}

    skills: List[str] = []
    seen = set()
    for tok in tokens:
        if not tok:
            continue
        # Trim leading label fragments like "AI & ML" or "DATA ENGINEERING"
        up = tok.upper().strip()
        if up in category_set:
            continue
        # If a category marker got merged into a token, split it out.
        for m in category_markers:
            mu = m.upper()
            if mu in up and up != mu:
                tok = re.split(re.escape(m), tok, flags=re.I)[0].strip(" ,;:\n\t")
                up = tok.upper().strip()
                break
        if not tok or up in category_set:
            continue
        # Drop very long descriptive phrases (likely not a skill token)
        if len(tok) > 80 and " " in tok:
            continue
        # Drop obvious extraction garbage
        if re.fullmatch(r"[A-Za-z\? ]{0,6}", tok) and "?" in tok:
            continue
        # Normalize a couple artifacts
        tok = tok.replace("  ", " ").strip()
        tok = re.sub(r"\s*\(.*?\)\s*", lambda m: m.group(0) if len(m.group(0)) <= 28 else " ", tok).strip()
        key = tok.lower()
        if key in seen:
            continue
        seen.add(key)
        skills.append(tok)

    return skills[:60]


@dataclass
class _RoleSpan:
    title: str
    start_mm_yyyy: str
    end_mm_yyyy: str
    line_idx: int


def _parse_mm_yyyy(s: str) -> Optional[Tuple[int, int]]:
    m = re.match(r"^\s*(\d{2})/(\d{4})\s*$", s)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def _duration_str(start: str, end: str) -> str:
    """
    Convert MM/YYYY - (MM/YYYY|Present) to a human-ish duration string.
    """
    s = _parse_mm_yyyy(start)
    if not s:
        return ""
    em = end.strip().lower()
    if em == "present":
        today = date.today()
        e = (today.month, today.year)
    else:
        e = _parse_mm_yyyy(end)
        if not e:
            return ""

    sm, sy = s
    em2, ey2 = e
    months = (ey2 - sy) * 12 + (em2 - sm) + 1
    if months <= 0:
        return ""
    years = months // 12
    rem = months % 12
    if years and rem:
        return f"{years} yr {rem} mo"
    if years:
        return f"{years} yr"
    return f"{rem} mo"


def extract_roles_and_tenure(sections: Dict[str, List[str]]) -> Dict[str, object]:
    """
    Extract role spans and a tenure list from EXPERIENCE section.
    Works for Oliver-Oct.pdf where role lines look like:
      \"Principal Engineer ... 01/2025 - Present\"
    """
    exp = sections.get("EXPERIENCE") or []
    if not exp:
        return {"roles": [], "tenure": []}

    lines = [_normalize_text(l).strip() for l in exp if l and l.strip()]

    # Oliver-Oct.pdf extraction sometimes replaces the dash with a null-ish separator.
    # Accept dash variants OR just whitespace between start/end.
    role_re = re.compile(
        r"^(?P<title>.+?)\s+(?P<start>\d{2}/\d{4})\s*(?:-|–|—|to|\s)\s*(?P<end>(?:\d{2}/\d{4}|Present))\s*$",
        re.I,
    )

    roles: List[_RoleSpan] = []
    for idx, line in enumerate(lines):
        m = role_re.match(line)
        if not m:
            continue
        title = m.group("title").strip()
        start = m.group("start").strip()
        end = m.group("end").strip()
        roles.append(_RoleSpan(title=title, start_mm_yyyy=start, end_mm_yyyy=end, line_idx=idx))

    tenure: List[Dict[str, str]] = []
    for r in roles:
        company = ""
        # Company is often the next line; keep it short and strip trailing location.
        if r.line_idx + 1 < len(lines):
            nxt = lines[r.line_idx + 1]
            # Stop if the next line is a heading or too long
            if not _is_heading(nxt) and len(nxt) <= 80:
                company = nxt
        dur = _duration_str(r.start_mm_yyyy, r.end_mm_yyyy)
        tenure.append({"company": company, "duration": dur, "role": r.title})

    return {
        "roles": [{"title": r.title, "start": r.start_mm_yyyy, "end": r.end_mm_yyyy} for r in roles],
        "tenure": tenure[:12],
        "experience_lines": lines,
    }


def extract_roles_and_tenure_from_lines(lines: List[str]) -> Dict[str, object]:
    """
    Some resumes repeat EXPERIENCE blocks (e.g. portfolio section later).
    Scan all lines for role/date spans to build a tenure list.
    """
    lines = [_normalize_text(l).strip() for l in lines if l and l.strip()]
    if not lines:
        return {"roles": [], "tenure": []}

    role_re = re.compile(
        r"^(?P<title>.+?)\s+(?P<start>\d{2}/\d{4})\s*(?:-|–|—|to|\s)\s*(?P<end>(?:\d{2}/\d{4}|Present))\s*$",
        re.I,
    )

    roles: List[_RoleSpan] = []
    for idx, line in enumerate(lines):
        m = role_re.match(line)
        if not m:
            continue
        title = m.group("title").strip()
        start = m.group("start").strip()
        end = m.group("end").strip()
        roles.append(_RoleSpan(title=title, start_mm_yyyy=start, end_mm_yyyy=end, line_idx=idx))

    tenure: List[Dict[str, str]] = []
    for r in roles:
        company = ""
        if r.line_idx + 1 < len(lines):
            nxt = lines[r.line_idx + 1]
            if len(nxt) <= 90 and not _is_heading(nxt):
                company = nxt
        dur = _duration_str(r.start_mm_yyyy, r.end_mm_yyyy)
        tenure.append({"company": company, "duration": dur, "role": r.title})

    return {
        "roles": [{"title": r.title, "start": r.start_mm_yyyy, "end": r.end_mm_yyyy} for r in roles],
        "tenure": tenure[:20],
    }


def extract_notable_accomplishments(sections: Dict[str, List[str]]) -> List[str]:
    """
    Pull concise accomplishment lines from EXPERIENCE section.
    Oliver-Oct.pdf uses paragraph-like lines (not bullets), so we use heuristics:
    - keep lines with action verbs or metrics
    - skip role/company header lines
    """
    exp = sections.get("EXPERIENCE") or []
    if not exp:
        return []

    lines = [_normalize_text(l).strip() for l in exp if l and l.strip()]
    role_header_re = re.compile(r"\d{2}/\d{4}\s*(?:-|–|—|\s)\s*(?:\d{2}/\d{4}|Present)\s*$", re.I)
    two_dates_re = re.compile(r"\b\d{2}/\d{4}\b.*\b\d{2}/\d{4}\b")

    verbs = re.compile(r"\b(architect|built|ship|shipped|delivered|designed|led|implemented|improved|reduced|increased|optimized|deployed|integrated|created|developed|launched)\b", re.I)
    has_metric = re.compile(r"(\d+%|\b\d{1,3}[kKmM]\+?\b|\b\d{2,}\b)")

    acc: List[str] = []
    seen = set()
    for l in lines:
        if len(l) < 18 or len(l) > 180:
            continue
        if _is_heading(l):
            continue
        if role_header_re.search(l) or two_dates_re.search(l):
            continue
        # Skip obvious company/location lines
        if l.lower().endswith(" remote") or l.lower().endswith(" va") or l.lower().endswith(" tx"):
            continue
        if verbs.search(l) or has_metric.search(l):
            norm = l.strip(" -•\t")
            key = norm.lower()
            if key in seen:
                continue
            seen.add(key)
            acc.append(norm)
        if len(acc) >= 12:
            break
    return acc


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
    text = _normalize_text(text)
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    sections = _slice_sections(text)
    key_metrics = extract_key_metrics(lines)
    pa = extract_problems_and_accomplishments(lines)
    # Prefer roles from EXPERIENCE if we can parse them; otherwise fall back to naive title detection.
    roles_info = extract_roles_and_tenure(sections)
    roles_info_all = extract_roles_and_tenure_from_lines(lines)
    if len(roles_info_all.get("tenure") or []) > len(roles_info.get("tenure") or []):
        roles_info = roles_info_all
    positions = extract_positions(lines)
    skills = extract_skills_from_sections(sections)
    accomplishments = extract_notable_accomplishments(sections) or pa["NotableAccomplishments"]
    tenure = roles_info.get("tenure") or []
    domains = extract_domains(text)
    seniority = infer_seniority_from_text(text)
    return {
        "KeyMetrics": key_metrics,
        "ProblemsSolved": pa["ProblemsSolved"],
        "NotableAccomplishments": accomplishments[:15],
        "Positions": positions,
        "Tenure": tenure,
        "Skills": skills,
        "Domains": domains,
        "Seniority": seniority,
    }

