from typing import Dict, Any
from .config import settings


def gate_sendability(verification_status: str | None, verification_score: float | None) -> bool:
    if verification_status == "valid":
        return True
    if verification_status == "accept_all" and (verification_score or 0.0) >= settings.mv_threshold:
        return True
    return False


def generate_outreach_variant(mode: str, length: str, variables: Dict[str, Any]) -> Dict[str, str]:
    first_name = variables.get("FirstName", "there")
    role_title = variables.get("RoleTitle", "the role")
    company = variables.get("Company", "your team")
    calendly = variables.get("CalendlyURL", "")
    proof = variables.get("YourEdge", "relevant wins")
    subject = f"Quick intro on {role_title} at {company}"
    base = f"Hi {first_name}, I mapped a few ideas and how {proof} could help."
    if length == "short":
        body = f"{base} If helpful, grab time: {calendly}"
    elif length == "long":
        body = f"{base} Happy to share a one-pager and specific examples. If helpful, pick a slot: {calendly}"
    else:
        body = f"{base} Open to a quick chat? {calendly}"
    return {"subject": subject, "body": body}

