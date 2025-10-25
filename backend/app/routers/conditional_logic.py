"""
FastAPI router for conditional logic and field inference
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from ..services.conditional_logic import conditional_logic_service, FieldInference

router = APIRouter(prefix="/api/conditional-logic", tags=["conditional-logic"])


class FieldInferenceRequest(BaseModel):
    """Request model for field inference"""
    data: Dict[str, Any]
    required_fields: Optional[List[str]] = None


class FieldInferenceResponse(BaseModel):
    """Response model for field inference"""
    inferences: List[Dict[str, Any]]
    missing_fields: List[str]
    suggestions: Dict[str, List[Dict[str, Any]]]


class ValidateInferenceRequest(BaseModel):
    """Request model for validating inferences"""
    inferences: List[Dict[str, Any]]


class ValidateInferenceResponse(BaseModel):
    """Response model for validated inferences"""
    validated_inferences: List[Dict[str, Any]]
    confidence_scores: Dict[str, float]


@router.post("/infer-fields", response_model=FieldInferenceResponse)
async def infer_missing_fields(request: FieldInferenceRequest):
    """Infer missing fields based on available data"""
    try:
        # Get missing fields
        required_fields = request.required_fields or [
            "reports_to", "company_size", "industry", "location", 
            "experience_level", "salary_range"
        ]
        missing_fields = conditional_logic_service.get_missing_fields(request.data, required_fields)
        
        # Get field inferences
        inferences = conditional_logic_service.infer_missing_fields(request.data)
        validated_inferences = conditional_logic_service.validate_inferences(inferences)
        
        # Get suggestions for missing fields
        suggestions = conditional_logic_service.suggest_field_values(request.data, missing_fields)
        
        # Convert to response format
        inference_dicts = []
        for inference in validated_inferences:
            inference_dicts.append({
                "field": inference.field,
                "value": inference.value,
                "confidence": inference.confidence,
                "reasoning": inference.reasoning,
                "source_fields": inference.source_fields
            })
        
        suggestion_dicts = {}
        for field, field_inferences in suggestions.items():
            suggestion_dicts[field] = []
            for inference in field_inferences:
                suggestion_dicts[field].append({
                    "value": inference.value,
                    "confidence": inference.confidence,
                    "reasoning": inference.reasoning,
                    "source_fields": inference.source_fields
                })
        
        return FieldInferenceResponse(
            inferences=inference_dicts,
            missing_fields=missing_fields,
            suggestions=suggestion_dicts
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inferring fields: {str(e)}")


@router.post("/validate-inferences", response_model=ValidateInferenceResponse)
async def validate_inferences(request: ValidateInferenceRequest):
    """Validate and filter inferences based on confidence thresholds"""
    try:
        # Convert dicts back to FieldInference objects
        inferences = []
        for inf_dict in request.inferences:
            inference = FieldInference(
                field=inf_dict["field"],
                value=inf_dict["value"],
                confidence=inf_dict["confidence"],
                reasoning=inf_dict["reasoning"],
                source_fields=inf_dict["source_fields"]
            )
            inferences.append(inference)
        
        # Validate inferences
        validated_inferences = conditional_logic_service.validate_inferences(inferences)
        
        # Convert back to dicts
        validated_dicts = []
        confidence_scores = {}
        
        for inference in validated_inferences:
            validated_dicts.append({
                "field": inference.field,
                "value": inference.value,
                "confidence": inference.confidence,
                "reasoning": inference.reasoning,
                "source_fields": inference.source_fields
            })
            confidence_scores[inference.field] = inference.confidence
        
        return ValidateInferenceResponse(
            validated_inferences=validated_dicts,
            confidence_scores=confidence_scores
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating inferences: {str(e)}")


@router.get("/rules")
async def get_conditional_rules():
    """Get all available conditional rules"""
    try:
        rules = []
        for rule in conditional_logic_service.rules:
            rules.append({
                "field": rule.field,
                "condition": rule.condition,
                "inference": rule.inference,
                "confidence": rule.confidence,
                "source_fields": rule.source_fields
            })
        
        return {"rules": rules}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting rules: {str(e)}")


@router.post("/test-rule")
async def test_conditional_rule(rule_data: Dict[str, Any]):
    """Test a specific conditional rule"""
    try:
        field = rule_data.get("field")
        condition = rule_data.get("condition")
        data = rule_data.get("data", {})
        
        # Find the rule
        rule = None
        for r in conditional_logic_service.rules:
            if r.field == field and r.condition == condition:
                rule = r
                break
        
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        # Test the rule
        condition_met = conditional_logic_service._evaluate_condition(condition, data)
        
        if condition_met:
            inference = conditional_logic_service._apply_inference(rule, data)
            if inference:
                return {
                    "condition_met": True,
                    "inference": {
                        "field": inference.field,
                        "value": inference.value,
                        "confidence": inference.confidence,
                        "reasoning": inference.reasoning,
                        "source_fields": inference.source_fields
                    }
                }
            else:
                return {
                    "condition_met": True,
                    "inference": None,
                    "message": "Condition met but no inference generated"
                }
        else:
            return {
                "condition_met": False,
                "inference": None,
                "message": "Condition not met"
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error testing rule: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "conditional-logic"}
