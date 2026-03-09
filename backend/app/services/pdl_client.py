from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import httpx


PDL_BASE_URL = "https://api.peopledatalabs.com/v5"


@dataclass
class PdlPersonResult:
    name: str
    title: str
    linkedin_url: Optional[str]
    company: Optional[str]
    email: Optional[str] = None
    email_source: Optional[str] = None
    location_name: Optional[str] = None
    location_country: Optional[str] = None
    job_company_website: Optional[str] = None
    job_company_linkedin_url: Optional[str] = None
    job_company_industry: Optional[str] = None
    job_company_size: Optional[str] = None
    # Rich person data for signal extraction
    summary: Optional[str] = None
    job_summary: Optional[str] = None
    job_title_role: Optional[str] = None
    job_title_sub_role: Optional[str] = None
    job_title_levels: Optional[List[str]] = None
    job_start_date: Optional[str] = None
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    experience: Optional[List[Dict[str, Any]]] = None
    education: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[str]] = None
    languages: Optional[List[Dict[str, Any]]] = None
    inferred_salary: Optional[str] = None
    inferred_years_experience: Optional[int] = None
    industry: Optional[str] = None
    # Rich company data
    job_company_founded: Optional[int] = None
    job_company_employee_count: Optional[int] = None
    job_company_total_funding_raised: Optional[float] = None
    job_company_inferred_revenue: Optional[str] = None
    job_company_12mo_employee_growth_rate: Optional[float] = None
    job_company_type: Optional[str] = None


# Keep this intentionally small + outreach-safe.
# We do NOT request birth date/year, sex, street address, phone numbers, etc.
DEFAULT_PERSON_FIELDS: List[str] = [
    "id",
    "full_name",
    "first_name",
    "last_name",
    "job_title",
    "job_title_role",
    "job_title_sub_role",
    "job_title_levels",
    "job_summary",
    "job_start_date",
    "job_company_name",
    "job_company_website",
    "job_company_linkedin_url",
    "job_company_industry",
    "job_company_size",
    "job_company_founded",
    "job_company_employee_count",
    "job_company_total_funding_raised",
    "job_company_inferred_revenue",
    "job_company_12mo_employee_growth_rate",
    "job_company_type",
    "linkedin_url",
    "work_email",
    "recommended_personal_email",
    "emails",
    "location_name",
    "location_country",
    "summary",
    "skills",
    "interests",
    "experience",
    "education",
    "certifications",
    "languages",
    "inferred_salary",
    "inferred_years_experience",
    "sex",
    "industry",
]

PERSON_ENRICH_FIELDS: List[str] = [
    "id",
    "full_name",
    "first_name",
    "last_name",
    "gender",
    "job_title",
    "job_title_role",
    "job_title_sub_role",
    "job_company_name",
    "job_company_website",
    "job_company_industry",
    "job_company_size",
    "job_start_date",
    "linkedin_url",
    "linkedin_username",
    "linkedin_id",
    "twitter_url",
    "github_url",
    "facebook_url",
    "work_email",
    "recommended_personal_email",
    "emails",
    "phone_numbers",
    "location_name",
    "location_country",
    "location_metro",
    "location_region",
    "skills",
    "interests",
    "experience",
    "education",
    "certifications",
    "languages",
    "summary",
    "industry",
    "job_company_linkedin_url",
    "inferred_salary",
    "inferred_years_experience",
]


class PDLClient:
    def __init__(self, api_key: str, timeout_seconds: float = 15.0) -> None:
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def _headers(self) -> Dict[str, str]:
        return {"X-Api-Key": self.api_key, "Accept": "application/json"}

    def company_enrich(self, website: str) -> Dict[str, Any]:
        """
        Company Enrichment API.
        PDL v5 expects `website` (not `domain`) for common lookups.
        """
        url = f"{PDL_BASE_URL}/company/enrich"
        with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
            resp = client.get(url, params={"website": website}, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    def person_enrich(
        self,
        *,
        name: str = "",
        company: str = "",
        linkedin_url: str = "",
        title: str = "",
    ) -> Dict[str, Any]:
        """
        Person Enrichment API -- look up a person by name+company or LinkedIn URL.
        Returns bio, skills, experience, education, etc.
        """
        url = f"{PDL_BASE_URL}/person/enrich"
        params: Dict[str, Any] = {}
        if linkedin_url:
            params["profile"] = linkedin_url
        if name:
            params["name"] = name
        if company:
            params["company"] = company
        if title:
            params["title"] = title
        if not params:
            return {}
        with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
            resp = client.get(url, params=params, headers=self._headers())
            if resp.status_code in (401, 402, 403, 404):
                return {}
            resp.raise_for_status()
            return resp.json()

    def extract_enriched_person(self, raw: Dict[str, Any]) -> Optional[PdlPersonResult]:
        """Convert a person_enrich response (single record) into a PdlPersonResult."""
        if not raw or not isinstance(raw, dict):
            return None
        person_data = raw.get("data")
        if not isinstance(person_data, dict):
            return None
        results = self.extract_people({"data": [person_data]})
        return results[0] if results else None

    def person_search(self, company: str, size: int = 10) -> Dict[str, Any]:
        """
        Person Search API expects `query` as an Elasticsearch JSON query (string),
        which is easiest to send via POST body.
        """
        import logging
        _log = logging.getLogger(__name__)
        url = f"{PDL_BASE_URL}/person/search"
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"match": {"job_company_name": company}},
                    ]
                }
            },
            "size": max(1, min(int(size), 100)),
            "fields": DEFAULT_PERSON_FIELDS,
        }
        with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
            resp = client.post(url, json=query, headers=self._headers())
            _log.info("PDL person_search status=%d for company='%s'", resp.status_code, company)
            if resp.status_code in (401, 402, 403, 404):
                _log.warning("PDL person_search returned %d for '%s' (auth/credits issue or no results)", resp.status_code, company)
                return {"data": []}
            resp.raise_for_status()
            data = resp.json()
            _log.info("PDL person_search returned %d records for '%s'", len(data.get("data") or []), company)
            return data

    def extract_people(self, raw: Dict[str, Any]) -> List[PdlPersonResult]:
        data = raw.get("data") or []
        out: List[PdlPersonResult] = []
        if not isinstance(data, list):
            return out

        def _best_email(row: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
            # Priority: work_email > recommended_personal_email > emails[].address
            work = row.get("work_email")
            if isinstance(work, str) and work.strip():
                return work.strip(), "work_email"
            rec = row.get("recommended_personal_email")
            if isinstance(rec, str) and rec.strip():
                return rec.strip(), "recommended_personal_email"
            emails = row.get("emails")
            if isinstance(emails, list):
                for e in emails:
                    if not isinstance(e, dict):
                        continue
                    addr = e.get("address")
                    if isinstance(addr, str) and addr.strip():
                        et = str(e.get("type") or "").strip()
                        src = f"emails{':' + et if et else ''}"
                        return addr.strip(), src
            return None, None

        for row in data:
            if not isinstance(row, dict):
                continue
            name = str(row.get("full_name") or row.get("name") or "").strip()
            title = str(row.get("job_title") or row.get("title") or "").strip()
            linkedin_url = row.get("linkedin_url") or row.get("linkedin") or None
            company = row.get("job_company_name") or row.get("company") or None
            if not name or not title:
                continue
            if linkedin_url:
                lu = str(linkedin_url).strip()
                if lu.startswith("linkedin.com/") or lu.startswith("www.linkedin.com/"):
                    lu = "https://" + lu.lstrip("/")
                elif lu.startswith("/in/"):
                    lu = "https://www.linkedin.com" + lu
                linkedin_url = lu

            email, email_source = _best_email(row)

            def _str_or_none(key: str) -> Optional[str]:
                v = row.get(key)
                return str(v).strip() if isinstance(v, str) and str(v).strip() else None

            def _list_or_none(key: str) -> Optional[List[Any]]:
                v = row.get(key)
                return v if isinstance(v, list) else None

            skills_raw = _list_or_none("skills")
            skills = [str(s).strip() for s in (skills_raw or []) if isinstance(s, str) and str(s).strip()][:20] or None
            interests_raw = _list_or_none("interests")
            interests = [str(s).strip() for s in (interests_raw or []) if isinstance(s, str) and str(s).strip()][:15] or None
            certs_raw = _list_or_none("certifications")
            certifications = [str(s).strip() for s in (certs_raw or []) if isinstance(s, str) and str(s).strip()][:10] or None

            out.append(
                PdlPersonResult(
                    name=name,
                    title=title,
                    linkedin_url=str(linkedin_url).strip() if linkedin_url else None,
                    company=str(company).strip() if company else None,
                    email=str(email).strip() if email else None,
                    email_source=str(email_source).strip() if email_source else None,
                    location_name=_str_or_none("location_name"),
                    location_country=_str_or_none("location_country"),
                    job_company_website=_str_or_none("job_company_website"),
                    job_company_linkedin_url=_str_or_none("job_company_linkedin_url"),
                    job_company_industry=_str_or_none("job_company_industry"),
                    job_company_size=_str_or_none("job_company_size"),
                    summary=_str_or_none("summary"),
                    job_summary=_str_or_none("job_summary"),
                    job_title_role=_str_or_none("job_title_role"),
                    job_title_sub_role=_str_or_none("job_title_sub_role"),
                    job_title_levels=_list_or_none("job_title_levels"),
                    job_start_date=_str_or_none("job_start_date"),
                    skills=skills,
                    interests=interests,
                    experience=_list_or_none("experience"),
                    education=_list_or_none("education"),
                    certifications=certifications,
                    languages=_list_or_none("languages"),
                    inferred_salary=_str_or_none("inferred_salary"),
                    inferred_years_experience=row.get("inferred_years_experience") if isinstance(row.get("inferred_years_experience"), (int, float)) else None,
                    industry=_str_or_none("industry"),
                    job_company_founded=row.get("job_company_founded") if isinstance(row.get("job_company_founded"), int) else None,
                    job_company_employee_count=row.get("job_company_employee_count") if isinstance(row.get("job_company_employee_count"), int) else None,
                    job_company_total_funding_raised=row.get("job_company_total_funding_raised") if isinstance(row.get("job_company_total_funding_raised"), (int, float)) else None,
                    job_company_inferred_revenue=_str_or_none("job_company_inferred_revenue"),
                    job_company_12mo_employee_growth_rate=row.get("job_company_12mo_employee_growth_rate") if isinstance(row.get("job_company_12mo_employee_growth_rate"), (int, float)) else None,
                    job_company_type=_str_or_none("job_company_type"),
                )
            )
        return out


def extract_person_signals(p: PdlPersonResult) -> List[Dict[str, str]]:
    """Build up to 9 interesting, personalizable facts about a person from PDL data.
    Each signal has: label (display heading), value (the fact), category."""
    signals: List[Dict[str, str]] = []

    if p.summary:
        signals.append({"label": "Professional Summary", "value": p.summary[:200], "category": "bio"})

    if p.job_summary:
        signals.append({"label": "Current Role Focus", "value": p.job_summary[:200], "category": "role"})

    if p.education:
        for edu in p.education[:2]:
            if not isinstance(edu, dict):
                continue
            school = (edu.get("school") or {}).get("name") or ""
            degrees = edu.get("degrees") or []
            majors = edu.get("majors") or []
            parts = []
            if degrees:
                parts.append(str(degrees[0]).title())
            if majors:
                parts.append(f"in {str(majors[0]).title()}")
            if school:
                parts.append(f"from {school.title()}")
            if parts:
                signals.append({"label": "Education", "value": " ".join(parts), "category": "education"})
                break

    if p.skills:
        top = [s.title() for s in p.skills[:6]]
        signals.append({"label": "Key Skills", "value": ", ".join(top), "category": "skills"})

    if p.interests:
        top = [s.title() for s in p.interests[:5]]
        signals.append({"label": "Interests", "value": ", ".join(top), "category": "interests"})

    if p.certifications:
        signals.append({"label": "Certifications", "value": ", ".join(p.certifications[:3]), "category": "certifications"})

    if p.experience and len(p.experience) >= 2:
        prev = p.experience[1] if isinstance(p.experience[1], dict) else {}
        raw_title = prev.get("title")
        prev_title = (raw_title.get("name", "") if isinstance(raw_title, dict) else str(raw_title or "")).strip()
        raw_co = prev.get("company")
        prev_co = (raw_co.get("name", "") if isinstance(raw_co, dict) else str(raw_co or "")).strip()
        if prev_title and prev_co:
            signals.append({"label": "Previous Role", "value": f"{prev_title.title()} at {prev_co.title()}", "category": "experience"})

    if p.languages:
        langs = [str((l.get("name") or "")).title() for l in p.languages if isinstance(l, dict) and l.get("name")][:4]
        if langs and not (len(langs) == 1 and langs[0].lower() == "english"):
            signals.append({"label": "Languages", "value": ", ".join(langs), "category": "languages"})

    if p.job_start_date:
        signals.append({"label": "Current Role Since", "value": p.job_start_date, "category": "tenure"})

    if p.location_name:
        signals.append({"label": "Location", "value": p.location_name.title(), "category": "location"})

    if p.inferred_years_experience:
        signals.append({"label": "Years of Experience", "value": f"{p.inferred_years_experience}+ years", "category": "experience"})

    return signals[:9]


def extract_company_signals(p: PdlPersonResult) -> List[Dict[str, str]]:
    """Build up to 9 interesting facts about the person's company from PDL data."""
    signals: List[Dict[str, str]] = []

    if p.job_company_industry:
        signals.append({"label": "Industry", "value": p.job_company_industry.title(), "category": "industry"})

    if p.job_company_size:
        signals.append({"label": "Company Size", "value": f"{p.job_company_size} employees", "category": "size"})

    if p.job_company_employee_count:
        signals.append({"label": "Employee Count", "value": f"{p.job_company_employee_count:,}", "category": "headcount"})

    if p.job_company_12mo_employee_growth_rate is not None:
        pct = round(p.job_company_12mo_employee_growth_rate * 100, 1)
        direction = "growing" if pct > 0 else "shrinking"
        signals.append({"label": "12-Month Growth", "value": f"{pct:+.1f}% ({direction})", "category": "growth"})

    if p.job_company_total_funding_raised:
        amt = p.job_company_total_funding_raised
        if amt >= 1_000_000_000:
            fmt = f"${amt / 1_000_000_000:.1f}B"
        elif amt >= 1_000_000:
            fmt = f"${amt / 1_000_000:.0f}M"
        else:
            fmt = f"${amt:,.0f}"
        signals.append({"label": "Total Funding Raised", "value": fmt, "category": "funding"})

    if p.job_company_inferred_revenue:
        signals.append({"label": "Estimated Revenue", "value": p.job_company_inferred_revenue, "category": "revenue"})

    if p.job_company_founded:
        signals.append({"label": "Founded", "value": str(p.job_company_founded), "category": "founded"})

    if p.job_company_type:
        signals.append({"label": "Company Type", "value": p.job_company_type.title(), "category": "type"})

    if p.job_company_website:
        signals.append({"label": "Website", "value": p.job_company_website, "category": "website"})

    return signals[:9]


