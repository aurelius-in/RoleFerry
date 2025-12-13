import os
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path so `app` package is importable
BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.db import run_migrations_blocking
from app.routers import beta_feedback as beta_feedback_router, analytics as analytics_router, demo_reset as demo_reset_router


# Run migrations once for this smoke test (idempotent).
run_migrations_blocking()

smoke_app = FastAPI(title="RoleFerry Week12 Smoke App")
smoke_app.include_router(beta_feedback_router.router, tags=["beta-feedback"])
smoke_app.include_router(analytics_router.router, prefix="/analytics", tags=["analytics"])
smoke_app.include_router(demo_reset_router.router, tags=["demo-reset"])

client = TestClient(smoke_app)


def assert_ok(resp, label: str):
    if not (200 <= resp.status_code < 300):
        raise AssertionError(f"{label} failed: {resp.status_code} {resp.text}")


def run_smoke_flow():
    # 1) Submit a beta feedback response
    feedback_payload = {
        "email": "beta-user@example.com",
        "nps_score": 9,
        "would_pay_499": True,
        "suggested_price": "$499 (with 50% early adopter discount)",
        "feedback_text": "This saves me hours per week. Pricing feels fair for serious job seekers.",
    }
    r = client.post("/beta-feedback/submit", json=feedback_payload)
    assert_ok(r, "submit_beta_feedback")
    created = r.json()
    assert created.get("id")
    assert created.get("email") == feedback_payload["email"]

    # 2) List feedback (primarily to ensure the endpoint is live)
    r = client.get("/beta-feedback")
    assert_ok(r, "list_beta_feedback")
    items = r.json().get("items", [])
    print("beta_feedback_items_count:", len(items))

    # 3) Reset demo data and confirm analytics + feedback are cleared
    r = client.post("/demo/reset")
    assert_ok(r, "demo_reset")
    r = client.get("/analytics/overview")
    assert_ok(r, "analytics_overview_after_reset")
    overview = r.json()
    assert overview.get("total_sent", 0) == 0
    r = client.get("/beta-feedback")
    assert_ok(r, "list_beta_feedback_after_reset")
    items = r.json().get("items", [])
    assert len(items) == 0


if __name__ == "__main__":
    run_smoke_flow()
    print("Week 12 smoke test (beta feedback) completed successfully.")



