from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import re

router = APIRouter()
from ..clients.openai_client import get_openai_client, extract_json_from_text

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

class RecentNews(BaseModel):
    title: str
    summary: str
    date: str
    source: str
    url: str

class ResearchData(BaseModel):
    company_summary: CompanySummary
    contact_bios: List[ContactBio]
    recent_news: List[RecentNews]
    shared_connections: List[str]

class ResearchRequest(BaseModel):
    contact_ids: List[str]
    company_name: str
    # Optional: pass selected job context so we can research the right org unit for large companies.
    selected_job_description: Optional[Dict[str, Any]] = None

class ResearchResponse(BaseModel):
    success: bool
    message: str
    research_data: Optional[ResearchData] = None
    helper: Optional[Dict[str, Any]] = None

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

        # Build a realistic mock "research corpus" (what a real provider pipeline would fetch).
        # GPT then summarizes this corpus into structured fields for the UI.
        company_slug = company.lower().replace(" ", "")
        corpus = {
            "company_name": company,
            "research_scope": scope_label,
            "scope_target": scope_target,
            "job_title": jd_title,
            "job_required_skills": jd.get("required_skills") or [],
            "job_pain_points": jd.get("pain_points") or [],
            "job_success_metrics": jd.get("success_metrics") or [],
            "about": (
                (
                    f"{company} is a large organization. This research is focused on the {org_unit} org and its priorities."
                    if scope_label == "division"
                    else f"{company} builds cloud infrastructure and analytics software for enterprise teams."
                )
            ),
            "product_bullets": [
                "Event instrumentation SDK + schema governance",
                "Funnel + cohort analytics with attribution",
                "Role-based dashboards for execs and operators",
            ],
            "recent_news_raw": [
                {
                    "title": f"{scope_target} expands into EMEA with new enterprise partnerships",
                    "snippet": "The company announced new channel partnerships and a roadmap focused on faster onboarding and improved retention analytics.",
                    "date": "2024-01-15",
                    "source": "TechCrunch",
                    "url": "https://techcrunch.com/funding-news",
                },
                {
                    "title": f"{scope_target} launches an AI-assisted analytics workflow",
                    "snippet": "A new feature helps teams explain dashboard changes and propose next steps based on trends.",
                    "date": "2024-01-10",
                    "source": "VentureBeat",
                    "url": "https://venturebeat.com/ai-platform",
                },
            ],
            "contacts_raw": [
                {
                    "name": "Sarah Johnson",
                    "title": "VP of Engineering",
                    "company": company,
                    "linkedin_url": "https://linkedin.com/in/sarahjohnson",
                    "highlights": [
                        "Scaled a platform team from 6 to 20 engineers",
                        "Prioritized reliability, cost, and developer experience",
                    ],
                }
            ],
            "shared_connections_raw": [
                "John Smith (former colleague at StartupXYZ)",
                "Sarah Wilson (mutual Stanford connection)",
                "Mike Johnson (met at industry conference)",
            ],
            "website": f"https://{company_slug}.com",
            "linkedin_company": f"https://linkedin.com/company/{company_slug}",
            "requested_contact_ids": request.contact_ids,
        }

        client = get_openai_client()
        # GPT-first summarization (stub returns JSON as well).
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a company + contact research summarizer for outreach.\n\n"
                    "Given a research corpus JSON (raw provider outputs), produce a clean structured summary.\n"
                    "If research_scope is 'division', focus the company_summary on the scope_target org (division/team), "
                    "not the entire company.\n"
                    "Return ONLY a JSON object with keys:\n"
                    "- company_summary: { name, description, industry, size, founded, headquarters, website, linkedin_url }\n"
                    "- contact_bios: array of { name, title, company, bio, experience, education, skills, linkedin_url }\n"
                    "- recent_news: array of { title, summary, date, source, url }\n"
                    "- shared_connections: array of strings\n"
                    "- hooks: array of short talking points for outreach\n"
                ),
            },
            {"role": "user", "content": json.dumps(corpus)},
        ]
        stub_json = {
            "company_summary": {
                "name": scope_target,
                "description": corpus["about"],
                "industry": "Enterprise Software",
                "size": "501-1,000 employees",
                "founded": "2015",
                "headquarters": "San Francisco, CA",
                "website": corpus["website"],
                "linkedin_url": corpus["linkedin_company"],
            },
            "contact_bios": [
                {
                    "name": "Sarah Johnson",
                    "title": "VP of Engineering",
                    "company": company,
                    "bio": "Engineering leader focused on reliability, cost efficiency, and team scaling.",
                    "experience": "10+ years leading platform and product engineering teams.",
                    "education": "MBA Stanford; BS Computer Science UC Berkeley",
                    "skills": ["Leadership", "Platform engineering", "Reliability", "Hiring"],
                    "linkedin_url": "https://linkedin.com/in/sarahjohnson",
                }
            ],
            "recent_news": [
                {
                    "title": corpus["recent_news_raw"][0]["title"],
                    "summary": "Expansion plus roadmap emphasis on faster onboarding and retention analytics.",
                    "date": corpus["recent_news_raw"][0]["date"],
                    "source": corpus["recent_news_raw"][0]["source"],
                    "url": corpus["recent_news_raw"][0]["url"],
                },
                {
                    "title": corpus["recent_news_raw"][1]["title"],
                    "summary": "AI-assisted analytics to explain changes and suggest next best actions.",
                    "date": corpus["recent_news_raw"][1]["date"],
                    "source": corpus["recent_news_raw"][1]["source"],
                    "url": corpus["recent_news_raw"][1]["url"],
                },
            ],
            "shared_connections": corpus["shared_connections_raw"],
            "hooks": [
                "Focus outreach on the specific team’s outcomes, not generic company mission statements",
                "Reference a relevant initiative/news item tied to the org’s domain",
                "Offer a concrete 2–3 bullet plan aligned to the job’s pain points",
            ],
        }

        raw = client.run_chat_completion(messages, temperature=0.2, max_tokens=900, stub_json=stub_json)
        choices = raw.get("choices") or []
        msg = (choices[0].get("message") if choices else {}) or {}
        content_str = str(msg.get("content") or "")
        data = extract_json_from_text(content_str) or stub_json

        cs = data.get("company_summary") or stub_json["company_summary"]
        bios = data.get("contact_bios") or stub_json["contact_bios"]
        news = data.get("recent_news") or stub_json["recent_news"]
        connections = data.get("shared_connections") or stub_json["shared_connections"]
        hooks = data.get("hooks") or stub_json["hooks"]

        mock_research_data = ResearchData(
            company_summary=CompanySummary(
                name=str(cs.get("name") or request.company_name),
                description=str(cs.get("description") or corpus["about"]),
                industry=str(cs.get("industry") or "Enterprise Software"),
                size=str(cs.get("size") or "501-1,000 employees"),
                founded=str(cs.get("founded") or "2015"),
                headquarters=str(cs.get("headquarters") or "San Francisco, CA"),
                website=str(cs.get("website") or corpus["website"]),
                linkedin_url=str(cs.get("linkedin_url") or corpus["linkedin_company"]),
            ),
            contact_bios=[
                ContactBio(
                    name=str(b.get("name") or ""),
                    title=str(b.get("title") or ""),
                    company=str(b.get("company") or request.company_name),
                    bio=str(b.get("bio") or ""),
                    experience=str(b.get("experience") or ""),
                    education=str(b.get("education") or ""),
                    skills=[str(s) for s in (b.get("skills") or [])],
                    linkedin_url=b.get("linkedin_url"),
                )
                for b in bios
                if isinstance(b, dict)
            ],
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
            shared_connections=[str(x) for x in connections],
        )
        
        return ResearchResponse(
            success=True,
            message="Research completed successfully",
            research_data=mock_research_data,
            helper={
                "hooks": hooks,
                "research_scope": scope_label,
                "scope_target": scope_target,
                "corpus_preview": {
                    "product_bullets": corpus.get("product_bullets", []),
                    "recent_news_raw": corpus.get("recent_news_raw", []),
                },
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to conduct research: {str(e)}")

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
        # For now, return mock data
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
            recent_news=[
                RecentNews(
                    title="TechCorp Announces $50M Series C Funding Round",
                    summary="The company plans to use the funding to expand its engineering team.",
                    date="2024-01-15",
                    source="TechCrunch",
                    url="https://techcrunch.com/techcorp-funding"
                )
            ],
            shared_connections=[
                "John Smith (Former colleague)",
                "Sarah Wilson (Mutual connection)"
            ]
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
