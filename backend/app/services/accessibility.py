"""
Accessibility service for RoleFerry
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import re

class AccessibilityCheck(BaseModel):
    element_id: str
    element_type: str
    issue: str
    severity: str  # "error", "warning", "info"
    suggestion: str

class AccessibilityReport(BaseModel):
    success: bool
    checks: List[AccessibilityCheck] = []
    score: int = 0
    recommendations: List[str] = []

class AccessibilityService:
    """Service for ensuring accessibility standards across the application"""
    
    def __init__(self):
        self.required_aria_attributes = {
            'button': ['aria-label', 'aria-describedby'],
            'input': ['aria-label', 'aria-describedby', 'aria-required'],
            'textarea': ['aria-label', 'aria-describedby', 'aria-required'],
            'select': ['aria-label', 'aria-describedby', 'aria-required'],
            'form': ['aria-label', 'aria-describedby'],
            'section': ['aria-label', 'aria-labelledby'],
            'nav': ['aria-label', 'aria-labelledby'],
            'main': ['aria-label', 'aria-labelledby'],
            'aside': ['aria-label', 'aria-labelledby'],
            'article': ['aria-label', 'aria-labelledby']
        }
        
        self.required_roles = {
            'button': 'button',
            'input': 'textbox',
            'textarea': 'textbox',
            'select': 'combobox',
            'form': 'form',
            'section': 'region',
            'nav': 'navigation',
            'main': 'main',
            'aside': 'complementary',
            'article': 'article'
        }
    
    def check_aria_labels(self, html_content: str) -> List[AccessibilityCheck]:
        """Check for proper ARIA labels"""
        checks = []
        
        # Check for missing aria-label attributes
        for element_type, required_attrs in self.required_aria_attributes.items():
            pattern = f'<{element_type}[^>]*>'
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            
            for match in matches:
                element_id = self._extract_id(match)
                for attr in required_attrs:
                    if attr not in match:
                        checks.append(AccessibilityCheck(
                            element_id=element_id or f"unnamed_{element_type}",
                            element_type=element_type,
                            issue=f"Missing {attr} attribute",
                            severity="error",
                            suggestion=f"Add {attr}='descriptive text' to the {element_type} element"
                        ))
        
        return checks
    
    def check_aria_roles(self, html_content: str) -> List[AccessibilityCheck]:
        """Check for proper ARIA roles"""
        checks = []
        
        for element_type, required_role in self.required_roles.items():
            pattern = f'<{element_type}[^>]*>'
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            
            for match in matches:
                element_id = self._extract_id(match)
                if 'role=' not in match:
                    checks.append(AccessibilityCheck(
                        element_id=element_id or f"unnamed_{element_type}",
                        element_type=element_type,
                        issue=f"Missing role attribute",
                        severity="warning",
                        suggestion=f"Add role='{required_role}' to the {element_type} element"
                    ))
        
        return checks
    
    def check_heading_structure(self, html_content: str) -> List[AccessibilityCheck]:
        """Check for proper heading structure"""
        checks = []
        
        # Find all headings
        heading_pattern = r'<h([1-6])[^>]*>'
        headings = re.findall(heading_pattern, html_content)
        
        if not headings:
            checks.append(AccessibilityCheck(
                element_id="page",
                element_type="page",
                issue="No headings found",
                severity="error",
                suggestion="Add at least one heading (h1) to provide page structure"
            ))
            return checks
        
        # Check for h1
        if '1' not in headings:
            checks.append(AccessibilityCheck(
                element_id="page",
                element_type="page",
                issue="No h1 heading found",
                severity="error",
                suggestion="Add an h1 heading to provide the main page title"
            ))
        
        # Check heading hierarchy
        prev_level = 0
        for i, level in enumerate(headings):
            level = int(level)
            if level > prev_level + 1:
                checks.append(AccessibilityCheck(
                    element_id=f"heading_{i}",
                    element_type="heading",
                    issue=f"Heading level {level} follows level {prev_level}",
                    severity="warning",
                    suggestion="Maintain proper heading hierarchy (h1, h2, h3, etc.)"
                ))
            prev_level = level
        
        return checks
    
    def check_form_accessibility(self, html_content: str) -> List[AccessibilityCheck]:
        """Check form accessibility"""
        checks = []
        
        # Check for form labels
        form_pattern = r'<form[^>]*>'
        forms = re.findall(form_pattern, html_content, re.IGNORECASE)
        
        for form in forms:
            form_id = self._extract_id(form)
            
            # Check for form labels
            if 'aria-label' not in form and 'aria-labelledby' not in form:
                checks.append(AccessibilityCheck(
                    element_id=form_id or "unnamed_form",
                    element_type="form",
                    issue="Form missing accessibility label",
                    severity="error",
                    suggestion="Add aria-label or aria-labelledby to the form"
                ))
        
        # Check for input labels
        input_pattern = r'<input[^>]*>'
        inputs = re.findall(input_pattern, html_content, re.IGNORECASE)
        
        for input_elem in inputs:
            input_id = self._extract_id(input_elem)
            
            # Check for associated label
            if 'aria-label' not in input_elem and 'aria-labelledby' not in input_elem:
                checks.append(AccessibilityCheck(
                    element_id=input_id or "unnamed_input",
                    element_type="input",
                    issue="Input missing accessibility label",
                    severity="error",
                    suggestion="Add aria-label or aria-labelledby to the input"
                ))
            
            # Check for required attribute
            if 'required' in input_elem and 'aria-required' not in input_elem:
                checks.append(AccessibilityCheck(
                    element_id=input_id or "unnamed_input",
                    element_type="input",
                    issue="Required input missing aria-required",
                    severity="warning",
                    suggestion="Add aria-required='true' to required inputs"
                ))
        
        return checks
    
    def check_keyboard_navigation(self, html_content: str) -> List[AccessibilityCheck]:
        """Check keyboard navigation support"""
        checks = []
        
        # Check for tabindex
        tabindex_pattern = r'tabindex="([^"]*)"'
        tabindexes = re.findall(tabindex_pattern, html_content)
        
        for tabindex in tabindexes:
            if tabindex == '0':
                checks.append(AccessibilityCheck(
                    element_id="tabindex_0",
                    element_type="element",
                    issue="tabindex='0' found",
                    severity="info",
                    suggestion="Ensure tabindex='0' elements are accessible via keyboard"
                ))
            elif tabindex.startswith('-'):
                checks.append(AccessibilityCheck(
                    element_id="tabindex_negative",
                    element_type="element",
                    issue="Negative tabindex found",
                    severity="warning",
                    suggestion="Avoid negative tabindex values as they remove elements from tab order"
                ))
        
        # Check for focus management
        if 'onfocus' not in html_content and 'onblur' not in html_content:
            checks.append(AccessibilityCheck(
                element_id="focus_management",
                element_type="page",
                issue="No focus management found",
                severity="info",
                suggestion="Consider adding focus management for better keyboard navigation"
            ))
        
        return checks
    
    def check_color_contrast(self, html_content: str) -> List[AccessibilityCheck]:
        """Check color contrast (basic check)"""
        checks = []
        
        # Check for color usage
        color_pattern = r'color:\s*([^;]+)'
        colors = re.findall(color_pattern, html_content)
        
        for color in colors:
            if color.strip() in ['#000', '#fff', '#ffffff', '#000000']:
                checks.append(AccessibilityCheck(
                    element_id="color_contrast",
                    element_type="element",
                    issue="Basic color usage detected",
                    severity="info",
                    suggestion="Ensure color contrast meets WCAG AA standards (4.5:1 ratio)"
                ))
        
        return checks
    
    def check_alt_text(self, html_content: str) -> List[AccessibilityCheck]:
        """Check for alt text on images"""
        checks = []
        
        img_pattern = r'<img[^>]*>'
        images = re.findall(img_pattern, html_content, re.IGNORECASE)
        
        for img in images:
            img_id = self._extract_id(img)
            
            if 'alt=' not in img:
                checks.append(AccessibilityCheck(
                    element_id=img_id or "unnamed_img",
                    element_type="img",
                    issue="Image missing alt text",
                    severity="error",
                    suggestion="Add alt='descriptive text' to all images"
                ))
            elif 'alt=""' in img:
                checks.append(AccessibilityCheck(
                    element_id=img_id or "unnamed_img",
                    element_type="img",
                    issue="Image has empty alt text",
                    severity="warning",
                    suggestion="Provide meaningful alt text or use alt='' for decorative images"
                ))
        
        return checks
    
    def check_semantic_html(self, html_content: str) -> List[AccessibilityCheck]:
        """Check for semantic HTML usage"""
        checks = []
        
        # Check for semantic elements
        semantic_elements = ['main', 'nav', 'section', 'article', 'aside', 'header', 'footer']
        
        for element in semantic_elements:
            if f'<{element}' not in html_content:
                checks.append(AccessibilityCheck(
                    element_id="semantic_html",
                    element_type="page",
                    issue=f"Missing {element} element",
                    severity="info",
                    suggestion=f"Consider using <{element}> for better semantic structure"
                ))
        
        return checks
    
    def generate_accessibility_report(self, html_content: str) -> AccessibilityReport:
        """Generate comprehensive accessibility report"""
        all_checks = []
        
        # Run all accessibility checks
        all_checks.extend(self.check_aria_labels(html_content))
        all_checks.extend(self.check_aria_roles(html_content))
        all_checks.extend(self.check_heading_structure(html_content))
        all_checks.extend(self.check_form_accessibility(html_content))
        all_checks.extend(self.check_keyboard_navigation(html_content))
        all_checks.extend(self.check_color_contrast(html_content))
        all_checks.extend(self.check_alt_text(html_content))
        all_checks.extend(self.check_semantic_html(html_content))
        
        # Calculate score
        total_checks = len(all_checks)
        error_count = len([c for c in all_checks if c.severity == "error"])
        warning_count = len([c for c in all_checks if c.severity == "warning"])
        
        score = max(0, 100 - (error_count * 20) - (warning_count * 10))
        
        # Generate recommendations
        recommendations = []
        if error_count > 0:
            recommendations.append("Fix all error-level accessibility issues")
        if warning_count > 0:
            recommendations.append("Address warning-level accessibility issues")
        if score < 80:
            recommendations.append("Consider accessibility testing with screen readers")
        if score < 60:
            recommendations.append("Conduct comprehensive accessibility audit")
        
        return AccessibilityReport(
            success=error_count == 0,
            checks=all_checks,
            score=score,
            recommendations=recommendations
        )
    
    def _extract_id(self, html_element: str) -> Optional[str]:
        """Extract ID from HTML element"""
        id_pattern = r'id="([^"]*)"'
        match = re.search(id_pattern, html_element)
        return match.group(1) if match else None
    
    def generate_accessible_html(self, element_type: str, content: str, **kwargs) -> str:
        """Generate accessible HTML for common elements"""
        
        if element_type == "button":
            return f'<button aria-label="{kwargs.get("aria_label", "Button")}" role="button" tabindex="0">{content}</button>'
        
        elif element_type == "input":
            return f'<input aria-label="{kwargs.get("aria_label", "Input")}" aria-required="{kwargs.get("required", "false")}" role="textbox" tabindex="0" />'
        
        elif element_type == "textarea":
            return f'<textarea aria-label="{kwargs.get("aria_label", "Text area")}" aria-required="{kwargs.get("required", "false")}" role="textbox" tabindex="0">{content}</textarea>'
        
        elif element_type == "form":
            return f'<form aria-label="{kwargs.get("aria_label", "Form")}" role="form">{content}</form>'
        
        elif element_type == "section":
            return f'<section aria-label="{kwargs.get("aria_label", "Section")}" role="region">{content}</section>'
        
        elif element_type == "nav":
            return f'<nav aria-label="{kwargs.get("aria_label", "Navigation")}" role="navigation">{content}</nav>'
        
        elif element_type == "main":
            return f'<main aria-label="{kwargs.get("aria_label", "Main content")}" role="main">{content}</main>'
        
        elif element_type == "aside":
            return f'<aside aria-label="{kwargs.get("aria_label", "Sidebar")}" role="complementary">{content}</aside>'
        
        elif element_type == "article":
            return f'<article aria-label="{kwargs.get("aria_label", "Article")}" role="article">{content}</article>'
        
        else:
            return content
