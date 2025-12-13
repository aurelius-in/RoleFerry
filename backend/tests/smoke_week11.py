import os
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path so `app` package is importable
BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.db import run_migrations_blocking
from app.routers import (
    deliverability_launch,
    analytics as analytics_router,
    email_verification,
    webhooks,
    messages as messages_router,
)


# Run migrations once for this smoke test (idempotent).
run_migrations_blocking()

smoke_app = FastAPI(title="RoleFerry Week11 Smoke App")
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
smoke_app.include_router(
    email_verification.router,
    prefix="/email-verification",
    tags=["email-verification"],
)
smoke_app.include_router(
    webhooks.router,
    tags=["webhooks"],
)
smoke_app.include_router(
    messages_router.router,
    tags=["messages"],
)

client = TestClient(smoke_app)


def assert_ok(resp, label: str):
    if not (200 <= resp.status_code < 300):
        raise AssertionError(f"{label} failed: {resp.status_code} {resp.text}")


def run_smoke_flow():
    # 1) Launch a small internal test campaign; this should verify emails and
    #    record outreach rows.
    launch_payload = {
        "campaign_id": "week11-test-campaign",
        "emails": [
            {
                "subject": "Week 11 test campaign subject",
                "body": "Hello from RoleFerry Week 11 smoke test.",
            }
        ],
        "contacts": [
            {"email": "verified1@example.com", "variant": "short"},
            {"email": "verified2@example.com", "variant": "short"},
        ],
    }
    r = client.post("/deliverability-launch/launch", json=launch_payload)
    assert_ok(r, "launch_campaign")
    data = r.json()
    assert data.get("success") is True
    assert data.get("emails_sent") >= 2

    # 2) Call bulk verification endpoint explicitly as well
    r = client.post(
        "/email-verification/verify-bulk",
        json={"emails": ["verified1@example.com", "invalid@nowhere.invalid"]},
    )
    assert_ok(r, "verify_bulk_emails")
    bulk = r.json()
    assert bulk.get("success") is True
    assert len(bulk.get("results", [])) == 2

    # 3) Simulate webhook events from a sending provider (open + reply)
    webhook_payload_open = {"event": "open", "email": "verified1@example.com"}
    r = client.post("/webhooks/instantly", json=webhook_payload_open)
    assert_ok(r, "instantly_webhook_open")

    webhook_payload_reply = {
        "event": "reply",
        "email": "verified1@example.com",
        "label": "positive",
    }
    r = client.post("/webhooks/instantly", json=webhook_payload_reply)
    assert_ok(r, "instantly_webhook_reply")

    # 4) Messages API should now show updated message flags
    r = client.get("/messages")
    assert_ok(r, "list_messages")
    msgs = r.json().get("messages", [])
    assert any(m.get("id") == "verified1@example.com" and m.get("replied") for m in msgs)

    # 5) Analytics overview should reflect at least these sends
    r = client.get("/analytics/overview")
    assert_ok(r, "analytics_overview")
    overview = r.json()
    assert overview.get("total_sent", 0) >= 2
    print("analytics_overview_week11:", overview)


if __name__ == "__main__":
    run_smoke_flow()
    print("Week 11 smoke test completed successfully.")



