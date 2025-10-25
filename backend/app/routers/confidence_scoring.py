"""
FastAPI router for confidence scoring and human validation
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..services.confidence_scoring import (
    confidence_scoring_service, 
    ConfidenceScore, 
    ValidationRequest, 
    ValidationResponse,
    ValidationStatus,
    ConfidenceLevel
)

router = APIRouter(prefix="/api/confidence-scoring", tags=["confidence-scoring"])


class ConfidenceScoreRequest(BaseModel):
    """Request model for confidence scoring"""
    field: str
    value: str
    context: Dict[str, Any]


class ConfidenceScoreResponse(BaseModel):
    """Response model for confidence scoring"""
    field: str
    value: str
    confidence: float
    level: str
    factors: List[str]
    validation_required: bool
    recommendations: List[str]


class ValidationRequestModel(BaseModel):
    """Request model for creating validation requests"""
    field: str
    value: str
    confidence: float
    context: Dict[str, Any]
    requested_by: str


class ValidationResponseModel(BaseModel):
    """Request model for validation responses"""
    request_id: str
    status: str
    feedback: str
    validated_by: str
    confidence_adjustment: Optional[float] = None


class BatchValidationRequest(BaseModel):
    """Request model for batch validation"""
    validations: List[Dict[str, Any]]


class ValidationStatsResponse(BaseModel):
    """Response model for validation statistics"""
    total_requests: int
    pending: int
    approved: int
    rejected: int
    approval_rate: float


@router.post("/calculate-confidence", response_model=ConfidenceScoreResponse)
async def calculate_confidence_score(request: ConfidenceScoreRequest):
    """Calculate confidence score for a field value"""
    try:
        score = confidence_scoring_service.calculate_confidence_score(
            field=request.field,
            value=request.value,
            context=request.context
        )
        
        recommendations = confidence_scoring_service.get_confidence_recommendations(
            field=request.field,
            value=request.value,
            context=request.context
        )
        
        return ConfidenceScoreResponse(
            field=score.field,
            value=score.value,
            confidence=score.confidence,
            level=score.level.value,
            factors=score.factors,
            validation_required=score.validation_required,
            recommendations=recommendations
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating confidence: {str(e)}")


@router.post("/create-validation-request", response_model=Dict[str, str])
async def create_validation_request(request: ValidationRequestModel):
    """Create a validation request for human review"""
    try:
        validation_request = confidence_scoring_service.create_validation_request(
            field=request.field,
            value=request.value,
            confidence=request.confidence,
            context=request.context,
            requested_by=request.requested_by
        )
        
        return {
            "request_id": validation_request.id,
            "status": validation_request.status.value,
            "message": "Validation request created successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating validation request: {str(e)}")


@router.post("/submit-validation-response", response_model=Dict[str, str])
async def submit_validation_response(request: ValidationResponseModel):
    """Submit a validation response"""
    try:
        status = ValidationStatus(request.status)
        
        response = confidence_scoring_service.submit_validation_response(
            request_id=request.request_id,
            status=status,
            feedback=request.feedback,
            validated_by=request.validated_by,
            confidence_adjustment=request.confidence_adjustment
        )
        
        return {
            "request_id": response.request_id,
            "status": response.status.value,
            "message": "Validation response submitted successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting validation response: {str(e)}")


@router.get("/pending-validations", response_model=List[Dict[str, Any]])
async def get_pending_validations(limit: int = 50):
    """Get pending validation requests"""
    try:
        pending = confidence_scoring_service.get_pending_validations(limit)
        
        return [
            {
                "id": req.id,
                "field": req.field,
                "value": req.value,
                "confidence": req.confidence,
                "context": req.context,
                "requested_by": req.requested_by,
                "requested_at": req.requested_at.isoformat(),
                "status": req.status.value
            }
            for req in pending
        ]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting pending validations: {str(e)}")


@router.get("/validation-stats", response_model=ValidationStatsResponse)
async def get_validation_stats():
    """Get validation statistics"""
    try:
        stats = confidence_scoring_service.get_validation_stats()
        
        return ValidationStatsResponse(
            total_requests=stats["total_requests"],
            pending=stats["pending"],
            approved=stats["approved"],
            rejected=stats["rejected"],
            approval_rate=stats["approval_rate"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting validation stats: {str(e)}")


@router.post("/batch-validate", response_model=List[Dict[str, str]])
async def batch_validate(request: BatchValidationRequest):
    """Batch create validation requests"""
    try:
        requests = confidence_scoring_service.batch_validate(request.validations)
        
        return [
            {
                "request_id": req.id,
                "field": req.field,
                "status": req.status.value,
                "message": "Validation request created successfully"
            }
            for req in requests
        ]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error batch creating validations: {str(e)}")


@router.get("/validation-history")
async def get_validation_history(field: Optional[str] = None, status: Optional[str] = None):
    """Get validation history with optional filtering"""
    try:
        status_enum = ValidationStatus(status) if status else None
        history = confidence_scoring_service.get_validation_history(field, status_enum)
        
        return [
            {
                "id": req.id,
                "field": req.field,
                "value": req.value,
                "confidence": req.confidence,
                "context": req.context,
                "requested_by": req.requested_by,
                "requested_at": req.requested_at.isoformat(),
                "status": req.status.value,
                "validated_by": req.validated_by,
                "validated_at": req.validated_at.isoformat() if req.validated_at else None,
                "human_feedback": req.human_feedback
            }
            for req in history
        ]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting validation history: {str(e)}")


@router.put("/confidence-thresholds")
async def update_confidence_thresholds(thresholds: Dict[str, float]):
    """Update confidence thresholds"""
    try:
        confidence_scoring_service.update_confidence_thresholds(thresholds)
        
        return {
            "message": "Confidence thresholds updated successfully",
            "thresholds": confidence_scoring_service.confidence_thresholds
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating thresholds: {str(e)}")


@router.get("/confidence-thresholds")
async def get_confidence_thresholds():
    """Get current confidence thresholds"""
    try:
        return {
            "thresholds": confidence_scoring_service.confidence_thresholds
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting thresholds: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "confidence-scoring"}
