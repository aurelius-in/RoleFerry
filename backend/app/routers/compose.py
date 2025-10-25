from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..services.jargon_detector import jargon_detector, detect_jargon_in_text, simplify_text_with_jargon

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
    pinpoint_matches: List[Dict[str, Any]]
    context_data: Dict[str, str]

class ComposeResponse(BaseModel):
    success: bool
    message: str
    email_template: Optional[EmailTemplate] = None

@router.post("/generate", response_model=ComposeResponse)
async def generate_email(request: ComposeRequest):
    """
    Generate an email template with variable substitution and jargon detection.
    """
    try:
        # Create variable lookup dictionary
        variable_lookup = {var.name: var.value for var in request.variables}
        
        # Generate subject and body based on mode and tone
        if request.user_mode == "job-seeker":
            subject = f"Quick advice on {variable_lookup.get('{{job_title}}', 'this role')} at {variable_lookup.get('{{company_name}}', 'your company')}?"
            
            body = f"""Hi {variable_lookup.get('{{first_name}}', 'there')},

I spotted the {variable_lookup.get('{{job_title}}', 'role')} at {variable_lookup.get('{{company_name}}', 'your company')} and think my background fits perfectly. I noticed you're facing {variable_lookup.get('{{pinpoint_1}}', 'challenges')}, and I have experience {variable_lookup.get('{{solution_1}}', 'solving similar problems')}, resulting in {variable_lookup.get('{{metric_1}}', 'significant impact')}.

{variable_lookup.get('{{company_summary}}', 'Your company')} - this aligns well with my expertise. I'm particularly excited about {variable_lookup.get('{{recent_news}}', 'your recent developments')}.

Open to a brief 15-min chat to sanity-check fit? If helpful, forwarding my resume would be amazing.

Either way—thanks for considering!

Best,
[Your Name]"""
        else:
            subject = f"Exceptional candidate for {variable_lookup.get('{{job_title}}', 'this role')} at {variable_lookup.get('{{company_name}}', 'your company')}"
            
            body = f"""Hi {variable_lookup.get('{{first_name}}', 'there')},

I have an exceptional candidate who would be perfect for your {variable_lookup.get('{{job_title}}', 'role')}. They have successfully {variable_lookup.get('{{solution_1}}', 'solved similar challenges')}, achieving {variable_lookup.get('{{metric_1}}', 'outstanding results')}.

Given {variable_lookup.get('{{company_summary}}', 'your company')} and your recent {variable_lookup.get('{{recent_news}}', 'developments')}, this candidate's background would be invaluable.

{variable_lookup.get('{{contact_bio}}', 'Your background')} - I believe this candidate would be an excellent fit for your team.

Would you be open to a brief call to discuss?

Best regards,
[Your Name]"""
        
        # Adjust tone
        if request.tone == "recruiter":
            body = f"Efficiency-focused approach:\n\n{body}"
        elif request.tone == "manager":
            body = f"Proof of competence:\n\n{body}"
        elif request.tone == "exec":
            body = f"ROI/Strategy focused:\n\n{body}"
        
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
            email_template=email_template
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
            Variable(name="{{pinpoint_1}}", value="", description="First business challenge"),
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
