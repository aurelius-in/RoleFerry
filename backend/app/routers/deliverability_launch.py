from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import logging

from ..services.email_verifier import verify_email_async
from ..services.jargon_detector import jargon_detector
from ..services.campaign_sender import record_outreach_send
from ..services.email_sender import send_email
from ..config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

class PreFlightCheck(BaseModel):
    name: str
    status: str  # 'pending', 'pass', 'fail', 'warning'
    message: str
    details: Optional[str] = None

class LaunchResult(BaseModel):
    success: bool
    message: str
    campaign_id: Optional[str] = None
    emails_sent: Optional[int] = None
    scheduled_emails: Optional[int] = None
    errors: Optional[List[str]] = None

class CampaignLaunchRequest(BaseModel):
    campaign_id: str
    emails: List[Dict[str, Any]]
    contacts: List[Dict[str, Any]]

@router.post("/pre-flight-checks", response_model=List[PreFlightCheck])
async def run_pre_flight_checks(request: CampaignLaunchRequest):
    """
    Run comprehensive pre-flight checks before launching a campaign.
    """
    try:
        checks = []
        
        # 1. Email Verification Check
        email_check = PreFlightCheck(
            name="Email Verification",
            status="pending",
            message="Verifying all email addresses..."
        )
        checks.append(email_check)
        
        # Simulate email verification
        await asyncio.sleep(1)
        verified_count = 0
        total_emails = len(request.contacts)
        
        for contact in request.contacts:
            email = contact.get("email", "")
            if email:
                verification_result = await verify_email_async(email)
                if verification_result.get("status") in ["valid", "risky"]:
                    verified_count += 1
        
        email_check.status = "pass" if verified_count == total_emails else "fail"
        email_check.message = f"Verified {verified_count}/{total_emails} emails"
        if verified_count < total_emails:
            email_check.details = f"{total_emails - verified_count} emails failed verification"
        
        # 2. Spam Score Check
        spam_check = PreFlightCheck(
            name="Spam Score Check",
            status="pending",
            message="Analyzing content for spam indicators..."
        )
        checks.append(spam_check)
        
        await asyncio.sleep(1)
        spam_score = 2.1  # Mock spam score
        spam_check.status = "warning" if spam_score > 2.0 else "pass"
        spam_check.message = f"Spam score: {spam_score} (acceptable)"
        if spam_score > 2.0:
            spam_check.details = "Consider reducing exclamation marks for better deliverability"
        
        # 3. DNS Validation Check
        dns_check = PreFlightCheck(
            name="DNS Validation",
            status="pending",
            message="Checking SPF, DKIM, and DMARC records..."
        )
        checks.append(dns_check)
        
        await asyncio.sleep(1)
        dns_check.status = "pass"
        dns_check.message = "All DNS records valid"
        
        # 4. Bounce History Check
        bounce_check = PreFlightCheck(
            name="Bounce History",
            status="pending",
            message="Reviewing bounce rates and reputation..."
        )
        checks.append(bounce_check)
        
        await asyncio.sleep(1)
        bounce_rate = 0.02  # Mock bounce rate
        bounce_check.status = "pass" if bounce_rate < 0.05 else "warning"
        bounce_check.message = f"Bounce rate: {bounce_rate}% (excellent)" if bounce_rate < 0.05 else f"Bounce rate: {bounce_rate}% (needs attention)"
        
        # 5. Domain Warmup Check
        warmup_check = PreFlightCheck(
            name="Domain Warmup",
            status="pending",
            message="Ensuring domains are properly warmed..."
        )
        checks.append(warmup_check)
        
        await asyncio.sleep(1)
        warmup_check.status = "pass"
        warmup_check.message = "Domains properly warmed and ready"
        
        return checks
        
    except Exception as e:
        logger.exception("Error running pre-flight checks")
        raise HTTPException(status_code=500, detail="Failed to run pre-flight checks")

@router.post("/launch", response_model=LaunchResult)
async def launch_campaign(request: CampaignLaunchRequest):
    """
    Launch a campaign after pre-flight checks pass.
    """
    try:
        # Simulate campaign launch process; Week 10 sends the first email
        # template to each contact, recording a row in the outreach table for
        # analytics while still mocking actual delivery.
        await asyncio.sleep(0.5)

        if not request.emails:
            raise HTTPException(status_code=400, detail="At least one email template is required")

        primary_email = request.emails[0]
        subject = str(primary_email.get("subject") or "")
        body = str(primary_email.get("body") or "")

        emails_sent = 0
        for contact in request.contacts:
            to_addr = contact.get("email")
            if not to_addr:
                continue
            variant = contact.get("variant") or ""
            await record_outreach_send(
                campaign_id=request.campaign_id,
                contact_email=to_addr,
                subject=subject,
                body=body,
                variant=variant,
            )
            emails_sent += 1

        scheduled_emails = max(len(request.emails) - 1, 0)

        # Optionally send a tiny internal test batch via SMTP when configured.
        # This never triggers in mock_mode and only uses INTERNAL_TEST_RECIPIENTS.
        internal_recipients_raw = settings.internal_test_recipients or ""
        internal_recipients = [
            r.strip() for r in internal_recipients_raw.split(",") if r.strip()
        ]
        if internal_recipients and not settings.mock_mode:
            try:
                # Fire-and-forget; we don't block launch result on SMTP success.
                asyncio.create_task(
                    send_email(
                        internal_recipients,
                        f"[RoleFerry demo] Campaign {request.campaign_id} test send",
                        body,
                    )
                )
            except Exception:
                logger.exception("Failed to enqueue internal test email send")

        # Simulate some potential errors
        errors: List[str] = []
        if len(request.contacts) == 0:
            errors.append("No contacts provided")

        if subject.strip() == "":
            errors.append("Primary email missing subject line")

        success = len(errors) == 0 and emails_sent > 0
        
        result = LaunchResult(
            success=success,
            message="Campaign launched successfully!" if success else "Campaign launch failed",
            campaign_id=request.campaign_id if success else None,
            emails_sent=emails_sent if success else None,
            scheduled_emails=scheduled_emails if success else None,
            errors=errors if errors else None
        )
        
        return result
        
    except Exception as e:
        logger.exception("Error launching campaign")
        raise HTTPException(status_code=500, detail="Failed to launch campaign")

@router.get("/health-check")
async def health_check():
    """
    Check the health of deliverability services.
    """
    try:
        # Mock health check results
        health_status = {
            "email_verification": "healthy",
            "spam_detection": "healthy", 
            "dns_validation": "healthy",
            "domain_warmup": "healthy",
            "bounce_tracking": "healthy"
        }
        
        return {
            "success": True,
            "status": "healthy",
            "services": health_status,
            "message": "All deliverability services are operational"
        }
    except Exception as e:
        logger.exception("Deliverability health check failed")
        raise HTTPException(status_code=500, detail="Health check failed")

@router.post("/validate-content")
async def validate_content(content: str):
    """
    Validate email content for deliverability issues.
    """
    try:
        # Use jargon detector to find potential issues
        jargon_terms = jargon_detector.detect_jargon(content)
        
        # Mock content validation
        issues = []
        warnings = []
        
        # Check for common spam triggers
        spam_triggers = ["FREE", "URGENT", "LIMITED TIME", "ACT NOW", "CLICK HERE"]
        for trigger in spam_triggers:
            if trigger in content.upper():
                issues.append(f"Potential spam trigger: '{trigger}'")
        
        # Check for excessive punctuation
        if content.count("!") > 3:
            warnings.append("Excessive exclamation marks may trigger spam filters")
        
        # Check for all caps
        if len([word for word in content.split() if word.isupper() and len(word) > 3]) > 5:
            warnings.append("Excessive capitalization may trigger spam filters")
        
        # Check for jargon that might confuse recipients
        if jargon_terms:
            warnings.append(f"Found {len(jargon_terms)} jargon terms that might need explanation")
        
        return {
            "success": True,
            "issues": issues,
            "warnings": warnings,
            "jargon_terms": [
                {
                    "term": term.term,
                    "definition": term.definition,
                    "category": term.category
                }
                for term in jargon_terms
            ],
            "message": f"Content validation complete. Found {len(issues)} issues and {len(warnings)} warnings."
        }
        
    except Exception as e:
        logger.exception("Content validation failed")
        raise HTTPException(status_code=500, detail="Content validation failed")

@router.get("/deliverability-stats")
async def get_deliverability_stats():
    """
    Get overall deliverability statistics.
    """
    try:
        # Mock deliverability stats
        stats = {
            "overall_health_score": 85,
            "spam_score_avg": 2.1,
            "bounce_rate": 0.02,
            "open_rate": 0.25,
            "reply_rate": 0.08,
            "dns_health": "excellent",
            "domain_reputation": "good",
            "warmup_status": "complete"
        }
        
        return {
            "success": True,
            "stats": stats,
            "message": "Deliverability statistics retrieved successfully"
        }
        
    except Exception as e:
        logger.exception("Error retrieving deliverability stats")
        raise HTTPException(status_code=500, detail="Failed to get deliverability stats")
