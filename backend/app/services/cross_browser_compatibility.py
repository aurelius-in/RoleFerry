"""
Cross-browser compatibility service for RoleFerry
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import re

class BrowserSupport(BaseModel):
    browser: str
    version: str
    support_level: str  # "full", "partial", "none"
    issues: List[str] = []
    workarounds: List[str] = []

class CompatibilityReport(BaseModel):
    success: bool
    browser_support: List[BrowserSupport] = []
    recommendations: List[str] = []
    score: int = 0

class CrossBrowserCompatibilityService:
    """Service for ensuring cross-browser compatibility across the application"""
    
    def __init__(self):
        self.browser_support_matrix = {
            "chrome": {
                "versions": ["90+", "80+", "70+", "60+"],
                "features": {
                    "css_grid": "full",
                    "flexbox": "full",
                    "css_variables": "full",
                    "es6": "full",
                    "fetch_api": "full",
                    "promises": "full",
                    "async_await": "full",
                    "webp": "full",
                    "webgl": "full",
                    "service_workers": "full"
                }
            },
            "firefox": {
                "versions": ["88+", "78+", "68+", "60+"],
                "features": {
                    "css_grid": "full",
                    "flexbox": "full",
                    "css_variables": "full",
                    "es6": "full",
                    "fetch_api": "full",
                    "promises": "full",
                    "async_await": "full",
                    "webp": "full",
                    "webgl": "full",
                    "service_workers": "full"
                }
            },
            "safari": {
                "versions": ["14+", "13+", "12+", "11+"],
                "features": {
                    "css_grid": "full",
                    "flexbox": "full",
                    "css_variables": "full",
                    "es6": "partial",
                    "fetch_api": "full",
                    "promises": "full",
                    "async_await": "full",
                    "webp": "full",
                    "webgl": "full",
                    "service_workers": "partial"
                }
            },
            "edge": {
                "versions": ["90+", "80+", "70+", "60+"],
                "features": {
                    "css_grid": "full",
                    "flexbox": "full",
                    "css_variables": "full",
                    "es6": "full",
                    "fetch_api": "full",
                    "promises": "full",
                    "async_await": "full",
                    "webp": "full",
                    "webgl": "full",
                    "service_workers": "full"
                }
            },
            "ie": {
                "versions": ["11", "10", "9"],
                "features": {
                    "css_grid": "none",
                    "flexbox": "partial",
                    "css_variables": "none",
                    "es6": "none",
                    "fetch_api": "none",
                    "promises": "none",
                    "async_await": "none",
                    "webp": "none",
                    "webgl": "partial",
                    "service_workers": "none"
                }
            }
        }
        
        self.css_prefixes = {
            "webkit": ["-webkit-"],
            "moz": ["-moz-"],
            "ms": ["-ms-"],
            "o": ["-o-"]
        }
        
        self.js_polyfills = {
            "fetch": "https://cdn.jsdelivr.net/npm/whatwg-fetch@3.6.2/dist/fetch.umd.js",
            "promises": "https://cdn.jsdelivr.net/npm/es6-promise@4.2.8/dist/es6-promise.auto.js",
            "intersection_observer": "https://cdn.jsdelivr.net/npm/intersection-observer@0.12.2/intersection-observer.js",
            "resize_observer": "https://cdn.jsdelivr.net/npm/resize-observer-polyfill@1.5.1/dist/ResizeObserver.js"
        }
    
    def check_css_compatibility(self, css_content: str) -> List[BrowserSupport]:
        """Check CSS compatibility across browsers"""
        browser_support = []
        
        # Check for CSS Grid
        if "display: grid" in css_content or "display:grid" in css_content:
            for browser, info in self.browser_support_matrix.items():
                support_level = info["features"]["css_grid"]
                issues = []
                workarounds = []
                
                if support_level == "none":
                    issues.append("CSS Grid not supported")
                    workarounds.append("Use Flexbox or float-based layouts")
                elif support_level == "partial":
                    issues.append("CSS Grid partially supported")
                    workarounds.append("Add fallback layout with Flexbox")
                
                browser_support.append(BrowserSupport(
                    browser=browser,
                    version=info["versions"][0],
                    support_level=support_level,
                    issues=issues,
                    workarounds=workarounds
                ))
        
        # Check for CSS Variables
        if "var(" in css_content:
            for browser, info in self.browser_support_matrix.items():
                support_level = info["features"]["css_variables"]
                issues = []
                workarounds = []
                
                if support_level == "none":
                    issues.append("CSS Variables not supported")
                    workarounds.append("Use preprocessor variables or hardcode values")
                elif support_level == "partial":
                    issues.append("CSS Variables partially supported")
                    workarounds.append("Add fallback values")
                
                browser_support.append(BrowserSupport(
                    browser=browser,
                    version=info["versions"][0],
                    support_level=support_level,
                    issues=issues,
                    workarounds=workarounds
                ))
        
        # Check for Flexbox
        if "display: flex" in css_content or "display:flex" in css_content:
            for browser, info in self.browser_support_matrix.items():
                support_level = info["features"]["flexbox"]
                issues = []
                workarounds = []
                
                if support_level == "partial":
                    issues.append("Flexbox partially supported")
                    workarounds.append("Add vendor prefixes and fallbacks")
                
                browser_support.append(BrowserSupport(
                    browser=browser,
                    version=info["versions"][0],
                    support_level=support_level,
                    issues=issues,
                    workarounds=workarounds
                ))
        
        return browser_support
    
    def check_js_compatibility(self, js_content: str) -> List[BrowserSupport]:
        """Check JavaScript compatibility across browsers"""
        browser_support = []
        
        # Check for ES6 features
        es6_features = ["const ", "let ", "=>", "class ", "import ", "export "]
        for feature in es6_features:
            if feature in js_content:
                for browser, info in self.browser_support_matrix.items():
                    support_level = info["features"]["es6"]
                    issues = []
                    workarounds = []
                    
                    if support_level == "none":
                        issues.append(f"ES6 feature '{feature}' not supported")
                        workarounds.append("Use Babel to transpile to ES5")
                    elif support_level == "partial":
                        issues.append(f"ES6 feature '{feature}' partially supported")
                        workarounds.append("Add polyfills or transpile")
                    
                    browser_support.append(BrowserSupport(
                        browser=browser,
                        version=info["versions"][0],
                        support_level=support_level,
                        issues=issues,
                        workarounds=workarounds
                    ))
        
        # Check for Fetch API
        if "fetch(" in js_content:
            for browser, info in self.browser_support_matrix.items():
                support_level = info["features"]["fetch_api"]
                issues = []
                workarounds = []
                
                if support_level == "none":
                    issues.append("Fetch API not supported")
                    workarounds.append("Use XMLHttpRequest or fetch polyfill")
                elif support_level == "partial":
                    issues.append("Fetch API partially supported")
                    workarounds.append("Add fetch polyfill")
                
                browser_support.append(BrowserSupport(
                    browser=browser,
                    version=info["versions"][0],
                    support_level=support_level,
                    issues=issues,
                    workarounds=workarounds
                ))
        
        # Check for Promises
        if "Promise" in js_content:
            for browser, info in self.browser_support_matrix.items():
                support_level = info["features"]["promises"]
                issues = []
                workarounds = []
                
                if support_level == "none":
                    issues.append("Promises not supported")
                    workarounds.append("Use Promise polyfill")
                elif support_level == "partial":
                    issues.append("Promises partially supported")
                    workarounds.append("Add Promise polyfill")
                
                browser_support.append(BrowserSupport(
                    browser=browser,
                    version=info["versions"][0],
                    support_level=support_level,
                    issues=issues,
                    workarounds=workarounds
                ))
        
        return browser_support
    
    def check_html_compatibility(self, html_content: str) -> List[BrowserSupport]:
        """Check HTML compatibility across browsers"""
        browser_support = []
        
        # Check for HTML5 semantic elements
        semantic_elements = ["<main>", "<section>", "<article>", "<aside>", "<header>", "<footer>", "<nav>"]
        for element in semantic_elements:
            if element in html_content:
                for browser, info in self.browser_support_matrix.items():
                    if browser == "ie":
                        issues = [f"HTML5 semantic element {element} not supported"]
                        workarounds = ["Use div with appropriate class names"]
                        support_level = "none"
                    else:
                        issues = []
                        workarounds = []
                        support_level = "full"
                    
                    browser_support.append(BrowserSupport(
                        browser=browser,
                        version=info["versions"][0],
                        support_level=support_level,
                        issues=issues,
                        workarounds=workarounds
                    ))
        
        # Check for modern HTML attributes
        modern_attributes = ['loading="lazy"', 'decoding="async"', 'fetchpriority="high"']
        for attr in modern_attributes:
            if attr in html_content:
                for browser, info in self.browser_support_matrix.items():
                    if browser in ["ie", "safari"] and "11" in info["versions"]:
                        issues = [f"Modern HTML attribute {attr} not supported"]
                        workarounds = ["Use JavaScript-based alternatives"]
                        support_level = "none"
                    else:
                        issues = []
                        workarounds = []
                        support_level = "full"
                    
                    browser_support.append(BrowserSupport(
                        browser=browser,
                        version=info["versions"][0],
                        support_level=support_level,
                        issues=issues,
                        workarounds=workarounds
                    ))
        
        return browser_support
    
    def generate_css_prefixes(self, css_content: str) -> str:
        """Generate CSS prefixes for better browser support"""
        prefixed_css = css_content
        
        # Add vendor prefixes for common properties
        prefix_rules = {
            r'(\s+)transform\s*:': r'\1-webkit-transform:\2;\1-moz-transform:\2;\1-ms-transform:\2;\1-o-transform:\2;\1transform:',
            r'(\s+)transition\s*:': r'\1-webkit-transition:\2;\1-moz-transition:\2;\1-o-transition:\2;\1transition:',
            r'(\s+)animation\s*:': r'\1-webkit-animation:\2;\1-moz-animation:\2;\1-o-animation:\2;\1animation:',
            r'(\s+)border-radius\s*:': r'\1-webkit-border-radius:\2;\1-moz-border-radius:\2;\1border-radius:',
            r'(\s+)box-shadow\s*:': r'\1-webkit-box-shadow:\2;\1-moz-box-shadow:\2;\1box-shadow:',
            r'(\s+)user-select\s*:': r'\1-webkit-user-select:\2;\1-moz-user-select:\2;\1-ms-user-select:\2;\1user-select:',
            r'(\s+)appearance\s*:': r'\1-webkit-appearance:\2;\1-moz-appearance:\2;\1appearance:'
        }
        
        for pattern, replacement in prefix_rules.items():
            prefixed_css = re.sub(pattern, replacement, prefixed_css)
        
        return prefixed_css
    
    def generate_js_polyfills(self, js_content: str) -> str:
        """Generate JavaScript polyfills for better browser support"""
        polyfill_script = ""
        
        # Check for features that need polyfills
        if "fetch(" in js_content:
            polyfill_script += f'<script src="{self.js_polyfills["fetch"]}"></script>\n'
        
        if "Promise" in js_content:
            polyfill_script += f'<script src="{self.js_polyfills["promises"]}"></script>\n'
        
        if "IntersectionObserver" in js_content:
            polyfill_script += f'<script src="{self.js_polyfills["intersection_observer"]}"></script>\n'
        
        if "ResizeObserver" in js_content:
            polyfill_script += f'<script src="{self.js_polyfills["resize_observer"]}"></script>\n'
        
        return polyfill_script
    
    def generate_fallback_html(self, html_content: str) -> str:
        """Generate fallback HTML for better browser support"""
        fallback_html = html_content
        
        # Add fallback for images
        fallback_html = re.sub(
            r'<img([^>]*?)>',
            r'<img\1><noscript><img\1></noscript>',
            fallback_html
        )
        
        # Add fallback for CSS Grid
        if "display: grid" in fallback_html or "display:grid" in fallback_html:
            fallback_html = re.sub(
                r'(\s+)display\s*:\s*grid\s*;',
                r'\1display: -ms-grid;\1display: grid;',
                fallback_html
            )
        
        # Add fallback for CSS Variables
        if "var(" in fallback_html:
            # This would need more sophisticated processing in production
            pass
        
        return fallback_html
    
    def generate_compatibility_report(self, html_content: str, css_content: str, js_content: str) -> CompatibilityReport:
        """Generate comprehensive compatibility report"""
        all_browser_support = []
        
        # Check HTML compatibility
        all_browser_support.extend(self.check_html_compatibility(html_content))
        
        # Check CSS compatibility
        all_browser_support.extend(self.check_css_compatibility(css_content))
        
        # Check JavaScript compatibility
        all_browser_support.extend(self.check_js_compatibility(js_content))
        
        # Calculate overall score
        total_checks = len(all_browser_support)
        full_support = len([bs for bs in all_browser_support if bs.support_level == "full"])
        score = int((full_support / total_checks) * 100) if total_checks > 0 else 0
        
        # Generate recommendations
        recommendations = []
        if score < 80:
            recommendations.append("Add CSS vendor prefixes for better browser support")
            recommendations.append("Include JavaScript polyfills for modern features")
            recommendations.append("Add fallback HTML for unsupported features")
            recommendations.append("Test on older browser versions")
        
        if score < 60:
            recommendations.append("Consider using a CSS framework with built-in browser support")
            recommendations.append("Use a JavaScript transpiler like Babel")
            recommendations.append("Implement progressive enhancement")
            recommendations.append("Add feature detection before using modern APIs")
        
        return CompatibilityReport(
            success=score >= 80,
            browser_support=all_browser_support,
            recommendations=recommendations,
            score=score
        )
    
    def generate_browser_specific_css(self, browser: str) -> str:
        """Generate browser-specific CSS"""
        if browser == "ie":
            return """
            /* IE-specific styles */
            .container {
                display: -ms-flexbox;
                display: flex;
            }
            
            .grid {
                display: -ms-grid;
                display: grid;
            }
            """
        elif browser == "safari":
            return """
            /* Safari-specific styles */
            .container {
                -webkit-transform: translateZ(0);
                transform: translateZ(0);
            }
            """
        else:
            return ""
    
    def generate_feature_detection_js(self) -> str:
        """Generate feature detection JavaScript"""
        return """
        // Feature detection
        function hasFeature(feature) {
            switch(feature) {
                case 'css_grid':
                    return CSS.supports('display', 'grid');
                case 'css_variables':
                    return CSS.supports('color', 'var(--test)');
                case 'fetch':
                    return typeof fetch !== 'undefined';
                case 'promises':
                    return typeof Promise !== 'undefined';
                case 'intersection_observer':
                    return typeof IntersectionObserver !== 'undefined';
                case 'resize_observer':
                    return typeof ResizeObserver !== 'undefined';
                default:
                    return false;
            }
        }
        
        // Apply fallbacks based on feature support
        if (!hasFeature('css_grid')) {
            document.documentElement.classList.add('no-css-grid');
        }
        
        if (!hasFeature('css_variables')) {
            document.documentElement.classList.add('no-css-variables');
        }
        
        if (!hasFeature('fetch')) {
            // Load fetch polyfill
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/whatwg-fetch@3.6.2/dist/fetch.umd.js';
            document.head.appendChild(script);
        }
        """
    
    def get_browser_support_matrix(self) -> Dict[str, Any]:
        """Get browser support matrix"""
        return self.browser_support_matrix
    
    def get_css_prefixes(self) -> Dict[str, List[str]]:
        """Get CSS prefixes for different browsers"""
        return self.css_prefixes
    
    def get_js_polyfills(self) -> Dict[str, str]:
        """Get JavaScript polyfills for different features"""
        return self.js_polyfills
