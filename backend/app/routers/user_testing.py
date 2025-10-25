"""
FastAPI router for user testing services
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from ..services.user_testing import (
    UserTestingService,
    TestSession,
    TestTask,
    TestResult
)

router = APIRouter()
testing_service = UserTestingService()

@router.post("/create-test-session")
async def create_test_session(user_id: str, workflow_type: str) -> TestSession:
    """Create a new test session"""
    return testing_service.create_test_session(user_id, workflow_type)

@router.post("/start-task")
async def start_task(session_id: str, task_id: str) -> Dict[str, Any]:
    """Start a test task"""
    return testing_service.start_task(session_id, task_id)

@router.post("/complete-task")
async def complete_task(
    session_id: str, 
    task_id: str, 
    result: TestResult
) -> Dict[str, Any]:
    """Complete a test task"""
    return testing_service.complete_task(session_id, task_id, result)

@router.post("/add-feedback")
async def add_feedback(session_id: str, feedback: Dict[str, Any]) -> Dict[str, Any]:
    """Add user feedback to a test session"""
    return testing_service.add_feedback(session_id, feedback)

@router.get("/calculate-metrics/{session_id}")
async def calculate_metrics(session_id: str) -> Dict[str, Any]:
    """Calculate test session metrics"""
    return testing_service.calculate_metrics(session_id)

@router.get("/generate-test-report/{session_id}")
async def generate_test_report(session_id: str) -> Dict[str, Any]:
    """Generate comprehensive test report"""
    return testing_service.generate_test_report(session_id)

@router.get("/test-tasks/{workflow_type}")
async def get_test_tasks(workflow_type: str) -> List[TestTask]:
    """Get test tasks for a specific workflow"""
    return testing_service.get_test_tasks(workflow_type)

@router.get("/test-metrics")
async def get_test_metrics() -> Dict[str, Any]:
    """Get test metrics"""
    return testing_service.get_test_metrics()

@router.get("/user-personas")
async def get_user_personas() -> List[Dict[str, Any]]:
    """Get user personas for testing"""
    return testing_service.generate_user_personas()

@router.get("/testing-scenarios")
async def get_testing_scenarios() -> List[Dict[str, Any]]:
    """Get testing scenarios"""
    return testing_service.generate_testing_scenarios()

@router.get("/testing-plan")
async def get_testing_plan() -> Dict[str, Any]:
    """Get comprehensive testing plan"""
    return testing_service.generate_testing_plan()

@router.get("/usability-checklist")
async def get_usability_checklist() -> Dict[str, List[str]]:
    """Get usability testing checklist"""
    return {
        "navigation": [
            "Is the navigation intuitive?",
            "Can users find what they're looking for?",
            "Is the navigation consistent across pages?",
            "Are there clear visual cues for current location?",
            "Is the navigation accessible via keyboard?"
        ],
        "content": [
            "Is the content clear and understandable?",
            "Are instructions helpful and accurate?",
            "Is the information organized logically?",
            "Are there any confusing or misleading elements?",
            "Is the content accessible to all users?"
        ],
        "forms": [
            "Are form fields clearly labeled?",
            "Is validation helpful and timely?",
            "Are error messages clear and actionable?",
            "Is the form completion process smooth?",
            "Are there any unnecessary fields?"
        ],
        "interactions": [
            "Do buttons and links work as expected?",
            "Are interactive elements clearly identifiable?",
            "Is feedback provided for user actions?",
            "Are there any broken or non-functional elements?",
            "Is the interaction flow logical?"
        ],
        "performance": [
            "Does the application load quickly?",
            "Are there any noticeable delays?",
            "Does the application work on different devices?",
            "Are there any performance issues?",
            "Is the application responsive?"
        ],
        "accessibility": [
            "Can users navigate with keyboard only?",
            "Are screen readers supported?",
            "Is color contrast sufficient?",
            "Are alt texts provided for images?",
            "Is the application usable by people with disabilities?"
        ]
    }

@router.get("/testing-methods")
async def get_testing_methods() -> Dict[str, Any]:
    """Get available testing methods"""
    return {
        "moderated_testing": {
            "description": "Real-time observation with facilitator",
            "benefits": ["Immediate feedback", "Clarification of issues", "Rich insights"],
            "limitations": ["Resource intensive", "Limited participants", "Observer bias"],
            "best_for": "Complex workflows, detailed feedback"
        },
        "unmoderated_testing": {
            "description": "Self-guided testing without facilitator",
            "benefits": ["Scalable", "Natural behavior", "Cost effective"],
            "limitations": ["Limited interaction", "Less detailed feedback", "Technical issues"],
            "best_for": "Simple tasks, large sample sizes"
        },
        "a_b_testing": {
            "description": "Compare two versions of a feature",
            "benefits": ["Statistical significance", "Real user data", "Objective results"],
            "limitations": ["Requires traffic", "Limited to specific features", "Time consuming"],
            "best_for": "Feature optimization, conversion improvement"
        },
        "accessibility_testing": {
            "description": "Test with assistive technologies",
            "benefits": ["Inclusive design", "Compliance", "Better UX for all"],
            "limitations": ["Specialized knowledge", "Limited tools", "Time intensive"],
            "best_for": "Compliance, inclusive design"
        },
        "performance_testing": {
            "description": "Test under various conditions",
            "benefits": ["Real-world conditions", "Scalability insights", "User experience"],
            "limitations": ["Complex setup", "Limited scenarios", "Resource intensive"],
            "best_for": "Performance optimization, scalability"
        }
    }

@router.get("/testing-tools")
async def get_testing_tools() -> Dict[str, Any]:
    """Get recommended testing tools"""
    return {
        "usability_testing": {
            "UserTesting": "Remote moderated and unmoderated testing",
            "Maze": "Unmoderated testing with analytics",
            "Lookback": "Live user interviews and testing",
            "Hotjar": "User behavior analysis and heatmaps",
            "FullStory": "Session replay and user analytics"
        },
        "accessibility_testing": {
            "axe": "Browser extension for accessibility testing",
            "WAVE": "Web accessibility evaluation tool",
            "Lighthouse": "Chrome DevTools accessibility audit",
            "NVDA": "Free screen reader for testing",
            "JAWS": "Professional screen reader for testing"
        },
        "performance_testing": {
            "Lighthouse": "Performance and accessibility auditing",
            "WebPageTest": "Real-world performance testing",
            "GTmetrix": "Website speed and performance analysis",
            "Pingdom": "Website monitoring and performance",
            "New Relic": "Application performance monitoring"
        },
        "cross_browser_testing": {
            "BrowserStack": "Cross-browser testing platform",
            "CrossBrowserTesting": "Automated cross-browser testing",
            "LambdaTest": "Cloud-based testing platform",
            "Sauce Labs": "Continuous testing platform",
            "Browserling": "Online browser testing"
        },
        "analytics": {
            "Google Analytics": "Website traffic and user behavior",
            "Mixpanel": "User behavior and event tracking",
            "Amplitude": "Product analytics and user insights",
            "Heap": "Automatic event tracking",
            "PostHog": "Open-source product analytics"
        }
    }

@router.get("/testing-best-practices")
async def get_testing_best_practices() -> Dict[str, List[str]]:
    """Get testing best practices"""
    return {
        "planning": [
            "Define clear testing objectives",
            "Identify target user personas",
            "Create realistic test scenarios",
            "Set success criteria and metrics",
            "Plan for different user types and devices"
        ],
        "recruitment": [
            "Recruit representative users",
            "Include diverse backgrounds and abilities",
            "Screen participants effectively",
            "Provide clear instructions and expectations",
            "Offer appropriate incentives"
        ],
        "execution": [
            "Create comfortable testing environment",
            "Use think-aloud protocol",
            "Avoid leading questions",
            "Observe without interfering",
            "Document everything thoroughly"
        ],
        "analysis": [
            "Analyze both quantitative and qualitative data",
            "Look for patterns and common issues",
            "Prioritize findings by impact and frequency",
            "Consider user context and goals",
            "Provide actionable recommendations"
        ],
        "reporting": [
            "Create clear, actionable reports",
            "Include both issues and successes",
            "Provide evidence and examples",
            "Prioritize recommendations",
            "Follow up on implementation"
        ]
    }

@router.get("/testing-metrics")
async def get_testing_metrics() -> Dict[str, Any]:
    """Get key testing metrics to track"""
    return {
        "task_completion": {
            "completion_rate": "Percentage of tasks completed successfully",
            "abandonment_rate": "Percentage of tasks abandoned",
            "error_rate": "Percentage of tasks with errors",
            "retry_rate": "Percentage of tasks requiring retry"
        },
        "efficiency": {
            "completion_time": "Average time to complete tasks",
            "clicks_to_complete": "Number of clicks required",
            "pages_visited": "Number of pages visited per task",
            "time_on_task": "Time spent on each task"
        },
        "satisfaction": {
            "satisfaction_score": "User satisfaction rating (1-5)",
            "ease_of_use": "Perceived ease of use rating",
            "likelihood_to_recommend": "Net Promoter Score",
            "overall_impression": "Overall user impression"
        },
        "usability": {
            "learnability": "How quickly users can learn to use the system",
            "efficiency": "How quickly users can perform tasks",
            "memorability": "How well users remember how to use the system",
            "error_recovery": "How well users recover from errors",
            "satisfaction": "How satisfied users are with the system"
        }
    }
