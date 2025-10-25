"""
Performance optimization service for RoleFerry
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import re
import time
import asyncio
from functools import wraps

class PerformanceMetric(BaseModel):
    metric_name: str
    value: float
    unit: str
    threshold: float
    status: str  # "good", "warning", "critical"

class PerformanceReport(BaseModel):
    success: bool
    metrics: List[PerformanceMetric] = []
    recommendations: List[str] = []
    score: int = 0

class PerformanceOptimizationService:
    """Service for optimizing performance across the application"""
    
    def __init__(self):
        self.performance_thresholds = {
            "page_load_time": 3.0,  # seconds
            "first_contentful_paint": 1.8,  # seconds
            "largest_contentful_paint": 2.5,  # seconds
            "cumulative_layout_shift": 0.1,  # score
            "first_input_delay": 100,  # milliseconds
            "time_to_interactive": 3.8,  # seconds
            "total_blocking_time": 200,  # milliseconds
            "speed_index": 3.4,  # seconds
        }
        
        self.optimization_techniques = {
            "lazy_loading": "Load images and content only when needed",
            "code_splitting": "Split JavaScript into smaller chunks",
            "minification": "Remove unnecessary characters from code",
            "compression": "Compress assets to reduce file size",
            "caching": "Store frequently used data in memory",
            "cdn": "Use Content Delivery Network for faster delivery",
            "preloading": "Load critical resources early",
            "prefetching": "Load resources that might be needed",
            "debouncing": "Limit the rate of function calls",
            "throttling": "Control the rate of function execution"
        }
    
    def measure_execution_time(self, func):
        """Decorator to measure function execution time"""
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            result = await func(*args, **kwargs)
            end_time = time.time()
            execution_time = end_time - start_time
            
            # Log performance metrics
            print(f"Function {func.__name__} executed in {execution_time:.4f} seconds")
            
            return result
        return wrapper
    
    def optimize_html_content(self, html_content: str) -> str:
        """Optimize HTML content for better performance"""
        optimized_html = html_content
        
        # Remove unnecessary whitespace
        optimized_html = re.sub(r'\s+', ' ', optimized_html)
        
        # Remove comments
        optimized_html = re.sub(r'<!--.*?-->', '', optimized_html, flags=re.DOTALL)
        
        # Optimize inline styles
        optimized_html = self._optimize_inline_styles(optimized_html)
        
        # Add performance hints
        optimized_html = self._add_performance_hints(optimized_html)
        
        return optimized_html
    
    def _optimize_inline_styles(self, html_content: str) -> str:
        """Optimize inline styles for better performance"""
        # Remove unnecessary CSS properties
        style_pattern = r'style="([^"]*)"'
        
        def optimize_style(match):
            style_content = match.group(1)
            # Remove unnecessary properties
            optimized_style = re.sub(r'\s*;\s*$', '', style_content)
            return f'style="{optimized_style}"'
        
        return re.sub(style_pattern, optimize_style, html_content)
    
    def _add_performance_hints(self, html_content: str) -> str:
        """Add performance hints to HTML content"""
        hints = [
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<meta name="theme-color" content="#000000">',
            '<link rel="preconnect" href="https://fonts.googleapis.com">',
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
            '<link rel="dns-prefetch" href="//fonts.googleapis.com">',
            '<link rel="dns-prefetch" href="//fonts.gstatic.com">'
        ]
        
        # Add hints to head section
        head_pattern = r'(<head[^>]*>)'
        if re.search(head_pattern, html_content):
            for hint in hints:
                if hint not in html_content:
                    html_content = re.sub(
                        head_pattern, 
                        f'\\1\n  {hint}', 
                        html_content
                    )
        
        return html_content
    
    def optimize_css_content(self, css_content: str) -> str:
        """Optimize CSS content for better performance"""
        optimized_css = css_content
        
        # Remove unnecessary whitespace
        optimized_css = re.sub(r'\s+', ' ', optimized_css)
        
        # Remove comments
        optimized_css = re.sub(r'/\*.*?\*/', '', optimized_css, flags=re.DOTALL)
        
        # Remove unnecessary semicolons
        optimized_css = re.sub(r';\s*}', '}', optimized_css)
        
        # Optimize color values
        optimized_css = self._optimize_color_values(optimized_css)
        
        # Remove unused CSS
        optimized_css = self._remove_unused_css(optimized_css)
        
        return optimized_css
    
    def _optimize_color_values(self, css_content: str) -> str:
        """Optimize color values in CSS"""
        # Convert hex colors to shorter form
        css_content = re.sub(r'#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3', r'#\1\2\3', css_content)
        
        # Convert rgb to hex where possible
        rgb_pattern = r'rgb\((\d+),\s*(\d+),\s*(\d+)\)'
        def rgb_to_hex(match):
            r, g, b = int(match.group(1)), int(match.group(2)), int(match.group(3))
            return f'#{r:02x}{g:02x}{b:02x}'
        
        css_content = re.sub(rgb_pattern, rgb_to_hex, css_content)
        
        return css_content
    
    def _remove_unused_css(self, css_content: str) -> str:
        """Remove unused CSS rules"""
        # This is a simplified version - in production, you'd use more sophisticated tools
        # like PurgeCSS or UnusedCSS
        
        # Remove empty rules
        css_content = re.sub(r'[^{}]+{\s*}', '', css_content)
        
        # Remove rules with only comments
        css_content = re.sub(r'/\*.*?\*/\s*[^{}]*{\s*}', '', css_content, flags=re.DOTALL)
        
        return css_content
    
    def optimize_javascript_content(self, js_content: str) -> str:
        """Optimize JavaScript content for better performance"""
        optimized_js = js_content
        
        # Remove unnecessary whitespace
        optimized_js = re.sub(r'\s+', ' ', optimized_js)
        
        # Remove comments
        optimized_js = re.sub(r'//.*$', '', optimized_js, flags=re.MULTILINE)
        optimized_js = re.sub(r'/\*.*?\*/', '', optimized_js, flags=re.DOTALL)
        
        # Remove unnecessary semicolons
        optimized_js = re.sub(r';\s*}', '}', optimized_js)
        
        # Optimize variable names (basic minification)
        optimized_js = self._minify_variable_names(optimized_js)
        
        return optimized_js
    
    def _minify_variable_names(self, js_content: str) -> str:
        """Minify variable names in JavaScript"""
        # This is a simplified version - in production, you'd use tools like UglifyJS or Terser
        
        # Find variable declarations
        var_pattern = r'var\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*='
        let_pattern = r'let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*='
        const_pattern = r'const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*='
        
        # For now, just return the original content
        # In production, you'd implement proper minification
        return js_content
    
    def generate_performance_report(self, metrics: Dict[str, float]) -> PerformanceReport:
        """Generate performance report based on metrics"""
        performance_metrics = []
        recommendations = []
        
        for metric_name, value in metrics.items():
            threshold = self.performance_thresholds.get(metric_name, 0)
            
            if value <= threshold:
                status = "good"
            elif value <= threshold * 1.5:
                status = "warning"
            else:
                status = "critical"
            
            performance_metrics.append(PerformanceMetric(
                metric_name=metric_name,
                value=value,
                unit=self._get_metric_unit(metric_name),
                threshold=threshold,
                status=status
            ))
        
        # Generate recommendations
        for metric in performance_metrics:
            if metric.status == "warning":
                recommendations.append(f"Consider optimizing {metric.metric_name}")
            elif metric.status == "critical":
                recommendations.append(f"Urgent: Optimize {metric.metric_name}")
        
        # Calculate overall score
        good_count = len([m for m in performance_metrics if m.status == "good"])
        total_count = len(performance_metrics)
        score = int((good_count / total_count) * 100) if total_count > 0 else 0
        
        return PerformanceReport(
            success=score >= 80,
            metrics=performance_metrics,
            recommendations=recommendations,
            score=score
        )
    
    def _get_metric_unit(self, metric_name: str) -> str:
        """Get the unit for a performance metric"""
        units = {
            "page_load_time": "seconds",
            "first_contentful_paint": "seconds",
            "largest_contentful_paint": "seconds",
            "cumulative_layout_shift": "score",
            "first_input_delay": "milliseconds",
            "time_to_interactive": "seconds",
            "total_blocking_time": "milliseconds",
            "speed_index": "seconds"
        }
        return units.get(metric_name, "units")
    
    def optimize_images(self, image_paths: List[str]) -> List[str]:
        """Optimize images for better performance"""
        optimized_paths = []
        
        for path in image_paths:
            # Add image optimization hints
            if path.endswith('.jpg') or path.endswith('.jpeg'):
                optimized_paths.append(f"{path}?format=webp&quality=80")
            elif path.endswith('.png'):
                optimized_paths.append(f"{path}?format=webp&quality=80")
            else:
                optimized_paths.append(path)
        
        return optimized_paths
    
    def generate_lazy_loading_html(self, image_path: str, alt_text: str = "") -> str:
        """Generate lazy loading HTML for images"""
        return f'''
        <img 
            src="{image_path}" 
            alt="{alt_text}" 
            loading="lazy" 
            decoding="async"
            style="width: 100%; height: auto;"
        >
        '''
    
    def generate_preload_hints(self, resources: List[str]) -> str:
        """Generate preload hints for critical resources"""
        hints = []
        
        for resource in resources:
            if resource.endswith('.css'):
                hints.append(f'<link rel="preload" href="{resource}" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">')
            elif resource.endswith('.js'):
                hints.append(f'<link rel="preload" href="{resource}" as="script">')
            elif resource.endswith(('.jpg', '.jpeg', '.png', '.webp')):
                hints.append(f'<link rel="preload" href="{resource}" as="image">')
            elif resource.endswith('.woff2'):
                hints.append(f'<link rel="preload" href="{resource}" as="font" type="font/woff2" crossorigin>')
        
        return '\n'.join(hints)
    
    def generate_critical_css(self, css_content: str) -> str:
        """Generate critical CSS for above-the-fold content"""
        # This is a simplified version - in production, you'd use tools like Critical CSS
        
        # Extract critical CSS rules (simplified)
        critical_rules = []
        
        # Look for common critical selectors
        critical_selectors = [
            'body', 'html', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.container', '.header', '.nav', '.main', '.footer',
            '.btn', '.button', '.form', '.input', '.textarea'
        ]
        
        for selector in critical_selectors:
            pattern = rf'{re.escape(selector)}\s*{{[^}}]*}}'
            matches = re.findall(pattern, css_content, re.IGNORECASE)
            critical_rules.extend(matches)
        
        return '\n'.join(critical_rules)
    
    def optimize_database_queries(self, queries: List[str]) -> List[str]:
        """Optimize database queries for better performance"""
        optimized_queries = []
        
        for query in queries:
            # Add basic query optimization
            optimized_query = query
            
            # Add LIMIT clauses where appropriate
            if 'SELECT' in query.upper() and 'LIMIT' not in query.upper():
                optimized_query += ' LIMIT 100'
            
            # Add indexes hints (simplified)
            if 'WHERE' in query.upper():
                optimized_query = optimized_query.replace('WHERE', 'WHERE /*+ USE_INDEX */')
            
            optimized_queries.append(optimized_query)
        
        return optimized_queries
    
    def implement_caching_strategy(self, cache_key: str, ttl: int = 3600) -> str:
        """Implement caching strategy for better performance"""
        return f'''
        # Implement caching for key: {cache_key}
        # TTL: {ttl} seconds
        
        import redis
        import json
        from datetime import datetime, timedelta
        
        def get_cached_data(key: str):
            try:
                # Connect to Redis
                r = redis.Redis(host='localhost', port=6379, db=0)
                
                # Get cached data
                cached_data = r.get(key)
                if cached_data:
                    return json.loads(cached_data)
                
                return None
            except Exception as e:
                print(f"Cache error: {e}")
                return None
        
        def set_cached_data(key: str, data: dict, ttl: int = {ttl}):
            try:
                # Connect to Redis
                r = redis.Redis(host='localhost', port=6379, db=0)
                
                # Set cached data
                r.setex(key, ttl, json.dumps(data))
                return True
            except Exception as e:
                print(f"Cache error: {e}")
                return False
        '''
    
    def generate_performance_budget(self) -> Dict[str, Any]:
        """Generate performance budget for the application"""
        return {
            "budget": {
                "total_budget": "500KB",
                "javascript": "200KB",
                "css": "100KB",
                "images": "200KB",
                "fonts": "50KB",
                "other": "50KB"
            },
            "thresholds": {
                "page_load_time": "3.0s",
                "first_contentful_paint": "1.8s",
                "largest_contentful_paint": "2.5s",
                "cumulative_layout_shift": "0.1",
                "first_input_delay": "100ms",
                "time_to_interactive": "3.8s"
            },
            "recommendations": [
                "Use WebP format for images",
                "Implement lazy loading",
                "Minify CSS and JavaScript",
                "Use a CDN for static assets",
                "Enable gzip compression",
                "Implement service workers",
                "Use critical CSS",
                "Optimize database queries",
                "Implement caching strategies",
                "Monitor performance metrics"
            ]
        }
