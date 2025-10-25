"""
FastAPI router for template engine
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from ..services.template_engine import template_engine

router = APIRouter(prefix="/api/template-engine", tags=["template-engine"])


class TemplateParseRequest(BaseModel):
    """Request model for template parsing"""
    template: str
    context: Dict[str, Any]


class TemplateParseResponse(BaseModel):
    """Response model for template parsing"""
    template: str
    variables: List[Dict[str, Any]]
    missing_variables: List[str]
    parse_success: bool
    error_message: Optional[str] = None


class TemplateSubstituteRequest(BaseModel):
    """Request model for template substitution"""
    template: str
    context: Dict[str, Any]


class TemplateSubstituteResponse(BaseModel):
    """Response model for template substitution"""
    result: str
    variables_substituted: int
    missing_variables: List[str]


class TemplateValidateRequest(BaseModel):
    """Request model for template validation"""
    template: str
    context: Dict[str, Any]


class TemplateValidateResponse(BaseModel):
    """Response model for template validation"""
    valid: bool
    variables_found: int
    missing_variables: List[str]
    variables: List[Dict[str, Any]]
    error_message: Optional[str] = None


class AvailableVariablesRequest(BaseModel):
    """Request model for getting available variables"""
    context: Dict[str, Any]


class AvailableVariablesResponse(BaseModel):
    """Response model for available variables"""
    variables: List[Dict[str, Any]]


@router.post("/parse", response_model=TemplateParseResponse)
async def parse_template(request: TemplateParseRequest):
    """Parse a template and extract variables"""
    try:
        result = template_engine.parse_template(request.template, request.context)
        
        return TemplateParseResponse(
            template=result.template,
            variables=[
                {
                    "name": var.name,
                    "type": var.type.value,
                    "value": var.value,
                    "confidence": var.confidence,
                    "source": var.source,
                    "description": var.description,
                    "required": var.required,
                    "fallback": var.fallback
                }
                for var in result.variables
            ],
            missing_variables=result.missing_variables,
            parse_success=result.parse_success,
            error_message=result.error_message
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing template: {str(e)}")


@router.post("/substitute", response_model=TemplateSubstituteResponse)
async def substitute_variables(request: TemplateSubstituteRequest):
    """Substitute variables in a template"""
    try:
        result = template_engine.substitute_variables(request.template, request.context)
        
        # Parse to get variable count
        parse_result = template_engine.parse_template(request.template, request.context)
        
        return TemplateSubstituteResponse(
            result=result,
            variables_substituted=len(parse_result.variables),
            missing_variables=parse_result.missing_variables
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error substituting variables: {str(e)}")


@router.post("/validate", response_model=TemplateValidateResponse)
async def validate_template(request: TemplateValidateRequest):
    """Validate a template"""
    try:
        validation_result = template_engine.validate_template(request.template, request.context)
        
        return TemplateValidateResponse(
            valid=validation_result["valid"],
            variables_found=validation_result["variables_found"],
            missing_variables=validation_result["missing_variables"],
            variables=validation_result["variables"],
            error_message=validation_result["error_message"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating template: {str(e)}")


@router.post("/available-variables", response_model=AvailableVariablesResponse)
async def get_available_variables(request: AvailableVariablesRequest):
    """Get available variables based on context"""
    try:
        variables = template_engine.get_available_variables(request.context)
        
        return AvailableVariablesResponse(variables=variables)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available variables: {str(e)}")


@router.get("/variable-patterns")
async def get_variable_patterns():
    """Get all available variable patterns"""
    try:
        patterns = {}
        for pattern, var_type in template_engine.variable_patterns.items():
            patterns[pattern] = var_type.value
        
        return {
            "patterns": patterns,
            "descriptions": template_engine.variable_descriptions
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting variable patterns: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "template-engine"}
