"""
FastAPI router for documentation services
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from ..services.documentation import (
    DocumentationService,
    DocumentationSection
)

router = APIRouter()
documentation_service = DocumentationService()

@router.get("/overview")
async def get_overview_documentation() -> DocumentationSection:
    """Get overview documentation"""
    return documentation_service.generate_overview_documentation()

@router.get("/architecture")
async def get_architecture_documentation() -> DocumentationSection:
    """Get architecture documentation"""
    return documentation_service.generate_architecture_documentation()

@router.get("/workflow")
async def get_workflow_documentation() -> DocumentationSection:
    """Get workflow documentation"""
    return documentation_service.generate_workflow_documentation()

@router.get("/features")
async def get_features_documentation() -> DocumentationSection:
    """Get features documentation"""
    return documentation_service.generate_features_documentation()

@router.get("/api")
async def get_api_documentation() -> DocumentationSection:
    """Get API documentation"""
    return documentation_service.generate_api_documentation()

@router.get("/deployment")
async def get_deployment_documentation() -> DocumentationSection:
    """Get deployment documentation"""
    return documentation_service.generate_deployment_documentation()

@router.get("/testing")
async def get_testing_documentation() -> DocumentationSection:
    """Get testing documentation"""
    return documentation_service.generate_testing_documentation()

@router.get("/troubleshooting")
async def get_troubleshooting_documentation() -> DocumentationSection:
    """Get troubleshooting documentation"""
    return documentation_service.generate_troubleshooting_documentation()

@router.get("/complete")
async def get_complete_documentation() -> List[DocumentationSection]:
    """Get complete documentation"""
    return documentation_service.generate_complete_documentation()

@router.get("/user-guide")
async def get_user_guide() -> Dict[str, Any]:
    """Get user guide"""
    return documentation_service.generate_user_guide()

@router.get("/developer-guide")
async def get_developer_guide() -> Dict[str, Any]:
    """Get developer guide"""
    return documentation_service.generate_developer_guide()

@router.get("/admin-guide")
async def get_admin_guide() -> Dict[str, Any]:
    """Get admin guide"""
    return documentation_service.generate_admin_guide()

@router.get("/troubleshooting-guide")
async def get_troubleshooting_guide() -> Dict[str, Any]:
    """Get troubleshooting guide"""
    return documentation_service.generate_troubleshooting_guide()

@router.get("/faq")
async def get_faq() -> Dict[str, Any]:
    """Get FAQ"""
    return documentation_service.generate_faq()

@router.get("/wireframe-documentation")
async def get_wireframe_documentation() -> Dict[str, Any]:
    """Get wireframe documentation"""
    return {
        "overview": {
            "title": "Wireframe Documentation",
            "description": "Comprehensive documentation for all RoleFerry wireframes and user interface components."
        },
        "wireframes": {
            "homepage": {
                "title": "Homepage Wireframe",
                "description": "Main landing page with 3x3 keypad navigation and mode toggle",
                "features": ["Keypad-style navigation", "Mode toggle", "Progress tracking", "Responsive design"],
                "file": "docs/index.html"
            },
            "job_preferences": {
                "title": "Job Preferences Wireframe",
                "description": "Form for setting job preferences or ideal client profile",
                "features": ["Dynamic labeling", "Form validation", "Data persistence", "Responsive design"],
                "file": "docs/wireframes/job-preferences.html"
            },
            "candidate_profile": {
                "title": "Candidate Profile Wireframe",
                "description": "Resume upload and AI parsing interface",
                "features": ["File upload", "AI parsing simulation", "Data display", "Edit functionality"],
                "file": "docs/wireframes/candidate-profile.html"
            },
            "job_descriptions": {
                "title": "Job Descriptions Wireframe",
                "description": "Job description import and analysis interface",
                "features": ["URL import", "Text input", "AI parsing", "Data extraction"],
                "file": "docs/wireframes/job-descriptions.html"
            },
            "pinpoint_match": {
                "title": "Pinpoint Match Wireframe",
                "description": "AI-powered matching and scoring interface",
                "features": ["Alignment scoring", "Match breakdown", "Visual indicators", "Detailed analysis"],
                "file": "docs/wireframes/pinpoint-match.html"
            },
            "find_contact": {
                "title": "Find Contact Wireframe",
                "description": "Contact search and verification interface",
                "features": ["Contact search", "Email verification", "Confidence scoring", "Contact selection"],
                "file": "docs/wireframes/find-contact.html"
            },
            "context_research": {
                "title": "Context Research Wireframe",
                "description": "Company and contact research interface",
                "features": ["Auto-pulled summaries", "Editable content", "Variable placeholders", "Research insights"],
                "file": "docs/wireframes/context-research.html"
            },
            "offer_creation": {
                "title": "Offer Creation Wireframe",
                "description": "Personalized offer generation interface",
                "features": ["Tone selection", "Content generation", "Editable offers", "Format options"],
                "file": "docs/wireframes/offer-creation.html"
            },
            "compose": {
                "title": "Compose Wireframe",
                "description": "Email composition and editing interface",
                "features": ["Email generation", "Variable substitution", "Jargon clarity", "Tone selection"],
                "file": "docs/wireframes/compose.html"
            },
            "campaign": {
                "title": "Campaign Wireframe",
                "description": "Email campaign creation and management interface",
                "features": ["Multi-email sequences", "Timing controls", "Deliverability checks", "Campaign management"],
                "file": "docs/wireframes/campaign.html"
            },
            "deliverability_launch": {
                "title": "Deliverability Launch Wireframe",
                "description": "Pre-flight checks and campaign launch interface",
                "features": ["Pre-flight checks", "Email verification", "Spam score", "Launch controls"],
                "file": "docs/wireframes/deliverability-launch.html"
            }
        },
        "design_system": {
            "colors": {
                "primary": "#2563eb",
                "secondary": "#10b981",
                "accent": "#f59e0b",
                "background": "#0a0a0a",
                "surface": "#1a1a1a",
                "text": "#ffffff",
                "text_secondary": "#9ca3af"
            },
            "typography": {
                "heading": "Inter, system-ui, sans-serif",
                "body": "Inter, system-ui, sans-serif",
                "monospace": "Courier New, monospace"
            },
            "spacing": {
                "xs": "0.25rem",
                "sm": "0.5rem",
                "md": "1rem",
                "lg": "1.5rem",
                "xl": "2rem",
                "2xl": "3rem"
            },
            "breakpoints": {
                "mobile": "480px",
                "tablet": "768px",
                "desktop": "1024px",
                "wide": "1280px"
            }
        },
        "accessibility": {
            "standards": "WCAG AA compliance",
            "features": [
                "ARIA labels and roles",
                "Keyboard navigation",
                "Screen reader support",
                "Color contrast compliance",
                "Focus management"
            ]
        },
        "responsive_design": {
            "mobile_first": "Design optimized for mobile devices first",
            "breakpoints": "Responsive design for all screen sizes",
            "touch_friendly": "Touch-optimized interactions for mobile",
            "performance": "Optimized for fast loading on all devices"
        }
    }

@router.get("/workflow-documentation")
async def get_workflow_documentation() -> Dict[str, Any]:
    """Get workflow documentation"""
    return {
        "overview": {
            "title": "10-Tab Workflow System",
            "description": "The core workflow system that guides users through the entire process from setup to campaign launch."
        },
        "job_seeker_workflow": {
            "title": "Job Seeker Workflow",
            "description": "Complete workflow for job seekers to find and apply for jobs",
            "steps": [
                {
                    "step": 1,
                    "title": "Job Preferences",
                    "description": "Set your ideal job preferences including industry, role, salary, and location",
                    "actions": ["Select industries", "Choose roles", "Set salary range", "Choose location", "Select work type"]
                },
                {
                    "step": 2,
                    "title": "Resume Upload",
                    "description": "Upload your resume for AI parsing and analysis",
                    "actions": ["Upload resume file", "Review parsed data", "Edit information", "Save profile"]
                },
                {
                    "step": 3,
                    "title": "Job Descriptions",
                    "description": "Import and analyze job descriptions to find matches",
                    "actions": ["Import job description", "Review parsed requirements", "Analyze pain points"]
                },
                {
                    "step": 4,
                    "title": "Pinpoint Match",
                    "description": "AI-powered matching between your profile and job requirements",
                    "actions": ["Review alignment score", "Analyze match breakdown", "Understand fit"]
                },
                {
                    "step": 5,
                    "title": "Find Contact",
                    "description": "Find the right contact person for outreach",
                    "actions": ["Search for contacts", "Review contact info", "Check email verification", "Select contact"]
                },
                {
                    "step": 6,
                    "title": "Context Research",
                    "description": "Research company and contact for personalized outreach",
                    "actions": ["Review company summary", "Check contact bio", "Read recent news", "Edit information"]
                },
                {
                    "step": 7,
                    "title": "Offer Creation",
                    "description": "Create a personalized offer that provides value",
                    "actions": ["Select tone", "Review generated offer", "Edit content", "Save offer"]
                },
                {
                    "step": 8,
                    "title": "Compose Email",
                    "description": "Compose personalized email using offer and context",
                    "actions": ["Select email tone", "Review generated email", "Edit content", "Use jargon clarity"]
                },
                {
                    "step": 9,
                    "title": "Campaign",
                    "description": "Create follow-up email campaign",
                    "actions": ["Review generated emails", "Edit content", "Set timing", "Check deliverability"]
                },
                {
                    "step": 10,
                    "title": "Launch",
                    "description": "Launch campaign with pre-flight checks",
                    "actions": ["Review pre-flight checks", "Verify email", "Check spam score", "Launch campaign"]
                }
            ]
        },
        "recruiter_workflow": {
            "title": "Recruiter Workflow",
            "description": "Complete workflow for recruiters to find and reach out to candidates",
            "steps": [
                {
                    "step": 1,
                    "title": "Ideal Client Profile",
                    "description": "Define your ideal client profile for candidate matching",
                    "actions": ["Select target industries", "Choose company sizes", "Set geographic preferences", "Define budget"]
                },
                {
                    "step": 2,
                    "title": "Job Descriptions",
                    "description": "Upload and analyze job descriptions",
                    "actions": ["Import job description", "Review parsed requirements", "Analyze pain points"]
                },
                {
                    "step": 3,
                    "title": "Candidate Profile",
                    "description": "Upload candidate resume for AI parsing",
                    "actions": ["Upload candidate resume", "Review parsed data", "Edit information", "Save profile"]
                },
                {
                    "step": 4,
                    "title": "Pinpoint Match",
                    "description": "AI-powered matching between candidate and job requirements",
                    "actions": ["Review alignment score", "Analyze match breakdown", "Understand fit"]
                },
                {
                    "step": 5,
                    "title": "Find Contact",
                    "description": "Find the right contact person for outreach",
                    "actions": ["Search for contacts", "Review contact info", "Check email verification", "Select contact"]
                },
                {
                    "step": 6,
                    "title": "Context Research",
                    "description": "Research company and contact for personalized outreach",
                    "actions": ["Review company summary", "Check contact bio", "Read recent news", "Edit information"]
                },
                {
                    "step": 7,
                    "title": "Offer Creation",
                    "description": "Create a personalized offer that provides value",
                    "actions": ["Select tone", "Review generated offer", "Edit content", "Save offer"]
                },
                {
                    "step": 8,
                    "title": "Compose Email",
                    "description": "Compose personalized email using offer and context",
                    "actions": ["Select email tone", "Review generated email", "Edit content", "Use jargon clarity"]
                },
                {
                    "step": 9,
                    "title": "Campaign",
                    "description": "Create follow-up email campaign",
                    "actions": ["Review generated emails", "Edit content", "Set timing", "Check deliverability"]
                },
                {
                    "step": 10,
                    "title": "Launch",
                    "description": "Launch campaign with pre-flight checks",
                    "actions": ["Review pre-flight checks", "Verify email", "Check spam score", "Launch campaign"]
                }
            ]
        },
        "features": {
            "dual_mode": "Support for both Job Seeker and Recruiter modes",
            "ai_matching": "AI-powered matching and scoring",
            "personalization": "Personalized content generation",
            "automation": "Automated workflows and follow-ups",
            "analytics": "Comprehensive analytics and insights",
            "accessibility": "Full accessibility support",
            "responsive": "Responsive design for all devices",
            "security": "Enterprise-grade security"
        }
    }

@router.get("/api-reference")
async def get_api_reference() -> Dict[str, Any]:
    """Get API reference documentation"""
    return {
        "overview": {
            "title": "API Reference",
            "description": "Comprehensive API reference for all RoleFerry endpoints and functionality."
        },
        "authentication": {
            "title": "Authentication",
            "description": "JWT-based authentication with role-based access control",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/auth/login",
                    "description": "User login with email and password"
                },
                {
                    "method": "POST",
                    "path": "/auth/register",
                    "description": "User registration with email and password"
                },
                {
                    "method": "POST",
                    "path": "/auth/refresh",
                    "description": "Refresh JWT token"
                }
            ]
        },
        "workflow_endpoints": {
            "title": "Workflow Endpoints",
            "description": "Endpoints for the 10-tab workflow system",
            "endpoints": [
                {
                    "method": "GET",
                    "path": "/job-preferences",
                    "description": "Get job preferences"
                },
                {
                    "method": "POST",
                    "path": "/job-preferences",
                    "description": "Create or update job preferences"
                },
                {
                    "method": "POST",
                    "path": "/resume/upload-and-parse",
                    "description": "Upload and parse resume"
                },
                {
                    "method": "POST",
                    "path": "/job-descriptions/parse",
                    "description": "Parse job description"
                },
                {
                    "method": "POST",
                    "path": "/pinpoint-match/calculate",
                    "description": "Calculate alignment score"
                },
                {
                    "method": "POST",
                    "path": "/find-contact",
                    "description": "Find contacts with verification"
                },
                {
                    "method": "GET",
                    "path": "/context-research/summary",
                    "description": "Get company and contact summary"
                },
                {
                    "method": "POST",
                    "path": "/offer-creation/generate",
                    "description": "Generate personalized offer"
                },
                {
                    "method": "POST",
                    "path": "/compose/generate",
                    "description": "Generate email content"
                },
                {
                    "method": "POST",
                    "path": "/campaign/create",
                    "description": "Create email campaign"
                },
                {
                    "method": "POST",
                    "path": "/deliverability-launch/check",
                    "description": "Run pre-flight checks"
                }
            ]
        },
        "utility_endpoints": {
            "title": "Utility Endpoints",
            "description": "Utility endpoints for additional functionality",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/email-verification/verify",
                    "description": "Verify email address"
                },
                {
                    "method": "POST",
                    "path": "/conditional-logic/infer-reports-to",
                    "description": "Infer reports-to relationship"
                },
                {
                    "method": "POST",
                    "path": "/confidence-scoring/calculate-score",
                    "description": "Calculate confidence score"
                },
                {
                    "method": "POST",
                    "path": "/template-engine/render",
                    "description": "Render template with variables"
                },
                {
                    "method": "POST",
                    "path": "/company-size-adaptation/adapt-tone",
                    "description": "Adapt tone based on company size"
                },
                {
                    "method": "POST",
                    "path": "/analytics-tracking/track-event",
                    "description": "Track user event"
                }
            ]
        },
        "error_handling": {
            "title": "Error Handling",
            "description": "Comprehensive error handling with detailed error messages",
            "status_codes": [
                {"code": 200, "meaning": "Success"},
                {"code": 201, "meaning": "Created"},
                {"code": 400, "meaning": "Bad Request"},
                {"code": 401, "meaning": "Unauthorized"},
                {"code": 403, "meaning": "Forbidden"},
                {"code": 404, "meaning": "Not Found"},
                {"code": 422, "meaning": "Validation Error"},
                {"code": 500, "meaning": "Internal Server Error"}
            ]
        }
    }
