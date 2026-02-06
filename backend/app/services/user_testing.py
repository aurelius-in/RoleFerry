"""
User testing service for RoleFerry
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from datetime import datetime
import json

class TestSession(BaseModel):
    session_id: str
    user_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    tasks: List[Dict[str, Any]] = []
    feedback: List[Dict[str, Any]] = []
    metrics: Dict[str, Any] = {}

class TestTask(BaseModel):
    task_id: str
    name: str
    description: str
    expected_actions: List[str]
    success_criteria: List[str]
    difficulty: str  # "easy", "medium", "hard"
    time_limit: int  # seconds

class TestResult(BaseModel):
    task_id: str
    completed: bool
    completion_time: float
    success_rate: float
    user_feedback: str
    issues_found: List[str] = []
    suggestions: List[str] = []

class UserTestingService:
    """Service for conducting user testing and validation"""
    
    def __init__(self):
        self.test_tasks = {
            "job_seeker_workflow": [
                TestTask(
                    task_id="js_001",
                    name="Set Job Preferences",
                    description="Configure your ideal job preferences including industry, role, salary, and location",
                    expected_actions=[
                        "Navigate to Job Preferences tab",
                        "Select industries of interest",
                        "Choose preferred roles",
                        "Set salary range",
                        "Select location preferences",
                        "Choose work type (remote, hybrid, on-site)"
                    ],
                    success_criteria=[
                        "All required fields are filled",
                        "Preferences are saved successfully",
                        "User can proceed to next step"
                    ],
                    difficulty="easy",
                    time_limit=300
                ),
                TestTask(
                    task_id="js_002",
                    name="Upload Resume",
                    description="Upload your resume and review the AI-parsed information",
                    expected_actions=[
                        "Navigate to Resume tab",
                        "Upload resume file",
                        "Review parsed information",
                        "Edit any incorrect data",
                        "Save the information"
                    ],
                    success_criteria=[
                        "Resume uploads successfully",
                        "AI parsing completes",
                        "User can review and edit data",
                        "Information is saved"
                    ],
                    difficulty="medium",
                    time_limit=600
                ),
                TestTask(
                    task_id="js_003",
                    name="Find Job Match",
                    description="Find a job that matches your preferences and skills",
                    expected_actions=[
                        "Navigate to Job Descriptions tab",
                        "Import job description",
                        "Review AI-parsed job details",
                        "Navigate to Pain Point Match tab",
                        "Review alignment score",
                        "Analyze match breakdown"
                    ],
                    success_criteria=[
                        "Job description imports successfully",
                        "AI parsing completes",
                        "Alignment score is calculated",
                        "User understands the match"
                    ],
                    difficulty="medium",
                    time_limit=900
                ),
                TestTask(
                    task_id="js_004",
                    name="Find Contact",
                    description="Find the right contact person for the job",
                    expected_actions=[
                        "Navigate to Find Contact tab",
                        "Search for contacts",
                        "Review contact information",
                        "Check email verification status",
                        "Select appropriate contact"
                    ],
                    success_criteria=[
                        "Contact search works",
                        "Contact information is displayed",
                        "Email verification status is shown",
                        "User can select a contact"
                    ],
                    difficulty="easy",
                    time_limit=300
                ),
                TestTask(
                    task_id="js_005",
                    name="Research Context",
                    description="Research the company and contact for personalized outreach",
                    expected_actions=[
                        "Navigate to Context Research tab",
                        "Review company summary",
                        "Review contact bio",
                        "Check recent news",
                        "Edit any information if needed"
                    ],
                    success_criteria=[
                        "Company information loads",
                        "Contact bio is displayed",
                        "Recent news is shown",
                        "User can edit information"
                    ],
                    difficulty="easy",
                    time_limit=300
                ),
                TestTask(
                    task_id="js_006",
                    name="Create Offer",
                    description="Create a personalized offer that provides value",
                    expected_actions=[
                        "Navigate to Offer Creation tab",
                        "Select appropriate tone",
                        "Review generated offer",
                        "Edit offer content if needed",
                        "Save the offer"
                    ],
                    success_criteria=[
                        "Offer is generated",
                        "User can select tone",
                        "User can edit content",
                        "Offer is saved"
                    ],
                    difficulty="medium",
                    time_limit=600
                ),
                TestTask(
                    task_id="js_007",
                    name="Create Bio Page",
                    description="Generate and publish a shareable bio page link",
                    expected_actions=[
                        "Navigate to Bio Page tab",
                        "Generate draft",
                        "Customize theme",
                        "Publish bio page",
                        "Copy the public link"
                    ],
                    success_criteria=[
                        "Draft is generated",
                        "Theme customization works",
                        "Bio page is published",
                        "Public URL is saved and copyable"
                    ],
                    difficulty="medium",
                    time_limit=600
                ),
                TestTask(
                    task_id="js_008",
                    name="Create Campaign",
                    description="Create a follow-up email campaign",
                    expected_actions=[
                        "Navigate to Campaign tab",
                        "Review generated emails",
                        "Edit email content",
                        "Set timing preferences",
                        "Review deliverability",
                        "Save the campaign"
                    ],
                    success_criteria=[
                        "Campaign is generated",
                        "User can edit emails",
                        "Timing is set",
                        "Deliverability is checked",
                        "Campaign is saved"
                    ],
                    difficulty="hard",
                    time_limit=900
                ),
                TestTask(
                    task_id="js_009",
                    name="Launch Campaign",
                    description="Launch the email campaign with pre-flight checks",
                    expected_actions=[
                        "Navigate to Deliverability/Launch tab",
                        "Review pre-flight checks",
                        "Check email verification",
                        "Review spam score",
                        "Launch the campaign"
                    ],
                    success_criteria=[
                        "Pre-flight checks complete",
                        "Email verification passes",
                        "Spam score is acceptable",
                        "Campaign launches successfully"
                    ],
                    difficulty="hard",
                    time_limit=600
                )
            ],
            "recruiter_workflow": [
                TestTask(
                    task_id="rec_001",
                    name="Set Ideal Client Profile",
                    description="Configure your ideal client profile for candidate matching",
                    expected_actions=[
                        "Navigate to ICP tab",
                        "Select target industries",
                        "Choose company sizes",
                        "Set geographic preferences",
                        "Define budget range"
                    ],
                    success_criteria=[
                        "All required fields are filled",
                        "ICP is saved successfully",
                        "User can proceed to next step"
                    ],
                    difficulty="easy",
                    time_limit=300
                ),
                TestTask(
                    task_id="rec_002",
                    name="Upload Job Description",
                    description="Upload job description and review AI-parsed requirements",
                    expected_actions=[
                        "Navigate to Job Descriptions tab",
                        "Import job description",
                        "Review parsed requirements",
                        "Edit any incorrect data",
                        "Save the information"
                    ],
                    success_criteria=[
                        "Job description imports successfully",
                        "AI parsing completes",
                        "User can review and edit data",
                        "Information is saved"
                    ],
                    difficulty="medium",
                    time_limit=600
                ),
                TestTask(
                    task_id="rec_003",
                    name="Find Candidate Match",
                    description="Find a candidate that matches the job requirements",
                    expected_actions=[
                        "Navigate to Candidate Profile tab",
                        "Upload candidate resume",
                        "Review AI-parsed candidate data",
                        "Navigate to Pain Point Match tab",
                        "Review alignment score",
                        "Analyze match breakdown"
                    ],
                    success_criteria=[
                        "Candidate resume uploads successfully",
                        "AI parsing completes",
                        "Alignment score is calculated",
                        "User understands the match"
                    ],
                    difficulty="medium",
                    time_limit=900
                ),
                TestTask(
                    task_id="rec_004",
                    name="Find Contact",
                    description="Find the right contact person for outreach",
                    expected_actions=[
                        "Navigate to Find Contact tab",
                        "Search for contacts",
                        "Review contact information",
                        "Check email verification status",
                        "Select appropriate contact"
                    ],
                    success_criteria=[
                        "Contact search works",
                        "Contact information is displayed",
                        "Email verification status is shown",
                        "User can select a contact"
                    ],
                    difficulty="easy",
                    time_limit=300
                ),
                TestTask(
                    task_id="rec_005",
                    name="Research Context",
                    description="Research the company and contact for personalized outreach",
                    expected_actions=[
                        "Navigate to Context Research tab",
                        "Review company summary",
                        "Review contact bio",
                        "Check recent news",
                        "Edit any information if needed"
                    ],
                    success_criteria=[
                        "Company information loads",
                        "Contact bio is displayed",
                        "Recent news is shown",
                        "User can edit information"
                    ],
                    difficulty="easy",
                    time_limit=300
                ),
                TestTask(
                    task_id="rec_006",
                    name="Create Offer",
                    description="Create a personalized offer that provides value",
                    expected_actions=[
                        "Navigate to Offer Creation tab",
                        "Select appropriate tone",
                        "Review generated offer",
                        "Edit offer content if needed",
                        "Save the offer"
                    ],
                    success_criteria=[
                        "Offer is generated",
                        "User can select tone",
                        "User can edit content",
                        "Offer is saved"
                    ],
                    difficulty="medium",
                    time_limit=600
                ),
                TestTask(
                    task_id="rec_007",
                    name="Create Bio Page",
                    description="Generate and publish a shareable bio page link",
                    expected_actions=[
                        "Navigate to Bio Page tab",
                        "Generate draft",
                        "Customize theme",
                        "Publish bio page",
                        "Copy the public link"
                    ],
                    success_criteria=[
                        "Draft is generated",
                        "Theme customization works",
                        "Bio page is published",
                        "Public URL is saved and copyable"
                    ],
                    difficulty="medium",
                    time_limit=600
                ),
                TestTask(
                    task_id="rec_008",
                    name="Create Campaign",
                    description="Create a follow-up email campaign",
                    expected_actions=[
                        "Navigate to Campaign tab",
                        "Review generated emails",
                        "Edit email content",
                        "Set timing preferences",
                        "Review deliverability",
                        "Save the campaign"
                    ],
                    success_criteria=[
                        "Campaign is generated",
                        "User can edit emails",
                        "Timing is set",
                        "Deliverability is checked",
                        "Campaign is saved"
                    ],
                    difficulty="hard",
                    time_limit=900
                ),
                TestTask(
                    task_id="rec_009",
                    name="Launch Campaign",
                    description="Launch the email campaign with pre-flight checks",
                    expected_actions=[
                        "Navigate to Deliverability/Launch tab",
                        "Review pre-flight checks",
                        "Check email verification",
                        "Review spam score",
                        "Launch the campaign"
                    ],
                    success_criteria=[
                        "Pre-flight checks complete",
                        "Email verification passes",
                        "Spam score is acceptable",
                        "Campaign launches successfully"
                    ],
                    difficulty="hard",
                    time_limit=600
                )
            ]
        }
        
        self.test_metrics = {
            "task_completion_rate": 0.0,
            "average_completion_time": 0.0,
            "user_satisfaction": 0.0,
            "error_rate": 0.0,
            "abandonment_rate": 0.0
        }
    
    def create_test_session(self, user_id: str, workflow_type: str) -> TestSession:
        """Create a new test session"""
        session_id = f"test_{user_id}_{workflow_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        tasks = self.test_tasks.get(workflow_type, [])
        
        return TestSession(
            session_id=session_id,
            user_id=user_id,
            start_time=datetime.now(),
            tasks=[task.dict() for task in tasks]
        )
    
    def start_task(self, session_id: str, task_id: str) -> Dict[str, Any]:
        """Start a test task"""
        # In a real implementation, this would update the database
        return {
            "session_id": session_id,
            "task_id": task_id,
            "start_time": datetime.now().isoformat(),
            "status": "started"
        }
    
    def complete_task(self, session_id: str, task_id: str, result: TestResult) -> Dict[str, Any]:
        """Complete a test task"""
        # In a real implementation, this would update the database
        return {
            "session_id": session_id,
            "task_id": task_id,
            "completion_time": result.completion_time,
            "success_rate": result.success_rate,
            "issues_found": result.issues_found,
            "suggestions": result.suggestions,
            "status": "completed"
        }
    
    def add_feedback(self, session_id: str, feedback: Dict[str, Any]) -> Dict[str, Any]:
        """Add user feedback to a test session"""
        # In a real implementation, this would update the database
        return {
            "session_id": session_id,
            "feedback": feedback,
            "timestamp": datetime.now().isoformat()
        }
    
    def calculate_metrics(self, session_id: str) -> Dict[str, Any]:
        """Calculate test session metrics"""
        # In a real implementation, this would query the database
        return {
            "session_id": session_id,
            "task_completion_rate": 0.85,
            "average_completion_time": 450.0,
            "user_satisfaction": 4.2,
            "error_rate": 0.15,
            "abandonment_rate": 0.10
        }
    
    def generate_test_report(self, session_id: str) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        metrics = self.calculate_metrics(session_id)
        
        return {
            "session_id": session_id,
            "summary": {
                "total_tasks": 9,
                "completed_tasks": 8,
                "completion_rate": 0.89,
                "average_time_per_task": 450.0,
                "total_session_time": 3600.0
            },
            "metrics": metrics,
            "recommendations": [
                "Improve error handling for file uploads",
                "Add more guidance for first-time users",
                "Optimize AI processing time",
                "Enhance mobile responsiveness",
                "Add keyboard shortcuts for power users"
            ],
            "issues_found": [
                "File upload sometimes fails on slow connections",
                "AI parsing can take longer than expected",
                "Some users find the interface overwhelming",
                "Mobile navigation could be improved",
                "Error messages could be more helpful"
            ],
            "success_stories": [
                "Users love the AI-powered matching",
                "The workflow is intuitive for most users",
                "The dual-mode toggle works well",
                "The progress tracking is helpful",
                "The gamification elements are engaging"
            ]
        }
    
    def get_test_tasks(self, workflow_type: str) -> List[TestTask]:
        """Get test tasks for a specific workflow"""
        return self.test_tasks.get(workflow_type, [])
    
    def get_test_metrics(self) -> Dict[str, Any]:
        """Get test metrics"""
        return self.test_metrics
    
    def generate_user_personas(self) -> List[Dict[str, Any]]:
        """Generate user personas for testing"""
        return [
            {
                "persona_id": "job_seeker_1",
                "name": "Sarah Chen",
                "role": "Software Engineer",
                "experience": "3 years",
                "tech_savvy": "high",
                "goals": "Find a remote software engineering role",
                "pain_points": "Time-consuming job applications, generic outreach",
                "testing_focus": "Ease of use, time efficiency"
            },
            {
                "persona_id": "job_seeker_2",
                "name": "Mike Rodriguez",
                "role": "Marketing Manager",
                "experience": "5 years",
                "tech_savvy": "medium",
                "goals": "Transition to tech industry",
                "pain_points": "Lack of technical background, networking",
                "testing_focus": "Guidance, learning curve"
            },
            {
                "persona_id": "recruiter_1",
                "name": "Jennifer Kim",
                "role": "Technical Recruiter",
                "experience": "7 years",
                "tech_savvy": "high",
                "goals": "Find qualified candidates faster",
                "pain_points": "Manual candidate screening, time-consuming outreach",
                "testing_focus": "Efficiency, candidate quality"
            },
            {
                "persona_id": "recruiter_2",
                "name": "David Thompson",
                "role": "HR Manager",
                "experience": "10 years",
                "tech_savvy": "medium",
                "goals": "Improve hiring process",
                "pain_points": "High volume of applications, quality control",
                "testing_focus": "Process improvement, scalability"
            }
        ]
    
    def generate_testing_scenarios(self) -> List[Dict[str, Any]]:
        """Generate testing scenarios"""
        return [
            {
                "scenario_id": "happy_path",
                "name": "Happy Path - Successful Workflow",
                "description": "User completes the entire workflow without issues",
                "expected_outcome": "All tasks completed successfully",
                "testing_focus": "Core functionality, user satisfaction"
            },
            {
                "scenario_id": "error_recovery",
                "name": "Error Recovery - Handling Issues",
                "description": "User encounters and recovers from errors",
                "expected_outcome": "User can recover from errors and continue",
                "testing_focus": "Error handling, user guidance"
            },
            {
                "scenario_id": "mobile_usage",
                "name": "Mobile Usage - Responsive Design",
                "description": "User completes workflow on mobile device",
                "expected_outcome": "Workflow works on mobile devices",
                "testing_focus": "Mobile responsiveness, touch interactions"
            },
            {
                "scenario_id": "accessibility",
                "name": "Accessibility - Screen Reader Usage",
                "description": "User completes workflow using screen reader",
                "expected_outcome": "Workflow is accessible to all users",
                "testing_focus": "Accessibility, inclusive design"
            },
            {
                "scenario_id": "performance",
                "name": "Performance - Slow Connection",
                "description": "User completes workflow on slow connection",
                "expected_outcome": "Workflow works on slow connections",
                "testing_focus": "Performance, loading times"
            }
        ]
    
    def generate_testing_plan(self) -> Dict[str, Any]:
        """Generate comprehensive testing plan"""
        return {
            "testing_phases": [
                {
                    "phase": "Alpha Testing",
                    "duration": "1 week",
                    "participants": "Internal team (5-10 people)",
                    "focus": "Core functionality, basic usability",
                    "tasks": ["Complete both workflows", "Report bugs", "Provide feedback"]
                },
                {
                    "phase": "Beta Testing",
                    "duration": "2 weeks",
                    "participants": "Internal stakeholders (10-20 people)",
                    "focus": "Workflow validation, feature completeness",
                    "tasks": ["Complete workflows", "Test edge cases", "Provide detailed feedback"]
                },
                {
                    "phase": "User Acceptance Testing",
                    "duration": "3 weeks",
                    "participants": "External users (20-50 people)",
                    "focus": "Real-world usage, user satisfaction",
                    "tasks": ["Complete workflows", "Provide feedback", "Suggest improvements"]
                }
            ],
            "testing_methods": [
                "Moderated usability testing",
                "Unmoderated remote testing",
                "A/B testing for key features",
                "Accessibility testing",
                "Performance testing",
                "Cross-browser testing"
            ],
            "success_criteria": [
                "Task completion rate > 80%",
                "User satisfaction score > 4.0/5.0",
                "Average completion time < 30 minutes",
                "Error rate < 10%",
                "Accessibility compliance (WCAG AA)"
            ],
            "tools_and_platforms": [
                "UserTesting.com for remote testing",
                "Maze for unmoderated testing",
                "Hotjar for user behavior analysis",
                "Google Analytics for usage metrics",
                "Lighthouse for performance testing"
            ]
        }
