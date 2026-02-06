from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import re
from ..services.jargon_detector import jargon_detector, detect_jargon_in_text, simplify_text_with_jargon
from ..clients.openai_client import get_openai_client, extract_json_from_text, _strip_fluff_openers
from ..auth import require_current_user

router = APIRouter()

class Variable(BaseModel):
    name: str
    value: str
    description: str

class JargonTerm(BaseModel):
    term: str
    definition: str
    category: str
    position: List[int]

class EmailTemplate(BaseModel):
    id: str
    subject: str
    body: str
    tone: str  # 'recruiter', 'manager', 'exec'
    variables: List[Variable]
    jargon_terms: List[JargonTerm]
    simplified_body: str
    user_mode: str = "job-seeker"

class ComposeRequest(BaseModel):
    tone: str
    custom_tone: Optional[str] = None
    user_mode: str = "job-seeker"
    variables: List[Variable]
    painpoint_matches: List[Dict[str, Any]]
    # Week 10: upstream context is a structured blob (research, selected JD, offers, contacts).
    # Keep this permissive to avoid 422s when the UI passes nested objects.
    context_data: Dict[str, Any]

class ComposeResponse(BaseModel):
    success: bool
    message: str
    email_template: Optional[EmailTemplate] = None
    helper: Optional[Dict[str, Any]] = None

@router.post("/generate", response_model=ComposeResponse)
async def generate_email(request: ComposeRequest, http_request: Request):
    """
    Generate an email template with variable substitution and jargon detection.
    """
    try:
        user = await require_current_user(http_request)

        def _signature_block() -> str:
            lines = [user.full_name]
            if user.phone:
                lines.append(user.phone)
            if user.linkedin_url:
                lines.append(user.linkedin_url)
            return "\n".join([ln for ln in lines if str(ln).strip()]).strip()

        signature = _signature_block()

        def _append_signature(msg_body: str) -> str:
            s = str(msg_body or "").rstrip()
            if not signature:
                return s
            # Avoid duplicating if already present
            if user.full_name.lower() in s.lower():
                return s
            return (s + "\n\nBest,\n" + signature + "\n").strip() + "\n"

        # Create variable lookup dictionary
        variable_lookup = {var.name: var.value for var in request.variables}
        work_link_value = str(variable_lookup.get("{{work_link}}") or "").strip()
        bio_page_url_value = str(variable_lookup.get("{{bio_page_url}}") or "").strip()

        # Build GPT context (everything upstream should be present here, even if mocked).
        context_data = request.context_data or {}

        def _pick_latest_offer(blob: Dict[str, Any]) -> Dict[str, Any]:
            offers = blob.get("created_offers") or []
            if isinstance(offers, list) and offers:
                last = offers[-1]
                return last if isinstance(last, dict) else {}
            return {}

        offer = _pick_latest_offer(context_data)
        offer_title = str(offer.get("title") or "").strip()
        offer_content = str(offer.get("content") or "").strip()
        offer_url = str(offer.get("url") or "").strip()
        offer_tone = str(offer.get("tone") or "").strip()
        offer_custom_tone = str(offer.get("custom_tone") or offer.get("customTone") or "").strip()
        def _clean_offer_snippet(text: str, max_len: int = 240) -> str:
            s = " ".join(str(text or "").split()).strip()
            if not s:
                return ""
            # Strip common greetings so the "offer line" doesn't start with "Hi <name>, ..."
            s = re.sub(r"^(hi|hello|hey)\s+[^,]{1,40},\s*", "", s, flags=re.I)
            # Prefer first sentence if it looks like a full email/paragraph.
            m = re.split(r"(?<=[.!?])\s+", s)
            if m and len(m[0]) >= 20:
                s = m[0].strip()
            if len(s) <= max_len:
                return s
            cut = s.rfind(" ", 0, max_len)
            if cut < 60:
                cut = max_len
            return s[:cut].rstrip() + "…"

        offer_snippet = _clean_offer_snippet(offer_content, max_len=240) if offer_content else ""

        # Clay-style template: keep placeholders in the generated subject/body so the user can
        # see how the message is constructed. We do NOT substitute values here.
        tone = (request.tone or offer_tone or "manager").strip().lower()
        custom_tone = (request.custom_tone or offer_custom_tone or "").strip()

        def _no_em_dashes(s: str) -> str:
            return str(s or "").replace("—", "-").replace("–", "-")

        def link_intro(t: str) -> str:
            if t == "recruiter":
                return "Please see my work here:"
            if t == "manager":
                return "A quick example of my work:"
            if t == "exec":
                return "If helpful, a brief example of work/impact:"
            if t == "developer":
                return "Code/work samples:"
            if t == "sales":
                return "Proof points here:"
            if t == "startup":
                return "A few things I’ve built:"
            if t == "enterprise":
                return "Selected work samples (process + outcomes):"
            if t == "custom" and custom_tone:
                return f"In a {custom_tone} tone, here’s my work:"
            return "Please see my work here:"

        # Build GPT context for Compose generation (main subject/body + variants).
        context = {
            "tone": tone,
            "custom_tone": custom_tone,
            "user_mode": request.user_mode,
            "sender_profile": {
                "full_name": user.full_name,
                "phone": user.phone,
                "linkedin_url": user.linkedin_url,
                "email": user.email,
            },
            # placeholders for the main template
            "first_name": "{{first_name}}",
            "job_title": "{{job_title}}",
            "company_name": "{{company_name}}",
            "painpoint_1": "{{painpoint_1}}",
            "solution_1": "{{solution_1}}",
            "metric_1": "{{metric_1}}",
            "company_summary": "{{company_summary}}",
            "company_theme": "{{company_theme}}",
            "recent_news": "{{recent_news}}",
            "contact_bio": "{{contact_bio}}",
            "offer_title": "{{offer_title}}",
            "offer_snippet": "{{offer_snippet}}",
            "offer_url": "{{work_link}}",
            "bio_page_url": "{{bio_page_url}}",
            "contact_title": "{{contact_title}}",
            "personalization_angle": "{{personalization_angle}}",
            "painpoint_matches": request.painpoint_matches or [],
            "context_data": context_data,
        }

        # Deterministic fallback (if LLM fails)
        def _fallback_template() -> tuple[str, str]:
            subject = "{{job_title}} at {{company_name}} - quick idea"
            if tone == "recruiter":
                subject = "{{company_name}} - {{job_title}} (quick question)"
            elif tone == "exec":
                subject = "{{company_name}} - {{painpoint_1}} idea"

            metric_val = str(variable_lookup.get("{{metric_1}}") or "").strip()
            metric_is_bad = False
            try:
                digits_only = re.sub(r"[^\d]", "", metric_val)
                if metric_val and re.fullmatch(r"[\d\-\s()+.]+", metric_val) and 9 <= len(digits_only) <= 12:
                    metric_is_bad = True
                if metric_val and re.fullmatch(r"\d{8,}", metric_val):
                    metric_is_bad = True
            except Exception:
                metric_is_bad = False

            proof_line = "Proof: {{solution_1}}" + (f" ({{{{metric_1}}}})" if (metric_val and not metric_is_bad) else "")

            parts: list[str] = [
                "Hi {{first_name}},\n\n",
                "I saw the {{job_title}} role at {{company_name}} and had one concrete idea that might help.\n\n",
                "- Personalization: {{personalization_angle}}\n" if str(variable_lookup.get("{{personalization_angle}}") or "").strip() else "",
                "- One idea I’d bring: {{offer_snippet}}\n",
                f"- {proof_line}\n\n",
                "Open to a quick 10–15 minute chat?\n\n",
            ]
            if bio_page_url_value:
                parts.append("Bio page: {{bio_page_url}}\n\n")
            if work_link_value:
                parts.append(f"{link_intro(tone)} {{{{work_link}}}}\n\n")
            parts.append(f"Best,\n{signature}\n")
            return subject, "".join([p for p in parts if p])

        # GPT compose generation — best effort, but do not block output.
        client = get_openai_client()
        helper_data: Dict[str, Any] = {}
        subject: str
        body: str
        try:
            raw = client.draft_compose_email(
                {
                    **context,
                    "constraints": {
                        "no_em_dashes": True,
                        "include_work_link": bool(work_link_value),
                        "include_bio_page_url": bool(bio_page_url_value),
                    },
                }
            )
            choices = raw.get("choices") or []
            msg = (choices[0].get("message") if choices else {}) or {}
            content_str = str(msg.get("content") or "")
            helper_data = extract_json_from_text(content_str) or {}

            subject = str(helper_data.get("subject") or "").strip() or _fallback_template()[0]
            body = str(helper_data.get("body") or "").strip() or _fallback_template()[1]
        except Exception:
            helper_data = {}
            subject, body = _fallback_template()

        # Enforce quality + style rules even if the LLM drifts.
        try:
            body = _append_signature(_strip_fluff_openers(body))
            body = _no_em_dashes(body)
            subject = _no_em_dashes(subject)

            variants = helper_data.get("variants") or []
            if isinstance(variants, list):
                cleaned = []
                for v in variants:
                    if not isinstance(v, dict):
                        continue
                    vb = str(v.get("body") or "")
                    if vb:
                        v["body"] = _no_em_dashes(_append_signature(_strip_fluff_openers(vb)))
                    vs = str(v.get("subject") or "")
                    if vs:
                        v["subject"] = _no_em_dashes(vs)
                    cleaned.append(v)
                helper_data["variants"] = cleaned
        except Exception:
            pass
        
        # Detect jargon in the body
        jargon_terms = detect_jargon_in_text(body)
        
        # Convert jargon terms to our format
        jargon_terms_formatted = [
            JargonTerm(
                term=term["term"],
                definition=term["definition"],
                category=term["category"],
                position=term["position"]
            )
            for term in jargon_terms
        ]
        
        # Create simplified version
        simplified_body, _ = simplify_text_with_jargon(body)
        
        # Create email template
        email_template = EmailTemplate(
            id="email_1",
            subject=subject,
            body=body,
            tone=request.tone,
            variables=request.variables,
            jargon_terms=jargon_terms_formatted,
            simplified_body=simplified_body,
            user_mode=request.user_mode
        )
        
        return ComposeResponse(
            success=True,
            message="Email generated successfully",
            email_template=email_template,
            helper={
                "rationale": helper_data.get("rationale"),
                "variants": helper_data.get("variants") or [],
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate email: {str(e)}")

@router.post("/save", response_model=ComposeResponse)
async def save_email_template(template: EmailTemplate):
    """
    Save an email template.
    """
    try:
        # In a real app, save to database
        return ComposeResponse(
            success=True,
            message="Email template saved successfully",
            email_template=template
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save email template: {str(e)}")

@router.get("/{user_id}", response_model=ComposeResponse)
async def get_email_templates(user_id: str):
    """
    Get all email templates for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data
        mock_template = EmailTemplate(
            id="email_1",
            subject="Quick advice on Senior Software Engineer at TechCorp?",
            body="Hi Jane,\n\nI spotted the Senior Software Engineer role at TechCorp and think my background fits perfectly...",
            tone="manager",
            variables=[
                Variable(name="{{first_name}}", value="Jane", description="Contact's first name"),
                Variable(name="{{job_title}}", value="Senior Software Engineer", description="Target job title"),
                Variable(name="{{company_name}}", value="TechCorp", description="Target company name")
            ],
            jargon_terms=[
                JargonTerm(term="API", definition="Application Programming Interface", category="Technology", position=[0, 3])
            ],
            simplified_body="Hi Jane,\n\nI spotted the Senior Software Engineer role at TechCorp and think my background fits perfectly...",
            user_mode="job-seeker"
        )
        
        return ComposeResponse(
            success=True,
            message="Email templates retrieved successfully",
            email_template=mock_template
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get email templates: {str(e)}")

@router.post("/detect-jargon")
async def detect_jargon_endpoint(text: str):
    """
    Detect jargon and acronyms in text.
    """
    try:
        jargon_terms = detect_jargon_in_text(text)
        
        return {
            "success": True,
            "jargon_terms": jargon_terms,
            "message": f"Found {len(jargon_terms)} jargon terms"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect jargon: {str(e)}")

@router.post("/simplify")
async def simplify_text_endpoint(text: str):
    """
    Simplify text by detecting and explaining jargon.
    """
    try:
        simplified_text, jargon_info = simplify_text_with_jargon(text)
        
        return {
            "success": True,
            "original_text": text,
            "simplified_text": simplified_text,
            "jargon_info": jargon_info,
            "message": "Text simplified successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to simplify text: {str(e)}")

@router.get("/variables/available")
async def get_available_variables():
    """
    Get all available variables for email composition.
    """
    try:
        variables = [
            Variable(name="{{first_name}}", value="", description="Contact's first name"),
            Variable(name="{{job_title}}", value="", description="Target job title"),
            Variable(name="{{company_name}}", value="", description="Target company name"),
            Variable(name="{{painpoint_1}}", value="", description="First pain point / business challenge"),
            Variable(name="{{solution_1}}", value="", description="Your solution to challenge 1"),
            Variable(name="{{metric_1}}", value="", description="Key metric for solution 1"),
            Variable(name="{{company_summary}}", value="", description="Company overview"),
            Variable(name="{{company_theme}}", value="", description="Theme: what the company likely cares about + mini-plan (not news)"),
            Variable(name="{{recent_news}}", value="", description="Recent company news"),
            Variable(name="{{contact_bio}}", value="", description="Contact's background")
        ]
        
        return {
            "success": True,
            "variables": variables,
            "message": "Available variables retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get variables: {str(e)}")

@router.get("/tones/descriptions")
async def get_tone_descriptions():
    """
    Get descriptions for different audience tones.
    """
    try:
        tones = {
            "recruiter": "Efficiency-focused, quick decision making",
            "manager": "Proof of competence, team impact",
            "exec": "ROI/Strategy focused, business outcomes"
        }
        
        return {
            "success": True,
            "tones": tones,
            "message": "Tone descriptions retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tone descriptions: {str(e)}")
