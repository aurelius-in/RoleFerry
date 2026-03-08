"""
Signaliz API client for AI-powered company signal enrichment.

API endpoint: POST https://api.signaliz.com/functions/v1/company-signal-enrichment
Auth: Bearer token in Authorization header

Response structure:
- signals: list of { id, metadata: { source_type, has_specific_date }, signal_type, confidence_score }
- summary: { executive_summary, key_themes, overall_relevance_score, outreach_summary, signal_relevance }
- summary.outreach_summary: { one_liner_hook, strongest_signal, recommended_angle, conversation_starters }
- summary.signal_relevance: list of { signal_index, relevance_score, relevance_reason }
"""
import logging
from typing import Any, Dict, List, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

SIGNALIZ_BASE = "https://api.signaliz.com/functions/v1"

_SIGNAL_TYPE_LABELS = {
    "technology": "Technology",
    "product_launch": "Product Launch",
    "partnership": "Partnership",
    "leadership_change": "Leadership Change",
    "funding": "Funding",
    "expansion": "Expansion",
    "hiring_signal": "Hiring",
    "news": "News",
    "workforce": "Workforce",
    "intent": "Intent",
    "firmographics": "Firmographics",
}


def signaliz_enabled() -> bool:
    return bool(settings.signaliz_api_key)


def enrich_company_signals(
    company_name: str,
    *,
    research_prompt: str = "",
    domain: str = "",
    signal_types: Optional[List[str]] = None,
    target_signal_count: int = 6,
    lookback_days: int = 180,
    timeout: float = 60.0,
) -> Dict[str, Any]:
    """
    Call Signaliz Company Signal Enrichment API and normalise the response
    into a shape compatible with our CompanyIntelligence model.
    """
    if not settings.signaliz_api_key:
        return {}

    body: Dict[str, Any] = {
        "company_name": company_name,
        "research_prompt": research_prompt or (
            f"Find recent signals about {company_name} including product launches, "
            "leadership changes, hiring activity, funding events, and partnerships."
        ),
        "target_signal_count": target_signal_count,
        "lookback_days": lookback_days,
    }
    if domain:
        body["domain"] = domain
    if signal_types:
        body["signal_types"] = signal_types

    headers = {
        "Authorization": f"Bearer {settings.signaliz_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        with httpx.Client(timeout=timeout, headers=headers) as client:
            r = client.post(f"{SIGNALIZ_BASE}/company-signal-enrichment", json=body)
            if r.status_code != 200:
                logger.warning("Signaliz API returned %s: %s", r.status_code, r.text[:500])
                return {}
            raw = r.json()
            if not isinstance(raw, dict):
                return {}

            normalised = _normalise_response(raw, company_name)
            logger.info(
                "Signaliz enrichment for %s: %d signals, relevance=%.2f",
                company_name,
                len(normalised.get("signals") or []),
                float(normalised.get("overall_relevance_score") or 0),
            )
            return normalised
    except Exception as e:
        logger.warning("Signaliz API call failed for %s: %s", company_name, e)
        return {}


def _normalise_response(raw: Dict[str, Any], company_name: str) -> Dict[str, Any]:
    """
    Transform Signaliz raw API response into our standard CompanyIntelligence shape:
    {
      signals: [{ signal_type, source_type, signal_title, signal_source, signal_content, signal_date, confidence_score }],
      outreach_summary: { one_liner_hook, strongest_signal, recommended_angle, conversation_starters, signal_relevance },
      executive_summary: str,
      overall_relevance_score: float,
    }
    """
    summary = raw.get("summary") or {}
    raw_signals = raw.get("signals") or []
    signal_relevance = summary.get("signal_relevance") or []
    key_themes = summary.get("key_themes") or []

    relevance_map: Dict[int, Dict[str, Any]] = {}
    for sr in signal_relevance:
        if isinstance(sr, dict):
            idx = sr.get("signal_index")
            if idx is not None:
                relevance_map[int(idx)] = sr

    normalised_signals: List[Dict[str, Any]] = []
    for i, sig in enumerate(raw_signals):
        if isinstance(sig, str):
            sig_type = sig.strip().lower()
        elif isinstance(sig, dict):
            sig_type = str(sig.get("signal_type") or "news").strip().lower()
        else:
            continue

        source_type = "ai_enrichment"
        confidence = 0.5
        sig_id = ""
        if isinstance(sig, dict):
            meta = sig.get("metadata") or {}
            if isinstance(meta, dict):
                source_type = str(meta.get("source_type") or "ai_enrichment")
            confidence = float(sig.get("confidence_score") or 0.5)
            sig_id = str(sig.get("id") or "")

        rel = relevance_map.get(i, {})
        relevance_reason = str(rel.get("relevance_reason") or "").strip()
        relevance_score = float(rel.get("relevance_score") or confidence)

        label = _SIGNAL_TYPE_LABELS.get(sig_type, sig_type.replace("_", " ").title())
        title = f"{label}: {company_name}"
        if relevance_reason:
            first_sentence = relevance_reason.split(". ")[0].strip()
            if len(first_sentence) > 20:
                title = first_sentence[:120]

        normalised_signals.append({
            "signal_type": sig_type,
            "source_type": source_type,
            "signal_title": title,
            "signal_source": f"signaliz::{sig_id}" if sig_id else "signaliz",
            "signal_content": relevance_reason or f"{label} signal detected for {company_name}.",
            "signal_date": "",
            "confidence_score": max(confidence, relevance_score),
        })

    if not normalised_signals and signal_relevance:
        for sr in signal_relevance:
            if not isinstance(sr, dict):
                continue
            reason = str(sr.get("relevance_reason") or "").strip()
            if not reason:
                continue
            score = float(sr.get("relevance_score") or 0.7)
            first_sentence = reason.split(". ")[0].strip()
            normalised_signals.append({
                "signal_type": "news",
                "source_type": "ai_enrichment",
                "signal_title": first_sentence[:120] if len(first_sentence) > 20 else f"Signal for {company_name}",
                "signal_source": "signaliz",
                "signal_content": reason,
                "signal_date": "",
                "confidence_score": min(1.0, score),
            })

    outreach_raw = summary.get("outreach_summary") or {}
    outreach_summary = {
        "one_liner_hook": str(outreach_raw.get("one_liner_hook") or "").strip(),
        "strongest_signal": str(outreach_raw.get("strongest_signal") or "").strip(),
        "recommended_angle": str(outreach_raw.get("recommended_angle") or "").strip(),
        "conversation_starters": [
            str(cs).strip() for cs in (outreach_raw.get("conversation_starters") or []) if str(cs).strip()
        ],
        "signal_relevance": str(outreach_raw.get("signal_relevance") or "").strip() if isinstance(outreach_raw.get("signal_relevance"), str) else "",
    }

    return {
        "signals": normalised_signals,
        "outreach_summary": outreach_summary if any(outreach_summary.values()) else None,
        "executive_summary": str(summary.get("executive_summary") or "").strip(),
        "overall_relevance_score": float(summary.get("overall_relevance_score") or 0),
        "key_themes": key_themes,
        "_signaliz_raw_summary": summary,
    }
