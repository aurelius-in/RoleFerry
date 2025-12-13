"""
Service layer package for RoleFerry backend.

This module hosts shared helper functions that are used across routers,
and is importable as `app.services` (e.g. `from app.services import gate_sendability`).
"""

from typing import Dict, Any, List

from ..config import settings
from ..llm import LLMAdapter, format_calendly_line


def gate_sendability(verification_status: str | None, verification_score: float | None) -> bool:
    """
    Decide if an email should be considered sendable based on verification status/score.
    Used by /verify and demo seed logic.
    """
    if verification_status == "valid":
        return True
    if verification_status == "accept_all" and (verification_score or 0.0) >= settings.mv_threshold:
        return True
    return False


def generate_outreach_variant(mode: str, length: str, variables: Dict[str, Any]) -> Dict[str, str]:
    """
    Generate a simple outreach subject/body pair using deterministic templates.
    This is a lightweight, non-LLM helper for Week 9/10 flows.
    """
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
    """
    Generate a small set of outreach variants using the stubbed LLM adapter.
    In mock mode this does not call a paid API; it just echoes the prompt.
    """
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


__all__ = [
    "gate_sendability",
    "generate_outreach_variant",
    "generate_ghostwriter_variants",
]


