from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ..services.email_verifier import verify_email_async, get_verification_badge

router = APIRouter()

class EmailVerificationRequest(BaseModel):
    email: str

class EmailVerificationResponse(BaseModel):
    success: bool
    message: str
    email: str
    status: str
    score: Optional[float]
    provider: str
    badge: dict

class BulkVerificationRequest(BaseModel):
    emails: List[str]

class BulkVerificationResponse(BaseModel):
    success: bool
    message: str
    results: List[dict]

@router.post("/verify", response_model=EmailVerificationResponse)
async def verify_single_email(request: EmailVerificationRequest):
    """
    Verify a single email address using NeverBounce/MillionVerifier.
    """
    try:
        result = await verify_email_async(request.email)
        
        badge = get_verification_badge(
            result.get("status", "unknown"),
            result.get("score", 0)
        )
        
        return EmailVerificationResponse(
            success=True,
            message="Email verification completed",
            email=request.email,
            status=result.get("status", "unknown"),
            score=result.get("score"),
            provider=result.get("provider", "unknown"),
            badge=badge
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify email: {str(e)}")

@router.post("/verify-bulk", response_model=BulkVerificationResponse)
async def verify_bulk_emails(request: BulkVerificationRequest):
    """
    Verify multiple email addresses in bulk.
    """
    try:
        results = []
        for email in request.emails:
            try:
                result = await verify_email_async(email)
                badge = get_verification_badge(
                    result.get("status", "unknown"),
                    result.get("score", 0)
                )
                
                results.append({
                    "email": email,
                    "status": result.get("status", "unknown"),
                    "score": result.get("score"),
                    "provider": result.get("provider", "unknown"),
                    "badge": badge,
                    "success": True
                })
            except Exception as e:
                results.append({
                    "email": email,
                    "status": "error",
                    "score": None,
                    "provider": "unknown",
                    "badge": {"label": "Error", "color": "red", "icon": "✗"},
                    "success": False,
                    "error": str(e)
                })
        
        return BulkVerificationResponse(
            success=True,
            message=f"Bulk verification completed for {len(request.emails)} emails",
            results=results
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify emails: {str(e)}")

@router.get("/badge/{status}/{score}")
async def get_badge_info(status: str, score: float):
    """
    Get badge information for a given status and score.
    """
    try:
        badge = get_verification_badge(status, score)
        return {
            "success": True,
            "status": status,
            "score": score,
            "badge": badge
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get badge info: {str(e)}")

@router.get("/health")
async def verification_health():
    """
    Check the health of email verification services.
    """
    try:
        # Test with a known good email
        test_result = await verify_email_async("test@example.com")
        
        return {
            "success": True,
            "message": "Email verification service is healthy",
            "test_result": test_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email verification service is unhealthy: {str(e)}")
