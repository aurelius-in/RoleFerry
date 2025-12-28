from __future__ import annotations

from typing import List, Dict, Any, Optional, Tuple
from time import sleep, time
import json
import hashlib

import httpx

from ..config import settings

# Very small in-process cache (good enough for dev/demo)
_CACHE: dict[str, dict[str, Any]] = {}
_CACHE_TTL_SECONDS = 60 * 30  # 30 minutes


def _ck(payload: Dict[str, Any]) -> str:
    try:
        s = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    except Exception:
        s = str(payload)
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest()


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    item = _CACHE.get(key)
    if not item:
        return None
    if (time() - float(item.get("ts", 0))) > _CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None
    return item.get("value")


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    _CACHE[key] = {"ts": time(), "value": value}


def serper_web_search(query: str, *, num: int = 6, gl: str = "us", hl: str = "en") -> List[Dict[str, Any]]:
    """
    Serper.dev Google Search API (web).

    Returns a list of { title, url, snippet }.

    Note: This function intentionally does NOT depend on OpenAI. It's pure retrieval.
    """
    q = (query or "").strip()
    if not q:
        return []

    # Gate: require key. We do not hit the network without it.
    if not settings.serper_api_key:
        sleep(0.05)
        return []

    payload = {"q": q, "num": max(1, min(int(num), 10)), "gl": gl, "hl": hl}
    key = _ck(payload)
    cached = _cache_get(key)
    if cached and isinstance(cached.get("results"), list):
        return cached["results"]

    # Allow live Serper calls even when ROLEFERRY_MOCK_MODE=true (since users can toggle data mode).
    # This is still safe because it requires an explicit SERPER_API_KEY.
    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.post(
                "https://google.serper.dev/search",
                json=payload,
                headers={"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json() or {}
    except Exception:
        return []

    out: List[Dict[str, Any]] = []
    organic = data.get("organic") or []
    if isinstance(organic, list):
        for item in organic[: max(1, min(int(num), 10))]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            url = str(item.get("link") or item.get("url") or "").strip()
            snippet = str(item.get("snippet") or item.get("description") or "").strip()
            if not url:
                continue
            out.append({"title": title[:160], "url": url, "snippet": snippet[:400]})

    _cache_set(key, {"results": out})
    return out


def search_linkedin(domain: str, role_query: str) -> List[Dict[str, Any]]:
    """
    Convenience helper: find likely LinkedIn profiles for a company domain + role keywords.

    NOTE: This is best-effort and can return empty if SERPER_API_KEY is not set.
    """
    d = (domain or "").strip()
    rq = (role_query or "").strip()
    if not d or not rq:
        return []
    q = f"site:linkedin.com/in {rq} {d}"
    return serper_web_search(q, num=5)


