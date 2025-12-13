from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ..services.email_verifier import verify_email_async, get_verification_badge
from ..clients.openai_client import get_openai_client, extract_json_from_text
import json

router = APIRouter()

class Contact(BaseModel):
    id: str
    name: str
    title: str
    email: str
    linkedin_url: Optional[str] = None
    confidence: float
    verification_status: str
    verification_score: Optional[float] = None
    company: str
    department: str
    level: str

class ContactSearchRequest(BaseModel):
    query: str
    company: Optional[str] = None
    role: Optional[str] = None
    level: Optional[str] = None

class ContactSearchResponse(BaseModel):
    success: bool
    message: str
    contacts: List[Contact]
    helper: Optional[Dict[str, Any]] = None

class ContactVerificationRequest(BaseModel):
    contact_ids: List[str]
    # Optional: allow the frontend to send the current contact objects so we can
    # verify the real emails deterministically without a DB lookup.
    contacts: Optional[List[Contact]] = None

class ContactVerificationResponse(BaseModel):
    success: bool
    message: str
    verified_contacts: List[Contact]

@router.post("/search", response_model=ContactSearchResponse)
async def search_contacts(request: ContactSearchRequest):
    """
    Search for contacts at target companies.
    """
    try:
        # In a real implementation, this would integrate with Apollo, Clay, or other data providers
        # For now, return mock data
        mock_contacts = [
            Contact(
                id="contact_1",
                name="Sarah Johnson",
                title="VP of Engineering",
                email="sarah.johnson@techcorp.com",
                linkedin_url="https://linkedin.com/in/sarahjohnson",
                confidence=0.95,
                verification_status="unknown",
                verification_score=None,
                company="TechCorp Inc.",
                department="Engineering",
                level="VP"
            ),
            Contact(
                id="contact_2",
                name="Mike Chen",
                title="Head of Talent Acquisition",
                email="mike.chen@techcorp.com",
                linkedin_url="https://linkedin.com/in/mikechen",
                confidence=0.88,
                verification_status="unknown",
                verification_score=None,
                company="TechCorp Inc.",
                department="HR",
                level="Head"
            ),
            Contact(
                id="contact_3",
                name="Jennifer Martinez",
                title="Senior Engineering Manager",
                email="j.martinez@techcorp.com",
                linkedin_url="https://linkedin.com/in/jennifermartinez",
                confidence=0.92,
                verification_status="unknown",
                verification_score=None,
                company="TechCorp Inc.",
                department="Engineering",
                level="Senior Manager"
            )
        ]

        # GPT helper: decision-maker talking points + outreach angles per contact.
        client = get_openai_client()
        helper_context = {
            "query": request.query,
            "company": request.company,
            "role": request.role,
            "level": request.level,
            "contacts": [c.model_dump() for c in mock_contacts],
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You generate outreach talking points for decision makers.\n\n"
                    "Return ONLY JSON with keys:\n"
                    "- talking_points_by_contact: object mapping contact_id -> array of strings\n"
                    "- opener_suggestions: array of strings\n"
                    "- questions_to_ask: array of strings\n"
                ),
            },
            {"role": "user", "content": json.dumps(helper_context)},
        ]
        stub_json = {
            "talking_points_by_contact": {
                "contact_1": [
                    "Lead with reliability/cost outcomes; ask about current bottlenecks.",
                    "Reference platform scale and engineering execution velocity.",
                ],
                "contact_2": [
                    "Ask what ‘great candidate’ means for this role and how they evaluate impact.",
                    "Offer a short plan focused on the top pain point + measurable metric.",
                ],
                "contact_3": [
                    "Tailor to day-to-day execution: ownership, incident prevention, and delivery cadence.",
                    "Ask what success looks like in the first 60–90 days.",
                ],
            },
            "opener_suggestions": [
                "Quick question on your priorities for the role",
                "Noticed a theme in the job posting — here’s a concrete idea",
            ],
            "questions_to_ask": [
                "What’s the most urgent outcome you need in the next 90 days?",
                "Where is the team currently feeling the most pain (quality, speed, cost)?",
            ],
        }
        raw = client.run_chat_completion(messages, temperature=0.25, max_tokens=650, stub_json=stub_json)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        helper = extract_json_from_text(content_str) or stub_json

        return ContactSearchResponse(
            success=True,
            message=f"Found {len(mock_contacts)} contacts",
            contacts=mock_contacts,
            helper=helper,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search contacts: {str(e)}")

@router.post("/verify", response_model=ContactVerificationResponse)
async def verify_contacts(request: ContactVerificationRequest):
    """
    Verify email addresses for selected contacts.
    """
    try:
        verified_contacts: List[Contact] = []

        contacts_by_id: Dict[str, Contact] = {}
        for c in (request.contacts or []):
            contacts_by_id[c.id] = c

        for contact_id in request.contact_ids:
            base = contacts_by_id.get(contact_id)
            if base is None:
                base = Contact(
                    id=contact_id,
                    name="Contact",
                    title="Decision Maker",
                    email=f"{contact_id}@example.com",
                    confidence=0.8,
                    verification_status="unknown",
                    verification_score=None,
                    company="Company",
                    department="Engineering",
                    level="Director",
                )

            verification_result = await verify_email_async(base.email)
            base.verification_status = verification_result.get("status", "unknown")
            base.verification_score = verification_result.get("score")
            verified_contacts.append(base)
        
        return ContactVerificationResponse(
            success=True,
            message=f"Verified {len(verified_contacts)} contacts",
            verified_contacts=verified_contacts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify contacts: {str(e)}")

@router.get("/{contact_id}", response_model=Contact)
async def get_contact(contact_id: str):
    """
    Get a specific contact by ID.
    """
    try:
        # In a real implementation, this would fetch from database
        # For now, return mock data
        mock_contact = Contact(
            id=contact_id,
            name="Sarah Johnson",
            title="VP of Engineering",
            email="sarah.johnson@techcorp.com",
            linkedin_url="https://linkedin.com/in/sarahjohnson",
            confidence=0.95,
            verification_status="valid",
            verification_score=92,
            company="TechCorp Inc.",
            department="Engineering",
            level="VP"
        )
        
        return mock_contact
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get contact: {str(e)}")

@router.put("/{contact_id}", response_model=Contact)
async def update_contact(contact_id: str, contact: Contact):
    """
    Update a contact.
    """
    try:
        # In a real implementation, this would update in database
        return contact
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update contact: {str(e)}")

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    """
    Delete a contact.
    """
    try:
        # In a real implementation, this would delete from database
        return {"success": True, "message": "Contact deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete contact: {str(e)}")

@router.get("/badge/{status}/{score}")
async def get_contact_badge(status: str, score: float):
    """
    Get badge information for a contact's verification status.
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
        raise HTTPException(status_code=500, detail=f"Failed to get badge: {str(e)}")
