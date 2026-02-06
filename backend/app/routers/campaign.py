from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import csv
import io
import re

from ..auth import get_current_user_optional
from ..clients.openai_client import get_openai_client, extract_json_from_text, _strip_fluff_openers
from ..config import settings
from ..clients.instantly import InstantlyClient
from ..storage import store


class CampaignExportRequest(BaseModel):
    contacts: List[dict]


class CampaignPushRequest(BaseModel):
    list_name: Optional[str] = None
    contacts: List[dict]

class SenderProfile(BaseModel):
    full_name: str = ""
    phone: str = ""
    linkedin_url: str = ""
    email: str = ""


class CampaignGenerateStepRequest(BaseModel):
    # Which email in the sequence is being generated (1..4)
    step_number: int
    # Tone per email (includes hail-mary tones for step 4)
    tone: str
    custom_tone: Optional[str] = None
    # Hidden accordion text (user-editable); treated as instructions the model must follow.
    special_instructions: Optional[str] = None
    # 10-layer context toggles (frontend-defined). Backend treats this as a hint; frontend should also filter payload.
    enabled_context_layers: Optional[Dict[str, bool]] = None
    # The structured context payload for THIS contact, already filtered to enabled layers.
    context: Dict[str, Any]
    # Optional sender profile if user isn't logged in (demo/non-auth flow).
    sender_profile: Optional[SenderProfile] = None


class CampaignGenerateStepResponse(BaseModel):
    success: bool
    message: str
    subject: str
    body: str
    helper: Optional[Dict[str, Any]] = None


router = APIRouter()


@router.post("/export")
def export_csv(payload: CampaignExportRequest):
    # V1 CSV columns per spec
    fieldnames = [
        "email",
        "first_name",
        "last_name",
        "company",
        "title",
        "jd_link",
        "portfolio_url",
        "match_score",
        "verification_status",
        "verification_score",
        "subject",
        "message",
    ]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for idx, row in enumerate(payload.contacts):
        missing = [k for k in fieldnames if k not in row]
        if missing:
            raise HTTPException(status_code=400, detail={"row": idx, "missing": missing})
        writer.writerow({k: row.get(k, "") for k in fieldnames})
    csv_content = buffer.getvalue()
    return {"filename": "instantly.csv", "content": csv_content}


@router.get("")
def list_campaign_rows():
    return {"rows": store.list_sequence_rows()}


@router.get("/runs")
def list_runs():
    return {"runs": store.list_sequence_runs()}


@router.get("/campaigns")
def list_campaigns(status: str | None = None, variant: str | None = None, min_list: int | None = None):
    items = store.list_campaigns()
    if status:
        items = [c for c in items if (c.get("status") or "").lower() == status.lower()]
    if variant:
        items = [c for c in items if (c.get("variant") or "").lower() == variant.lower()]
    if min_list is not None:
        items = [c for c in items if int(c.get("list_size") or 0) >= int(min_list)]
    return {"campaigns": items}


@router.post("/push")
async def push_to_instantly(payload: CampaignPushRequest):
    list_name = payload.list_name or "RoleFerry Run"
    if settings.instantly_enabled:
        client = InstantlyClient(settings.instantly_api_key or "")
        result = await client.push_contacts(list_name, payload.contacts)
        store.add_audit(None, "instantly_push", {"list_name": list_name, "count": len(payload.contacts), "result": result})
        # Store minimal message data for analytics
        for c in payload.contacts:
            store.messages.append({
                "id": c.get("email"),
                "opened": False,
                "replied": False,
                "label": None,
                "variant": c.get("variant") or "",
            })
        return result
    store.add_audit(None, "instantly_push_csv", {"list_name": list_name, "count": len(payload.contacts)})
    return {"status": "fallback_csv", "list_name": list_name}


@router.post("/generate-step", response_model=CampaignGenerateStepResponse)
async def generate_campaign_step(payload: CampaignGenerateStepRequest, http_request: Request):
    """
    Generate a single email step for the Campaign sequence.

    This replaces the old Compose dependency: Campaign is now the main composer.
    """
    try:
        step = int(payload.step_number or 0)
        if step < 1 or step > 4:
            raise HTTPException(status_code=400, detail="step_number must be 1..4")

        tone = str(payload.tone or "").strip().lower()
        custom_tone = str(payload.custom_tone or "").strip()
        if tone == "custom" and not custom_tone:
            raise HTTPException(status_code=400, detail="custom_tone is required when tone=custom")

        # Prefer authenticated user profile for signature; fall back to caller-provided sender_profile.
        user = await get_current_user_optional(http_request)
        sender = payload.sender_profile or SenderProfile()
        if user:
            sender = SenderProfile(
                full_name=str(getattr(user, "full_name", "") or "").strip(),
                phone=str(getattr(user, "phone", "") or "").strip(),
                linkedin_url=str(getattr(user, "linkedin_url", "") or "").strip(),
                email=str(getattr(user, "email", "") or "").strip(),
            )

        def _signature_block() -> str:
            lines = [sender.full_name]
            if sender.phone:
                lines.append(sender.phone)
            if sender.linkedin_url:
                lines.append(sender.linkedin_url)
            return "\n".join([ln for ln in lines if str(ln).strip()]).strip()

        signature = _signature_block()

        def _append_signature(msg_body: str) -> str:
            s = str(msg_body or "").rstrip()
            if not signature:
                return s
            if sender.full_name and sender.full_name.lower() in s.lower():
                return s
            return (s + "\n\nBest,\n" + signature + "\n").strip() + "\n"

        def _no_em_dashes(s: str) -> str:
            return str(s or "").replace("—", "-").replace("–", "-")

        def _tone_guardrails(t: str) -> str:
            """
            Expand tone into explicit guardrails, especially for step 4 hail-mary tones.
            """
            base = {
                "recruiter": "Ultra concise, logistics-forward, easy yes/no.",
                "manager": "Competent + collaborative, emphasizes team impact.",
                "exec": "Outcome/ROI + risk reduction, strategic framing.",
                "developer": "Technical specificity, concrete implementation details, no fluff.",
                "sales": "Crisp proof points, clear next step, confident but not pushy.",
                "startup": "High-ownership, fast-moving, momentum and iteration.",
                "enterprise": "Process-aware, risk-aware, stakeholders + delivery predictability.",
            }.get(t, "")

            hail = {
                "hilarious": "Funny and memorable, but still respectful and professional; no sarcasm that reads hostile.",
                "silly": "Playful and light; no cringe; keep it short and kind.",
                "wacky": "Unexpected and quirky, but still professional; do NOT be random; keep it tied to the role.",
                "alarmist": "Urgent framing without fear-mongering; no threats; no manipulation; keep it ethical.",
                "flirty": "Warm and charming, but NEVER sexual or suggestive; keep it workplace-safe; no pet names.",
                "sad": "Vulnerable but confident; no guilt-tripping; no desperation.",
                "ridiculous": "Absurdly playful in a safe way; no profanity; no insults; still about the role.",
            }.get(t, "")

            guard = "Hard safety: do not be inappropriate, sexual, hostile, or manipulative. No guilt trips."
            parts = [p for p in [base, hail, guard] if p]
            return " ".join(parts).strip()

        special = str(payload.special_instructions or "").strip()
        ctx = payload.context or {}

        client = get_openai_client()

        # Deterministic fallback: decent but basic.
        def _fallback() -> tuple[str, str]:
            contact = ctx.get("contact") if isinstance(ctx, dict) else {}
            job = ctx.get("selected_job_description") if isinstance(ctx, dict) else {}
            links = ctx.get("links") if isinstance(ctx, dict) else {}

            first = ""
            company_name = ""
            job_title = ""
            try:
                first = str((contact or {}).get("name") or "").strip().split(" ")[0]
            except Exception:
                first = ""
            try:
                company_name = str((contact or {}).get("company") or (ctx.get("company_name") if isinstance(ctx, dict) else "") or "").strip()
            except Exception:
                company_name = ""
            try:
                job_title = str((job or {}).get("title") or (job or {}).get("role") or "").strip()
            except Exception:
                job_title = ""

            greet_name = first or "there"
            subj = f"Quick follow-up on {job_title or 'the role'}"
            if step == 1:
                subj = f"{job_title or 'Role'} at {company_name or 'your team'} - quick idea"
            elif step == 2:
                subj = f"Re: {job_title or 'the role'} @ {company_name or 'your team'}"
            elif step == 3:
                subj = f"One more idea for {company_name or 'your team'}"
            elif step == 4:
                subj = "Closing the loop?"

            body_bits: List[str] = [f"Hi {greet_name},\n\n"]
            if step == 1:
                body_bits.append(f"Saw the {job_title or 'role'} at {company_name or 'your team'} and wanted to share one quick idea.\n\n")
                body_bits.append("- One idea I’d bring: (add your offer snippet)\n")
                body_bits.append("- Relevant proof: (add one proof point)\n\n")
                body_bits.append("Open to a quick 10-15 minute chat?\n\n")
            elif step == 2:
                body_bits.append(f"Quick follow-up - is there a better person to route this to for the {job_title or 'role'}?\n\n")
                body_bits.append("If helpful, I can share a short 2-3 bullet plan.\n\n")
            elif step == 3:
                body_bits.append("Following up once more - I can tailor a quick plan to your top priority.\n\n")
                body_bits.append("Want me to send a short 3-bullet plan?\n\n")
            else:
                body_bits.append("Last note from me. If this isn’t a fit, no worries - just reply “no” and I’ll close the loop.\n\n")
                body_bits.append("If you are the right person, is it worth a quick chat?\n\n")

            # Optional: include bio/work links if provided in context
            bio = str(((links or {}).get("bio_page_url")) or "").strip()
            work = str(((links or {}).get("work_link")) or "").strip()
            if bio:
                body_bits.append(f"Bio: {bio}\n")
            if work:
                body_bits.append(f"Work: {work}\n")
            body = _append_signature("".join(body_bits))
            return subj, body

        # LLM generation if available; else fallback.
        if not client.should_use_real_llm:
            subj, body = _fallback()
            return CampaignGenerateStepResponse(
                success=True,
                message="Generated (deterministic fallback)",
                subject=_no_em_dashes(subj),
                body=_no_em_dashes(body),
                helper={"used_llm": False},
            )

        system = (
            "You are RoleFerry's outreach copilot. Draft ONE email step in a 4-email sequence.\n\n"
            "Hard style constraints:\n"
            "- Do NOT use em dashes or en dashes. Use commas, parentheses, or simple hyphens.\n"
            "- Hard ban: no canned openers like 'I hope you're doing well'.\n"
            "- After any greeting, the next sentence must be value-first (offer/painpoint/proof/ask).\n"
            "- Keep it plain-language and specific.\n"
            "- Use real names/companies ONLY if provided in the context JSON. Do not invent.\n"
            "- Do NOT output template placeholders like {{first_name}}.\n\n"
            f"Sequence step: {step} of 4.\n"
            "Step intent:\n"
            "- Step 1: primary message (best foot forward).\n"
            "- Step 2: short follow-up.\n"
            "- Step 3: different angle / additional proof.\n"
            "- Step 4: 'breakup' / last resort (can be playful, but respectful).\n\n"
            f"Tone: {tone}.\n"
            f"Tone guardrails: {_tone_guardrails(tone)}\n\n"
            "Special instructions (must follow):\n"
            + (special if special else "(none)") +
            "\n\n"
            "Return ONLY valid JSON with keys: subject, body, rationale.\n"
        )

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Context JSON:\n{ctx}"},
        ]

        raw = client.run_chat_completion(
            messages,
            temperature=0.35 if step in (1, 2) else (0.45 if step == 3 else 0.55),
            max_tokens=700,
            stub_json={"subject": _fallback()[0], "body": _fallback()[1], "rationale": "fallback"},
        )

        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or {}
        subject = str(data.get("subject") or "").strip() or _fallback()[0]
        body = str(data.get("body") or "").strip() or _fallback()[1]

        # Enforce quality rules even if the model drifts.
        body = _append_signature(_strip_fluff_openers(body))
        body = _no_em_dashes(body)
        subject = _no_em_dashes(subject)

        # Basic sanity: avoid accidental over-long subjects.
        subject = re.sub(r"\s+", " ", subject).strip()[:140]

        return CampaignGenerateStepResponse(
            success=True,
            message="Generated",
            subject=subject,
            body=body,
            helper={
                "used_llm": True,
                "rationale": str(data.get("rationale") or "").strip(),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate campaign email: {str(e)}")
