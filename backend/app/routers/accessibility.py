"""
FastAPI router for accessibility services
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from ..services.accessibility import AccessibilityService, AccessibilityReport, AccessibilityCheck

router = APIRouter()
accessibility_service = AccessibilityService()

@router.post("/check-aria-labels")
async def check_aria_labels(html_content: str) -> List[AccessibilityCheck]:
    """Check for proper ARIA labels in HTML content"""
    return accessibility_service.check_aria_labels(html_content)

@router.post("/check-aria-roles")
async def check_aria_roles(html_content: str) -> List[AccessibilityCheck]:
    """Check for proper ARIA roles in HTML content"""
    return accessibility_service.check_aria_roles(html_content)

@router.post("/check-heading-structure")
async def check_heading_structure(html_content: str) -> List[AccessibilityCheck]:
    """Check for proper heading structure in HTML content"""
    return accessibility_service.check_heading_structure(html_content)

@router.post("/check-form-accessibility")
async def check_form_accessibility(html_content: str) -> List[AccessibilityCheck]:
    """Check form accessibility in HTML content"""
    return accessibility_service.check_form_accessibility(html_content)

@router.post("/check-keyboard-navigation")
async def check_keyboard_navigation(html_content: str) -> List[AccessibilityCheck]:
    """Check keyboard navigation support in HTML content"""
    return accessibility_service.check_keyboard_navigation(html_content)

@router.post("/check-color-contrast")
async def check_color_contrast(html_content: str) -> List[AccessibilityCheck]:
    """Check color contrast in HTML content"""
    return accessibility_service.check_color_contrast(html_content)

@router.post("/check-alt-text")
async def check_alt_text(html_content: str) -> List[AccessibilityCheck]:
    """Check for alt text on images in HTML content"""
    return accessibility_service.check_alt_text(html_content)

@router.post("/check-semantic-html")
async def check_semantic_html(html_content: str) -> List[AccessibilityCheck]:
    """Check for semantic HTML usage in HTML content"""
    return accessibility_service.check_semantic_html(html_content)

@router.post("/generate-report")
async def generate_accessibility_report(html_content: str) -> AccessibilityReport:
    """Generate comprehensive accessibility report for HTML content"""
    return accessibility_service.generate_accessibility_report(html_content)

@router.post("/generate-accessible-html")
async def generate_accessible_html(
    element_type: str, 
    content: str, 
    **kwargs
) -> str:
    """Generate accessible HTML for common elements"""
    return accessibility_service.generate_accessible_html(element_type, content, **kwargs)

@router.get("/accessibility-guidelines")
async def get_accessibility_guidelines() -> Dict[str, Any]:
    """Get accessibility guidelines and best practices"""
    return {
        "wcag_levels": {
            "A": "Basic accessibility requirements",
            "AA": "Standard accessibility requirements (recommended)",
            "AAA": "Enhanced accessibility requirements"
        },
        "key_principles": {
            "perceivable": "Information must be presentable in ways users can perceive",
            "operable": "Interface components must be operable",
            "understandable": "Information and UI operation must be understandable",
            "robust": "Content must be robust enough for various assistive technologies"
        },
        "best_practices": {
            "aria_labels": "Use aria-label for elements without visible text",
            "heading_structure": "Use proper heading hierarchy (h1, h2, h3, etc.)",
            "form_labels": "Associate labels with form controls",
            "keyboard_navigation": "Ensure all interactive elements are keyboard accessible",
            "color_contrast": "Maintain sufficient color contrast (4.5:1 for AA)",
            "alt_text": "Provide meaningful alt text for images",
            "semantic_html": "Use semantic HTML elements for better structure"
        },
        "testing_tools": {
            "axe": "Browser extension for accessibility testing",
            "wave": "Web accessibility evaluation tool",
            "lighthouse": "Chrome DevTools accessibility audit",
            "screen_readers": "Test with NVDA, JAWS, or VoiceOver"
        },
        "common_issues": {
            "missing_aria_labels": "Interactive elements without accessible names",
            "poor_heading_structure": "Incorrect heading hierarchy",
            "unlabeled_forms": "Form controls without associated labels",
            "keyboard_traps": "Elements that can't be navigated with keyboard",
            "low_contrast": "Text that doesn't meet contrast requirements",
            "missing_alt_text": "Images without alternative text",
            "non_semantic_html": "Using div/span instead of semantic elements"
        }
    }

@router.get("/accessibility-checklist")
async def get_accessibility_checklist() -> Dict[str, List[str]]:
    """Get accessibility checklist for development"""
    return {
        "content": [
            "All images have meaningful alt text",
            "Headings follow proper hierarchy (h1, h2, h3, etc.)",
            "Text has sufficient color contrast (4.5:1 for AA)",
            "Content is readable and understandable",
            "No information conveyed by color alone"
        ],
        "navigation": [
            "All interactive elements are keyboard accessible",
            "Focus is visible and logical",
            "No keyboard traps",
            "Skip links are provided for main content",
            "Navigation is consistent across pages"
        ],
        "forms": [
            "All form controls have labels",
            "Required fields are clearly marked",
            "Error messages are clear and helpful",
            "Form validation is accessible",
            "Form submission is clear"
        ],
        "media": [
            "Videos have captions",
            "Audio has transcripts",
            "Media controls are accessible",
            "Auto-playing media can be paused",
            "Media doesn't interfere with screen readers"
        ],
        "technical": [
            "HTML is valid and semantic",
            "ARIA attributes are used correctly",
            "Page has proper language declaration",
            "Page title is descriptive",
            "Meta tags are properly set"
        ]
    }
