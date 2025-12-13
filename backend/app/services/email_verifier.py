from typing import Dict, Any
import asyncio
import aiohttp
import hashlib
from ..config import settings
from .neverbounce_client import verify_email as nb_verify


def _deterministic_mock_verification(email: str, provider: str) -> Dict[str, Any]:
    """
    Deterministic verifier for demo mode.
    Produces stable (status, score) per email so downstream steps are consistent.
    """
    e = (email or "").strip().lower()
    digest = hashlib.sha256(f"{provider}:{e}".encode("utf-8", errors="ignore")).hexdigest()
    n = int(digest[:8], 16) % 100

    # Basic heuristics + stable randomness:
    # - obvious invalids: missing '@' or domain
    if "@" not in e or e.endswith("@") or e.endswith("."):
        return {"status": "invalid", "score": 0, "provider": provider, "raw": {"source": "deterministic_mock"}}
    # - disposable-ish: 'noreply' or 'support' skew risky
    if any(tok in e for tok in ["noreply", "no-reply", "donotreply", "support@", "info@"]):
        status = "risky" if n < 85 else "unknown"
        score = 55 if status == "risky" else 50
        return {"status": status, "score": score, "provider": provider, "raw": {"source": "deterministic_mock"}}

    # Stable distribution: ~70% valid, ~20% risky, ~10% unknown
    if n < 70:
        return {"status": "valid", "score": 85 + (n % 15), "provider": provider, "raw": {"source": "deterministic_mock"}}
    if n < 90:
        return {"status": "risky", "score": 55 + (n % 25), "provider": provider, "raw": {"source": "deterministic_mock"}}
    return {"status": "unknown", "score": 50, "provider": provider, "raw": {"source": "deterministic_mock"}}


async def verify_email_async(email: str) -> Dict[str, Any]:
    """Async email verification with NeverBounce/MillionVerifier integration."""
    
    async def neverbounce_verify(e: str) -> Dict[str, Any]:
        """NeverBounce API integration."""
        if settings.mock_mode or not settings.neverbounce_api_key:
            await asyncio.sleep(0.05)
            return _deterministic_mock_verification(e, provider="neverbounce")
        
        try:
            async with aiohttp.ClientSession() as session:
                url = "https://api.neverbounce.com/v4/single/check"
                headers = {"Content-Type": "application/json"}
                data = {
                    "key": settings.neverbounce_api_key,
                    "email": e
                }
                
                async with session.post(url, json=data, headers=headers) as response:
                    result = await response.json()
                    
                    # Map NeverBounce status to our format
                    nb_status = result.get("result", "unknown")
                    if nb_status == "valid":
                        status = "valid"
                        score = 95
                    elif nb_status == "invalid":
                        status = "invalid"
                        score = 0
                    elif nb_status == "disposable":
                        status = "risky"
                        score = 30
                    else:
                        status = "unknown"
                        score = 50
                    
                    return {
                        "status": status,
                        "score": score,
                        "provider": "neverbounce",
                        "raw": result
                    }
        except Exception as e:
            return {
                "status": "unknown",
                "score": None,
                "provider": "neverbounce",
                "error": str(e)
            }
    
    async def millionverifier_verify(e: str) -> Dict[str, Any]:
        """MillionVerifier API integration."""
        if settings.mock_mode or not settings.mv_api_key:
            await asyncio.sleep(0.05)
            return _deterministic_mock_verification(e, provider="millionverifier")
        
        try:
            async with aiohttp.ClientSession() as session:
                url = "https://api.millionverifier.com/api/v3/"
                params = {
                    "api": settings.mv_api_key,
                    "email": e
                }
                
                async with session.get(url, params=params) as response:
                    result = await response.json()
                    
                    # Map MillionVerifier status to our format
                    mv_status = result.get("result", "unknown")
                    if mv_status == "ok":
                        status = "valid"
                        score = 90
                    elif mv_status == "bad":
                        status = "invalid"
                        score = 0
                    elif mv_status == "unknown":
                        status = "unknown"
                        score = 50
                    else:
                        status = "risky"
                        score = 40
                    
                    return {
                        "status": status,
                        "score": score,
                        "provider": "millionverifier",
                        "raw": result
                    }
        except Exception as e:
            return {
                "status": "unknown",
                "score": None,
                "provider": "millionverifier",
                "error": str(e)
            }
    
    # Try preferred provider first
    preferred = settings.preferred_email_verifier
    result = None
    
    if preferred == "neverbounce":
        result = await neverbounce_verify(email)
        # Waterfall to MillionVerifier if NeverBounce returns unknown
        if result.get("status") == "unknown" and settings.mv_api_key:
            alt_result = await millionverifier_verify(email)
            if alt_result.get("status") != "unknown":
                result = alt_result
    else:
        result = await millionverifier_verify(email)
        # Waterfall to NeverBounce if MillionVerifier returns unknown
        if result.get("status") == "unknown" and settings.neverbounce_api_key:
            alt_result = await neverbounce_verify(email)
            if alt_result.get("status") != "unknown":
                result = alt_result
    
    return result


def verify(email: str) -> Dict[str, Any]:
    """Synchronous wrapper for email verification."""
    return asyncio.run(verify_email_async(email))


def get_verification_badge(status: str, score: float) -> Dict[str, Any]:
    """Get verification badge information based on status and score."""
    if status == "valid" and score >= 80:
        return {
            "label": "Valid",
            "color": "green",
            "icon": "✓"
        }
    elif status == "risky" or (status == "valid" and score < 80):
        return {
            "label": "Risky",
            "color": "yellow", 
            "icon": "⚠"
        }
    elif status == "invalid":
        return {
            "label": "Invalid",
            "color": "red",
            "icon": "✗"
        }
    else:
        return {
            "label": "Unknown",
            "color": "gray",
            "icon": "?"
        }


