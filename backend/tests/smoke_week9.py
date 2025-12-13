import os
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path so `app` package is importable
BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.db import run_migrations_blocking
from app.routers import job_preferences, resume, job_descriptions, pain_point_match, offer_creation
from app.routers import analytics as analytics_router

# Run migrations once for this smoke test (idempotent).
run_migrations_blocking()

smoke_app = FastAPI(title="RoleFerry Week9 Smoke App")
smoke_app.include_router(
    job_preferences.router, prefix="/job-preferences", tags=["job-preferences"]
)
smoke_app.include_router(resume.router, prefix="/resume", tags=["resume"])
smoke_app.include_router(
    job_descriptions.router, prefix="/job-descriptions", tags=["job-descriptions"]
)
smoke_app.include_router(
    pain_point_match.router, prefix="/painpoint-match", tags=["painpoint-match"]
)
smoke_app.include_router(offer_creation.router, prefix="/offer-creation", tags=["offer-creation"])
smoke_app.include_router(analytics_router.router, prefix="/analytics", tags=["analytics"])

client = TestClient(smoke_app)


def assert_ok(resp, label: str):
    if not (200 <= resp.status_code < 300):
        raise AssertionError(f"{label} failed: {resp.status_code} {resp.text}")


def run_smoke_flow():
    # 1) Save job preferences
    prefs_payload = {
        "values": ["Impactful work", "Work-life balance"],
        "role_categories": ["Technical & Engineering"],
        "location_preferences": ["Remote", "Hybrid"],
        "work_type": ["Remote", "Hybrid"],
        "role_type": ["Full-Time"],
        "company_size": ["51-200 employees", "201-500 employees"],
        "industries": ["Enterprise Software", "AI & Machine Learning"],
        "skills": ["Python", "JavaScript", "React"],
        "minimum_salary": "$80,000",
        "job_search_status": "Actively looking",
        "state": "CA",
        "user_mode": "job-seeker",
    }
    r = client.post("/job-preferences/save", json=prefs_payload)
    assert_ok(r, "save_job_preferences")

    r = client.get("/job-preferences/demo-user")
    assert_ok(r, "get_job_preferences")

    # 2) Upload resume (simple TXT)
    resume_text = """Senior Software Engineer at TechCorp Inc.
Reduced latency by 40% and served 10k+ users.
Worked on B2B SaaS analytics platform.
"""
    files = {"file": ("resume.txt", resume_text, "text/plain")}
    r = client.post("/resume/upload", files=files)
    assert_ok(r, "upload_resume")

    # 3) Import a job description
    jd_text = "Senior Software Engineer at TechCorp Inc. Build B2B SaaS products in Python and React."
    r = client.post("/job-descriptions/import", json={"url": None, "text": jd_text})
    assert_ok(r, "import_job_description")
    jd = r.json()["job_description"]
    job_id = jd["id"]

    # 4) Generate pain point matches
    match_payload = {"job_description_id": job_id, "resume_extract_id": "ignored"}
    r = client.post("/painpoint-match/generate", json=match_payload)
    assert_ok(r, "generate_painpoint_matches")
    matches = r.json()["matches"]

    # 5) Create and save an offer
    offer_req = {
        "painpoint_matches": [matches[0]],
        "tone": "manager",
        "format": "text",
        "user_mode": "job-seeker",
    }
    r = client.post("/offer-creation/create", json=offer_req)
    assert_ok(r, "create_offer")
    offer = r.json()["offer"]

    r = client.post("/offer-creation/save", json=offer)
    assert_ok(r, "save_offer")

    # 6) Analytics overview
    r = client.get("/analytics/overview")
    assert_ok(r, "analytics_overview")
    print("analytics_overview:", r.json())


if __name__ == "__main__":
    run_smoke_flow()
    print("Week 9 smoke test completed successfully.")


