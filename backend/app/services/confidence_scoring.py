"""
Confidence Scoring and Human Validation Service for RoleFerry
Handles confidence scoring, validation loops, and human feedback integration
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import json
from datetime import datetime, timedelta


class ValidationStatus(Enum):
    """Status of validation"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


class ConfidenceLevel(Enum):
    """Confidence levels"""
    LOW = "low"          # 0-60%
    MEDIUM = "medium"    # 61-80%
    HIGH = "high"        # 81-95%
    VERY_HIGH = "very_high"  # 96-100%


@dataclass
class ConfidenceScore:
    """Represents a confidence score for a field or inference"""
    field: str
    value: str
    confidence: float
    level: ConfidenceLevel
    factors: List[str]
    validation_required: bool
    human_feedback: Optional[str] = None
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None


@dataclass
class ValidationRequest:
    """Represents a validation request"""
    id: str
    field: str
    value: str
    confidence: float
    context: Dict[str, Any]
    requested_by: str
    requested_at: datetime
    status: ValidationStatus = ValidationStatus.PENDING
    human_feedback: Optional[str] = None
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None


@dataclass
class ValidationResponse:
    """Represents a validation response"""
    request_id: str
    status: ValidationStatus
    feedback: str
    validated_by: str
    validated_at: datetime
    confidence_adjustment: Optional[float] = None


class ConfidenceScoringService:
    """Service for confidence scoring and human validation"""
    
    def __init__(self):
        self.validation_requests: Dict[str, ValidationRequest] = {}
        self.validation_responses: Dict[str, ValidationResponse] = {}
        self.confidence_thresholds = {
            "auto_approve": 0.95,
            "human_review": 0.80,
            "reject": 0.60
        }
    
    def calculate_confidence_score(self, field: str, value: str, context: Dict[str, Any]) -> ConfidenceScore:
        """Calculate confidence score for a field value"""
        factors = []
        confidence = 0.0
        
        # Factor 1: Data source reliability
        source_reliability = self._get_source_reliability(context.get("source", "unknown"))
        confidence += source_reliability * 0.3
        factors.append(f"Source reliability: {source_reliability:.2f}")
        
        # Factor 2: Data completeness
        completeness = self._get_data_completeness(context)
        confidence += completeness * 0.25
        factors.append(f"Data completeness: {completeness:.2f}")
        
        # Factor 3: Field-specific validation
        field_validation = self._get_field_validation(field, value, context)
        confidence += field_validation * 0.25
        factors.append(f"Field validation: {field_validation:.2f}")
        
        # Factor 4: Cross-field consistency
        consistency = self._get_cross_field_consistency(field, value, context)
        confidence += consistency * 0.20
        factors.append(f"Cross-field consistency: {consistency:.2f}")
        
        # Determine confidence level
        if confidence >= 0.96:
            level = ConfidenceLevel.VERY_HIGH
        elif confidence >= 0.81:
            level = ConfidenceLevel.HIGH
        elif confidence >= 0.61:
            level = ConfidenceLevel.MEDIUM
        else:
            level = ConfidenceLevel.LOW
        
        # Determine if validation is required
        validation_required = confidence < self.confidence_thresholds["auto_approve"]
        
        return ConfidenceScore(
            field=field,
            value=value,
            confidence=confidence,
            level=level,
            factors=factors,
            validation_required=validation_required
        )
    
    def _get_source_reliability(self, source: str) -> float:
        """Get reliability score for data source"""
        source_scores = {
            "linkedin": 0.95,
            "company_website": 0.90,
            "email_verification": 0.85,
            "social_media": 0.70,
            "public_records": 0.80,
            "user_input": 0.75,
            "ai_inference": 0.65,
            "unknown": 0.50
        }
        return source_scores.get(source, 0.50)
    
    def _get_data_completeness(self, context: Dict[str, Any]) -> float:
        """Get completeness score for data"""
        required_fields = ["title", "company", "email"]
        available_fields = [field for field in required_fields if field in context and context[field]]
        completeness = len(available_fields) / len(required_fields)
        return completeness
    
    def _get_field_validation(self, field: str, value: str, context: Dict[str, Any]) -> float:
        """Get validation score for specific field"""
        if field == "email":
            return self._validate_email(value)
        elif field == "phone":
            return self._validate_phone(value)
        elif field == "company_size":
            return self._validate_company_size(value)
        elif field == "salary_range":
            return self._validate_salary_range(value)
        else:
            return 0.8  # Default validation score
    
    def _validate_email(self, email: str) -> float:
        """Validate email format"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if re.match(pattern, email):
            return 0.95
        return 0.30
    
    def _validate_phone(self, phone: str) -> float:
        """Validate phone format"""
        import re
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', phone)
        if len(digits) >= 10:
            return 0.90
        return 0.40
    
    def _validate_company_size(self, size: str) -> float:
        """Validate company size format"""
        if "employees" in size.lower() and any(char.isdigit() for char in size):
            return 0.90
        return 0.60
    
    def _validate_salary_range(self, salary: str) -> float:
        """Validate salary range format"""
        if "$" in salary and any(char.isdigit() for char in salary):
            return 0.85
        return 0.50
    
    def _get_cross_field_consistency(self, field: str, value: str, context: Dict[str, Any]) -> float:
        """Get consistency score across related fields"""
        consistency_score = 0.8  # Base consistency
        
        # Check title vs company size consistency
        if field == "title" and "company_size" in context:
            title = value.lower()
            company_size = context["company_size"].lower()
            
            if "ceo" in title and "startup" in company_size:
                consistency_score = 0.95
            elif "manager" in title and "medium" in company_size:
                consistency_score = 0.90
            elif "director" in title and "large" in company_size:
                consistency_score = 0.95
        
        # Check experience vs salary consistency
        if field == "salary_range" and "experience_level" in context:
            salary = value.lower()
            experience = context["experience_level"].lower()
            
            if "entry" in experience and "50" in salary:
                consistency_score = 0.90
            elif "senior" in experience and "150" in salary:
                consistency_score = 0.95
        
        return consistency_score
    
    def create_validation_request(self, field: str, value: str, confidence: float, 
                                context: Dict[str, Any], requested_by: str) -> ValidationRequest:
        """Create a validation request for human review"""
        request_id = f"val_{field}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        request = ValidationRequest(
            id=request_id,
            field=field,
            value=value,
            confidence=confidence,
            context=context,
            requested_by=requested_by,
            requested_at=datetime.now()
        )
        
        self.validation_requests[request_id] = request
        return request
    
    def submit_validation_response(self, request_id: str, status: ValidationStatus, 
                                feedback: str, validated_by: str, 
                                confidence_adjustment: Optional[float] = None) -> ValidationResponse:
        """Submit a validation response"""
        if request_id not in self.validation_requests:
            raise ValueError(f"Validation request {request_id} not found")
        
        request = self.validation_requests[request_id]
        request.status = status
        request.validated_by = validated_by
        request.validated_at = datetime.now()
        request.human_feedback = feedback
        
        response = ValidationResponse(
            request_id=request_id,
            status=status,
            feedback=feedback,
            validated_by=validated_by,
            validated_at=datetime.now(),
            confidence_adjustment=confidence_adjustment
        )
        
        self.validation_responses[request_id] = response
        return response
    
    def get_pending_validations(self, limit: int = 50) -> List[ValidationRequest]:
        """Get pending validation requests"""
        pending = [
            req for req in self.validation_requests.values()
            if req.status == ValidationStatus.PENDING
        ]
        return sorted(pending, key=lambda x: x.requested_at)[:limit]
    
    def get_validation_stats(self) -> Dict[str, Any]:
        """Get validation statistics"""
        total_requests = len(self.validation_requests)
        pending = len([r for r in self.validation_requests.values() if r.status == ValidationStatus.PENDING])
        approved = len([r for r in self.validation_requests.values() if r.status == ValidationStatus.APPROVED])
        rejected = len([r for r in self.validation_requests.values() if r.status == ValidationStatus.REJECTED])
        
        return {
            "total_requests": total_requests,
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
            "approval_rate": approved / total_requests if total_requests > 0 else 0
        }
    
    def update_confidence_thresholds(self, thresholds: Dict[str, float]) -> None:
        """Update confidence thresholds"""
        self.confidence_thresholds.update(thresholds)
    
    def get_confidence_recommendations(self, field: str, value: str, context: Dict[str, Any]) -> List[str]:
        """Get recommendations for improving confidence"""
        recommendations = []
        
        # Check data completeness
        if not context.get("email"):
            recommendations.append("Add email address to improve confidence")
        if not context.get("company"):
            recommendations.append("Add company name to improve confidence")
        if not context.get("title"):
            recommendations.append("Add job title to improve confidence")
        
        # Check source reliability
        source = context.get("source", "unknown")
        if source == "unknown":
            recommendations.append("Use more reliable data sources (LinkedIn, company website)")
        
        # Check field-specific recommendations
        if field == "email" and "@" not in value:
            recommendations.append("Verify email format")
        if field == "phone" and len(value.replace(" ", "").replace("-", "")) < 10:
            recommendations.append("Verify phone number format")
        
        return recommendations
    
    def batch_validate(self, validations: List[Dict[str, Any]]) -> List[ValidationRequest]:
        """Batch create validation requests"""
        requests = []
        for validation in validations:
            request = self.create_validation_request(
                field=validation["field"],
                value=validation["value"],
                confidence=validation["confidence"],
                context=validation["context"],
                requested_by=validation["requested_by"]
            )
            requests.append(request)
        return requests
    
    def get_validation_history(self, field: Optional[str] = None, 
                             status: Optional[ValidationStatus] = None) -> List[ValidationRequest]:
        """Get validation history with optional filtering"""
        requests = list(self.validation_requests.values())
        
        if field:
            requests = [r for r in requests if r.field == field]
        
        if status:
            requests = [r for r in requests if r.status == status]
        
        return sorted(requests, key=lambda x: x.requested_at, reverse=True)


# Global instance
confidence_scoring_service = ConfidenceScoringService()
