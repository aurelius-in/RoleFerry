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


# PDFs (especially from Word/Google Docs templates) often use non-standard bullet glyphs
# (e.g., "" / "") that survive text extraction.
_BULLET_RE = re.compile(r"^(\-|\*|•|‣|▪|●|·|||\uFFFD)\s*")


def _is_bullet_line(s: str) -> bool:
    return bool(_BULLET_RE.match((s or "").lstrip()))


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
    """
    Heuristic key metrics extractor.

    We only extract metrics that are explicitly present in the resume text
    (numbers, currency, percents, scale indicators). We do NOT invent metrics.
    """
    metrics: List[str] = []

    # Recognize numbers that are more likely to be "impact" than just years.
    has_metric_token = re.compile(
        r"("
        r"\$\s*\d[\d,]*(?:\.\d+)?\s*(?:[kKmMbB])?\+?"
        r"|\b\d{2,3}%\b|\b\d+%\b"
        r"|\b\d[\d,]*(?:\.\d+)?\s*(?:k|m|b)\+?\b"
        r"|\b\d{2,}\b"
        r")"
    )
    looks_like_year = re.compile(r"\b(19|20)\d{2}\b")
    looks_like_year_range = re.compile(r"\b(19|20)\d{2}\b\s*[-–—]\s*\b(19|20)\d{2}\b")
    looks_like_phone = re.compile(r"\b\d{3}[- )]\d{3}[- ]\d{4}\b")

    for raw in lines:
        l = (raw or "").strip()
        if len(l) < 10 or len(l) > 240:
            continue
        low = l.lower()
        if "linkedin.com" in low or "mailto:" in low or "@" in low:
            continue
        if looks_like_phone.search(l):
            continue
        if looks_like_year_range.search(l):
            continue

        if not has_metric_token.search(l):
            continue

        # If it contains a year token, require stronger metric markers to avoid date noise.
        if looks_like_year.search(l):
            if re.search(r"(\$|%|\b\d[\d,]*\s*(?:k|m|b)\b)", l, re.I):
                metrics.append(l)
            else:
                continue
        else:
            metrics.append(l)

    # De-dupe while preserving order
    seen = set()
    out: List[str] = []
    for m in metrics:
        k = m.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(m)
        if len(out) >= 12:
            break
    return out[:10]


def extract_problems_and_accomplishments(lines: List[str]) -> Dict[str, List[str]]:
    bullets = [l for l in lines if _is_bullet_line(l)]
    problems = bullets[:12]
    accomplishments = [
        l
        for l in bullets
        if re.search(r"(launched|shipped|improved|reduced|increased|optimized|built|designed|delivered|led)", l, re.I)
        or re.search(r"(\$|%|\b\d[\d,]*\s*(?:k|m|b)\b)", l, re.I)
    ]
    return {
        "ProblemsSolved": problems[:10],
        "NotableAccomplishments": accomplishments[:10],
    }


_MAJOR_HEADINGS = {
    "SUMMARY",
    "PROFESSIONAL SUMMARY",
    "PROFILE",
    # Experience
    "EXPERIENCE",
    "PROFESSIONAL EXPERIENCE",
    "WORK EXPERIENCE",
    "WORK HISTORY",
    "EMPLOYMENT HISTORY",
    "PROFESSIONAL HISTORY",
    "CAREER HISTORY",
    # Education
    "EDUCATION",
    # Skills
    "SKILLS",
    "CORE SKILLS",
    "CORE COMPETENCIES",
    "TECHNICAL SKILLS",
    "SKILLS & TOOLS",
    "TOP SKILLS",
    "LANGUAGES",
    "TECH STACK",
    "TECHNOLOGIES",
    "TOOLS",
    "TECHNICAL PROFICIENCIES",
    # Other
    "PUBLICATIONS",
    "BOOKS",
    "AWARDS",
    "WORK REFERENCES",
    "SOFTWARE PORTFOLIO",
    # Accomplishments/Projects
    "ACCOMPLISHMENTS",
    "NOTABLE ACCOMPLISHMENTS",
    "ACHIEVEMENTS",
    "HIGHLIGHTS",
    "PROJECTS",
    "SELECTED PROJECTS",
    "PROJECT EXPERIENCE",
    # Challenges
    "BUSINESS CHALLENGES SOLVED",
    "BUSINESS CHALLENGES",
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
    up = t.upper()
    if up in _MAJOR_HEADINGS:
        return True
    # Some DOCX resumes use "Skills:" or "Experience -" style headings.
    up2 = up.strip().rstrip(":").strip()
    return up2 in _MAJOR_HEADINGS


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
            # Normalize to canonical keys for downstream extractors.
            head = re.sub(r"[^A-Za-z &/]+", "", (line or "").strip()).upper().strip().rstrip(":").strip()
            if head in ["WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE"]:
                head = "EXPERIENCE"
            if head in ["WORK HISTORY", "EMPLOYMENT HISTORY", "PROFESSIONAL HISTORY", "CAREER HISTORY"]:
                head = "EXPERIENCE"
            if head in ["CORE SKILLS", "CORE COMPETENCIES", "TECHNICAL SKILLS", "SKILLS & TOOLS"]:
                head = "SKILLS"
            if head in ["TOP SKILLS", "LANGUAGES", "TECH STACK", "TECHNOLOGIES", "TOOLS", "TECHNICAL PROFICIENCIES"]:
                head = "SKILLS"
            if head in ["ACHIEVEMENTS", "HIGHLIGHTS", "NOTABLE ACCOMPLISHMENTS", "ACCOMPLISHMENTS"]:
                head = "ACCOMPLISHMENTS"
            if head in ["PROJECTS", "SELECTED PROJECTS", "PROJECT EXPERIENCE"]:
                head = "ACCOMPLISHMENTS"
            if head in ["BUSINESS CHALLENGES", "BUSINESS CHALLENGES SOLVED"]:
                head = "BUSINESS_CHALLENGES"
            current = head
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

    # Many DOCX resumes list skills as bullets or short lines; PDFs often use commas.
    # We'll support both.
    joined = _normalize_text(" ".join([l.strip() for l in raw_lines if l and l.strip()]))
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

    # Split by commas/semicolons first.
    tokens = [t.strip(" ,;:\n\t") for t in re.split(r"[;,]", joined)]
    # Also treat each original line as a potential token (bullets / one-skill-per-line).
    for l in raw_lines:
        s = _normalize_text(l).strip()
        s = s.lstrip("-•* ").strip()
        if s:
            tokens.append(s)

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


def extract_skills_from_lines(lines: List[str]) -> List[str]:
    """
    Fallback skills extractor for resumes without an explicit SKILLS section.
    Looks for inline "Skills:" / "Technologies:" patterns and comma-separated tool lists.
    """
    out: List[str] = []
    seen = set()

    def add(tok: str) -> None:
        t = (tok or "").strip().strip("•-* ").strip()
        if not t or len(t) > 60:
            return
        k = t.lower()
        if k in seen:
            return
        seen.add(k)
        out.append(t)

    inline_re = re.compile(r"^(skills|tools|technologies|tech stack|stack|languages)\s*[:\-]\s*(.+)$", re.I)
    for l in lines:
        m = inline_re.match((l or "").strip())
        if not m:
            continue
        rhs = m.group(2)
        for tok in re.split(r"[;,/]| {2,}", rhs):
            if tok.strip():
                add(tok)

    return out[:60]


def extract_business_challenges(sections: Dict[str, List[str]], all_lines: List[str]) -> List[str]:
    """
    Business challenges solved / problems tackled.
    Prefer an explicit BUSINESS_CHALLENGES section if present; otherwise use bullets/lines
    that look like problem statements from across the resume.
    """
    raw = sections.get("BUSINESS_CHALLENGES") or []
    out: List[str] = []
    seen = set()

    def add(s: str) -> None:
        s = (s or "").strip().lstrip("-•* ").strip()
        if len(s) < 8:
            return
        if len(s) > 220:
            return
        k = s.lower()
        if k in seen:
            return
        seen.add(k)
        out.append(s)

    for l in raw:
        # Split bullets embedded in one line
        if "•" in l:
            for part in l.split("•"):
                add(part)
        else:
            add(l)

    if out:
        return out[:15]

    # Fallback: use "problems solved" bullets from anywhere.
    bullets = [l for l in all_lines if _is_bullet_line(l)]
    for b in bullets:
        add(b)

    if out:
        return out[:15]

    # Last resort: look for "challenge/problem" phrasing / outcome verbs.
    for l in all_lines:
        low = l.lower()
        if any(
            w in low
            for w in [
                "challenge",
                "problem",
                "turnaround",
                "stalled",
                "blocked",
                "fix",
                "reduce",
                "improve",
                "increase",
                "optimize",
                "scale",
                "automate",
                "accelerate",
                "streamline",
            ]
        ):
            add(l)
        if len(out) >= 10:
            break
    return out[:15]


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


_MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _parse_month_year(s: str) -> Optional[Tuple[int, int]]:
    """
    Parse 'January 2025' / 'Jan 2025' -> (1, 2025).
    """
    m = re.match(r"^\s*([A-Za-z]{3,9})\s+(\d{4})\s*$", s)
    if not m:
        return None
    mon = _MONTHS.get(m.group(1).strip().lower())
    if not mon:
        return None
    return mon, int(m.group(2))


def _parse_date_token(s: str) -> Optional[Tuple[int, int]]:
    """
    Parse either MM/YYYY or Month YYYY into (month, year).
    """
    s2 = (s or "").strip()
    return _parse_mm_yyyy(s2) or _parse_month_year(s2)


def _duration_str(start: str, end: str) -> str:
    """
    Convert MM/YYYY - (MM/YYYY|Present) to a human-ish duration string.
    """
    s = _parse_date_token(start)
    if not s:
        return ""
    em = end.strip().lower()
    if em == "present":
        today = date.today()
        e = (today.month, today.year)
    else:
        e = _parse_date_token(end)
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
    date_token = r"(?:\d{2}/\d{4}|[A-Za-z]{3,9}\s+\d{4})"
    role_re = re.compile(
        rf"^(?P<title>.+?)\s+(?P<start>{date_token})\s*(?:-|–|—|to|\s)\s*(?P<end>(?:{date_token}|Present))(?:\s*\(.*\))?\s*$",
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

    date_token = r"(?:\d{2}/\d{4}|[A-Za-z]{3,9}\s+\d{4})"
    role_re = re.compile(
        rf"^(?P<title>.+?)\s+(?P<start>{date_token})\s*(?:-|–|—|to|\s)\s*(?P<end>(?:{date_token}|Present))(?:\s*\(.*\))?\s*$",
        re.I,
    )
    date_line_re = re.compile(
        rf"^(?P<start>{date_token})\s*(?:-|–|—|to)\s*(?P<end>(?:{date_token}|Present))(?:\s*\(.*\))?\s*$",
        re.I,
    )

    def _strip_md_prefix(s: str) -> str:
        return re.sub(r"^\s*#+\s*", "", (s or "").strip())

    def _is_page_marker(s: str) -> bool:
        low = (s or "").strip().lower()
        return low.startswith("page ") and " of " in low

    _duration_heading_re = re.compile(r"^\s*\d+\s+years?(?:\s+\d+\s+months?)?\s*$", re.I)

    def _is_duration_heading(s: str) -> bool:
        return bool(_duration_heading_re.match((s or "").strip()))

    def _is_md_heading_line(s: str) -> bool:
        return bool((s or "").lstrip().startswith("#"))

    def _looks_like_title(s: str) -> bool:
        low = (s or "").lower()
        if not low:
            return False
        if any(t in low for t in COMMON_TITLES):
            return True
        return any(
            k in low
            for k in [
                "engineer",
                "architect",
                "manager",
                "director",
                "lead",
                "founder",
                "scientist",
                "facilitator",
                "developer",
                "consultant",
                "administrator",
                "officer",
                "medic",
                "integration",
            ]
        )

    def _looks_like_company(s: str) -> bool:
        cand = (s or "").strip()
        if not cand or _is_page_marker(cand) or _is_duration_heading(cand):
            return False
        if cand.endswith(":"):
            return False
        if cand.strip().lower() in {"key contributions:", "key contribution:"}:
            return False
        if _is_heading(cand) or _looks_like_title(cand):
            return False
        if len(cand) > 60:
            return False
        low = cand.lower()
        if low.startswith(("i ", "built ", "developed ", "designed ", "engineered ", "led ", "mentored ")):
            return False
        # Must have some alphabetic tokens
        words = re.findall(r"[A-Za-z]+", cand)
        if not words:
            return False
        if len(words) > 8:
            return False
        # Prefer title-case / acronym-heavy lines as "company-ish"
        upperish = sum(1 for w in words if w[0].isupper())
        if upperish >= max(1, len(words) // 2):
            return True
        # Allow common org suffixes
        if any(x in cand for x in ["Inc", "LLC", "Ltd", "University", "Group", "Center", "Corps", "Army", "Navy"]):
            return True
        return False

    roles: List[_RoleSpan] = []
    for idx, line in enumerate(lines):
        m = role_re.match(line)
        if not m:
            continue
        title = m.group("title").strip()
        start = m.group("start").strip()
        end = m.group("end").strip()
        roles.append(_RoleSpan(title=title, start_mm_yyyy=start, end_mm_yyyy=end, line_idx=idx))

    # LinkedIn PDF exports commonly put dates on their own line, e.g.:
    #   "## RAIN"
    #   "Principal Engineer and AI Architect (Founder)"
    #   "January 2025 - Present (1 year)"
    # Build additional roles by scanning for date lines and looking upward.
    for idx, line in enumerate(lines):
        m = date_line_re.match(line)
        if not m:
            continue
        if idx - 1 < 0:
            continue
        prev1 = _strip_md_prefix(lines[idx - 1])
        prev2 = _strip_md_prefix(lines[idx - 2]) if idx - 2 >= 0 else ""

        # Heuristic: one of the previous lines is title, the other is company.
        if _looks_like_title(prev1) and not _looks_like_title(prev2):
            title = prev1
            company_line = prev2
        elif _looks_like_title(prev2) and not _looks_like_title(prev1):
            title = prev2
            company_line = prev1
        else:
            title = prev1
            company_line = prev2

        title = title.strip()
        company_line = company_line.strip()
        start = m.group("start").strip()
        end = m.group("end").strip()
        if title and start and end:
            roles.append(_RoleSpan(title=title, start_mm_yyyy=start, end_mm_yyyy=end, line_idx=idx))

    tenure: List[Dict[str, str]] = []
    for r in roles:
        company = ""
        # If we matched a date-only line (LinkedIn export style), company is usually ABOVE.
        # Prefer the line two above the date (company heading) over the line after the date
        # (which is usually a description sentence).
        is_date_only = bool(date_line_re.match(lines[r.line_idx])) if 0 <= r.line_idx < len(lines) else False
        if is_date_only:
            # First pass: scan upward for a markdown-ish heading like "## PwC"
            for j in range(r.line_idx - 1, max(-1, r.line_idx - 30), -1):
                raw = (lines[j] or "").strip()
                if not raw or _is_page_marker(raw) or _is_duration_heading(raw):
                    continue
                if _is_md_heading_line(raw):
                    cand = _strip_md_prefix(raw)
                    if cand and len(cand) <= 80:
                        company = cand
                        break
            # Second pass: pick a short non-title line (e.g., "Optum") if no heading was found.
            if not company:
                best_cand = ""
                best_score = -10_000
                for j in range(r.line_idx - 1, max(-1, r.line_idx - 30), -1):
                    raw = (lines[j] or "").strip()
                    if not raw or _is_page_marker(raw) or _is_duration_heading(raw):
                        continue
                    # LinkedIn exports sometimes wrap "(via Randstad)" onto two lines;
                    # avoid treating the closing line "Randstad)" as a company heading.
                    if raw.endswith(")") and "(" not in raw and j - 1 >= 0 and "(via" in (lines[j - 1] or "").lower():
                        continue
                    cand = _strip_md_prefix(raw)
                    if not _looks_like_company(cand):
                        continue

                    # Score candidates: prefer org-ish names over locations/date spans.
                    score = 0
                    dist = max(0, r.line_idx - j)
                    # Prefer closer lines (usually the company is immediately above the title/date)
                    score += max(0, 12 - dist)
                    if "," in cand:
                        score -= 2
                    if re.search(r"\b(19|20)\d{2}\b", cand):
                        score -= 3
                    if re.search(r"\d", cand):
                        score -= 1
                    if len(cand) <= 28:
                        score += 3
                    if any(x in cand for x in ["Inc", "LLC", "Ltd", "University", "Group", "Center", "Corps", "Army", "Navy"]):
                        score += 3
                    if "metropolitan area" in cand.lower():
                        score -= 3

                    if score > best_score:
                        best_score = score
                        best_cand = cand

                if best_cand:
                    company = best_cand

        if not company and r.line_idx + 1 < len(lines):
            nxt = _strip_md_prefix(lines[r.line_idx + 1])
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
    if not skills:
        skills = extract_skills_from_lines(lines)
    accomplishments = extract_notable_accomplishments(sections) or pa["NotableAccomplishments"]
    business_challenges = extract_business_challenges(sections, lines) or pa["ProblemsSolved"]
    tenure = roles_info.get("tenure") or []
    domains = extract_domains(text)
    seniority = infer_seniority_from_text(text)
    # If we still have no key metrics, salvage metric-bearing accomplishment lines.
    if not key_metrics and accomplishments:
        metricish: List[str] = []
        for a in accomplishments:
            if re.search(r"(\$|%|\b\d[\d,]*\s*(?:k|m|b)\b|\b\d{2,}\b)", a, re.I):
                metricish.append(a)
        key_metrics = metricish[:10]

    return {
        "KeyMetrics": key_metrics,
        "ProblemsSolved": pa["ProblemsSolved"],
        "BusinessChallengesSolved": business_challenges[:15],
        "NotableAccomplishments": accomplishments[:15],
        "Positions": positions,
        "Tenure": tenure,
        "Skills": skills,
        "Domains": domains,
        "Seniority": seniority,
    }

