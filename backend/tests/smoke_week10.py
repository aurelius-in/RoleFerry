import os
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path so `app` package is importable
BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.db import run_migrations_blocking
from app.routers import deliverability_launch, analytics as analytics_router


# Run migrations once for this smoke test (idempotent).
run_migrations_blocking()

smoke_app = FastAPI(title="RoleFerry Week10 Smoke App")
smoke_app.include_router(
    deliverability_launch.router,
    prefix="/deliverability-launch",
    tags=["deliverability-launch"],
)
smoke_app.include_router(
    analytics_router.router,
    prefix="/analytics",
    tags=["analytics"],
)

client = TestClient(smoke_app)


def assert_ok(resp, label: str):
    if not (200 <= resp.status_code < 300):
        raise AssertionError(f"{label} failed: {resp.status_code} {resp.text}")


def run_smoke_flow():
    # 1) Launch a small internal test campaign
    launch_payload = {
        "campaign_id": "week10-test-campaign",
        "emails": [
            {
                "subject": "Test campaign subject",
                "body": "Hello from RoleFerry Week 10 smoke test.",
            }
        ],
        "contacts": [
            {"email": "test1@example.com", "variant": "short"},
            {"email": "test2@example.com", "variant": "short"},
        ],
    }
    r = client.post("/deliverability-launch/launch", json=launch_payload)
    assert_ok(r, "launch_campaign")
    data = r.json()
    assert data.get("success") is True
    assert data.get("emails_sent") >= 2

    # 2) Analytics overview should now reflect at least these sends
    r = client.get("/analytics/overview")
    assert_ok(r, "analytics_overview")
    overview = r.json()
    assert overview.get("total_sent", 0) >= 2
    # Verification breakdown should always be present
    vb = overview.get("verification_breakdown", {})
    assert isinstance(vb, dict)
    print("analytics_overview_week10:", overview)


if __name__ == "__main__":
    run_smoke_flow()
    print("Week 10 smoke test completed successfully.")



