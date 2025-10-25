from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .config import settings

from .routers import (
    health,
    ijps,
    jobs,
    candidates,
    matches,
    contacts,
    verify,
    outreach,
    campaign,
    analytics,
    applications,
    enrich,
    tracker,
    livepages,
    personas,
    job_preferences,
    resume,
    job_descriptions,
    pinpoint_match,
    email_verification,
    find_contact,
    context_research,
    offer_creation,
    compose,
    deliverability_launch,
    conditional_logic,
    confidence_scoring,
    template_engine,
    company_size_adaptation,
    analytics_tracking,
    error_handling,
    accessibility,
    performance_optimization,
    cross_browser_compatibility,
    user_testing,
    documentation,
)


def create_app() -> FastAPI:
    app = FastAPI(title="RoleFerry API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def simple_logging(request: Request, call_next):
        response = await call_next(request)
        return response

    # Simple per-IP rate limit (very basic, in-memory). Disabled in dev.
    from starlette.responses import JSONResponse
    rate_counts: dict[str, int] = {}

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        if settings.environment and settings.environment.lower() == "dev":
            return await call_next(request)
        ip = request.client.host if request.client else "unknown"
        rate_counts[ip] = rate_counts.get(ip, 0) + 1
        if rate_counts[ip] > 200:
            return JSONResponse({"error": "rate_limited"}, status_code=429)
        return await call_next(request)

    @app.exception_handler(Exception)
    async def json_error_handler(request: Request, exc: Exception):
        return JSONResponse({"error": str(exc)}, status_code=500)

    # Best-effort migrations on startup (idempotent SQL files)
    try:
        from .db import run_migrations_blocking
        run_migrations_blocking()
    except Exception:
        pass

    # Core/health
    app.include_router(health.router)

    # Domain routers
    app.include_router(ijps.router, prefix="/ijps", tags=["ijps"]) 
    app.include_router(jobs.router, prefix="/jobs", tags=["jobs"]) 
    app.include_router(candidates.router, prefix="/candidates", tags=["candidates"]) 
    app.include_router(matches.router, prefix="/matches", tags=["matches"]) 
    app.include_router(contacts.router, prefix="/contacts", tags=["contacts"]) 
    app.include_router(verify.router, prefix="/contacts", tags=["verify"]) 
    app.include_router(outreach.router, prefix="/outreach", tags=["outreach"]) 
    app.include_router(campaign.router, prefix="/campaign", tags=["campaign"]) 
    app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
    
    # New routers for enterprise features
    app.include_router(applications.router, tags=["applications"])
    app.include_router(enrich.router, tags=["enrichment"])
    app.include_router(tracker.router, tags=["tracker"])
    app.include_router(livepages.router, tags=["livepages"])
    app.include_router(personas.router, tags=["personas"])
    app.include_router(job_preferences.router, prefix="/job-preferences", tags=["job-preferences"])
    app.include_router(resume.router, prefix="/resume", tags=["resume"])
    app.include_router(job_descriptions.router, prefix="/job-descriptions", tags=["job-descriptions"])
    app.include_router(pinpoint_match.router, prefix="/pinpoint-match", tags=["pinpoint-match"])
    app.include_router(email_verification.router, prefix="/email-verification", tags=["email-verification"])
    app.include_router(find_contact.router, prefix="/find-contact", tags=["find-contact"])
    app.include_router(context_research.router, prefix="/context-research", tags=["context-research"])
    app.include_router(offer_creation.router, prefix="/offer-creation", tags=["offer-creation"])
    app.include_router(compose.router, prefix="/compose", tags=["compose"])
    app.include_router(deliverability_launch.router, prefix="/deliverability-launch", tags=["deliverability-launch"])
    app.include_router(conditional_logic.router, prefix="/conditional-logic", tags=["conditional-logic"])
    app.include_router(confidence_scoring.router, prefix="/confidence-scoring", tags=["confidence-scoring"])
    app.include_router(template_engine.router, prefix="/template-engine", tags=["template-engine"])
    app.include_router(company_size_adaptation.router, prefix="/company-size-adaptation", tags=["company-size-adaptation"])
    app.include_router(analytics_tracking.router, prefix="/analytics-tracking", tags=["analytics-tracking"])
    app.include_router(error_handling.router, prefix="/error-handling", tags=["error-handling"])
    app.include_router(accessibility.router, prefix="/accessibility", tags=["accessibility"])
    app.include_router(performance_optimization.router, prefix="/performance", tags=["performance"])
    app.include_router(cross_browser_compatibility.router, prefix="/compatibility", tags=["compatibility"])
    app.include_router(user_testing.router, prefix="/testing", tags=["testing"])
    app.include_router(documentation.router, prefix="/docs", tags=["documentation"])
    from .routers import lead_qual as lead_qual_router, n8n_hooks as n8n_router, exports as exports_router, prospects as prospects_router, costs as costs_router, offer_decks as offer_router, research as research_router
    app.include_router(lead_qual_router.router)
    app.include_router(n8n_router.router)
    app.include_router(exports_router.router)
    app.include_router(prospects_router.router)
    app.include_router(costs_router.router)
    app.include_router(offer_router.router)
    app.include_router(research_router.router)
    from .routers import settings as settings_router, replies
    app.include_router(settings_router.router)
    app.include_router(replies.router)
    from .routers import webhooks, onepager, warmangles, audit, demo, messages, crm, ask
    app.include_router(webhooks.router)
    app.include_router(onepager.router)
    app.include_router(warmangles.router)
    app.include_router(audit.router)
    app.include_router(demo.router)
    app.include_router(messages.router)
    app.include_router(crm.router)
    app.include_router(ask.router)

    return app


app = create_app()

