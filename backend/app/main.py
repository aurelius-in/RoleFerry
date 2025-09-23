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
    sequence,
    analytics,
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

    # Simple per-IP rate limit (very basic, in-memory)
    from starlette.responses import JSONResponse
    rate_counts: dict[str, int] = {}

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        rate_counts[ip] = rate_counts.get(ip, 0) + 1
        if rate_counts[ip] > 200:
            return JSONResponse({"error": "rate_limited"}, status_code=429)
        return await call_next(request)

    @app.exception_handler(Exception)
    async def json_error_handler(request: Request, exc: Exception):
        return JSONResponse({"error": str(exc)}, status_code=500)

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
    app.include_router(sequence.router, prefix="/sequence", tags=["sequence"]) 
    app.include_router(analytics.router, prefix="/analytics", tags=["analytics"]) 
    from .routers import settings as settings_router, replies
    app.include_router(settings_router.router)
    app.include_router(replies.router)
    from .routers import webhooks, onepager, warmangles, audit, demo, messages, crm
    app.include_router(webhooks.router)
    app.include_router(onepager.router)
    app.include_router(warmangles.router)
    app.include_router(audit.router)
    app.include_router(demo.router)
    app.include_router(messages.router)
    app.include_router(crm.router)

    return app


app = create_app()

