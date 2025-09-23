from typing import Dict, Any, List
from .config import settings
from .llm import LLMAdapter, format_calendly_line


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
        cta = "grab a quick slot"
    elif length == "long":
        cta = "dive deeper with a brief call"
    else:
        cta = "connect for a few minutes"
    body = f"{base} If helpful, {cta}: {calendly}"
    return {"subject": subject, "body": body}


def generate_ghostwriter_variants(mode: str, length: str, variables: Dict[str, Any]) -> List[Dict[str, str]]:
    adapter = LLMAdapter()
    subject = f"Quick intro on {variables.get('RoleTitle', 'the role')} at {variables.get('Company', '')}"
    calendly_line = format_calendly_line(variables.get("CalendlyURL"))
    base_prompt = (
        f"Write a {length} {mode} in plain-spoken, relationship-first tone for {variables.get('FirstName','there')}. "
        f"Reference quantified proof if present. End with: {calendly_line}."
    )
    bodies = [
        adapter.generate(base_prompt + " Variant A"),
        adapter.generate(base_prompt + " Variant B"),
        adapter.generate(base_prompt + " Variant C"),
    ]
    return [
        {"variant": tag, "subject": subject, "body": body}
        for tag, body in zip(["A", "B", "C"], bodies)
    ]

