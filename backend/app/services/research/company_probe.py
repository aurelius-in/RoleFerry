from typing import Dict, Any, List


async def probe(company: str, jd_url: str | None = None) -> Dict[str, Any]:
    # Stub: return concise problems with placeholder links
    items: List[Dict[str, str]] = [
        {"problem": f"Growth plateau at {company}", "evidence": "Q2 Newsroom", "link": "https://example.com/news"},
        {"problem": "Attrition in PM org", "evidence": "Glassdoor snippet", "link": "https://example.com/reviews"},
        {"problem": "Onboarding velocity issues", "evidence": "Engineering blog", "link": "https://example.com/eng"},
    ]
    return {"company": company, "problems": items}


