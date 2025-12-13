"""
Minimal error/validation helpers used by the demo routers.

Week 10 note:
- This module exists primarily so the backend boots reliably for demos.
- Robustness/security hardening is intentionally out of scope right now.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import re

from pydantic import BaseModel


class ValidationError(BaseModel):
    field: str
    message: str
    code: str = "invalid"


class ErrorResponse(BaseModel):
    success: bool = True
    errors: List[ValidationError] = []
    message: Optional[str] = None


class ErrorHandlingService:
    """
    Small validation service used by `routers/error_handling.py`.

    For demo purposes, validations are intentionally lightweight.
    """

    _email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    _phone_re = re.compile(r"^[0-9+()\-.\s]{7,}$")
    _url_re = re.compile(r"^https?://", re.IGNORECASE)

    def validate_email(self, email: str) -> ValidationError | None:
        email = (email or "").strip()
        if not email:
            return ValidationError(field="email", message="Email is required", code="required")
        if not self._email_re.match(email):
            return ValidationError(field="email", message="Email format is invalid")
        return None

    def validate_phone(self, phone: str) -> ValidationError | None:
        phone = (phone or "").strip()
        if not phone:
            return ValidationError(field="phone", message="Phone is required", code="required")
        if not self._phone_re.match(phone):
            return ValidationError(field="phone", message="Phone format is invalid")
        return None

    def validate_name(self, name: str, field_name: str = "name") -> ValidationError | None:
        name = (name or "").strip()
        if not name:
            return ValidationError(field=field_name, message=f"{field_name} is required", code="required")
        if len(name) < 2:
            return ValidationError(field=field_name, message=f"{field_name} is too short")
        return None

    def validate_company(self, company: str) -> ValidationError | None:
        company = (company or "").strip()
        if not company:
            return ValidationError(field="company", message="Company is required", code="required")
        return None

    def validate_url(self, url: str) -> ValidationError | None:
        url = (url or "").strip()
        if not url:
            return ValidationError(field="url", message="URL is required", code="required")
        if not self._url_re.match(url):
            return ValidationError(field="url", message="URL must start with http:// or https://")
        return None

    # ---- composite validators (used by router endpoints) --------------

    def validate_required_fields(self, data: Dict[str, Any], required_fields: List[str]) -> List[ValidationError]:
        errors: List[ValidationError] = []
        for f in required_fields or []:
            if data.get(f) in (None, "", [], {}):
                errors.append(ValidationError(field=f, message=f"{f} is required", code="required"))
        return errors

    def validate_job_preferences(self, data: Dict[str, Any]) -> List[ValidationError]:
        return self.validate_required_fields(data, ["values", "role_categories", "location_preferences"])

    def validate_resume_data(self, data: Dict[str, Any]) -> List[ValidationError]:
        # Accept minimal resume payloads in demo
        if not data:
            return [ValidationError(field="resume", message="Resume data is required", code="required")]
        return []

    def validate_job_description(self, data: Dict[str, Any]) -> List[ValidationError]:
        if not data:
            return [ValidationError(field="job_description", message="Job description is required", code="required")]
        return []

    def validate_contact_data(self, data: Dict[str, Any]) -> List[ValidationError]:
        return self.validate_required_fields(data, ["name", "title", "company"])

    def validate_email_content(self, data: Dict[str, Any]) -> List[ValidationError]:
        return self.validate_required_fields(data, ["subject", "body"])

    def validate_campaign_data(self, data: Dict[str, Any]) -> List[ValidationError]:
        return self.validate_required_fields(data, ["campaign_id", "emails", "contacts"])

    # ---- response helpers --------------------------------------------

    def handle_validation_errors(self, errors: List[ValidationError]) -> ErrorResponse:
        if errors:
            return ErrorResponse(success=False, errors=errors, message="Validation failed")
        return ErrorResponse(success=True, errors=[], message=None)

