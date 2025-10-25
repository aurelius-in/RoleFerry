from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ..services.email_verifier import verify_email_async, get_verification_badge

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

class ContactVerificationRequest(BaseModel):
    contact_ids: List[str]

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
        
        return ContactSearchResponse(
            success=True,
            message=f"Found {len(mock_contacts)} contacts",
            contacts=mock_contacts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search contacts: {str(e)}")

@router.post("/verify", response_model=ContactVerificationResponse)
async def verify_contacts(request: ContactVerificationRequest):
    """
    Verify email addresses for selected contacts.
    """
    try:
        # In a real implementation, this would fetch contacts from database and verify emails
        # For now, return mock verification results
        verified_contacts = []
        
        for contact_id in request.contact_ids:
            # Mock contact data
            mock_contact = Contact(
                id=contact_id,
                name="Contact Name",
                title="Job Title",
                email="contact@company.com",
                confidence=0.9,
                verification_status="unknown",
                verification_score=None,
                company="Company Name",
                department="Department",
                level="Level"
            )
            
            # Verify email
            verification_result = await verify_email_async(mock_contact.email)
            
            # Update contact with verification results
            mock_contact.verification_status = verification_result.get("status", "unknown")
            mock_contact.verification_score = verification_result.get("score")
            
            verified_contacts.append(mock_contact)
        
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
