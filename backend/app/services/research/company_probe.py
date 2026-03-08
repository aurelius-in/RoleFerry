from typing import Dict, Any, List
from ...services.serper_client import serper_web_search
from ...clients.openai_client import get_openai_client, extract_json_from_text
import json


async def probe(company: str, jd_url: str | None = None) -> Dict[str, Any]:
    """
    Research real business problems/challenges for a company using web search
    and LLM summarization. Returns at least 3 items when possible.
    """
    company = (company or "").strip()
    if not company:
        return {"company": company, "problems": []}

    queries = [
        f'"{company}" challenges OR problems OR priorities site:glassdoor.com OR site:linkedin.com',
        f'"{company}" strategy OR roadmap OR growth 2025 2026',
        f'"{company}" hiring OR team OR scaling',
    ]

    snippets: List[str] = []
    urls: List[str] = []
    for q in queries:
        hits = serper_web_search(q, num=4)
        for h in hits:
            s = str(h.get("snippet") or "").strip()
            u = str(h.get("url") or "").strip()
            t = str(h.get("title") or "").strip()
            if s:
                snippets.append(f"{t}: {s}" if t else s)
            if u:
                urls.append(u)

    client = get_openai_client()
    if snippets and client.should_use_real_llm:
        corpus = "\n".join(snippets[:12])
        messages = [
            {
                "role": "system",
                "content": (
                    "You extract business problems/challenges for a company from web snippets.\n"
                    "Return ONLY JSON: {\"problems\": [{\"problem\": str, \"evidence\": str, \"link\": str}, ...]}\n"
                    "Rules:\n"
                    "- Return 3-5 problems that a job seeker could reference in outreach.\n"
                    "- Each problem should be a concise statement (10-20 words).\n"
                    "- Evidence should cite the source snippet.\n"
                    "- Link should be a real URL from the snippets.\n"
                    "- If you cannot find 3 real problems, infer likely challenges from the "
                    "company's industry and context, but label evidence as 'Inferred from context'.\n"
                    "- ALWAYS return at least 3 items.\n"
                ),
            },
            {
                "role": "user",
                "content": f"Company: {company}\nSnippets:\n{corpus}\nURLs: {json.dumps(urls[:6])}",
            },
        ]
        try:
            raw = client.run_chat_completion(
                messages, temperature=0.2, max_tokens=500,
                stub_json=_fallback(company, urls),
            )
            choices = raw.get("choices") or []
            msg = (choices[0].get("message") if choices else {}) or {}
            parsed = extract_json_from_text(str(msg.get("content") or "")) or {}
            problems = parsed.get("problems")
            if isinstance(problems, list) and len(problems) >= 2:
                return {"company": company, "problems": problems[:6]}
        except Exception:
            pass

    if snippets:
        items: List[Dict[str, str]] = []
        for i, s in enumerate(snippets[:3]):
            items.append({
                "problem": s[:120],
                "evidence": "Web search",
                "link": urls[i] if i < len(urls) else "",
            })
        return {"company": company, "problems": items}

    return {"company": company, "problems": _fallback(company, urls).get("problems", [])}


def _fallback(company: str, urls: List[str]) -> Dict[str, Any]:
    return {
        "problems": [
            {
                "problem": f"Scaling operations and team growth at {company}",
                "evidence": "Inferred from hiring activity",
                "link": urls[0] if urls else "",
            },
            {
                "problem": f"Competitive positioning in {company}'s market segment",
                "evidence": "Inferred from context",
                "link": urls[1] if len(urls) > 1 else "",
            },
            {
                "problem": f"Attracting and retaining top talent at {company}",
                "evidence": "Inferred from context",
                "link": urls[2] if len(urls) > 2 else "",
            },
        ]
    }
