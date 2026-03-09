from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import re
import time
import hashlib
import os
import httpx
from urllib.parse import quote as _urlquote, urlparse
import xml.etree.ElementTree as ET

router = APIRouter()
from ..clients.openai_client import get_openai_client, extract_json_from_text
from ..clients.signaliz import signaliz_enabled, enrich_company_signals
from ..config import settings
from ..services.serper_client import serper_web_search
from ..services.pdl_client import PDLClient
import logging

logger = logging.getLogger(__name__)

# Bump this when changing prompting/logic so cached results don't mask improvements.
_PROMPT_VERSION = "2026-02-16-research-provider-normalization-v6"


def _safe_str_list(val: Any) -> List[str]:
    """Safely coerce a value to a list of strings. If the LLM returns a bare
    string instead of a list, wrap it rather than iterating per-character."""
    if val is None:
        return []
    if isinstance(val, str):
        v = val.strip()
        return [v] if v and v.lower() != "unknown" else []
    if isinstance(val, list):
        return [str(x) for x in val if x is not None and str(x).strip()]
    return []


def _strip_likely_language(s: str) -> str:
    t = str(s or "")
    t = re.sub(r"\blikely\b", "", t, flags=re.I)
    t = re.sub(r"\bprobably\b", "", t, flags=re.I)
    t = re.sub(r"\bmight\b", "can", t, flags=re.I)
    t = re.sub(r"\bmay be\b", "is", t, flags=re.I)
    t = re.sub(r"\bappears to\b", "", t, flags=re.I)
    t = re.sub(r"\bseems to\b", "", t, flags=re.I)
    t = re.sub(r"\bit is believed\b", "", t, flags=re.I)
    t = re.sub(r"\bpossibly\b", "", t, flags=re.I)
    t = re.sub(r"\bpotentially\b", "", t, flags=re.I)
    t = re.sub(r"\bpresumably\b", "", t, flags=re.I)
    t = re.sub(r"\bsuggest(?:s|ing)?\s+that\b", "", t, flags=re.I)
    _placeholder_patterns = [
        r"(?i)no\s+\w+\s+(?:details?|data|info(?:rmation)?)\s*(?:captured|found|available|collected).*",
        r"(?i)try\s+(?:running\s+in\s+)?live\s+mode.*",
        r"(?i)serper\s+(?:configured|not\s+configured|required).*",
        r"(?i)no\s+external\s+web\s+sources.*",
        r"(?i)no\s+product\s+launch.*(?:captured|found|available).*",
        r"(?i)no\s+leadership\s+change.*(?:captured|found|available).*",
        r"(?i)no\s+hiring\s+signal.*(?:captured|found|available).*",
        r"(?i)no\s+recent\s+post.*(?:captured|found|available).*",
    ]
    for pat in _placeholder_patterns:
        t = re.sub(pat, "", t)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r":\s*\n", ":\n", t)
    return t.strip()

# PDL runs whenever PDL_API_KEY is present. No separate gate needed.
_ENABLE_PDL = True


def _build_company_signals_from_pdl(pdl: Dict[str, Any]) -> List[Dict[str, str]]:
    """Extract up to 9 structured company signals from the raw PDL company enrich response."""
    if not pdl:
        return []
    signals: List[Dict[str, str]] = []

    industry = pdl.get("industry")
    if industry:
        signals.append({"label": "Industry", "value": str(industry).title(), "category": "industry"})

    size = pdl.get("size")
    if size:
        signals.append({"label": "Company Size", "value": f"{size} employees", "category": "size"})

    ec = pdl.get("employee_count")
    if isinstance(ec, int) and ec > 0:
        signals.append({"label": "Employee Count", "value": f"{ec:,}", "category": "headcount"})

    growth = pdl.get("employee_growth_rate")
    if isinstance(growth, dict):
        g12 = growth.get("12_month")
        if isinstance(g12, (int, float)):
            pct = round(g12 * 100, 1)
            direction = "growing" if pct > 0 else "shrinking"
            signals.append({"label": "12-Month Growth", "value": f"{pct:+.1f}% ({direction})", "category": "growth"})

    funding = pdl.get("total_funding_raised")
    if isinstance(funding, (int, float)) and funding > 0:
        if funding >= 1_000_000_000:
            fmt = f"${funding / 1_000_000_000:.1f}B"
        elif funding >= 1_000_000:
            fmt = f"${funding / 1_000_000:.0f}M"
        else:
            fmt = f"${funding:,.0f}"
        signals.append({"label": "Total Funding Raised", "value": fmt, "category": "funding"})

    revenue = pdl.get("inferred_revenue")
    if revenue:
        signals.append({"label": "Estimated Revenue", "value": str(revenue), "category": "revenue"})

    founded = pdl.get("founded")
    if isinstance(founded, int) and founded > 1800:
        signals.append({"label": "Founded", "value": str(founded), "category": "founded"})

    co_type = pdl.get("type")
    if co_type:
        signals.append({"label": "Company Type", "value": str(co_type).title(), "category": "type"})

    hq = pdl.get("location")
    if isinstance(hq, dict):
        hq_name = hq.get("name") or hq.get("locality")
        if hq_name:
            signals.append({"label": "Headquarters", "value": str(hq_name).title(), "category": "hq"})

    return signals[:9]


def _build_unified_company_signals(
    pdl_company: Dict[str, Any],
    signaliz_data: Dict[str, Any],
    intelligence: Optional["CompanyIntelligence"] = None,
    company_summary: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    """Merge company signals from PDL, Signaliz, and web research into one
    deduplicated best-of-9 list.  Prioritises live signals (Signaliz > PDL >
    web-derived) and avoids redundant categories."""
    seen_categories: set[str] = set()
    unified: List[Dict[str, str]] = []

    def _add(label: str, value: str, category: str, priority: int = 50):
        if category in seen_categories:
            return
        val = str(value or "").strip()
        if not val or len(val) < 3 or val.lower() in ("unknown", "none", "n/a"):
            return
        seen_categories.add(category)
        unified.append({"label": label, "value": val[:280], "category": category, "_prio": str(priority)})

    # Signaliz signals (highest priority -- real-time intelligence)
    if intelligence and hasattr(intelligence, "signals"):
        for sig in (intelligence.signals or [])[:6]:
            content = str(getattr(sig, "signal_content", "") or "").strip()
            title = str(getattr(sig, "signal_title", "") or "").strip()
            stype = str(getattr(sig, "signal_type", "") or "").strip()
            text = title if title else content
            if not text or len(text) < 10:
                continue
            cat = f"signaliz_{stype}" if stype else f"signaliz_{len(unified)}"
            _add(stype.replace("_", " ").title() if stype else "Signal", text, cat, 100)

    # PDL company data (structured facts)
    for sig in _build_company_signals_from_pdl(pdl_company):
        _add(sig["label"], sig["value"], sig["category"], 80)

    # Company summary fallback (from LLM / web research)
    cs = company_summary or {}
    if cs.get("industry") and "industry" not in seen_categories:
        _add("Industry", str(cs["industry"]), "industry", 40)
    if cs.get("size") and "size" not in seen_categories:
        _add("Company Size", str(cs["size"]), "size", 40)
    if cs.get("founded") and "founded" not in seen_categories:
        _add("Founded", str(cs["founded"]), "founded", 40)
    if cs.get("headquarters") and "hq" not in seen_categories:
        _add("Headquarters", str(cs["headquarters"]), "hq", 40)

    unified.sort(key=lambda s: int(s.get("_prio", "50")), reverse=True)
    for s in unified:
        s.pop("_prio", None)
    return unified[:9]


class SelectedContact(BaseModel):
    id: str
    name: str
    title: str
    email: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    linkedin_url: Optional[str] = None
    # Optional PDL-derived fields (outreach-safe)
    email_source: Optional[str] = None
    location_name: Optional[str] = None
    location_country: Optional[str] = None
    job_company_website: Optional[str] = None
    job_company_linkedin_url: Optional[str] = None
    job_company_industry: Optional[str] = None
    job_company_size: Optional[str] = None

class CompanySummary(BaseModel):
    name: str
    description: str
    industry: str
    size: str
    founded: str
    headquarters: str
    website: str
    linkedin_url: Optional[str] = None

class ContactBio(BaseModel):
    name: str
    title: str
    company: str
    bio: str
    experience: str
    education: str
    skills: List[str]
    linkedin_url: Optional[str] = None
    # Optional public-profile enrichment (best-effort, should not hallucinate; empty if no sources).
    public_profile_highlights: List[str] = []
    publications: List[str] = []
    post_topics: List[str] = []
    opinions: List[str] = []
    other_interesting_facts: List[str] = []
    interesting_facts: List[Dict[str, str]] = []
    outreach_angles: List[str] = []
    urgency_score: int = 0
    urgency_reason: str = ""

class RecentNews(BaseModel):
    title: str
    summary: str
    date: str
    source: str
    url: str


class StructuredSignal(BaseModel):
    signal_type: str = ""
    source_type: str = "ai_enrichment"
    signal_title: str = ""
    signal_source: str = ""
    signal_content: str = ""
    signal_date: str = ""
    confidence_score: float = 0.0
    metadata: Dict[str, Any] = {}


class SequenceStep(BaseModel):
    email_number: int = 1
    angle: str = ""
    subject_line: str = ""
    key_point: str = ""

class OutreachSummary(BaseModel):
    one_liner_hook: str = ""
    strongest_signal: str = ""
    recommended_angle: str = ""
    conversation_starters: List[str] = []
    signal_relevance: List[str] = []
    sequence_strategy: List[SequenceStep] = []


class CompanyIntelligence(BaseModel):
    signals: List[StructuredSignal] = []
    outreach_summary: Optional[OutreachSummary] = None
    executive_summary: str = ""
    overall_relevance_score: float = 0.0


class CompanySignal(BaseModel):
    label: str
    value: str
    category: str

class ResearchData(BaseModel):
    company_summary: CompanySummary
    contact_bios: List[ContactBio]
    theme: str = ""
    company_culture_values: str = ""
    company_market_position: str = ""
    company_product_launches: str = ""
    company_leadership_changes: str = ""
    company_other_hiring_signals: str = ""
    company_recent_posts: str = ""
    company_publications: str = ""
    recent_news: List[RecentNews]
    shared_connections: List[str]
    background_report_title: Optional[str] = None
    background_report_sections: Optional[List[Dict[str, Any]]] = None
    intelligence: Optional[CompanyIntelligence] = None
    company_signals: Optional[List[CompanySignal]] = None

class ResearchRequest(BaseModel):
    contact_ids: List[str]
    company_name: str
    # Optional: pass selected job context so we can research the right org unit for large companies.
    selected_job_description: Optional[Dict[str, Any]] = None
    # Optional: upstream context so the background report can be grounded in the candidate + role.
    resume_extract: Optional[Dict[str, Any]] = None
    painpoint_matches: Optional[List[Dict[str, Any]]] = None
    # Optional: pass full contact objects so we can generate per-contact research/bios.
    contacts: Optional[List[SelectedContact]] = None
    # Optional: UI data mode ("demo" | "live"). If "live" and keys exist, we will fetch real web/company signals.
    data_mode: Optional[str] = None

class ResearchResponse(BaseModel):
    success: bool
    message: str
    research_data: Optional[ResearchData] = None
    # Per-contact research keyed by contact id. Lets the UI switch between contacts without re-calling.
    research_by_contact: Optional[Dict[str, ResearchData]] = None
    helper: Optional[Dict[str, Any]] = None

# Simple in-process TTL cache (good enough for demo/dev; resets on restart).
_CTX_CACHE: Dict[str, Dict[str, Any]] = {}
_CTX_CACHE_TTL_SECONDS = 60 * 30  # 30 minutes


def _strip_html(s: str) -> str:
    try:
        import html as _html_mod
        t = re.sub(r"<[^>]+>", " ", str(s or ""))
        t = _html_mod.unescape(t)
        t = re.sub(r"\s+", " ", t).strip()
        return t
    except Exception:
        return str(s or "").strip()


def _google_news_rss_hits(query: str, *, num: int = 6) -> List[Dict[str, Any]]:
    """
    Free, keyless "web search" fallback using Google News RSS.
    Returns Serper-like hit dicts: { title, link, snippet }.
    """
    q = str(query or "").strip()
    if not q:
        return []
    # Keep requests small + resilient; this runs in live mode when SERPER isn't configured.
    url = (
        "https://news.google.com/rss/search?q="
        + _urlquote(q)
        + "&hl=en-US&gl=US&ceid=US:en"
    )
    headers = {"User-Agent": "Mozilla/5.0 (RoleFerry; +https://roleferry.com)"}
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
            r = client.get(url)
            if r.status_code != 200:
                return []
            xml = r.text or ""
    except Exception:
        return []

    try:
        root = ET.fromstring(xml)
    except Exception:
        return []

    hits: List[Dict[str, Any]] = []
    for item in root.findall(".//item")[: max(1, int(num)) * 2]:
        try:
            title = _strip_html(item.findtext("title") or "")
            link = str(item.findtext("link") or "").strip()
            desc = _strip_html(item.findtext("description") or "")
            snippet = desc or ""
            if not link:
                continue
            hits.append({"title": title, "link": link, "snippet": snippet})
            if len(hits) >= max(1, int(num)):
                break
        except Exception:
            continue
    return hits


def _extract_ddg_url(raw_href: str) -> str:
    """Extract the real destination URL from a DuckDuckGo redirect link."""
    from urllib.parse import unquote, urlparse, parse_qs
    raw = str(raw_href or "").strip()
    if "uddg=" in raw:
        try:
            parsed = urlparse(raw if raw.startswith("http") else ("https:" + raw))
            qs = parse_qs(parsed.query)
            uddg = qs.get("uddg", [""])[0]
            if uddg:
                return unquote(uddg)
        except Exception:
            pass
    if raw.startswith("//"):
        return "https:" + raw
    return raw


def _duckduckgo_search(query: str, *, num: int = 8) -> List[Dict[str, Any]]:
    """Free keyless web search via DuckDuckGo HTML. Returns Serper-like hit dicts."""
    q = str(query or "").strip()
    if not q:
        return []
    try:
        url = f"https://html.duckduckgo.com/html/?q={_urlquote(q)}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
            r = client.get(url)
            if r.status_code != 200:
                return []
            html = r.text or ""
    except Exception:
        return []

    hits: List[Dict[str, Any]] = []
    try:
        for m in re.finditer(
            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
            r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
            html, re.DOTALL,
        ):
            raw_href = str(m.group(1) or "").strip()
            link = _extract_ddg_url(raw_href)
            title = _strip_html(m.group(2) or "")
            snippet = _strip_html(m.group(3) or "")
            if not link or "duckduckgo.com" in link:
                continue
            hits.append({"title": title[:200], "link": link, "url": link, "snippet": snippet[:400]})
            if len(hits) >= num:
                break
    except Exception:
        pass
    return hits


def _free_web_search(query: str, *, num: int = 6) -> List[Dict[str, Any]]:
    """Best-effort free web search: tries DuckDuckGo first, then Google News RSS."""
    hits = _duckduckgo_search(query, num=num)
    if hits:
        return hits
    return _google_news_rss_hits(query, num=num)


def _scrape_newsroom(domain: str, *, max_items: int = 6) -> List[Dict[str, Any]]:
    """
    Try common newsroom/press paths on a company domain and extract press release links.
    Returns Serper-like hit dicts with title, link, snippet.
    """
    if not domain:
        return []
    domain = domain.strip().lower().replace("www.", "")

    paths = [
        f"https://newsroom.{domain}/",
        f"https://newsroom.{domain}/press-releases",
        f"https://news.{domain}/",
        f"https://{domain}/newsroom",
        f"https://{domain}/press",
        f"https://{domain}/press-releases",
        f"https://{domain}/news",
        f"https://{domain}/blog/press",
    ]

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    hits: List[Dict[str, Any]] = []

    for base_url in paths[:5]:
        try:
            with httpx.Client(timeout=8.0, follow_redirects=True, headers=headers) as client:
                r = client.get(base_url)
                if r.status_code != 200:
                    continue
                html = r.text or ""
                if len(html) < 500:
                    continue
                seen_urls: set[str] = set()
                for m in re.finditer(
                    r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                    html, re.DOTALL | re.IGNORECASE,
                ):
                    href = str(m.group(1) or "").strip()
                    title = _strip_html(m.group(2) or "").strip()
                    if not title or len(title) < 15 or len(title) > 250:
                        continue
                    href_lower = href.lower()
                    if any(skip in href_lower for skip in ["#", "javascript:", "mailto:", "tel:", ".pdf", ".jpg", ".png"]):
                        continue
                    if not any(kw in href_lower for kw in [
                        "press", "release", "announcement", "news", "blog", "article", "update", "launch",
                    ]):
                        continue
                    if href.startswith("/"):
                        parsed = urlparse(base_url)
                        href = f"{parsed.scheme}://{parsed.netloc}{href}"
                    elif not href.startswith("http"):
                        continue
                    if href.lower() in seen_urls:
                        continue
                    seen_urls.add(href.lower())
                    hits.append({
                        "title": title[:200],
                        "link": href,
                        "url": href,
                        "snippet": f"From {domain} newsroom",
                        "source": "newsroom",
                    })
                    if len(hits) >= max_items:
                        return hits
                if hits:
                    return hits
        except Exception:
            continue
    return hits


def _classify_signal_type(url: str, title: str, snippet: str) -> str:
    """Classify a search hit into a signal type for structured display."""
    text = (url + " " + title + " " + snippet).lower()
    if any(w in text for w in ["linkedin.com/in", "linkedin.com/posts", "linkedin post"]):
        return "web_activity"
    if any(w in text for w in ["podcast", "interview", "conference", "talk", "speaker", "keynote", "webinar"]):
        return "web_activity"
    if any(w in text for w in ["hired", "promoted", "appointed", "joins", "joined", "new role", "named as"]):
        return "career_move"
    if any(w in text for w in ["funding", "raised", "acquisition", "acquired", "ipo", "series "]):
        return "company_news"
    if any(w in text for w in ["hiring", "job", "open role", "we're hiring", "careers"]):
        return "hiring_signal"
    if any(w in text for w in ["article", "blog", "post", "wrote", "published", "whitepaper", "report"]):
        return "web_activity"
    return "web_activity"


def _contact_facts_from_hits(hits: Any, *, max_items: int = 6) -> List[Dict[str, str]]:
    """
    Deterministically derive outreach-safe 'interesting_facts' from search hits.
    Prioritizes high-signal hits (posts, career moves, talks) over generic pages.
    """
    out: List[Dict[str, str]] = []
    seen_urls: set[str] = set()
    seen_facts: set[str] = set()

    priority_buckets: Dict[str, List[Dict[str, Any]]] = {
        "high": [], "medium": [], "low": [],
    }
    try:
        for h in (hits or [])[:40]:
            if not isinstance(h, dict):
                continue
            title = str(h.get("title") or "").strip()
            url = str(h.get("link") or h.get("url") or "").strip()
            snippet = str(h.get("snippet") or "").strip()
            if not url:
                continue
            text_lower = (url + " " + title + " " + snippet).lower()
            is_high = any(w in text_lower for w in [
                "linkedin.com/posts", "podcast", "interview", "conference", "speaker",
                "hired", "promoted", "appointed", "joins", "joined", "article", "blog",
                "published", "whitepaper", "wrote", "keynote", "talk",
            ])
            is_medium = any(w in text_lower for w in [
                "linkedin.com/in", "funding", "raised", "hiring", "announcement",
            ])
            bucket = "high" if is_high else ("medium" if is_medium else "low")
            priority_buckets[bucket].append(h)
    except Exception:
        return []

    for bucket_name in ["high", "medium", "low"]:
        for h in priority_buckets[bucket_name]:
            title = str(h.get("title") or "").strip()
            url = str(h.get("link") or h.get("url") or "").strip()
            snippet = str(h.get("snippet") or "").strip()
            fact = " ".join((snippet or title).split()).strip()
            if not fact:
                continue
            fact = fact[:160].rstrip()
            url_key = url.lower().rstrip("/")
            fact_key = fact.lower()[:80]
            if url_key in seen_urls or fact_key in seen_facts:
                continue
            seen_urls.add(url_key)
            seen_facts.add(fact_key)
            signal_type = _classify_signal_type(url, title, snippet)
            out.append({
                "fact": fact,
                "source_title": title[:160],
                "source_url": url,
                "signal_type": signal_type,
            })
            if len(out) >= max(1, int(max_items)):
                return out
    return out


def _best_linkedin_from_hits(hits: Any) -> str:
    try:
        for h in (hits or [])[: 40]:
            if not isinstance(h, dict):
                continue
            url = str(h.get("link") or h.get("url") or "").strip()
            if "linkedin.com/in/" in url:
                return url
    except Exception:
        return ""
    return ""


def _domain_from_url(u: str) -> str:
    try:
        host = (urlparse(str(u or "")).hostname or "").strip().lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def _is_company_relevant_hit(company_name: str, hit: Dict[str, Any], *, company_domain: str = "") -> bool:
    """
    Keep only business/news hits that appear to reference the target company.
    This helps avoid ambiguous-name noise (e.g., NASA Galileo mission).
    """
    if not isinstance(hit, dict):
        return False
    title = str((hit or {}).get("title") or "").strip()
    snippet = str((hit or {}).get("snippet") or "").strip()
    link = str((hit or {}).get("link") or (hit or {}).get("url") or "").strip()
    if not (title and link):
        return False

    text = f"{title} {snippet} {link}".lower()
    domain = _domain_from_url(link)
    target_domain = _domain_from_url(company_domain)
    if target_domain and (domain == target_domain or domain.endswith("." + target_domain)):
        return True

    company = str(company_name or "").strip().lower()
    company_tokens = [t for t in re.findall(r"[a-z0-9]{3,}", company) if t not in {"inc", "llc", "ltd", "co", "corp", "the"}]
    token_hits = sum(1 for t in company_tokens if t in text)
    if token_hits == 0:
        return False

    # Hard negatives for common ambiguous-name collisions.
    space_noise = {
        "nasa", "spacecraft", "astronomy", "europa", "jupiter", "saturn",
        "orbiter", "planetary", "mission", "hubble", "rover", "cosmos",
    }
    if any(n in text for n in space_noise):
        business_counter_signals = {
            "company", "ceo", "cto", "cfo", "press release", "funding", "acquisition",
            "partnership", "product", "launch", "customers", "revenue", "hiring",
            "career", "fintech", "banking", "payment", "debit", "credit",
            "prnewswire", "businesswire", "techcrunch", "forbes", "bloomberg",
        }
        if not any(b in text for b in business_counter_signals):
            return False

    # For one-word company names, require business context unless domain match already passed.
    if len(company_tokens) <= 1:
        business_terms = {
            "company", "business", "ceo", "press release", "funding", "acquisition",
            "partnership", "product", "platform", "customers", "hiring",
            "fintech", "banking", "payment", "debit", "credit", "startup",
        }
        if not any(b in text for b in business_terms):
            return False

    return True

def _cache_key(payload: Dict[str, Any]) -> str:
    try:
        s = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    except Exception:
        s = str(payload)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    item = _CTX_CACHE.get(key)
    if not item:
        return None
    if (time.time() - float(item.get("ts", 0))) > _CTX_CACHE_TTL_SECONDS:
        _CTX_CACHE.pop(key, None)
        return None
    return item.get("value")

def _cache_set(key: str, value: Dict[str, Any]) -> None:
    _CTX_CACHE[key] = {"ts": time.time(), "value": value}


def _bullets_from_serper_hits(hits: Any, *, max_items: int = 6, label: str | None = None) -> str:
    """
    Convert Serper hits into outreach-safe bullets with real URLs.
    """
    out: List[str] = []
    try:
        for h in (hits or [])[: max(0, int(max_items))]:
            if not isinstance(h, dict):
                continue
            title = str(h.get("title") or "").strip()
            url = str(h.get("link") or h.get("url") or "").strip()
            snippet = str(h.get("snippet") or "").strip()
            if not url:
                continue
            if not title and not snippet:
                continue
            bit = title or snippet[:140]
            if snippet and title and snippet.lower() not in title.lower():
                bit = f"{title} — {snippet[:180]}"
            # Keep it short; always include source URL.
            out.append(f"- {bit} ({url})")
    except Exception:
        out = []

    if not out:
        return ""
    if label:
        return f"{label}:\n" + "\n".join(out)
    return "\n".join(out)

_VALID_SIGNAL_TYPES = {
    "leadership_change", "product_launch", "hiring_signal", "funding_event",
    "partnership", "market_expansion", "regulatory", "technology_adoption",
    "earnings", "restructuring",
    "technology", "expansion", "news", "workforce", "intent", "firmographics", "funding",
}


def _build_stub_intelligence(corpus: Dict, scope_target: str, company_serper_by_topic: Dict) -> Dict[str, Any]:
    """Build a basic intelligence block from web search hits (no LLM needed)."""
    signals: List[Dict[str, Any]] = []
    try:
        type_map = {
            "product_launches": "product_launch",
            "leadership": "leadership_change",
            "signals": "hiring_signal",
            "news": "hiring_signal",
            "publications": "product_launch",
            "market": "market_expansion",
            "culture": "hiring_signal",
            "overview": "market_expansion",
            "posts": "technology_adoption",
        }
        for topic_key, hits in (company_serper_by_topic.items() if isinstance(company_serper_by_topic, dict) else []):
            sig_type = type_map.get(str(topic_key), "hiring_signal")
            for h in (hits or [])[:3]:
                if not isinstance(h, dict):
                    continue
                title = _strip_html(str(h.get("title") or ""))
                snippet = _strip_html(str(h.get("snippet") or ""))
                url = str(h.get("link") or h.get("url") or "").strip()
                if not title and not snippet:
                    continue
                signals.append({
                    "signal_type": sig_type,
                    "source_type": "web_source" if url else "ai_enrichment",
                    "signal_title": title[:200],
                    "signal_source": url,
                    "signal_content": snippet[:500],
                    "signal_date": "",
                    "confidence_score": 0.6 if url else 0.3,
                    "metadata": {},
                })
                if len(signals) >= 8:
                    break
            if len(signals) >= 8:
                break
    except Exception:
        pass
    return {
        "signals": signals[:8],
        "outreach_summary": {
            "one_liner_hook": f"{scope_target} is showing activity worth monitoring for outreach timing.",
            "strongest_signal": signals[0]["signal_title"] if signals else "",
            "recommended_angle": f"Reference a recent development at {scope_target} and connect it to your expertise.",
            "conversation_starters": [],
            "signal_relevance": [],
        } if signals else None,
        "executive_summary": "",
        "overall_relevance_score": min(1.0, len(signals) * 0.15) if signals else 0.0,
    }


def _parse_intelligence(raw: Any) -> Optional[CompanyIntelligence]:
    """Parse the intelligence block from LLM output into a CompanyIntelligence model."""
    if not raw or not isinstance(raw, dict):
        return None
    try:
        signals_raw = raw.get("signals") or []
        if not isinstance(signals_raw, list):
            signals_raw = []
        signals = []
        for s in signals_raw[:12]:
            if not isinstance(s, dict):
                continue
            st = str(s.get("signal_type") or "").strip().lower()
            if st not in _VALID_SIGNAL_TYPES:
                st = "hiring_signal"
            sig = StructuredSignal(
                signal_type=st,
                source_type=str(s.get("source_type") or "ai_enrichment").strip(),
                signal_title=str(s.get("signal_title") or "").strip()[:200],
                signal_source=str(s.get("signal_source") or "").strip(),
                signal_content=str(s.get("signal_content") or "").strip()[:800],
                signal_date=str(s.get("signal_date") or "").strip(),
                confidence_score=min(1.0, max(0.0, float(s.get("confidence_score") or 0.0))),
                metadata=s.get("metadata") if isinstance(s.get("metadata"), dict) else {},
            )
            if sig.signal_title or sig.signal_content:
                signals.append(sig)

        os_raw = raw.get("outreach_summary") or {}
        if not isinstance(os_raw, dict):
            os_raw = {}
        seq_raw = os_raw.get("sequence_strategy") or []
        seq_steps: List[SequenceStep] = []
        if isinstance(seq_raw, list):
            for step in seq_raw[:4]:
                if isinstance(step, dict):
                    seq_steps.append(SequenceStep(
                        email_number=int(step.get("email_number") or len(seq_steps) + 1),
                        angle=str(step.get("angle") or "").strip()[:120],
                        subject_line=str(step.get("subject_line") or "").strip()[:200],
                        key_point=str(step.get("key_point") or "").strip()[:300],
                    ))
        outreach_summary = OutreachSummary(
            one_liner_hook=str(os_raw.get("one_liner_hook") or "").strip()[:300],
            strongest_signal=str(os_raw.get("strongest_signal") or "").strip()[:500],
            recommended_angle=str(os_raw.get("recommended_angle") or "").strip()[:500],
            conversation_starters=_safe_str_list(os_raw.get("conversation_starters"))[:5],
            signal_relevance=_safe_str_list(os_raw.get("signal_relevance"))[:3],
            sequence_strategy=seq_steps,
        ) if (os_raw.get("one_liner_hook") or os_raw.get("strongest_signal")) else None

        return CompanyIntelligence(
            signals=signals,
            outreach_summary=outreach_summary,
            executive_summary=str(raw.get("executive_summary") or "").strip()[:1500],
            overall_relevance_score=min(1.0, max(0.0, float(raw.get("overall_relevance_score") or 0.0))),
        )
    except Exception:
        return None


def _merge_intelligence(
    llm_intel: Optional[CompanyIntelligence],
    signaliz_data: Dict[str, Any],
) -> Optional[CompanyIntelligence]:
    """Merge Signaliz API signals with LLM-generated intelligence. Signaliz takes priority."""
    signaliz_signals = signaliz_data.get("signals") if isinstance(signaliz_data, dict) else None
    if not signaliz_signals and llm_intel:
        return llm_intel
    if not signaliz_signals and not llm_intel:
        return None

    parsed_signaliz = _parse_intelligence(signaliz_data) if signaliz_data else None

    if parsed_signaliz and not llm_intel:
        return parsed_signaliz
    if not parsed_signaliz and llm_intel:
        return llm_intel

    if parsed_signaliz and llm_intel:
        seen_titles = {s.signal_title.lower()[:60] for s in parsed_signaliz.signals}
        for s in llm_intel.signals:
            if s.signal_title.lower()[:60] not in seen_titles:
                parsed_signaliz.signals.append(s)
                seen_titles.add(s.signal_title.lower()[:60])
        parsed_signaliz.signals = parsed_signaliz.signals[:12]
        if not parsed_signaliz.outreach_summary and llm_intel.outreach_summary:
            parsed_signaliz.outreach_summary = llm_intel.outreach_summary
        if not parsed_signaliz.executive_summary and llm_intel.executive_summary:
            parsed_signaliz.executive_summary = llm_intel.executive_summary
        if parsed_signaliz.overall_relevance_score < llm_intel.overall_relevance_score:
            parsed_signaliz.overall_relevance_score = max(
                parsed_signaliz.overall_relevance_score,
                llm_intel.overall_relevance_score,
            )
        return parsed_signaliz

    return llm_intel


def _safe_company_signals(
    pdl_company: Dict[str, Any],
    signaliz_data: Dict[str, Any],
    entry: Dict[str, Any],
    cs: Dict[str, Any],
) -> Optional[List["CompanySignal"]]:
    """Build company_signals safely; return None on any error so the rest of the
    research response still succeeds."""
    try:
        raw = _build_unified_company_signals(
            pdl_company=pdl_company,
            signaliz_data=signaliz_data,
            intelligence=_merge_intelligence(
                _parse_intelligence(entry.get("intelligence")),
                signaliz_data,
            ),
            company_summary=cs,
        )
        if not raw:
            return None
        return [CompanySignal(**s) for s in raw]
    except Exception as exc:
        logger.warning("_safe_company_signals failed: %s", exc)
        return None


@router.post("/research", response_model=ResearchResponse)
async def conduct_research(request: ResearchRequest):
    """
    Conduct research on company and contacts.
    """
    try:
        # Decide whether to research company-level only or a specific division/department.
        company = (request.company_name or "").strip()
        jd = request.selected_job_description or {}
        jd_title = str(jd.get("title") or "").strip()

        BIG_COMPANIES = {
            "google",
            "alphabet",
            "microsoft",
            "amazon",
            "meta",
            "apple",
            "netflix",
            "tesla",
            "oracle",
            "ibm",
            "salesforce",
        }

        def infer_org_unit(company_name: str, job_title: str) -> Optional[str]:
            t = (job_title or "").strip()
            if not t:
                return None
            # Try to extract a clear unit from common patterns like "Role, Unit" or "Role - Unit".
            m = re.search(r"[,\\-–—]\\s*([A-Za-z][A-Za-z0-9 &/]+)$", t)
            if m:
                candidate = m.group(1).strip()
                if 3 <= len(candidate) <= 60:
                    return candidate

            low = t.lower()
            # Common large-org divisions
            if "cloud" in low:
                return "Cloud"
            if "youtube" in low:
                return "YouTube"
            if "ads" in low or "advertis" in low:
                return "Ads"
            if "search" in low:
                return "Search"
            if "android" in low:
                return "Android"
            if "maps" in low:
                return "Maps"
            if "workspace" in low or "g suite" in low:
                return "Workspace"
            if "security" in low:
                return "Security"
            if "payments" in low:
                return "Payments"
            if "ai" in low or "genai" in low or "ml" in low:
                return "AI/ML"
            return None

        is_big_company = company.lower() in BIG_COMPANIES
        org_unit = infer_org_unit(company, jd_title) if is_big_company else None
        scope_label = "division" if (is_big_company and org_unit) else "company"
        scope_target = f"{company} — {org_unit}" if (scope_label == "division") else company

        # Build a *non-fabricated* research corpus.
        # - If data_mode == "live" and SERPER_API_KEY is set, we fetch web snippets via Serper.
        # - If PDL_API_KEY is set and we have a company website from contacts, we enrich via PDL company endpoint.
        # - We never fabricate shared connections.

        def _uniq_nonempty(items: List[str]) -> List[str]:
            seen = set()
            out: List[str] = []
            for raw in items or []:
                s = str(raw or "").strip()
                if not s:
                    continue
                k = s.lower()
                if k in seen:
                    continue
                seen.add(k)
                out.append(s)
            return out

        def _signals_from_role_description(corpus_obj: Dict[str, Any]) -> List[str]:
            """
            Produce outreach-safe "hiring signals" derived from the provided role description context.
            This is NOT web research; it is grounded in the imported role/step context we already have.
            """
            try:
                title = str(corpus_obj.get("job_title") or "").strip()
                pains = [str(x).strip() for x in (corpus_obj.get("job_pain_points") or []) if str(x).strip()]
                succ = [str(x).strip() for x in (corpus_obj.get("job_success_metrics") or []) if str(x).strip()]
                skills = [str(x).strip() for x in (corpus_obj.get("job_required_skills") or []) if str(x).strip()]

                bullets: List[str] = []
                if title:
                    bullets.append(f"Hiring for: {title}.")
                if skills:
                    top = ", ".join(skills[:8])
                    bullets.append(f"Prioritizing skills: {top}.")
                if pains:
                    bullets.append(f"Current focus area: {pains[0]}.")
                    if len(pains) > 1:
                        bullets.append(f"Secondary focus area: {pains[1]}.")
                if succ:
                    bullets.append(f"Success will be measured by: {succ[0]}.")

                # Keep it concise + demo-friendly.
                out = []
                seen = set()
                for b in bullets:
                    s = str(b or "").strip()
                    if not s:
                        continue
                    k = s.lower()
                    if k in seen:
                        continue
                    seen.add(k)
                    out.append(s)
                return out[:6]
            except Exception:
                return []

        contact_company_websites = _uniq_nonempty(
            [c.job_company_website for c in (request.contacts or []) if getattr(c, "job_company_website", None)]
        )
        contact_company_linkedin = _uniq_nonempty(
            [c.job_company_linkedin_url for c in (request.contacts or []) if getattr(c, "job_company_linkedin_url", None)]
        )
        contact_company_industries = _uniq_nonempty(
            [c.job_company_industry for c in (request.contacts or []) if getattr(c, "job_company_industry", None)]
        )
        contact_company_sizes = _uniq_nonempty(
            [c.job_company_size for c in (request.contacts or []) if getattr(c, "job_company_size", None)]
        )

        data_mode = str(request.data_mode or "").strip().lower() or "live"
        want_live = data_mode == "live"

        # Build contacts early because live research paths use them.
        contacts: List[SelectedContact] = []
        if request.contacts:
            contacts = request.contacts
        else:
            for cid in request.contact_ids:
                contacts.append(
                    SelectedContact(
                        id=cid,
                        name=f"Contact {cid}",
                        title="Decision Maker",
                        company=company,
                    )
                )

        # Derive primary company web/link hints once so all branches can reuse safely.
        website_guess = contact_company_websites[0] if contact_company_websites else ""
        linkedin_guess = contact_company_linkedin[0] if contact_company_linkedin else ""
        company_domain_guess = _domain_from_url(website_guess)

        # Web snippets via Serper (best effort). We keep a small query budget so this stays fast.
        # We gather a richer corpus and let GPT decide which headings have enough signal.
        serper_hits: List[Dict[str, Any]] = []
        contact_serper_hits: Dict[str, List[Dict[str, Any]]] = {}
        company_serper_by_topic: Dict[str, List[Dict[str, Any]]] = {}
        contact_serper_by_topic: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

        def _serper(q: str, *, num: int = 6) -> List[Dict[str, Any]]:
            try:
                raw = serper_web_search(q, num=num) or []
                # Normalize provider shapes defensively to avoid runtime crashes.
                if isinstance(raw, list):
                    return [x for x in raw if isinstance(x, dict)]
                if isinstance(raw, dict):
                    organic = raw.get("organic")
                    if isinstance(organic, list):
                        return [x for x in organic if isinstance(x, dict)]
                return []
            except Exception:
                return []

        if want_live and settings.serper_api_key:
            # Derive a likely company domain for site-restricted searches (press/blog/newsroom).
            domain_guess = company_domain_guess

            def _gather(queries: List[str], *, per_query: int = 6, cap: int = 12) -> List[Dict[str, Any]]:
                """
                Run multiple Serper queries and dedupe results by URL.
                """
                seen: set[str] = set()
                out: List[Dict[str, Any]] = []
                for q in queries:
                    q = str(q or "").strip()
                    if not q:
                        continue
                    for h in (_serper(q, num=per_query) or []):
                        if not isinstance(h, dict):
                            continue
                        url = str(h.get("link") or h.get("url") or "").strip()
                        key = url.lower()
                        if not url or key in seen:
                            continue
                        seen.add(key)
                        out.append(h)
                        if len(out) >= cap:
                            return out
                return out

            # Company: multiple facets
            company_queries: Dict[str, List[str]] = {
                "overview": [f"{scope_target} company overview what they do", f"{scope_target} website"],
                "news": [
                    f"\"{scope_target}\" company recent news",
                    f"\"{scope_target}\" company press release",
                    f"site:prnewswire.com \"{scope_target}\" company",
                    f"site:businesswire.com \"{scope_target}\" company",
                ],
                "funding": [
                    f"{scope_target} funding investors valuation",
                    f"site:techcrunch.com {scope_target} funding",
                    f"site:crunchbase.com {scope_target} funding",
                ],
                "product": [f"{scope_target} product launch partnership", f"{scope_target} release notes"],
                "product_launches": [
                    f"{scope_target} product launch release announcement",
                    f"{scope_target} announces new product",
                ],
                "hiring": [
                    f"{scope_target} hiring growth layoffs",
                    f"{scope_target} hiring freeze layoffs",
                    f"site:layoffs.fyi {scope_target}",
                ],
                "leadership": [
                    f"{scope_target} leadership changes new CEO CTO CPO CFO VP",
                    f"{scope_target} appointed CEO CTO",
                ],
                "culture": [f"{scope_target} company culture values how it works", f"{scope_target} careers values"],
                "market": [f"{scope_target} competitors market position", f"{scope_target} alternative competitors"],
                "posts": [
                    f"{scope_target} blog posts engineering blog",
                    f"{scope_target} newsroom blog",
                    f"site:medium.com {scope_target}",
                    f"site:substack.com {scope_target}",
                ],
                "publications": [
                    f"{scope_target} whitepaper case study report publication",
                    f"{scope_target} case study pdf",
                    f"{scope_target} whitepaper pdf",
                ],
                # "Tea" / extra signals to verify (always source-backed; avoid defamation).
                "signals": [f"{scope_target} acquisition reorg restructuring outage breach incident lawsuit controversy"],
            }

            # Add site-restricted sources when we have a domain guess.
            if domain_guess:
                company_queries["news"].append(f"site:{domain_guess} (press OR newsroom OR announcement OR release)")
                company_queries["product_launches"].append(f"site:{domain_guess} (launch OR released OR announces OR new) (product OR feature)")
                company_queries["leadership"].append(f"site:{domain_guess} (appointed OR joins OR named) (CEO OR CTO OR CPO OR CFO OR VP)")
                company_queries["publications"].append(f"site:{domain_guess} (whitepaper OR case study OR report OR pdf)")
                company_queries["posts"].append(f"site:{domain_guess} (blog OR engineering OR insights)")

            # Run overview separately as the general corpus anchor.
            serper_hits = _gather(company_queries["overview"], per_query=6, cap=10)

            # Topic buckets: multiple queries + dedupe.
            for k, qs in company_queries.items():
                if k == "overview":
                    company_serper_by_topic[k] = serper_hits
                    continue
                hits_k = _gather(qs, per_query=6, cap=12)
                if k == "news":
                    hits_k = [h for h in hits_k if _is_company_relevant_hit(scope_target, h, company_domain=domain_guess)]
                company_serper_by_topic[k] = hits_k

            # Contacts: per-contact facets (keep bounded)
            max_contacts = 8
            for c in contacts[:max_contacts]:
                nm = str(c.name or "").strip()
                co = str(c.company or company).strip()
                if not nm:
                    continue
                # one general query + a few facet queries (posts/writing + talks/interviews + publications)
                q_general = f"{nm} {co} {c.title or ''}".strip()
                q_posts = f"{nm} {co} posts articles blog LinkedIn"
                q_talks = f"{nm} {co} podcast interview conference talk"
                q_pubs = f"{nm} {co} publication paper whitepaper guest post"
                # If we have an explicit LinkedIn URL, bias a query toward it (public snippets only).
                li = str(getattr(c, "linkedin_url", "") or "").strip()
                q_li = f"{li} {nm} {co}".strip() if li else f'site:linkedin.com/in "{nm}" {co}'
                hits_general = _serper(q_general, num=6)
                hits_posts = _serper(q_posts, num=6)
                hits_talks = _serper(q_talks, num=6)
                hits_pubs = _serper(q_pubs, num=6)
                hits_li = _serper(q_li, num=6)
                contact_serper_hits[c.id] = hits_general
                contact_serper_by_topic[c.id] = {
                    "general": hits_general,
                    "posts": hits_posts,
                    "talks": hits_talks,
                    "publications": hits_pubs,
                    "linkedin": hits_li,
                }
        elif want_live and not settings.serper_api_key:
            # Keyless fallback: DuckDuckGo + Google News RSS for both company and contact research.
            def _gather_free(queries: List[str], *, per_query: int = 6, cap: int = 12) -> List[Dict[str, Any]]:
                seen: set[str] = set()
                out: List[Dict[str, Any]] = []
                for q in queries or []:
                    q = str(q or "").strip()
                    if not q:
                        continue
                    for h in (_free_web_search(q, num=per_query) or []):
                        if not isinstance(h, dict):
                            continue
                        url = str(h.get("link") or h.get("url") or "").strip()
                        key = url.lower()
                        if not url or key in seen:
                            continue
                        seen.add(key)
                        out.append(h)
                        if len(out) >= cap:
                            return out
                return out

            company_queries: Dict[str, List[str]] = {
                "overview": [f"{scope_target} company overview", f"{scope_target} what does {scope_target} do"],
                "news": [
                    f'"{scope_target}" recent news 2025 2026',
                    f'"{scope_target}" announcement press release',
                    f'"{scope_target}" newsroom press releases',
                    f'site:prnewswire.com "{scope_target}"',
                ],
                "product_launches": [f'"{scope_target}" product launch new feature 2025 2026'],
                "leadership": [f'"{scope_target}" leadership team CEO CTO VP', f'"{scope_target}" appointed new hire executive'],
                "publications": [f'"{scope_target}" report whitepaper case study'],
                "market": [f'"{scope_target}" competitors market', f'"{scope_target}" industry analysis'],
                "culture": [f'"{scope_target}" company culture values careers'],
                "signals": [f'"{scope_target}" acquisition restructuring funding'],
            }

            serper_hits = _gather_free(company_queries["overview"], per_query=6, cap=10)
            for k, qs in company_queries.items():
                if k == "overview":
                    company_serper_by_topic[k] = serper_hits
                else:
                    hits_k = _gather_free(qs, per_query=6, cap=12)
                    if k == "news":
                        hits_k = [h for h in hits_k if _is_company_relevant_hit(scope_target, h, company_domain=company_domain_guess)]
                    company_serper_by_topic[k] = hits_k

            max_contacts = 8
            for c in contacts[:max_contacts]:
                nm = str(c.name or "").strip()
                co = str(c.company or company).strip()
                if not nm:
                    continue
                title_str = str(c.title or "").strip()
                hits_general = _free_web_search(f'"{nm}" "{co}" {title_str}', num=6)
                hits_posts = _free_web_search(f'"{nm}" {co} LinkedIn post article blog', num=6)
                hits_talks = _free_web_search(f'"{nm}" {co} podcast interview conference speaker', num=6)
                hits_pubs = _free_web_search(f'"{nm}" {co} publication whitepaper report', num=4)
                li = str(getattr(c, "linkedin_url", "") or "").strip()
                hits_li = _free_web_search(f'{li} {nm} {co}' if li else f'site:linkedin.com/in "{nm}" {co}', num=4)
                contact_serper_hits[c.id] = hits_general
                contact_serper_by_topic[c.id] = {
                    "general": hits_general,
                    "posts": hits_posts,
                    "talks": hits_talks,
                    "publications": hits_pubs,
                    "linkedin": hits_li,
                }

            # Keep compatibility: feed RSS hits into the same corpus keys the model expects.
            # This flips has_serper=true downstream so we can populate market/news fields.
            if not serper_hits:
                # At minimum, treat "news" as the main corpus if overview is empty.
                serper_hits = company_serper_by_topic.get("news") or []

        # PDL company enrichment (best effort, but OFF by default due to cost)
        pdl_company: Dict[str, Any] = {}
        if _ENABLE_PDL and settings.pdl_api_key and contact_company_websites:
            try:
                pdl = PDLClient(settings.pdl_api_key)
                pdl_company = pdl.company_enrich(contact_company_websites[0]) or {}
            except Exception:
                pdl_company = {}

        # PDL person enrichment: get bio, skills, experience for each contact
        pdl_person_by_contact: Dict[str, Dict[str, Any]] = {}
        if want_live and settings.pdl_api_key:
            try:
                pdl = PDLClient(settings.pdl_api_key, timeout_seconds=12.0)
                for c in contacts[:6]:
                    nm = str(c.name or "").strip()
                    co = str(c.company or company).strip()
                    li = str(getattr(c, "linkedin_url", "") or "").strip()
                    if not nm and not li:
                        continue
                    try:
                        person_data = pdl.person_enrich(
                            name=nm,
                            company=co,
                            linkedin_url=li,
                            title=str(c.title or "").strip(),
                        )
                        if person_data and isinstance(person_data, dict):
                            pdl_person_by_contact[c.id] = person_data
                            logger.info("PDL person enrich found data for %s at %s", nm, co)
                    except Exception as pe:
                        logger.debug("PDL person enrich failed for %s: %s", nm, pe)
            except Exception:
                pass

        corpus = {
            "company_name": company,
            "research_scope": scope_label,
            "scope_target": scope_target,
            "job_title": jd_title,
            "job_required_skills": jd.get("required_skills") or [],
            "job_pain_points": jd.get("pain_points") or [],
            "job_success_metrics": jd.get("success_metrics") or [],
            # Candidate context (best effort). Keep these lightweight/outreach-safe.
            "resume_extract": request.resume_extract or {},
            "painpoint_matches": request.painpoint_matches or [],
            # Internal-only convenience fields (also included in the payload passed to the LLM).
            "contacts_raw": [],
            "recent_news_raw": [],
            "signals": {
                "company_websites": contact_company_websites,
                "company_linkedin_urls": contact_company_linkedin,
                "company_industries": contact_company_industries,
                "company_sizes": contact_company_sizes,
            },
            "pdl_company_enrich": pdl_company,
            "pdl_person_by_contact": pdl_person_by_contact,
            "serper_hits": serper_hits,
            "contact_serper_hits": contact_serper_hits,
            "company_serper_by_topic": company_serper_by_topic,
            "contact_serper_by_topic": contact_serper_by_topic,
            "website": website_guess or "",
            "linkedin_company": linkedin_guess or "",
            "shared_connections_raw": [],
            "requested_contact_ids": request.contact_ids,
            "data_mode": data_mode,
        }

        # Signaliz enrichment: if API key is configured, get structured signals.
        signaliz_data: Dict[str, Any] = {}
        if want_live and signaliz_enabled():
            try:
                job_context = f" for someone pursuing a {jd_title} role" if jd_title else ""
                prompt = (
                    f"Find recent signals about {scope_target} including product launches, "
                    f"leadership changes, hiring activity, funding events, and partnerships"
                    f"{job_context}. Focus on newsroom announcements, press releases, and public filings."
                )
                signaliz_data = enrich_company_signals(
                    scope_target,
                    research_prompt=prompt,
                    domain=company_domain_guess,
                    target_signal_count=6,
                    lookback_days=180,
                    timeout=45.0,
                )
                if signaliz_data:
                    corpus["signaliz_enrichment"] = signaliz_data
                    logger.info("Signaliz returned %d signals for %s", len(signaliz_data.get("signals") or []), scope_target)
            except Exception as e:
                logger.warning("Signaliz enrichment failed for %s: %s", scope_target, e)

        # Newsroom scraping: try to find the company's press/newsroom page for recent announcements.
        if want_live and company_domain_guess:
            try:
                newsroom_hits = _scrape_newsroom(company_domain_guess, max_items=4)
                if newsroom_hits:
                    corpus.setdefault("newsroom_hits", []).extend(newsroom_hits)
                    if "news" not in company_serper_by_topic:
                        company_serper_by_topic["news"] = []
                    company_serper_by_topic["news"].extend(newsroom_hits)
                    serper_hits.extend(newsroom_hits)
                    logger.info("Newsroom scrape found %d items for %s", len(newsroom_hits), company_domain_guess)
            except Exception as e:
                logger.debug("Newsroom scrape failed for %s: %s", company_domain_guess, e)

        # Convert Serper hits (when present) into a simple recent_news_raw list.
        # If Serper is not enabled/available, keep this empty (no fabricated URLs).
        try:
            # Prefer explicit "news" topic hits, otherwise fall back to overview hits.
            news_hits = []
            try:
                news_hits = (company_serper_by_topic.get("news") or []) if isinstance(company_serper_by_topic, dict) else []
            except Exception:
                news_hits = []

            website_domain = _domain_from_url(str(corpus.get("website") or ""))
            for hit in (news_hits or serper_hits or [])[:12]:
                if not isinstance(hit, dict):
                    continue
                if not _is_company_relevant_hit(scope_target, hit, company_domain=website_domain):
                    continue
                title = str(hit.get("title") or "").strip()
                link = str(hit.get("link") or hit.get("url") or "").strip()
                snippet = str(hit.get("snippet") or "").strip()
                if not (title and link):
                    continue
                corpus["recent_news_raw"].append(
                    {
                        "title": title[:140],
                        "summary": snippet[:240],
                        "date": "Unknown",
                        "source": str(hit.get("source") or "web"),
                        "url": link,
                    }
                )
                if len(corpus["recent_news_raw"]) >= 6:
                    break
        except Exception:
            corpus["recent_news_raw"] = []

        # Cache: key on company + scope + JD title + selected contacts (id/name/title/department).
        cache_payload = {
            "company": company,
            "scope_label": scope_label,
            "scope_target": scope_target,
            "jd_title": jd_title,
            "contact_ids": request.contact_ids,
            "data_mode": data_mode,
            "prompt_version": _PROMPT_VERSION,
            "contacts": [
                {
                    "id": c.id,
                    "name": c.name,
                    "title": c.title,
                    "company": c.company,
                    "department": c.department,
                    "level": c.level,
                    "linkedin_url": c.linkedin_url,
                }
                for c in contacts
            ],
        }
        ck = _cache_key(cache_payload)
        cached = _cache_get(ck)
        if cached:
            try:
                return ResearchResponse(**cached)
            except Exception:
                # Cache shape can drift after schema/prompt updates; ignore stale entries.
                _CTX_CACHE.pop(ck, None)

        def _dept_bucket(c: SelectedContact) -> str:
            t = f"{c.title or ''} {c.department or ''}".lower()
            if any(k in t for k in ["talent", "recruit", "people", "hr"]):
                return "talent"
            if any(k in t for k in ["engineer", "platform", "sre", "devops", "cto", "vp eng", "director eng"]):
                return "engineering"
            if any(k in t for k in ["product", "pm", "growth"]):
                return "product"
            return "general"

        def _contact_highlights(c: SelectedContact) -> List[str]:
            bucket = _dept_bucket(c)
            if bucket == "talent":
                return [
                    "Owns hiring strategy, time-to-fill, and pipeline quality",
                    "Cares about signal, speed, and candidate experience",
                ]
            if bucket == "engineering":
                return [
                    "Optimizes delivery velocity, reliability, and engineering leverage",
                    "Cares about headcount ROI, team structure, and execution risk",
                ]
            if bucket == "product":
                return [
                    "Focuses on roadmap outcomes, adoption, and user value",
                    "Cares about iteration speed and cross-functional execution",
                ]
            return [
                "Focused on measurable outcomes and operational execution",
                "Cares about low-risk, high-leverage improvements",
            ]

        for c in contacts:
            corpus["contacts_raw"].append(
                {
                    "id": c.id,
                    "name": c.name,
                    "title": c.title,
                    "company": c.company or company,
                    "email": c.email,
                    "email_source": c.email_source,
                    "department": c.department,
                    "level": c.level,
                    "linkedin_url": c.linkedin_url,
                    "location_name": c.location_name,
                    "location_country": c.location_country,
                    "job_company_website": c.job_company_website,
                    "job_company_linkedin_url": c.job_company_linkedin_url,
                    "job_company_industry": c.job_company_industry,
                    "job_company_size": c.job_company_size,
                    "highlights": _contact_highlights(c),
                }
            )

        client = get_openai_client()

        def _pdl_bio(c: SelectedContact, pdl: Dict[str, Any], fallback_company: str) -> str:
            summary = str(pdl.get("summary") or "").strip() if pdl else ""
            if summary and len(summary) > 20:
                return summary[:500]
            return (
                f"{c.name} is a {c.title} at {c.company or fallback_company}. "
                f"Likely cares about outcomes, execution risk, and pragmatic improvements aligned to their team."
            )

        def _pdl_experience(pdl: Dict[str, Any]) -> str:
            if not pdl:
                return "Unknown"
            exp = pdl.get("experience") or []
            if not isinstance(exp, list) or not exp:
                yrs = pdl.get("inferred_years_experience")
                if yrs:
                    return f"~{yrs} years of experience"
                return "Unknown"
            parts = []
            for e in exp[:4]:
                if not isinstance(e, dict):
                    continue
                t = str(e.get("title", {}).get("name") or e.get("title") or "").strip() if isinstance(e.get("title"), (dict, str)) else ""
                co = str(e.get("company", {}).get("name") or e.get("company") or "").strip() if isinstance(e.get("company"), (dict, str)) else ""
                if t and co:
                    parts.append(f"{t} at {co}")
                elif t:
                    parts.append(t)
            return "; ".join(parts) if parts else "Unknown"

        def _pdl_education(pdl: Dict[str, Any]) -> str:
            if not pdl:
                return "Unknown"
            edu = pdl.get("education") or []
            if not isinstance(edu, list) or not edu:
                return "Unknown"
            parts = []
            for e in edu[:3]:
                if not isinstance(e, dict):
                    continue
                school = str(e.get("school", {}).get("name") or e.get("school") or "").strip() if isinstance(e.get("school"), (dict, str)) else ""
                degree = str(e.get("degrees") or e.get("degree") or "").strip()
                if isinstance(e.get("degrees"), list):
                    degree = ", ".join(str(d) for d in e["degrees"][:2])
                if school:
                    parts.append(f"{degree} - {school}" if degree else school)
            return "; ".join(parts) if parts else "Unknown"

        def _pdl_skills(pdl: Dict[str, Any]) -> List[str]:
            if not pdl:
                return []
            skills_raw = pdl.get("skills") or []
            if not isinstance(skills_raw, list):
                return []
            return [str(s).strip() for s in skills_raw[:8] if str(s).strip()]

        def _build_contact_facts(
            c: SelectedContact,
            serper_topics: Dict[str, List[Dict[str, Any]]],
            pdl: Dict[str, Any],
        ) -> List[Dict[str, str]]:
            facts: List[Dict[str, str]] = []
            seen: set[str] = set()

            if pdl:
                summary = str(pdl.get("summary") or "").strip()
                if summary and len(summary) > 20:
                    key = summary[:60].lower()
                    if key not in seen:
                        seen.add(key)
                        facts.append({
                            "fact": summary[:160],
                            "source_title": "Professional profile",
                            "source_url": str(pdl.get("linkedin_url") or ""),
                            "signal_type": "career_move",
                        })

                exp = pdl.get("experience") or []
                if isinstance(exp, list):
                    for e in exp[:2]:
                        if not isinstance(e, dict):
                            continue
                        t = str(e.get("title", {}).get("name") or e.get("title") or "").strip() if isinstance(e.get("title"), (dict, str)) else ""
                        co_name = str(e.get("company", {}).get("name") or e.get("company") or "").strip() if isinstance(e.get("company"), (dict, str)) else ""
                        start = str(e.get("start_date") or "").strip()
                        if t and co_name:
                            fact_text = f"{'Currently ' if not e.get('end_date') else 'Previously '}{t} at {co_name}"
                            if start:
                                fact_text += f" (since {start[:7]})"
                            key = fact_text[:60].lower()
                            if key not in seen:
                                seen.add(key)
                                facts.append({
                                    "fact": fact_text[:160],
                                    "source_title": "Career history",
                                    "source_url": str(pdl.get("linkedin_url") or ""),
                                    "signal_type": "career_move",
                                })

                pdl_skills = pdl.get("skills") or []
                if isinstance(pdl_skills, list) and len(pdl_skills) >= 3:
                    top = ", ".join(str(s) for s in pdl_skills[:5])
                    facts.append({
                        "fact": f"Key skills: {top}"[:160],
                        "source_title": "Professional profile",
                        "source_url": str(pdl.get("linkedin_url") or ""),
                        "signal_type": "role_insight",
                    })

                interests = pdl.get("interests") or []
                if isinstance(interests, list) and interests:
                    top = ", ".join(str(i) for i in interests[:4])
                    facts.append({
                        "fact": f"Interests: {top}"[:160],
                        "source_title": "Professional profile",
                        "source_url": "",
                        "signal_type": "role_insight",
                    })

            web_facts = _contact_facts_from_hits(
                sum((list(serper_topics.values())), []) if serper_topics else [],
                max_items=6,
            )
            for wf in web_facts:
                key = str(wf.get("fact", ""))[:60].lower()
                if key and key not in seen:
                    seen.add(key)
                    facts.append(wf)

            if len(facts) < 3:
                title = str(c.title or "").strip()
                co_fallback = str(c.company or "").strip()
                inferred = [
                    f"As {title} at {co_fallback}, owns key operational and strategic decisions for their team",
                    f"Responsible for team performance metrics, hiring, and cross-functional coordination",
                    f"Decision-maker who values concrete, outcome-oriented proposals over generic pitches",
                ]
                for inf in inferred:
                    if len(facts) >= 3:
                        break
                    facts.append({
                        "fact": inf[:160],
                        "source_title": "Role analysis",
                        "source_url": "",
                        "signal_type": "role_insight",
                    })

            return facts[:8]

        def _build_stub_for_contact(c: SelectedContact) -> Dict[str, Any]:
            bucket = _dept_bucket(c)
            dept_phrase = (c.department or "").strip()
            if not dept_phrase:
                dept_phrase = "their org"

            # Minimal, non-fabricated baseline description derived from available signals.
            base_desc = ""
            try:
                if corpus.get("serper_hits"):
                    base_desc = str((corpus["serper_hits"][0] or {}).get("snippet") or "").strip()
            except Exception:
                base_desc = ""
            if not base_desc:
                try:
                    base_desc = str((corpus.get("pdl_company_enrich") or {}).get("summary") or (corpus.get("pdl_company_enrich") or {}).get("description") or "").strip()
                except Exception:
                    base_desc = ""
            if not base_desc:
                # When we have no web/company enrichment, avoid "backend unavailable" style messages.
                # Keep it explicitly limited but still usable for drafting without sounding like the system gave up.
                base_desc = f"High-level overview for {scope_target}."
            if bucket == "engineering":
                tailored = (
                    f"{base_desc} Tailored for engineering leadership: emphasize delivery velocity, reliability, "
                    f"cost, and hiring leverage for {dept_phrase}."
                )
                skills = ["Leadership", "Platform engineering", "Reliability", "Hiring"]
            elif bucket == "talent":
                tailored = (
                    f"{base_desc} Tailored for talent leadership: emphasize signal quality, pipeline speed, "
                    f"candidate experience, and measurable time-to-fill improvements for {dept_phrase}."
                )
                skills = ["Talent strategy", "Sourcing", "Hiring ops", "Stakeholder alignment"]
            elif bucket == "product":
                tailored = (
                    f"{base_desc} Tailored for product leadership: emphasize roadmap outcomes, adoption, "
                    f"and faster iteration for {dept_phrase}."
                )
                skills = ["Product strategy", "Execution", "Analytics", "Cross-functional leadership"]
            else:
                tailored = f"{base_desc} Tailored for outreach to {c.title or 'a decision maker'}."
                skills = ["Leadership", "Execution", "Measurement"]

            # Recent news: only include items when we actually have Serper hits.
            contact_news: List[Dict[str, Any]] = []
            if corpus.get("recent_news_raw"):
                for n in (corpus.get("recent_news_raw") or [])[:2]:
                    if isinstance(n, dict):
                        contact_news.append(
                            {
                                "title": str(n.get("title") or ""),
                                "summary": str(n.get("summary") or ""),
                                "date": str(n.get("date") or ""),
                                "source": str(n.get("source") or ""),
                                "url": str(n.get("url") or ""),
                            }
                        )

            has_sources = bool(corpus.get("serper_hits")) or bool(corpus.get("company_serper_by_topic"))
            topics = corpus.get("company_serper_by_topic") or {}
            product_launches = ""
            leadership_changes = ""
            other_hiring_signals = ""
            recent_posts = ""
            publications = ""
            if has_sources and isinstance(topics, dict):
                product_launches = _bullets_from_serper_hits(
                    (topics.get("product_launches") or topics.get("product") or []),
                    max_items=6,
                )
                leadership_changes = _bullets_from_serper_hits(
                    (topics.get("leadership") or []),
                    max_items=6,
                )
                other_hiring_signals = _bullets_from_serper_hits(
                    (topics.get("signals") or topics.get("hiring") or topics.get("funding") or []),
                    max_items=8,
                )
                recent_posts = _bullets_from_serper_hits(
                    (topics.get("posts") or []),
                    max_items=8,
                )
                publications = _bullets_from_serper_hits(
                    (topics.get("publications") or []),
                    max_items=6,
                )
            culture_values = _bullets_from_serper_hits(
                (topics.get("culture") or topics.get("overview") or []) if isinstance(topics, dict) else [],
                max_items=7,
            ) if has_sources else ""
            market_position = _bullets_from_serper_hits(
                (topics.get("market") or []) if isinstance(topics, dict) else [],
                max_items=7,
            ) if has_sources else ""
            if not culture_values:
                culture_values = ""
            if not market_position:
                market_position = ""

            return {
                "company_summary": {
                    "name": scope_target,
                    "description": tailored,
                        # Avoid low-confidence industry/size guesses in stub mode; prefer Unknown unless we have enriched data.
                        "industry": str((corpus.get("pdl_company_enrich") or {}).get("industry") or "Unknown"),
                        "size": str((corpus.get("pdl_company_enrich") or {}).get("size") or "Unknown"),
                        "founded": "Unknown",
                        "headquarters": "Unknown",
                        "website": corpus.get("website") or "Unknown",
                        "linkedin_url": corpus.get("linkedin_company") or None,
                },
                "theme": (
                    "Theme: What the company cares about: Reference a plausible priority (customer experience, reliability, speed, cost) "
                    "and offer a 2–3 bullet mini-plan—without claiming a specific news event.\n"
                    "- Start with one concrete outcome tied to the role\n"
                    "- Propose a low-risk first sprint (instrument → ship → measure)\n"
                    "- Share a weekly reporting cadence"
                ),
                "company_culture_values": culture_values,
                "company_market_position": market_position,
                "company_product_launches": product_launches,
                "company_leadership_changes": leadership_changes,
                "company_other_hiring_signals": other_hiring_signals,
                "company_recent_posts": recent_posts,
                "company_publications": publications,
                "contact_bios": [
                    {
                        "name": c.name,
                        "title": c.title,
                        "company": c.company or company,
                        "bio": _pdl_bio(c, pdl_person_by_contact.get(c.id, {}), company),
                        "experience": _pdl_experience(pdl_person_by_contact.get(c.id, {})),
                        "education": _pdl_education(pdl_person_by_contact.get(c.id, {})),
                        "skills": _pdl_skills(pdl_person_by_contact.get(c.id, {})) or skills,
                        "linkedin_url": c.linkedin_url or str((pdl_person_by_contact.get(c.id) or {}).get("linkedin_url") or ""),
                        "interesting_facts": _build_contact_facts(
                            c,
                            contact_serper_by_topic.get(c.id, {}),
                            pdl_person_by_contact.get(c.id, {}),
                        ),
                        "outreach_angles": [],
                        "urgency_score": 0,
                        "urgency_reason": "",
                    }
                ],
                "recent_news": contact_news,
                "shared_connections": [],
                "background_report_title": "Contact Background Report",
                "background_report_sections": [
                    {
                        "heading": "What to personalize (based on their role)",
                        "body": (
                            f"Personalize your opener to {c.title} by connecting the role you’re pursuing ({corpus.get('job_title') or 'the role'}) "
                            f"to a likely priority for {dept_phrase}. Mention one specific problem-to-solve from the job posting (pain points / responsibilities), "
                            f"then offer one concrete proof point from your resume (a shipped project, a metric, or a scoped mini-plan). "
                            f"Keep it grounded: no big claims, just a crisp 'here’s what I’d improve first' tied to a measurable outcome."
                        ),
                        "sources": [],
                    }
                ],
                "intelligence": _build_stub_intelligence(corpus, scope_target, company_serper_by_topic),
                "hooks": [
                    "Connect the job’s top pain point to a specific outcome you’ve delivered before",
                    "Reference their org’s likely constraints (speed vs reliability vs cost) and offer a low-risk first step",
                    "Offer a 2–3 bullet mini-plan tied to a KPI the role is accountable for",
                ],
            }

        # Single-call summarization: ask the model to return per-contact research keyed by contact id.
        stub_research_by_contact: Dict[str, Any] = {}
        for c in contacts:
            stub_research_by_contact[c.id] = _build_stub_for_contact(c)

        stub_json = {
            "research_by_contact": stub_research_by_contact,
            "hooks": [
                "Open with a specific outcome you can improve in 2–3 weeks",
                "Reference a relevant initiative/news item as timing",
                "Offer a concrete mini-plan instead of a generic pitch",
            ],
        }

        # Pydantic v1/v2 compatibility
        contacts_dump = [
            (c.model_dump() if hasattr(c, "model_dump") else c.dict()) for c in contacts
        ]

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a company + contact research summarizer for outreach.\n\n"
                    "Given a research corpus JSON (raw provider outputs) and a list of selected contacts, "
                    "produce per-contact structured research.\n\n"
                    "If research_scope is 'division', focus the company_summary on the scope_target org (division/team), "
                    "not the entire company.\n\n"
                    "Rules:\n"
                    "- Prefer facts from the corpus JSON when available.\n"
                    "- Do NOT include meta/system disclaimers like '(no external lookup used)' in any user-facing text.\n"
                    "- If the corpus has limited data, you SHOULD still try:\n"
                    "  - Use general model knowledge to write a useful company description (what they sell, who they sell to, and the buying motion).\n"
                    "  - Populate industry/size/headquarters/website/linkedin_url ONLY if you are confident (well-known company) — otherwise 'Unknown'.\n"
                    "  - Never invent specific numbers (revenue, headcount) or specific dates.\n"
                    "  - Never invent 'recent_news' URLs.\n"
                    "  - recent_news MUST be actual news items from the corpus web hits (with real URLs). If you don't have web sources, return recent_news: [].\n"
                    "  - company_market_position MUST be sourced from real web data. If no web sources, set company_market_position to an empty string ''.\n"
                    "  - theme is NOT news. Always populate theme with safe, non-claiming outreach guidance using this exact sentence, then add a 2–3 bullet mini-plan:\n"
                    "    \"Theme: What the company cares about: Reference a plausible priority (customer experience, reliability, speed, cost) and offer a 2–3 bullet mini-plan—without claiming a specific news event.\"\n"
                    "- If information is missing or uncertain, return EMPTY STRINGS (not placeholder text). NEVER write phrases like 'No data found', 'No product launch details captured', 'No leadership changes found', or any similar placeholder. Just return ''.\n"
                    "- shared_connections MUST be an empty array unless provided (it is empty in this corpus).\n\n"
                    "MINIMUM FACTS REQUIREMENT (critical):\n"
                    "- You MUST produce at least 3 substantive facts about the company that a job seeker could reference in an email.\n"
                    "  These can come from: company description, culture, market position, product launches, hiring signals, recent posts, or news.\n"
                    "  If web sources are thin, synthesize from the company name, industry, job description pain points, and general knowledge.\n"
                    "  NEVER return placeholder text. Either write real content or return an empty string.\n"
                    "- You MUST produce at least 3 substantive facts per contact that the seeker could mention in outreach.\n"
                    "  These can come from: bio, career highlights, post topics, interesting facts, or inferred from their role/title.\n"
                    "  If web sources are thin, infer from their title, department, and company context.\n"
                    "  Always populate interesting_facts with at least 3 items (inferred facts are OK when labeled as inferred).\n\n"
                    "Quality bar:\n"
                    "- NEVER use hedging words like 'likely', 'probably', 'may', 'might', 'appears to', 'seems to'. Write assertively or leave it out.\n"
                    "- The company_summary.description should be 2–4 sentences and outreach-useful (what they do + why it matters + current priorities).\n"
                    "- company_culture_values should be 4–8 sentences: how they operate + values signals (avoid claiming a specific internal culture doc).\n"
                    "- company_market_position should be 4–8 sentences: who they compete with / positioning / what matters now.\n"
                    "  - If you don't have sources, leave it empty.\n"
                    "- company_product_launches should be 3–8 bullet points about recent launches/releases/announcements (with URLs if available in corpus).\n"
                    "- company_leadership_changes should be 2–6 bullet points on exec/VP changes or notable leadership moves (with URLs if available in corpus).\n"
                    "- company_other_hiring_signals should be 3–8 bullet points on hiring momentum signals beyond generic 'open roles' (with URLs if available).\n"
                    "- company_recent_posts should be 3–8 bullets summarizing recent company posts (blog/press/LinkedIn topics) with URLs when available.\n"
                    "- company_publications should be 1–6 bullets summarizing notable publications (case studies, whitepapers, reports) with URLs when available.\n"
                    "- contact_bios.bio should be 1–2 sentences tailored to the contact's title/department.\n"
                    "- contact_bios[].interesting_facts MUST have at least 3 items (aim for 5–6). Populate from these sources IN ORDER:\n"
                    "  0) PDL person enrichment data (pdl_person_by_contact): skills, experience, education, summary, interests. These are HIGHLY reliable.\n"
                    "  1) REAL signals from contact_serper_by_topic: recent posts, talks, articles, LinkedIn activity (use actual URLs).\n"
                    "  2) Career signals: promotions, role changes, new company joins visible in snippets.\n"
                    "  3) Company-context signals: if the company recently raised funding, launched a product, or made news, tie it to this person's role.\n"
                    "  4) Role-specific intelligence: based on their title, what are they MEASURABLY accountable for? What KPIs keep them up at night?\n"
                    "  Each item: { fact, source_title, source_url, signal_type }.\n"
                    "  signal_type must be one of: 'web_activity', 'career_move', 'company_news', 'role_insight', 'hiring_signal'.\n"
                    "  fact must be specific and outreach-ready (<=160 chars). BAD: 'Likely oversees reliability'. GOOD: 'Recently posted about scaling observability from 10 to 50 microservices'.\n"
                    "  source_url must be a real URL from the corpus. For role_insight signals, use source_url: '' and source_title: 'Role analysis'.\n"
                    "  NEVER produce vague facts like 'Likely cares about X'. Every fact must be specific enough to open a cold email with.\n"
                    "- contact_bios[].outreach_angles: array of 2–4 short outreach angle strings, each <100 chars, connecting the contact's signals to the job seeker's value.\n"
                    "- contact_bios[].urgency_score: integer 0–100 estimating how likely this contact is to respond NOW based on signals (hiring activity=high, recent posts=medium, no activity=low).\n"
                    "- contact_bios[].urgency_reason: 1 sentence explaining the urgency score.\n"
                    "- hooks should be 4–8 punchy, concrete outreach angles (no fluff), grounded in the job pain_points / success_metrics if present.\n\n"
                    "Grounding rules for the Contact Background Report:\n"
                    "- If resume_extract or painpoint_matches are provided, use them to make the report SPECIFIC.\n"
                    "  Example: cite 1 job pain point + 1 resume proof point + a recommended first 2–3 steps.\n"
                    "- Avoid generic coaching language. Make it a brief intelligence brief, not advice.\n\n"
                    "Contact Background Report (dynamic sections):\n"
                    "- Build a report titled 'Contact Background Report' for each contact, containing ~20 possible headings.\n"
                    "- Only INCLUDE a heading if you have at least ~2 sentences of useful, outreach-relevant info for it.\n"
                    "- Use ONLY facts/snippets from the provided corpus when web data is present.\n"
                    "- If web data is thin, you may write general, clearly non-claiming themes, but do not pretend they are sourced.\n"
                    "- Avoid sensitive personal data; keep it outreach-safe.\n\n"
                    "Candidate headings to consider (omit if empty/low-signal):\n"
                    "1) Role summary (what they own)\n"
                    "2) Current priorities / initiatives (from public snippets)\n"
                    "3) Team / org context\n"
                    "4) Recent posts or articles (topics + tone)\n"
                    "5) Interviews / talks / podcasts\n"
                    "6) Publications / writing\n"
                    "7) Public opinions / hot takes (only if explicitly present)\n"
                    "8) Career highlights\n"
                    "9) Past companies / domain experience\n"
                    "10) Hiring / team growth signals\n"
                    "11) Tools/stack they mention\n"
                    "12) Communities / affiliations\n"
                    "13) Awards / recognition\n"
                    "14) Conferences / events\n"
                    "15) Company news relevant to them\n"
                    "16) Product / market moves\n"
                    "17) Company culture / values signals\n"
                    "18) Risks / constraints (compliance, security, etc.)\n"
                    "19) Outreach personalization angles\n"
                    "20) Other notable bits\n\n"
                    "Return ONLY a JSON object with keys:\n"
                    "- research_by_contact: object keyed by contact id.\n"
                    "  Each value must be an object with keys:\n"
                    "  - company_summary: { name, description, industry, size, founded, headquarters, website, linkedin_url }\n"
                    "  - contact_bios: array of { name, title, company, bio, experience, education, skills, linkedin_url,\n"
                    "      public_profile_highlights, publications, post_topics, opinions, other_interesting_facts, interesting_facts,\n"
                    "      outreach_angles, urgency_score, urgency_reason }\n"
                    "  - theme: string\n"
                    "  - company_culture_values: string\n"
                    "  - company_market_position: string\n"
                    "  - company_product_launches: string\n"
                    "  - company_leadership_changes: string\n"
                    "  - company_other_hiring_signals: string\n"
                    "  - company_recent_posts: string\n"
                    "  - company_publications: string\n"
                    "  - recent_news: array of { title, summary, date, source, url }\n"
                    "  - shared_connections: array of strings\n"
                    "  - background_report_title: string\n"
                    "  - background_report_sections: array of { heading: string, body: string, sources: array of { title, url } }\n"
                    "  - intelligence: object with keys:\n"
                    "    - signals: array of structured signal objects, each with:\n"
                    "      { signal_type, source_type, signal_title, signal_source, signal_content, signal_date, confidence_score, metadata }\n"
                    "      signal_type MUST be one of: leadership_change, product_launch, hiring_signal, funding_event, partnership, market_expansion, regulatory, technology_adoption, earnings, restructuring\n"
                    "      source_type: 'web_source' if from a real URL in corpus, 'ai_enrichment' if synthesized from multiple sources\n"
                    "      signal_title: Short headline (<120 chars)\n"
                    "      signal_source: The actual URL where this was found (from corpus). Empty string if ai_enrichment.\n"
                    "      signal_content: 2-4 sentence detailed description of the signal and its business implications\n"
                    "      signal_date: ISO date string if known, empty otherwise\n"
                    "      confidence_score: float 0.0-1.0 (1.0 = directly sourced, 0.7+ = strong inference, <0.5 = speculative)\n"
                    "      Produce 3-8 signals per company. Prioritize: leadership changes, product launches, hiring signals, funding events.\n"
                    "      IMPORTANT: If the corpus contains a 'signaliz_enrichment' key, it has pre-enriched signals from Signaliz AI.\n"
                    "      Use its executive_summary, key_themes, and outreach_summary to enhance your output.\n"
                    "      Reference its signal relevance reasons as signal_content when appropriate.\n"
                    "    - outreach_summary: object with:\n"
                    "      one_liner_hook: A single compelling sentence that could open a cold email about this company (<160 chars)\n"
                    "      strongest_signal: The most actionable signal for outreach, explained in 1-2 sentences\n"
                    "      recommended_angle: 2-3 sentences on the best approach angle for outreach given the signals\n"
                    "      conversation_starters: array of 3 specific opening lines a job seeker could use in outreach\n"
                    "      signal_relevance: array of 2 sentences explaining why these signals matter for the job seeker\n"
                    "      sequence_strategy: array of 3 objects, one per email in a 3-email campaign sequence:\n"
                    "        { email_number: 1|2|3, angle: string (the approach angle for this email, ~40 chars), subject_line: string, key_point: string (~100 chars describing what to emphasize) }\n"
                    "        Email 1: lead with the strongest signal/hook. Email 2: follow up with a different angle (company news, mutual interest). Email 3: breakup email with a soft CTA.\n"
                    "    - executive_summary: 3-5 sentence executive briefing on the company's current trajectory and what it means for outreach\n"
                    "    - overall_relevance_score: float 0.0-1.0 (how relevant is this company to the job seeker based on signals)\n"
                    "- hooks: array of short talking points for outreach\n"
                ),
            },
            {"role": "user", "content": json.dumps({**corpus, "selected_contacts": contacts_dump})},
        ]

        raw = client.run_chat_completion(messages, temperature=0.2, max_tokens=6144, stub_json=stub_json, timeout_seconds=120)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or stub_json

        rb = data.get("research_by_contact") or stub_json["research_by_contact"]
        hooks = data.get("hooks") or stub_json["hooks"]

        research_by_contact: Dict[str, ResearchData] = {}
        for cid, entry in (rb.items() if isinstance(rb, dict) else []):
            if not isinstance(entry, dict):
                continue
            cs = entry.get("company_summary") or {}
            if not isinstance(cs, dict):
                cs = {}
            bios = entry.get("contact_bios") or []
            if not isinstance(bios, list):
                bios = []
            news = entry.get("recent_news") or []
            if not isinstance(news, list):
                news = []
            theme = str(entry.get("theme") or "").strip()
            culture_values = str(entry.get("company_culture_values") or "").strip()
            market_position = str(entry.get("company_market_position") or "").strip()
            product_launches = str(entry.get("company_product_launches") or "").strip()
            leadership_changes = str(entry.get("company_leadership_changes") or "").strip()
            other_hiring_signals = str(entry.get("company_other_hiring_signals") or "").strip()
            recent_posts = str(entry.get("company_recent_posts") or "").strip()
            publications = str(entry.get("company_publications") or "").strip()
            connections = entry.get("shared_connections") or []
            report_title = str(entry.get("background_report_title") or "Contact Background Report").strip() or "Contact Background Report"
            report_sections = entry.get("background_report_sections") or []
            if not isinstance(report_sections, list):
                report_sections = []
            report_sections = [s for s in report_sections if isinstance(s, dict)]

            # If the model didn't populate interesting_facts well, fill from serper hits (source-backed).
            try:
                topics_for_contact = {}
                try:
                    topics_for_contact = (corpus.get("contact_serper_by_topic") or {}).get(str(cid), {}) if isinstance(corpus, dict) else {}
                except Exception:
                    topics_for_contact = {}
                all_hits = []
                if isinstance(topics_for_contact, dict):
                    for k in ["posts", "talks", "publications", "linkedin", "general"]:
                        all_hits.extend(topics_for_contact.get(k) or [])
                li_best = _best_linkedin_from_hits(all_hits)
                facts_fallback = _contact_facts_from_hits(all_hits, max_items=6)
                if bios and isinstance(bios, list) and isinstance(bios[0], dict):
                    b0 = bios[0]
                    cur_facts = b0.get("interesting_facts") or []
                    if not isinstance(cur_facts, list):
                        cur_facts = []
                    if len(cur_facts) < 3 and facts_fallback:
                        existing_urls = {str(f.get("source_url") or "").lower() for f in cur_facts if isinstance(f, dict)}
                        for fb in facts_fallback:
                            if str(fb.get("source_url") or "").lower() not in existing_urls:
                                cur_facts.append(fb)
                                existing_urls.add(str(fb.get("source_url") or "").lower())
                        b0["interesting_facts"] = cur_facts[:8]
                    if li_best and not str(b0.get("linkedin_url") or "").strip():
                        b0["linkedin_url"] = li_best
            except Exception:
                pass

            # Ensure theme is always populated (theme is NOT news).
            try:
                if not theme:
                    pains = [str(x) for x in (corpus.get("job_pain_points") or []) if str(x).strip()]
                    succ = [str(x) for x in (corpus.get("job_success_metrics") or []) if str(x).strip()]
                    plan: List[str] = []
                    if pains:
                        plan.append(f"- Priority: {pains[0]}")
                    if succ:
                        plan.append(f"- Outcome: {succ[0]}")
                    plan.append("- Mini-plan: diagnose → ship 1 quick win → measure → iterate")
                    plan = plan[:3]

                    theme = (
                        f"Priorities (based on the role context, not specific news):\n" + "\n".join(plan)
                    ).strip()
            except Exception:
                pass

            theme = _strip_likely_language(theme)

            # Enforce: recent_news should only contain actual news with real URLs.
            cleaned_news: List[Dict[str, Any]] = []
            try:
                for n in (news if isinstance(news, list) else []):
                    if not isinstance(n, dict):
                        continue
                    title = str(n.get("title") or "").strip()
                    url = str(n.get("url") or "").strip()
                    source = str(n.get("source") or "").strip()
                    if title.lower().startswith("theme:"):
                        continue
                    if not url:
                        continue
                    if source.lower() == "general_knowledge":
                        continue
                    cleaned_news.append(n)
            except Exception:
                cleaned_news = []
            news = cleaned_news

            # Ensure culture is always populated in LLM mode (use safe, non-claiming defaults).
            # Market position should be sourced; avoid generic "likely/may" filler in demos.
            try:
                if not culture_values:
                    culture_values = ""
                # Only fill market_position when we had web sources; otherwise keep empty (the UI can prompt to configure SERPER).
                if not market_position and corpus.get("serper_hits"):
                    market_position = ""
                # Do not inject "mode" guidance strings into data fields.
                # If we have web sources, ensure these fields are populated from Serper even if the LLM left them blank.
                has_serper = bool(corpus.get("serper_hits")) or bool(corpus.get("company_serper_by_topic"))
                if has_serper:
                    topics = corpus.get("company_serper_by_topic") or {}
                    # Force source-backed output for these fields to avoid generic "likely" copy.
                    market_position = _bullets_from_serper_hits(
                        (topics.get("market") or []),
                        max_items=7,
                        label="Market position / competitors (source-backed)",
                    )
                    culture_values = _bullets_from_serper_hits(
                        (topics.get("culture") or topics.get("overview") or []),
                        max_items=7,
                        label="Culture / values signals (source-backed)",
                    )
                    if not product_launches:
                        product_launches = _bullets_from_serper_hits(
                            (topics.get("product_launches") or topics.get("product") or []),
                            max_items=6,
                            label="Recent product launches / announcements (source-backed)",
                        )
                    if not leadership_changes:
                        leadership_changes = _bullets_from_serper_hits(
                            (topics.get("leadership") or []),
                            max_items=6,
                            label="Leadership moves (source-backed)",
                        )
                    if not publications:
                        publications = _bullets_from_serper_hits(
                            (topics.get("publications") or topics.get("posts") or []),
                            max_items=6,
                            label="Publications / case studies / reports (source-backed)",
                        )
                    if not other_hiring_signals:
                        # "Other hiring signals" should come from the internet ("tea") — not the role description.
                        other_hiring_signals = _bullets_from_serper_hits(
                            (topics.get("signals") or topics.get("hiring") or topics.get("funding") or []),
                            max_items=8,
                            label="Other hiring signals to verify (source-backed)",
                        )
                else:
                    product_launches = ""
                    leadership_changes = ""
                    publications = ""
                    other_hiring_signals = ""
                    market_position = ""
                    culture_values = ""
                    recent_posts = ""

                if not market_position:
                    market_position = ""
                if not culture_values:
                    culture_values = ""
            except Exception:
                pass

            research_by_contact[str(cid)] = ResearchData(
                company_summary=CompanySummary(
                    name=str(cs.get("name") or request.company_name),
                    description=str(cs.get("description") or "Unknown"),
                    industry=str(cs.get("industry") or "Unknown"),
                    size=str(cs.get("size") or "Unknown"),
                    founded=str(cs.get("founded") or "Unknown"),
                    headquarters=str(cs.get("headquarters") or "Unknown"),
                    website=str(cs.get("website") or (corpus.get("website") or "Unknown")),
                    linkedin_url=(str(cs.get("linkedin_url")).strip() if cs.get("linkedin_url") else (corpus.get("linkedin_company") or None)),
                ),
                contact_bios=[
                    ContactBio(
                        name=str(b.get("name") or ""),
                        title=str(b.get("title") or ""),
                        company=str(b.get("company") or request.company_name),
                        bio=str(b.get("bio") or ""),
                        experience=str(b.get("experience") or ""),
                        education=str(b.get("education") or ""),
                        skills=_safe_str_list(b.get("skills")),
                        linkedin_url=b.get("linkedin_url"),
                        public_profile_highlights=_safe_str_list(b.get("public_profile_highlights"))[:8],
                        publications=_safe_str_list(b.get("publications"))[:6],
                        post_topics=_safe_str_list(b.get("post_topics"))[:10],
                        opinions=_safe_str_list(b.get("opinions"))[:8],
                        other_interesting_facts=_safe_str_list(b.get("other_interesting_facts"))[:8],
                        interesting_facts=[
                            {
                                "fact": str((x or {}).get("fact") or "").strip(),
                                "source_title": str((x or {}).get("source_title") or "").strip(),
                                "source_url": str((x or {}).get("source_url") or "").strip(),
                                "signal_type": str((x or {}).get("signal_type") or "").strip(),
                            }
                            for x in (b.get("interesting_facts") or [])
                            if isinstance(x, dict) and str((x or {}).get("fact") or "").strip()
                        ][:8],
                        outreach_angles=_safe_str_list(b.get("outreach_angles"))[:4],
                        urgency_score=min(100, max(0, int(b.get("urgency_score") or 0))),
                        urgency_reason=str(b.get("urgency_reason") or "").strip(),
                    )
                    for b in bios
                    if isinstance(b, dict)
                ],
                theme=_strip_likely_language(theme),
                company_culture_values=_strip_likely_language(culture_values),
                company_market_position=_strip_likely_language(market_position),
                company_product_launches=_strip_likely_language(product_launches),
                company_leadership_changes=_strip_likely_language(leadership_changes),
                company_other_hiring_signals=_strip_likely_language(other_hiring_signals),
                company_recent_posts=_strip_likely_language(recent_posts),
                company_publications=_strip_likely_language(publications),
                recent_news=[
                    RecentNews(
                        title=str(n.get("title") or ""),
                        summary=str(n.get("summary") or ""),
                        date=str(n.get("date") or ""),
                        source=str(n.get("source") or ""),
                        url=str(n.get("url") or ""),
                    )
                    for n in news
                    if isinstance(n, dict)
                ],
                shared_connections=[],
                background_report_title=report_title,
                background_report_sections=report_sections[:24],
                intelligence=_merge_intelligence(
                    _parse_intelligence(entry.get("intelligence")),
                    signaliz_data,
                ),
                company_signals=_safe_company_signals(
                    corpus.get("pdl_company_enrich") or {},
                    signaliz_data,
                    entry,
                    cs,
                ),
            )

        # Back-compat: also return a single research_data (first contact).
        first_id = contacts[0].id if contacts else (request.contact_ids[0] if request.contact_ids else "")
        research_data = research_by_contact.get(first_id) if first_id else None

        resp_obj = ResearchResponse(
            success=True,
            message="Research completed successfully",
            research_data=research_data,
            research_by_contact=research_by_contact,
            helper={
                "hooks": [str(h) for h in hooks][:6],
                "research_scope": scope_label,
                "scope_target": scope_target,
                "corpus_preview": {
                    "serper_hits": corpus.get("serper_hits", []),
                    "pdl_company_enrich": corpus.get("pdl_company_enrich", {}),
                },
            },
        )
        _cache_set(ck, resp_obj.model_dump() if hasattr(resp_obj, "model_dump") else resp_obj.dict())
        return resp_obj
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error("conduct_research failed: %s\n%s", e, tb)
        short_tb = "\n".join(tb.strip().splitlines()[-5:])
        raise HTTPException(
            status_code=500,
            detail=f"Failed to conduct research: {str(e)}\n{short_tb}",
        )

@router.post("/save", response_model=ResearchResponse)
async def save_research_data(research_data: ResearchData):
    """
    Save research data for a user.
    """
    try:
        # In a real app, save to database with user_id
        return ResearchResponse(
            success=True,
            message="Research data saved successfully",
            research_data=research_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save research data: {str(e)}")

@router.get("/{user_id}", response_model=ResearchResponse)
async def get_research_data(user_id: str):
    """
    Get research data for a user.
    """
    try:
        # In a real app, fetch from database
        # For now, return mock data (no fabricated shared connections).
        mock_research_data = ResearchData(
            company_summary=CompanySummary(
                name="TechCorp Inc.",
                description="TechCorp is a leading enterprise software company specializing in cloud infrastructure solutions.",
                industry="Enterprise Software",
                size="501-1,000 employees",
                founded="2015",
                headquarters="San Francisco, CA",
                website="https://techcorp.com",
                linkedin_url="https://linkedin.com/company/techcorp"
            ),
            contact_bios=[
                ContactBio(
                    name="Sarah Johnson",
                    title="VP of Engineering",
                    company="TechCorp Inc.",
                    bio="Sarah Johnson is a VP of Engineering with extensive experience in technology leadership.",
                    experience="10+ years in technology leadership roles",
                    education="MBA from Stanford University",
                    skills=["Leadership", "Strategic Planning", "Team Management"],
                    linkedin_url="https://linkedin.com/in/sarahjohnson"
                )
            ],
            theme=(
                "Theme: What the company cares about: Reference a plausible priority (customer experience, reliability, speed, cost) "
                "and offer a 2–3 bullet mini-plan—without claiming a specific news event.\n"
                "- Start with a concrete customer outcome + one KPI\n"
                "- Propose a low-risk first sprint (instrument → ship → measure)\n"
                "- Close with a weekly reporting cadence"
            ),
            company_culture_values="",
            company_market_position="",
            company_product_launches="",
            company_leadership_changes="",
            company_other_hiring_signals="",
            company_recent_posts="",
            company_publications="",
            recent_news=[
                RecentNews(
                    title="TechCorp Announces $50M Series C Funding Round",
                    summary="The company plans to use the funding to expand its engineering team.",
                    date="2024-01-15",
                    source="TechCrunch",
                    url="https://techcrunch.com/techcorp-funding"
                )
            ],
            shared_connections=[]
        )
        
        return ResearchResponse(
            success=True,
            message="Research data retrieved successfully",
            research_data=mock_research_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get research data: {str(e)}")

@router.put("/{user_id}", response_model=ResearchResponse)
async def update_research_data(user_id: str, research_data: ResearchData):
    """
    Update research data for a user.
    """
    try:
        # In a real app, update in database
        return ResearchResponse(
            success=True,
            message="Research data updated successfully",
            research_data=research_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update research data: {str(e)}")

@router.delete("/{user_id}")
async def delete_research_data(user_id: str):
    """
    Delete research data for a user.
    """
    try:
        # In a real app, delete from database
        return {"success": True, "message": "Research data deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete research data: {str(e)}")

@router.get("/variables/{user_id}")
async def get_available_variables(user_id: str):
    """
    Get available variables for email templates.
    """
    try:
        # In a real app, this would return actual variable data
        variables = {
            "company_summary": "Company description and key information",
            "contact_bio": "Contact's professional background and experience",
            "recent_news": "Latest news and updates about the company",
            "company_theme": "Theme: what the company likely cares about + mini-plan (not news)",
            "company_product_launches": "Recent product launches/releases (best-effort, sourced when possible)",
            "company_leadership_changes": "Leadership changes / exec moves (best-effort, sourced when possible)",
            "company_other_hiring_signals": "Other hiring signals beyond open roles (best-effort, sourced when possible)",
            "company_recent_posts": "Recent company posts/topics (blog/press/LinkedIn) with links when possible",
            "company_publications": "Publications (whitepapers/case studies/reports) with links when possible",
            "shared_connections": "Mutual connections and relationships",
            "company_industry": "Company's industry and sector",
            "company_size": "Number of employees and company size",
            "company_headquarters": "Company's main office location"
        }
        
        return {
            "success": True,
            "variables": variables,
            "message": "Available variables retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get variables: {str(e)}")
