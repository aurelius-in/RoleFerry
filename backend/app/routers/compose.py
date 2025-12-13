from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..services.jargon_detector import jargon_detector, detect_jargon_in_text, simplify_text_with_jargon
from ..clients.openai_client import get_openai_client, extract_json_from_text

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
async def generate_email(request: ComposeRequest):
    """
    Generate an email template with variable substitution and jargon detection.
    """
    try:
        # Create variable lookup dictionary
        variable_lookup = {var.name: var.value for var in request.variables}

        # Build GPT context (everything upstream should be present here, even if mocked).
        context = {
            "tone": request.tone,
            "user_mode": request.user_mode,
            "first_name": variable_lookup.get("{{first_name}}", "") or "there",
            "job_title": variable_lookup.get("{{job_title}}", "") or "the role",
            "company_name": variable_lookup.get("{{company_name}}", "") or "the company",
            "painpoint_1": variable_lookup.get("{{painpoint_1}}", "") or "",
            "solution_1": variable_lookup.get("{{solution_1}}", "") or "",
            "metric_1": variable_lookup.get("{{metric_1}}", "") or "",
            "company_summary": variable_lookup.get("{{company_summary}}", "") or "",
            "recent_news": variable_lookup.get("{{recent_news}}", "") or "",
            "contact_bio": variable_lookup.get("{{contact_bio}}", "") or "",
            "painpoint_matches": request.painpoint_matches or [],
            "context_data": request.context_data or {},
        }

        client = get_openai_client()
        raw = client.draft_compose_email(context)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or {}

        subject = str(data.get("subject") or "")
        body = str(data.get("body") or "")

        # As a safety net, if parsing fails, fall back to deterministic template.
        if not subject or not body:
            if request.user_mode == "job-seeker":
                subject = f"Quick advice on {context['job_title']} at {context['company_name']}?"
                body = (
                    f"Hi {context['first_name']},\n\n"
                    f"I spotted the {context['job_title']} role at {context['company_name']} and think my background fits. "
                    f"I noticed you're facing {context.get('painpoint_1') or 'a key priority'}, and I have experience "
                    f"{context.get('solution_1') or 'solving similar problems'} ({context.get('metric_1') or 'strong results'}).\n\n"
                    f"Open to a quick 10–15 minute chat?\n\nBest,\n[Your Name]\n"
                )
            else:
                subject = f"Exceptional candidate for {context['job_title']} at {context['company_name']}"
                body = (
                    f"Hi {context['first_name']},\n\n"
                    f"I have a strong candidate fit for {context['job_title']}. They’ve successfully "
                    f"{context.get('solution_1') or 'solved similar challenges'}, achieving {context.get('metric_1') or 'strong results'}.\n\n"
                    f"Open to a brief call to discuss?\n\nBest,\n[Your Name]\n"
                )
        
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
                "rationale": data.get("rationale"),
                "variants": data.get("variants") or [],
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
