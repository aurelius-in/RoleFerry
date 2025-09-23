from fastapi import FastAPI

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

    return app


app = create_app()

