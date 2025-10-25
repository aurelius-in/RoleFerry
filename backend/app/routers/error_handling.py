"""
FastAPI router for error handling and validation
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from ..services.error_handling import ErrorHandlingService, ValidationError, ErrorResponse

router = APIRouter()
error_service = ErrorHandlingService()

@router.post("/validate-email")
async def validate_email(email: str) -> ErrorResponse:
    """Validate email format"""
    error = error_service.validate_email(email)
    if error:
        return ErrorResponse(
            success=False,
            errors=[error],
            message="Email validation failed"
        )
    return ErrorResponse(success=True)

@router.post("/validate-phone")
async def validate_phone(phone: str) -> ErrorResponse:
    """Validate phone number format"""
    error = error_service.validate_phone(phone)
    if error:
        return ErrorResponse(
            success=False,
            errors=[error],
            message="Phone validation failed"
        )
    return ErrorResponse(success=True)

@router.post("/validate-name")
async def validate_name(name: str, field_name: str = "name") -> ErrorResponse:
    """Validate name format"""
    error = error_service.validate_name(name, field_name)
    if error:
        return ErrorResponse(
            success=False,
            errors=[error],
            message="Name validation failed"
        )
    return ErrorResponse(success=True)

@router.post("/validate-company")
async def validate_company(company: str) -> ErrorResponse:
    """Validate company name format"""
    error = error_service.validate_company(company)
    if error:
        return ErrorResponse(
            success=False,
            errors=[error],
            message="Company validation failed"
        )
    return ErrorResponse(success=True)

@router.post("/validate-url")
async def validate_url(url: str) -> ErrorResponse:
    """Validate URL format"""
    error = error_service.validate_url(url)
    if error:
        return ErrorResponse(
            success=False,
            errors=[error],
            message="URL validation failed"
        )
    return ErrorResponse(success=True)

@router.post("/validate-job-preferences")
async def validate_job_preferences(data: Dict[str, Any]) -> ErrorResponse:
    """Validate job preferences data"""
    errors = error_service.validate_job_preferences(data)
    return error_service.handle_validation_errors(errors)

@router.post("/validate-resume")
async def validate_resume_data(data: Dict[str, Any]) -> ErrorResponse:
    """Validate resume data"""
    errors = error_service.validate_resume_data(data)
    return error_service.handle_validation_errors(errors)

@router.post("/validate-job-description")
async def validate_job_description(data: Dict[str, Any]) -> ErrorResponse:
    """Validate job description data"""
    errors = error_service.validate_job_description(data)
    return error_service.handle_validation_errors(errors)

@router.post("/validate-contact")
async def validate_contact_data(data: Dict[str, Any]) -> ErrorResponse:
    """Validate contact data"""
    errors = error_service.validate_contact_data(data)
    return error_service.handle_validation_errors(errors)

@router.post("/validate-email-content")
async def validate_email_content(data: Dict[str, Any]) -> ErrorResponse:
    """Validate email content"""
    errors = error_service.validate_email_content(data)
    return error_service.handle_validation_errors(errors)

@router.post("/validate-campaign")
async def validate_campaign_data(data: Dict[str, Any]) -> ErrorResponse:
    """Validate campaign data"""
    errors = error_service.validate_campaign_data(data)
    return error_service.handle_validation_errors(errors)

@router.post("/validate-required-fields")
async def validate_required_fields(
    data: Dict[str, Any], 
    required_fields: List[str]
) -> ErrorResponse:
    """Validate that all required fields are present"""
    errors = error_service.validate_required_fields(data, required_fields)
    return error_service.handle_validation_errors(errors)

@router.post("/handle-api-error")
async def handle_api_error(error_message: str, context: str = "") -> ErrorResponse:
    """Handle API errors"""
    try:
        # Simulate an exception for testing
        raise Exception(error_message)
    except Exception as e:
        return error_service.handle_api_error(e, context)

@router.post("/handle-file-upload-error")
async def handle_file_upload_error(error_message: str) -> ErrorResponse:
    """Handle file upload errors"""
    try:
        # Simulate an exception for testing
        raise Exception(error_message)
    except Exception as e:
        return error_service.handle_file_upload_error(e)

@router.post("/handle-email-verification-error")
async def handle_email_verification_error(error_message: str) -> ErrorResponse:
    """Handle email verification errors"""
    try:
        # Simulate an exception for testing
        raise Exception(error_message)
    except Exception as e:
        return error_service.handle_email_verification_error(e)

@router.post("/handle-ai-processing-error")
async def handle_ai_processing_error(error_message: str) -> ErrorResponse:
    """Handle AI processing errors"""
    try:
        # Simulate an exception for testing
        raise Exception(error_message)
    except Exception as e:
        return error_service.handle_ai_processing_error(e)
