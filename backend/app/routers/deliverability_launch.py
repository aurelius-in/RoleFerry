from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import logging
import json
import re
import os

from ..services.email_verifier import verify_email_async
from ..services.jargon_detector import jargon_detector
from ..services.campaign_sender import record_outreach_send
from ..services.email_sender import send_email
from ..config import settings
from ..clients.openai_client import get_openai_client, extract_json_from_text, _strip_fluff_openers
from ..auth import require_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

class PreFlightCheck(BaseModel):
    name: str
    status: str  # 'pending', 'pass', 'fail', 'warning'
    message: str
    details: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

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
    # Optional: sender domain info for real DNS checks (SPF/DMARC; DKIM requires selector).
    sending_domain: Optional[str] = None
    dkim_selector: Optional[str] = None
    # Optional: warm-up plan passed from the UI (best-effort; used for a practical warm-up readiness check).
    warmup_plan: Optional[Dict[str, Any]] = None


class DeliverabilityEmail(BaseModel):
    id: Optional[str] = None
    step_number: Optional[int] = None
    subject: str
    body: str
    delay_days: Optional[int] = None


class DeliverabilityCheckRequest(BaseModel):
    # Prefer passing the whole campaign email list so we can analyze each step.
    emails: List[DeliverabilityEmail]
    contacts: Optional[List[Dict[str, Any]]] = None
    user_mode: str = "job-seeker"
    tone: Optional[str] = None
    custom_tone: Optional[str] = None


class DeliverabilityEmailReport(BaseModel):
    step_number: int
    health_score: int  # 0-100
    spam_risk: str  # low|medium|high
    issues: List[str]
    warnings: List[str]
    subject_variants: List[str]
    copy_tweaks: List[str]
    improved_subject: Optional[str] = None
    improved_body: Optional[str] = None


class DeliverabilityCheckResponse(BaseModel):
    success: bool
    message: str
    overall_health_score: int
    reports: List[DeliverabilityEmailReport]
    summary: Optional[str] = None

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

        verified_count = 0
        total_contacts = len(request.contacts)
        total_with_email = 0
        missing = 0
        verified_contacts: List[Dict[str, Any]] = []
        failed_contacts: List[Dict[str, Any]] = []

        # NOTE: OpenAI cannot validate mailbox existence. This is only "real"
        # when an email verification provider is configured (NeverBounce/MV).
        for contact in request.contacts:
            email = str(contact.get("email", "") or "").strip()
            if not email:
                missing += 1
                continue
            total_with_email += 1
            verification_result = await verify_email_async(email)
            if verification_result.get("status") in ["valid", "risky"]:
                verified_count += 1
                # Preserve the original contact payload (so the frontend can launch with only verified)
                verified_contacts.append(contact)
            else:
                failed_contacts.append(
                    {
                        "email": email,
                        "status": verification_result.get("status"),
                        "provider": verification_result.get("provider"),
                        "score": verification_result.get("score"),
                    }
                )

        email_check.meta = {
            "total_contacts": total_contacts,
            "total_with_email": total_with_email,
            "missing_email_count": missing,
            "verified_count": verified_count,
            "failed_count": max(total_with_email - verified_count, 0),
            "verified_contacts": verified_contacts,
            "failed_samples": failed_contacts[:8],
            "mock_mode": settings.mock_mode,
        }

        # Gating semantics:
        # - pass: all emails verified (valid/risky)
        # - fail: some emails failed verification BUT some are still valid/risky (eligible for "launch verified only")
        # - warning: missing emails / cannot verify any (edge cases)
        if total_with_email == 0:
            email_check.status = "warning"
            email_check.message = "No emails provided on contacts"
            email_check.details = "Add at least one contact email to run verification."
        elif verified_count == total_with_email:
            email_check.status = "pass"
            email_check.message = f"Verified {verified_count}/{total_with_email} emails"
            if missing:
                email_check.details = f"{missing} contacts have no email address on file."
        elif verified_count > 0:
            # Partial verification is common; make this launchable with a warning.
            email_check.status = "warning"
            email_check.message = f"Verified {verified_count}/{total_with_email} emails"
            email_check.details = f"{total_with_email - verified_count} emails failed verification. You can launch to verified emails only."
        else:
            email_check.status = "fail"
            email_check.message = f"Verified 0/{total_with_email} emails"
            email_check.details = "No emails passed verification; do not launch to this list."
        
        # 2. Content Deliverability (real: heuristics + GPT when available)
        content_check = PreFlightCheck(
            name="Content Deliverability (Copy Risk)",
            status="pending",
            message="Analyzing subject/body for inbox risk and clarity..."
        )
        checks.append(content_check)

        # 2b. Spam Risk Score (deterministic heuristics; derived from your actual copy)
        spam_risk_check = PreFlightCheck(
            name="Spam Risk Score (Heuristics)",
            status="pending",
            message="Scanning copy for spam-trigger patterns (links, caps, punctuation, trigger phrases)...",
        )
        checks.append(spam_risk_check)

        try:
            payload = DeliverabilityCheckRequest(
                emails=[
                    DeliverabilityEmail(
                        id=str(e.get("id") or ""),
                        step_number=int(e.get("step_number") or 0) or None,
                        subject=str(e.get("subject") or ""),
                        body=str(e.get("body") or ""),
                        delay_days=int(e.get("delay_days") or 0) if e.get("delay_days") is not None else None,
                    )
                    for e in (request.emails or [])
                    if isinstance(e, dict)
                ],
                contacts=request.contacts or [],
                user_mode="job-seeker",
            )
            deliverability = await check_deliverability(payload)  # reuse the same logic as Campaign page
            score = int(getattr(deliverability, "overall_health_score", 0) or 0)
            content_check.status = "pass" if score >= 80 else ("warning" if score >= 65 else "fail")
            content_check.message = f"Overall copy health score: {score}%"

            # Build a deterministic "spam risk score" from the same per-step reports.
            reps = list(getattr(deliverability, "reports", []) or [])
            worst = None
            try:
                worst = sorted(reps, key=lambda r: int(getattr(r, "health_score", 0) or 0))[0] if reps else None
            except Exception:
                worst = reps[0] if reps else None

            # Map health score to a 0-10 "spam risk" style score (lower is better)
            # NOTE: This is a heuristic score, not a third-party spam filter emulator.
            avg_health = int(getattr(deliverability, "overall_health_score", 0) or 0)
            spam_score = round(max(0.0, min(10.0, (100 - avg_health) / 10.0)), 1)

            spam_risk_check.status = "pass" if spam_score <= 2.5 else ("warning" if spam_score <= 5.0 else "fail")
            spam_risk_check.message = f"Spam risk score: {spam_score}/10 (heuristic)"
            try:
                worst_step = int(getattr(worst, "step_number", 0) or 0) or 1
                issues = list(getattr(worst, "issues", []) or [])[:4]
                warnings = list(getattr(worst, "warnings", []) or [])[:4]
                detail_lines = [f"Worst step: {worst_step}"]
                if issues:
                    detail_lines.append("Issues:\n- " + "\n- ".join([str(x) for x in issues]))
                if warnings:
                    detail_lines.append("Warnings:\n- " + "\n- ".join([str(x) for x in warnings]))
                spam_risk_check.details = "\n\n".join(detail_lines)[:2000]
            except Exception:
                spam_risk_check.details = None
            # Include the GPT summary + top 3 tweaks
            try:
                details_lines: List[str] = []
                if getattr(deliverability, "summary", None):
                    details_lines.append(str(deliverability.summary))
                reps = list(getattr(deliverability, "reports", []) or [])
                # show worst step issues first
                reps_sorted = sorted(reps, key=lambda r: int(getattr(r, "health_score", 0) or 0))
                for r in reps_sorted[:2]:
                    step = int(getattr(r, "step_number", 0) or 0) or 1
                    hs = int(getattr(r, "health_score", 0) or 0)
                    tweaks = list(getattr(r, "copy_tweaks", []) or [])[:3]
                    if tweaks:
                        details_lines.append(f"\nStep {step} ({hs}%):\n- " + "\n- ".join([str(x) for x in tweaks]))
                content_check.details = ("\n".join(details_lines)).strip()[:2000] or None
            except Exception:
                content_check.details = None
        except Exception:
            content_check.status = "warning"
            content_check.message = "Copy analysis unavailable; proceeding with basic checks"
            content_check.details = None
            spam_risk_check.status = "warning"
            spam_risk_check.message = "Spam risk score unavailable (copy analysis failed)"
            spam_risk_check.details = None
        
        # 3. DNS Validation Check
        dns_check = PreFlightCheck(
            name="DNS Validation",
            status="pending",
            message="Checking SPF, DKIM, and DMARC records..."
        )
        checks.append(dns_check)

        # Real-ish DNS checks require a sender domain. OpenAI cannot query DNS.
        sender_domain = (request.sending_domain or "").strip()
        if not sender_domain and (settings.smtp_from or ""):
            try:
                sender_domain = str(settings.smtp_from).split("@", 1)[-1].strip()
            except Exception:
                sender_domain = ""

        if not sender_domain:
            dns_check.status = "warning"
            dns_check.message = "Sender domain not provided (SPF/DMARC/DKIM not checked)"
            dns_check.details = "Add a sender domain on this screen to run real DNS checks for SPF/DMARC. DKIM requires a selector."
        else:
            # Use nslookup (available on Windows) to avoid extra dependencies.
            import subprocess

            def _nslookup_txt(name: str) -> str:
                try:
                    # Windows: nslookup -type=TXT
                    # Linux/Mac: host -t TXT or dig TXT
                    import platform
                    cmd = ["nslookup", "-type=TXT", name]
                    if platform.system().lower() != "windows":
                        cmd = ["dig", "+short", "TXT", name]
                    
                    out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, timeout=8)
                    return out or ""
                except Exception:
                    return ""

            def _nslookup_mx(name: str) -> str:
                try:
                    import platform
                    cmd = ["nslookup", "-type=MX", name]
                    if platform.system().lower() != "windows":
                        cmd = ["dig", "+short", "MX", name]
                        
                    out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, timeout=8)
                    return out or ""
                except Exception:
                    return ""

            txt_root = _nslookup_txt(sender_domain)
            txt_dmarc = _nslookup_txt(f"_dmarc.{sender_domain}")
            mx = _nslookup_mx(sender_domain)

            # More robust parsing for different platform outputs
            low_root = (txt_root or "").lower()
            low_dmarc = (txt_dmarc or "").lower()
            low_mx = (mx or "").lower()

            has_spf = "v=spf1" in low_root
            has_dmarc = "v=dmarc1" in low_dmarc
            # MX check: look for common indicators across dig/nslookup
            has_mx = any(k in low_mx for k in ["mail exchanger", "mx preference", ".com", ".net", ".org", ".io"])

            dkim_selector = (request.dkim_selector or "").strip()
            has_dkim = None
            dkim_note = ""
            if dkim_selector:
                txt_dkim = _nslookup_txt(f"{dkim_selector}._domainkey.{sender_domain}")
                has_dkim = "v=dkim1" in (txt_dkim or "").lower()
                dkim_note = f"DKIM selector '{dkim_selector}': {'found' if has_dkim else 'not found'}"
            else:
                dkim_note = "DKIM not checked (selector not provided)"

            problems = []
            if not has_spf:
                problems.append("Missing SPF (TXT v=spf1)")
            if not has_dmarc:
                problems.append("Missing DMARC (_dmarc TXT v=DMARC1)")
            if has_dkim is False:
                problems.append("DKIM selector TXT not found")
            if not has_mx:
                problems.append("No MX record detected")

            if problems:
                dns_check.status = "warning"
                dns_check.message = f"DNS check for {sender_domain}: needs attention"
                dns_check.details = ";\n".join(problems + [dkim_note])[:2000]
            else:
                dns_check.status = "pass"
                dns_check.message = f"DNS check for {sender_domain}: SPF/DMARC look good"
                dns_check.details = dkim_note
        
        # 4. Bounce History Check
        bounce_check = PreFlightCheck(
            name="Bounce History",
            status="pending",
            message="Reviewing bounce rates and reputation..."
        )
        checks.append(bounce_check)

        # In this demo we do not have a real sending reputation pipeline.
        bounce_check.status = "warning"
        bounce_check.message = "Bounce history unavailable in local demo"
        bounce_check.details = "Real bounce/reputation requires tracking sends from a connected mailbox/domain over time."
        
        # 5. Domain Warmup Check
        warmup_check = PreFlightCheck(
            name="Domain Warmup",
            status="pending",
            message="Ensuring domains are properly warmed..."
        )
        checks.append(warmup_check)

        # Warm-up readiness (best-effort):
        # - We can't truly verify provider warm-up network activity without an integration.
        # - But we *can* reflect the user's warm-up plan and provide actionable guidance.
        try:
            plan = request.warmup_plan or {}
            enabled = bool(plan.get("enabled"))
            provider = str(plan.get("provider") or "none").strip().lower()
            started_at = str(plan.get("started_at") or "").strip()
            ramp_days = int(plan.get("ramp_days") or 14)
            start_per_day = int(plan.get("start_emails_per_day") or 8)
            target_per_day = int(plan.get("target_emails_per_day") or 35)

            if not enabled:
                warmup_check.status = "warning"
                warmup_check.message = "Warm-up is OFF"
                warmup_check.details = (
                    "Recommendation: enable warm-up and connect a provider (Warmbox/Mailreach/Lemwarm/WarmupInbox/Instantly). "
                    "If you must launch now, keep volume low and use very clean copy."
                )
            elif provider in {"none", "", "diy"}:
                warmup_check.status = "warning"
                warmup_check.message = "Warm-up enabled, but no provider selected"
                warmup_check.details = (
                    f"Your plan is {start_per_day}/day → {target_per_day}/day over {ramp_days} days. "
                    "Select a warm-up provider for best results; DIY warm-up is slower and harder to track."
                )
            else:
                # Days since start (if started_at is parseable)
                days_elapsed = None
                try:
                    from datetime import datetime, timezone

                    dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                    days_elapsed = max(0, int((datetime.now(timezone.utc) - dt).total_seconds() // 86400))
                except Exception:
                    days_elapsed = None

                # Heuristic gating:
                # - <3 days: not warmed (warning)
                # - 3..(ramp_days-1): in progress (warning)
                # - >= ramp_days: ready (pass)
                if days_elapsed is None:
                    warmup_check.status = "warning"
                    warmup_check.message = f"Warm-up enabled via {provider} (status unverified)"
                    warmup_check.details = (
                        f"Plan: {start_per_day}/day → {target_per_day}/day over {ramp_days} days. "
                        "RoleFerry can’t verify provider activity yet; confirm warm-up progress in your provider dashboard."
                    )
                elif days_elapsed >= max(7, ramp_days):
                    warmup_check.status = "pass"
                    warmup_check.message = f"Warm-up likely ready (Day {days_elapsed} of {ramp_days})"
                    warmup_check.details = (
                        f"Provider: {provider}. Plan: {start_per_day}/day → {target_per_day}/day over {ramp_days} days. "
                        "Still confirm inbox placement in provider dashboard before scaling volume."
                    )
                elif days_elapsed >= 3:
                    warmup_check.status = "warning"
                    warmup_check.message = f"Warm-up in progress (Day {days_elapsed} of {ramp_days})"
                    warmup_check.details = (
                        f"Provider: {provider}. Consider launching to a small, highly-verified subset while warm-up ramps."
                    )
                else:
                    warmup_check.status = "warning"
                    warmup_check.message = f"Warm-up just started (Day {days_elapsed} of {ramp_days})"
                    warmup_check.details = (
                        f"Provider: {provider}. Recommendation: wait a few days before sending to larger lists; "
                        "keep early volume small and copy very clean."
                    )
        except Exception:
            warmup_check.status = "warning"
            warmup_check.message = "Warm-up status unavailable"
            warmup_check.details = "Enable warm-up in the UI and select a provider for best results."
        
        # 6. GPT Deliverability Helper (explanations + copy tweaks)
        # Keep deterministic results if GPT is not configured.
        try:
            primary_email = request.emails[0] if request.emails else {}
            subject = str(primary_email.get("subject") or "")
            body = str(primary_email.get("body") or "")

            client = get_openai_client()

            # Always have a deterministic fallback payload available.
            stub_json = {
                "summary": "Overall deliverability looks good; the main improvement is reducing spammy emphasis and increasing specificity.",
                "copy_tweaks": [
                    "Remove extra exclamation marks and overly promotional phrasing.",
                    "Mention one concrete pain point + one metric, then ask a simple CTA.",
                    "Keep the first paragraph under ~3 lines on mobile.",
                ],
                "subject_variants": [
                    "Quick question about the role",
                    "Idea for onboarding activation",
                    "Re: {company} — 10 min?",
                ],
            }

            helper_ctx = {
                "pre_flight_checks": [c.model_dump() for c in checks],
                "subject": subject,
                "body": body,
            }

            # If OpenAI isn't configured, don't pretend it's an error — explain what to fix.
            if not client.should_use_real_llm:
                # Railway note: env var names are case-sensitive, so RoleFerryKey vs ROLEFERRYKEY matters.
                env_hint = (
                    f"(env OPENAI_API_KEY={bool(os.getenv('OPENAI_API_KEY'))}, "
                    f"RoleFerryKey={bool(os.getenv('RoleFerryKey'))}, "
                    f"ROLEFERRYKEY={bool(os.getenv('ROLEFERRYKEY'))}, "
                    f"ROLEFERRY_KEY={bool(os.getenv('ROLEFERRY_KEY'))}, "
                    f"LLM_MODE={str(os.getenv('LLM_MODE') or '')})"
                )
                helper_details = (
                    "GPT is not active for deliverability helper.\n\n"
                    "To enable:\n"
                    "- In Railway → Backend service → Variables, set OPENAI_API_KEY (recommended)\n"
                    "  (aliases also supported: RoleFerryKey / ROLEFERRYKEY / ROLEFERRY_KEY)\n"
                    "- Set LLM_MODE=openai\n"
                    "- Redeploy the backend service\n\n"
                    f"Diagnostics: {env_hint}\n\n"
                    "Deterministic suggestions:\n"
                    f"{stub_json.get('summary','')}\n\n"
                    "Copy tweaks:\n- " + "\n- ".join(stub_json.get("copy_tweaks") or []) + "\n\n"
                    "Subject variants:\n- " + "\n- ".join(stub_json.get("subject_variants") or [])
                )
                checks.append(
                    PreFlightCheck(
                        name="GPT Deliverability Helper",
                        status="warning",
                        message="AI helper disabled; showing deterministic suggestions",
                        details=helper_details[:2000],
                    )
                )
            else:
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are a deliverability expert.\n\n"
                            "Given pre-flight checks + email copy, return ONLY JSON with keys:\n"
                            "- summary: string\n"
                            "- copy_tweaks: array of strings\n"
                            "- subject_variants: array of strings\n"
                        ),
                    },
                    {"role": "user", "content": json.dumps(helper_ctx)},
                ]
                raw = client.run_chat_completion(messages, temperature=0.2, max_tokens=500, stub_json=stub_json)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")
                data = extract_json_from_text(content_str) or stub_json

                helper_details = (
                    f"{data.get('summary','')}\n\n"
                    f"Copy tweaks:\n- " + "\n- ".join([str(x) for x in (data.get('copy_tweaks') or [])]) + "\n\n"
                    f"Subject variants:\n- " + "\n- ".join([str(x) for x in (data.get('subject_variants') or [])])
                )

                checks.append(
                    PreFlightCheck(
                        name="GPT Deliverability Helper",
                        status="pass",
                        message="Copy tweaks and safer subject variants generated",
                        details=helper_details[:2000],
                    )
                )
        except Exception as e:
            # Keep launch flow stable even if helper fails, but surface why.
            checks.append(
                PreFlightCheck(
                    name="GPT Deliverability Helper",
                    status="warning",
                    message="Helper unavailable; proceeding with deterministic checks",
                    details=f"{type(e).__name__}: {str(e)[:240]}",
                )
            )

        return checks
        
    except Exception as e:
        logger.exception("Error running pre-flight checks")
        raise HTTPException(status_code=500, detail="Failed to run pre-flight checks")


@router.post("/check", response_model=DeliverabilityCheckResponse)
async def check_deliverability(request: DeliverabilityCheckRequest):
    """
    Campaign-stage deliverability check.

    Intended UX:
    - score each email step for deliverability risk
    - give concrete, actionable fixes (subject + body)
    - optionally return an improved rewrite per step (GPT-backed when available)

    Note: This is NOT a DNS/SPF/DKIM checker. It focuses on copy risk + clarity.
    """
    try:
        if not request.emails:
            raise HTTPException(status_code=400, detail="At least one email is required")

        # Basic heuristics (fast, deterministic) to guide GPT + provide fallback.
        spam_triggers = [
            "free",
            "urgent",
            "limited time",
            "act now",
            "click here",
            "guarantee",
            "100%",
            "winner",
            "cash",
            "cheap",
        ]

        def _score_email(subject: str, body: str) -> Dict[str, Any]:
            s = str(subject or "")
            b = str(body or "")
            text = f"{s}\n\n{b}".strip()
            up = text.upper()

            issues: List[str] = []
            warnings: List[str] = []

            # Links
            link_count = len(re.findall(r"https?://", text, flags=re.I))
            if link_count >= 2:
                warnings.append("Multiple links can increase spam risk (consider 0–1 link in step 1).")

            # Spam triggers
            for t in spam_triggers:
                if t.upper() in up:
                    issues.append(f"Potential spam trigger phrase: '{t}'")

            # Punctuation / caps
            if text.count("!") > 1:
                warnings.append("Too many exclamation marks can look promotional.")
            caps_words = [w for w in re.findall(r"\b[A-Z]{4,}\b", text)]
            if len(caps_words) >= 3:
                warnings.append("Excessive ALL CAPS words can trigger filters.")

            # Length
            words = re.findall(r"\w+", text)
            word_count = len(words)
            if word_count > 170:
                warnings.append("Email is long; cold outreach performs better under ~120–150 words.")
            if word_count < 35:
                warnings.append("Email may be too short; consider adding 1 concrete proof point.")

            # Personalization placeholders (OK) vs no personalization (warning)
            if "{{first_name}}" not in text and "{first_name}" not in text and "Hi " not in text:
                warnings.append("Add a minimal greeting + 1 concrete reference for personalization.")

            # Jargon
            jargon_terms = jargon_detector.detect_jargon(text) or []
            if jargon_terms:
                warnings.append(f"Contains {len(jargon_terms)} jargon terms; consider simplifying for deliverability + clarity.")

            # Simple health score
            score = 92
            score -= min(20, 6 * len(issues))
            score -= min(18, 3 * len(warnings))
            score -= 8 if link_count >= 2 else 0
            score = max(30, min(98, score))

            spam_risk = "low"
            if len(issues) >= 2 or score < 65:
                spam_risk = "high"
            elif len(issues) == 1 or score < 78:
                spam_risk = "medium"

            return {
                "score": int(score),
                "spam_risk": spam_risk,
                "issues": issues,
                "warnings": warnings,
            }

        # Build per-email heuristic reports
        heuristic_reports: List[Dict[str, Any]] = []
        for i, em in enumerate(request.emails):
            step = int(em.step_number or (i + 1))
            h = _score_email(em.subject, em.body)
            heuristic_reports.append(
                {
                    "step_number": step,
                    "subject": em.subject,
                    "body": em.body,
                    **h,
                }
            )

        # GPT-backed improvement: rewrite + safer subject variants per step.
        client = get_openai_client()
        reports_out: List[DeliverabilityEmailReport] = []
        overall = int(round(sum([r["score"] for r in heuristic_reports]) / max(1, len(heuristic_reports))))
        summary: Optional[str] = None

        if client.should_use_real_llm:
            try:
                # Keep prompt compact: focus on actionable deliverability + better copy.
                contacts = request.contacts or []
                contact_hint = {}
                if contacts and isinstance(contacts, list):
                    c0 = contacts[0] if contacts else {}
                    if isinstance(c0, dict):
                        contact_hint = {
                            "name": c0.get("name"),
                            "title": c0.get("title"),
                            "company": c0.get("company"),
                        }

                llm_ctx = {
                    "user_mode": request.user_mode,
                    "tone": request.tone,
                    "custom_tone": request.custom_tone,
                    "contact_hint": contact_hint,
                    "emails": [
                        {
                            "step_number": r["step_number"],
                            "subject": r["subject"],
                            "body": r["body"],
                            "heuristic_health_score": r["score"],
                            "heuristic_issues": r["issues"],
                            "heuristic_warnings": r["warnings"],
                        }
                        for r in heuristic_reports
                    ],
                }

                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are an email deliverability expert and outreach copy editor.\n\n"
                            "Goal: maximize inbox placement + replies for cold outreach.\n\n"
                            "Constraints:\n"
                            "- Avoid spammy wording (FREE/URGENT/CLICK HERE/etc), excessive punctuation, and ALL CAPS.\n"
                            "- Avoid canned openers like \"I hope this message finds you well\".\n"
                            "- Keep step 1 under ~120-150 words if possible.\n"
                            "- Keep 0–1 links in step 1; if you include a link, introduce it naturally.\n"
                            "- Preserve the user's intent and tone.\n\n"
                            "Return ONLY JSON with keys:\n"
                            "- summary: string\n"
                            "- reports: array of objects with keys:\n"
                            "  - step_number: int\n"
                            "  - health_score: int (0-100)\n"
                            "  - spam_risk: 'low'|'medium'|'high'\n"
                            "  - issues: array of strings\n"
                            "  - warnings: array of strings\n"
                            "  - subject_variants: array of strings (3)\n"
                            "  - copy_tweaks: array of strings (3-6)\n"
                            "  - improved_subject: string\n"
                            "  - improved_body: string\n"
                        ),
                    },
                    {"role": "user", "content": json.dumps(llm_ctx)},
                ]

                stub_json = {
                    "summary": "Overall deliverability is acceptable. Biggest wins: shorten the first email, remove spammy emphasis, and make the opener more specific.",
                    "reports": [
                        {
                            "step_number": r["step_number"],
                            "health_score": r["score"],
                            "spam_risk": r["spam_risk"],
                            "issues": r["issues"],
                            "warnings": r["warnings"],
                            "subject_variants": [
                                "Quick question about the role",
                                "Idea for your priority",
                                "10 min this week?",
                            ],
                            "copy_tweaks": [
                                "Remove promotional phrasing and extra punctuation.",
                                "Use one concrete proof point (metric) and one clear CTA.",
                                "Keep the first paragraph under 3 lines on mobile.",
                            ],
                            "improved_subject": r["subject"],
                            "improved_body": r["body"],
                        }
                        for r in heuristic_reports
                    ],
                }

                raw = client.run_chat_completion(messages, temperature=0.15, max_tokens=1200, stub_json=stub_json)
                choices = raw.get("choices") or []
                msg = (choices[0].get("message") if choices else {}) or {}
                content_str = str(msg.get("content") or "")
                data = extract_json_from_text(content_str) or stub_json

                summary = str(data.get("summary") or "").strip() or None
                out_reports = data.get("reports") or []
                if isinstance(out_reports, list):
                    for r in out_reports:
                        if not isinstance(r, dict):
                            continue
                        step = int(r.get("step_number") or 0) or 1
                        reports_out.append(
                            DeliverabilityEmailReport(
                                step_number=step,
                                health_score=int(r.get("health_score") or 75),
                                spam_risk=str(r.get("spam_risk") or "medium"),
                                issues=[str(x) for x in (r.get("issues") or [])],
                                warnings=[str(x) for x in (r.get("warnings") or [])],
                                subject_variants=[str(x) for x in (r.get("subject_variants") or [])][:3],
                                copy_tweaks=[str(x) for x in (r.get("copy_tweaks") or [])][:6],
                                improved_subject=str(r.get("improved_subject") or "").strip() or None,
                                improved_body=_strip_fluff_openers(str(r.get("improved_body") or "").strip()) or None,
                            )
                        )
            except Exception:
                reports_out = []

        # Deterministic fallback: use heuristics only.
        if not reports_out:
            for r in heuristic_reports:
                reports_out.append(
                    DeliverabilityEmailReport(
                        step_number=int(r["step_number"]),
                        health_score=int(r["score"]),
                        spam_risk=str(r["spam_risk"]),
                        issues=[str(x) for x in r["issues"]],
                        warnings=[str(x) for x in r["warnings"]],
                        subject_variants=[],
                        copy_tweaks=[],
                        improved_subject=None,
                        improved_body=None,
                    )
                )

        # Normalize overall score based on returned reports (prefer GPT score if present)
        try:
            overall = int(round(sum([r.health_score for r in reports_out]) / max(1, len(reports_out))))
        except Exception:
            pass

        return DeliverabilityCheckResponse(
            success=True,
            message="Deliverability check completed",
            overall_health_score=overall,
            reports=sorted(reports_out, key=lambda r: r.step_number),
            summary=summary,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Deliverability check failed")
        raise HTTPException(status_code=500, detail="Deliverability check failed")

@router.post("/launch", response_model=LaunchResult)
async def launch_campaign(request: CampaignLaunchRequest, http_request: Request):
    """
    Launch a campaign after pre-flight checks pass.
    """
    try:
        user = await require_current_user(http_request)
        user_id = user.id

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
                user_id=user_id,
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
        
    except HTTPException:
        raise
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
