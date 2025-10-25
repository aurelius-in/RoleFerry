"""
FastAPI router for cross-browser compatibility services
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
from ..services.cross_browser_compatibility import (
    CrossBrowserCompatibilityService,
    CompatibilityReport,
    BrowserSupport
)

router = APIRouter()
compatibility_service = CrossBrowserCompatibilityService()

@router.post("/check-css-compatibility")
async def check_css_compatibility(css_content: str) -> List[BrowserSupport]:
    """Check CSS compatibility across browsers"""
    return compatibility_service.check_css_compatibility(css_content)

@router.post("/check-js-compatibility")
async def check_js_compatibility(js_content: str) -> List[BrowserSupport]:
    """Check JavaScript compatibility across browsers"""
    return compatibility_service.check_js_compatibility(js_content)

@router.post("/check-html-compatibility")
async def check_html_compatibility(html_content: str) -> List[BrowserSupport]:
    """Check HTML compatibility across browsers"""
    return compatibility_service.check_html_compatibility(html_content)

@router.post("/generate-css-prefixes")
async def generate_css_prefixes(css_content: str) -> str:
    """Generate CSS prefixes for better browser support"""
    return compatibility_service.generate_css_prefixes(css_content)

@router.post("/generate-js-polyfills")
async def generate_js_polyfills(js_content: str) -> str:
    """Generate JavaScript polyfills for better browser support"""
    return compatibility_service.generate_js_polyfills(js_content)

@router.post("/generate-fallback-html")
async def generate_fallback_html(html_content: str) -> str:
    """Generate fallback HTML for better browser support"""
    return compatibility_service.generate_fallback_html(html_content)

@router.post("/generate-compatibility-report")
async def generate_compatibility_report(
    html_content: str,
    css_content: str,
    js_content: str
) -> CompatibilityReport:
    """Generate comprehensive compatibility report"""
    return compatibility_service.generate_compatibility_report(
        html_content, css_content, js_content
    )

@router.post("/generate-browser-specific-css")
async def generate_browser_specific_css(browser: str) -> str:
    """Generate browser-specific CSS"""
    return compatibility_service.generate_browser_specific_css(browser)

@router.get("/feature-detection-js")
async def get_feature_detection_js() -> str:
    """Get feature detection JavaScript"""
    return compatibility_service.generate_feature_detection_js()

@router.get("/browser-support-matrix")
async def get_browser_support_matrix() -> Dict[str, Any]:
    """Get browser support matrix"""
    return compatibility_service.get_browser_support_matrix()

@router.get("/css-prefixes")
async def get_css_prefixes() -> Dict[str, List[str]]:
    """Get CSS prefixes for different browsers"""
    return compatibility_service.get_css_prefixes()

@router.get("/js-polyfills")
async def get_js_polyfills() -> Dict[str, str]:
    """Get JavaScript polyfills for different features"""
    return compatibility_service.get_js_polyfills()

@router.get("/browser-testing-checklist")
async def get_browser_testing_checklist() -> Dict[str, List[str]]:
    """Get browser testing checklist"""
    return {
        "desktop_browsers": [
            "Chrome (latest, -1, -2)",
            "Firefox (latest, -1, -2)",
            "Safari (latest, -1, -2)",
            "Edge (latest, -1, -2)",
            "Internet Explorer 11 (if required)"
        ],
        "mobile_browsers": [
            "Chrome Mobile (Android)",
            "Safari Mobile (iOS)",
            "Samsung Internet",
            "Firefox Mobile",
            "Edge Mobile"
        ],
        "testing_areas": [
            "Layout and styling",
            "JavaScript functionality",
            "Form interactions",
            "Navigation and routing",
            "Media and animations",
            "Performance and loading",
            "Accessibility features",
            "Responsive design"
        ],
        "testing_tools": [
            "BrowserStack",
            "CrossBrowserTesting",
            "LambdaTest",
            "Sauce Labs",
            "Browser Developer Tools",
            "Can I Use database"
        ],
        "common_issues": [
            "CSS Grid support in older browsers",
            "Flexbox bugs in Safari",
            "JavaScript ES6 support in IE",
            "CSS Variables support",
            "Fetch API compatibility",
            "Service Worker support",
            "WebP image format support",
            "CSS Custom Properties"
        ]
    }

@router.get("/browser-specific-fixes")
async def get_browser_specific_fixes() -> Dict[str, Any]:
    """Get browser-specific fixes and workarounds"""
    return {
        "internet_explorer": {
            "css_grid": "Use Flexbox or float-based layouts",
            "css_variables": "Use preprocessor variables or hardcode values",
            "es6": "Use Babel to transpile to ES5",
            "fetch": "Use XMLHttpRequest or fetch polyfill",
            "promises": "Use Promise polyfill",
            "flexbox": "Add vendor prefixes and fallbacks"
        },
        "safari": {
            "css_grid": "Add fallback layout with Flexbox",
            "flexbox": "Add vendor prefixes",
            "css_variables": "Add fallback values",
            "service_workers": "Add feature detection",
            "webp": "Add fallback image formats",
            "intersection_observer": "Add polyfill"
        },
        "firefox": {
            "css_grid": "Add vendor prefixes for older versions",
            "flexbox": "Add vendor prefixes",
            "css_variables": "Add fallback values",
            "webp": "Add fallback image formats",
            "service_workers": "Add feature detection"
        },
        "chrome": {
            "css_grid": "Generally well supported",
            "flexbox": "Generally well supported",
            "css_variables": "Generally well supported",
            "es6": "Generally well supported",
            "fetch": "Generally well supported",
            "promises": "Generally well supported"
        },
        "edge": {
            "css_grid": "Generally well supported",
            "flexbox": "Generally well supported",
            "css_variables": "Generally well supported",
            "es6": "Generally well supported",
            "fetch": "Generally well supported",
            "promises": "Generally well supported"
        }
    }

@router.get("/progressive-enhancement-guide")
async def get_progressive_enhancement_guide() -> Dict[str, Any]:
    """Get progressive enhancement guide"""
    return {
        "principles": [
            "Start with basic HTML structure",
            "Add CSS for styling and layout",
            "Enhance with JavaScript for interactivity",
            "Use feature detection before applying enhancements",
            "Provide fallbacks for unsupported features"
        ],
        "implementation": {
            "html": "Use semantic HTML elements and proper structure",
            "css": "Use CSS with fallbacks and vendor prefixes",
            "javascript": "Use feature detection and polyfills",
            "images": "Provide multiple formats and fallbacks",
            "fonts": "Use web-safe fonts as fallbacks"
        },
        "examples": {
            "css_grid": "Use Flexbox as fallback for CSS Grid",
            "css_variables": "Use hardcoded values as fallbacks",
            "fetch": "Use XMLHttpRequest as fallback",
            "promises": "Use callback-based alternatives",
            "intersection_observer": "Use scroll event listeners as fallback"
        },
        "testing": {
            "disable_javascript": "Test with JavaScript disabled",
            "disable_css": "Test with CSS disabled",
            "slow_connection": "Test on slow connections",
            "old_browsers": "Test on older browser versions",
            "mobile_devices": "Test on various mobile devices"
        }
    }

@router.get("/browser-feature-support")
async def get_browser_feature_support() -> Dict[str, Any]:
    """Get browser feature support information"""
    return {
        "css_features": {
            "css_grid": {
                "chrome": "57+",
                "firefox": "52+",
                "safari": "10.1+",
                "edge": "16+",
                "ie": "Not supported"
            },
            "css_variables": {
                "chrome": "49+",
                "firefox": "31+",
                "safari": "9.1+",
                "edge": "15+",
                "ie": "Not supported"
            },
            "flexbox": {
                "chrome": "21+",
                "firefox": "28+",
                "safari": "9+",
                "edge": "12+",
                "ie": "10+ (partial)"
            }
        },
        "javascript_features": {
            "es6": {
                "chrome": "51+",
                "firefox": "54+",
                "safari": "10+",
                "edge": "14+",
                "ie": "Not supported"
            },
            "fetch": {
                "chrome": "42+",
                "firefox": "39+",
                "safari": "10.1+",
                "edge": "14+",
                "ie": "Not supported"
            },
            "promises": {
                "chrome": "32+",
                "firefox": "29+",
                "safari": "8+",
                "edge": "12+",
                "ie": "Not supported"
            }
        },
        "html_features": {
            "semantic_elements": {
                "chrome": "5+",
                "firefox": "4+",
                "safari": "5+",
                "edge": "12+",
                "ie": "9+"
            },
            "lazy_loading": {
                "chrome": "76+",
                "firefox": "Not supported",
                "safari": "Not supported",
                "edge": "79+",
                "ie": "Not supported"
            }
        }
    }
