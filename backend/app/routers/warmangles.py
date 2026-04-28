import logging
from fastapi import APIRouter
from pydantic import BaseModel
from ..storage import store
from ..config import settings
from ..clients.apollo import ApolloClient

_log = logging.getLogger(__name__)


class WarmAnglesRequest(BaseModel):
    linkedin: str | None = None
    domain: str | None = None
    schools: list[str] | None = None
    contact_name: str | None = None
    contact_company: str | None = None
    candidate_companies: list[str] | None = None
    candidate_schools: list[str] | None = None


router = APIRouter()


@router.post("/warm-angles/find")
def find_warm_angles(payload: WarmAnglesRequest):
    keys = []
    if payload.linkedin:
        keys.append(f"li:{payload.linkedin}")
    if payload.domain:
        keys.append(f"domain:{payload.domain}")
    if payload.schools:
        for s in payload.schools:
            keys.append(f"school:{s}")
    results = []
    for k in keys:
        results.extend(store.get_warm_angles(k))

    # Apollo enrichment: find shared past employers via employment history
    if settings.apollo_api_key and payload.contact_name and payload.candidate_companies:
        try:
            apollo = ApolloClient(settings.apollo_api_key, timeout_seconds=8.0)
            parts = (payload.contact_name or "").strip().split()
            first = parts[0] if parts else ""
            last = parts[-1] if len(parts) > 1 else ""
            raw = apollo.person_enrich(
                first_name=first,
                last_name=last,
                organization_name=payload.contact_company or "",
                linkedin_url=payload.linkedin or "",
            )
            if raw:
                person = raw.get("person") or raw
                history = person.get("employment_history") or []
                candidate_cos = {c.strip().lower() for c in (payload.candidate_companies or []) if c.strip()}
                for job in history:
                    if not isinstance(job, dict):
                        continue
                    org = str(job.get("organization_name") or "").strip()
                    if org and org.lower() in candidate_cos:
                        title = str(job.get("title") or "").strip()
                        detail = f"Both worked at {org}" + (f" (they were {title})" if title else "")
                        results.append({"type": "shared_company", "detail": detail, "source": "apollo"})

                # Also check shared schools if candidate provided schools
                if payload.candidate_schools:
                    contact_edu = person.get("education") or []
                    cand_schools = {s.strip().lower() for s in (payload.candidate_schools or []) if s.strip()}
                    for edu in contact_edu if isinstance(contact_edu, list) else []:
                        if not isinstance(edu, dict):
                            continue
                        school = str(edu.get("school_name") or edu.get("organization_name") or "").strip()
                        if school and school.lower() in cand_schools:
                            results.append({"type": "shared_school", "detail": f"Both attended {school}", "source": "apollo"})
        except Exception as e:
            _log.debug("Apollo warm angles enrichment failed: %s", e)

    # de-dup by (type, detail)
    seen = set()
    dedup = []
    for a in results:
        key = (a.get("type"), a.get("detail"))
        if key in seen:
            continue
        seen.add(key)
        dedup.append(a)
    return {"warm_angles": dedup}

