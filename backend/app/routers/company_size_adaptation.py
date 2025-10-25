"""
FastAPI router for company size adaptation
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from ..services.company_size_adaptation import company_size_adaptation_service, CompanyProfile, CompanySize

router = APIRouter(prefix="/api/company-size-adaptation", tags=["company-size-adaptation"])


class CompanyDataRequest(BaseModel):
    """Request model for company data"""
    name: str
    employee_count: Optional[int] = None
    revenue: Optional[float] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    description: Optional[str] = ""


class CompanySizeDetectionResponse(BaseModel):
    """Response model for company size detection"""
    name: str
    size: str
    employee_count: Optional[int] = None
    revenue: Optional[float] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    characteristics: List[str] = []
    confidence: float = 0.0


class ToneAdaptationRequest(BaseModel):
    """Request model for tone adaptation"""
    company_size: str
    email_content: str


class ToneAdaptationResponse(BaseModel):
    """Response model for tone adaptation"""
    adapted_content: str
    tone_style: str
    formality: str
    approach: str
    key_phrases: List[str] = []
    avoid_phrases: List[str] = []


class SubjectLineRequest(BaseModel):
    """Request model for subject line generation"""
    base_subject: str
    company_size: str


class SubjectLineResponse(BaseModel):
    """Response model for subject line generation"""
    subject_line: str
    style: str


class CompanyInsightsRequest(BaseModel):
    """Request model for company insights"""
    company_size: str


class CompanyInsightsResponse(BaseModel):
    """Response model for company insights"""
    size_category: str
    tone_style: str
    formality_level: str
    approach: str
    key_phrases: List[str] = []
    avoid_phrases: List[str] = []
    email_structure: str
    subject_line_style: str
    characteristics: List[str] = []
    confidence: float = 0.0


class BatchDetectionRequest(BaseModel):
    """Request model for batch detection"""
    companies: List[Dict[str, Any]]


class BatchDetectionResponse(BaseModel):
    """Response model for batch detection"""
    profiles: List[Dict[str, Any]]


@router.post("/detect-size", response_model=CompanySizeDetectionResponse)
async def detect_company_size(request: CompanyDataRequest):
    """Detect company size based on available data"""
    try:
        company_data = {
            "name": request.name,
            "employee_count": request.employee_count,
            "revenue": request.revenue,
            "industry": request.industry,
            "stage": request.stage,
            "description": request.description
        }
        
        profile = company_size_adaptation_service.detect_company_size(company_data)
        
        return CompanySizeDetectionResponse(
            name=profile.name,
            size=profile.size.value,
            employee_count=profile.employee_count,
            revenue=profile.revenue,
            industry=profile.industry,
            stage=profile.stage,
            characteristics=profile.characteristics,
            confidence=profile.confidence
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting company size: {str(e)}")


@router.post("/adapt-tone", response_model=ToneAdaptationResponse)
async def adapt_email_tone(request: ToneAdaptationRequest):
    """Adapt email tone based on company size"""
    try:
        company_size = CompanySize(request.company_size)
        company_profile = CompanyProfile(
            name="Unknown",
            size=company_size,
            characteristics=[]
        )
        
        adapted_content = company_size_adaptation_service.adapt_email_tone(
            request.email_content, company_profile
        )
        
        adaptation = company_size_adaptation_service.get_tone_adaptation(company_size)
        
        return ToneAdaptationResponse(
            adapted_content=adapted_content,
            tone_style=adaptation.tone_style.value,
            formality=adaptation.formality,
            approach=adaptation.approach,
            key_phrases=adaptation.key_phrases,
            avoid_phrases=adaptation.avoid_phrases
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adapting tone: {str(e)}")


@router.post("/generate-subject-line", response_model=SubjectLineResponse)
async def generate_subject_line(request: SubjectLineRequest):
    """Generate appropriate subject line based on company size"""
    try:
        company_size = CompanySize(request.company_size)
        company_profile = CompanyProfile(
            name="Unknown",
            size=company_size,
            characteristics=[]
        )
        
        subject_line = company_size_adaptation_service.generate_subject_line(
            request.base_subject, company_profile
        )
        
        adaptation = company_size_adaptation_service.get_tone_adaptation(company_size)
        
        return SubjectLineResponse(
            subject_line=subject_line,
            style=adaptation.subject_line_style
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating subject line: {str(e)}")


@router.post("/get-insights", response_model=CompanyInsightsResponse)
async def get_company_insights(request: CompanyInsightsRequest):
    """Get insights about the company for personalization"""
    try:
        company_size = CompanySize(request.company_size)
        company_profile = CompanyProfile(
            name="Unknown",
            size=company_size,
            characteristics=[]
        )
        
        insights = company_size_adaptation_service.get_company_insights(company_profile)
        
        return CompanyInsightsResponse(
            size_category=insights["size_category"],
            tone_style=insights["tone_style"],
            formality_level=insights["formality_level"],
            approach=insights["approach"],
            key_phrases=insights["key_phrases"],
            avoid_phrases=insights["avoid_phrases"],
            email_structure=insights["email_structure"],
            subject_line_style=insights["subject_line_style"],
            characteristics=insights["characteristics"],
            confidence=insights["confidence"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting company insights: {str(e)}")


@router.post("/batch-detect", response_model=BatchDetectionResponse)
async def batch_detect_company_sizes(request: BatchDetectionRequest):
    """Batch detect company sizes for multiple companies"""
    try:
        profiles = company_size_adaptation_service.batch_detect_company_sizes(request.companies)
        
        profile_dicts = []
        for profile in profiles:
            profile_dicts.append({
                "name": profile.name,
                "size": profile.size.value,
                "employee_count": profile.employee_count,
                "revenue": profile.revenue,
                "industry": profile.industry,
                "stage": profile.stage,
                "characteristics": profile.characteristics,
                "confidence": profile.confidence
            })
        
        return BatchDetectionResponse(profiles=profile_dicts)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error batch detecting company sizes: {str(e)}")


@router.get("/size-categories")
async def get_size_categories():
    """Get all available company size categories"""
    try:
        categories = []
        for size in CompanySize:
            categories.append({
                "value": size.value,
                "label": size.value.title(),
                "description": f"Company size: {size.value}"
            })
        
        return {"categories": categories}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting size categories: {str(e)}")


@router.get("/tone-styles")
async def get_tone_styles():
    """Get all available tone styles"""
    try:
        styles = []
        for size in CompanySize:
            adaptation = company_size_adaptation_service.get_tone_adaptation(size)
            styles.append({
                "company_size": size.value,
                "tone_style": adaptation.tone_style.value,
                "formality": adaptation.formality,
                "approach": adaptation.approach,
                "key_phrases": adaptation.key_phrases,
                "avoid_phrases": adaptation.avoid_phrases
            })
        
        return {"styles": styles}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting tone styles: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "company-size-adaptation"}
