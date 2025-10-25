#!/usr/bin/env python3
"""
Create HTML documentation with navigation - no external dependencies
"""

import os
import re
from pathlib import Path
from datetime import datetime

def simple_markdown_to_html(md_content):
    """Simple markdown to HTML conversion without external dependencies"""
    
    # Convert headers
    md_content = re.sub(r'^# (.*)$', r'<h1>\1</h1>', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^## (.*)$', r'<h2>\1</h2>', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^### (.*)$', r'<h3>\1</h3>', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^#### (.*)$', r'<h4>\1</h4>', md_content, flags=re.MULTILINE)
    
    # Convert bold and italic
    md_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', md_content)
    md_content = re.sub(r'\*(.*?)\*', r'<em>\1</em>', md_content)
    
    # Convert code blocks
    md_content = re.sub(r'```(.*?)```', r'<pre><code>\1</code></pre>', md_content, flags=re.DOTALL)
    md_content = re.sub(r'`(.*?)`', r'<code>\1</code>', md_content)
    
    # Convert lists
    md_content = re.sub(r'^\- (.*)$', r'<li>\1</li>', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^(\d+)\. (.*)$', r'<li>\2</li>', md_content, flags=re.MULTILINE)
    
    # Wrap consecutive <li> in <ul>
    md_content = re.sub(r'(<li>.*?</li>)', r'<ul>\1</ul>', md_content, flags=re.DOTALL)
    
    # Convert links
    md_content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', md_content)
    
    # Convert paragraphs (double newlines)
    paragraphs = md_content.split('\n\n')
    html_paragraphs = []
    for p in paragraphs:
        p = p.strip()
        if p and not p.startswith('<'):
            p = f'<p>{p}</p>'
        html_paragraphs.append(p)
    
    return '\n\n'.join(html_paragraphs)

def create_html_doc(md_file_path, output_path, title, prev_file=None, next_file=None):
    """Create HTML document with navigation"""
    
    # Read markdown content
    try:
        with open(md_file_path, 'r', encoding='utf-8') as f:
            md_content = f.read()
    except FileNotFoundError:
        print(f"⚠️  File not found: {md_file_path}")
        return False
    
    # Convert to HTML
    html_content = simple_markdown_to_html(md_content)
    
    # Create HTML template
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - RoleFerry Documentation</title>
    <link rel="stylesheet" href="../styles.css">
    <link rel="icon" href="../assets/roleferry_trans.png">
    <style>
        body {{
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #f8fafc;
        }}
        .header {{
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem;
            background: linear-gradient(135deg, #2563eb 0%, #10b981 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        .header h1 {{
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
        }}
        .content {{
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }}
        .content h1, .content h2, .content h3, .content h4 {{
            color: #2563eb;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }}
        .content h1 {{
            font-size: 2rem;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 0.5rem;
        }}
        .content h2 {{
            font-size: 1.5rem;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 0.25rem;
        }}
        .content h3 {{
            font-size: 1.25rem;
        }}
        .content p {{
            margin-bottom: 1rem;
        }}
        .content ul, .content ol {{
            margin-bottom: 1rem;
            padding-left: 2rem;
        }}
        .content li {{
            margin-bottom: 0.5rem;
        }}
        .content code {{
            background: #f1f5f9;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
        }}
        .content pre {{
            background: #f1f5f9;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1rem 0;
        }}
        .content pre code {{
            background: none;
            padding: 0;
        }}
        .content table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }}
        .content th, .content td {{
            border: 1px solid #e5e7eb;
            padding: 0.75rem;
            text-align: left;
        }}
        .content th {{
            background: #f8fafc;
            font-weight: 600;
        }}
        .navigation {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }}
        .nav-button {{
            display: inline-flex;
            align-items: center;
            padding: 0.75rem 1.5rem;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s ease;
        }}
        .nav-button:hover {{
            background: #1d4ed8;
            transform: translateY(-2px);
        }}
        .nav-button:disabled {{
            background: #9ca3af;
            cursor: not-allowed;
            transform: none;
        }}
        .nav-button:disabled:hover {{
            background: #9ca3af;
            transform: none;
        }}
        .nav-center {{
            text-align: center;
            flex: 1;
        }}
        .nav-center h3 {{
            margin: 0;
            color: #374151;
        }}
        .nav-center p {{
            margin: 0.25rem 0 0 0;
            color: #6b7280;
            font-size: 0.9rem;
        }}
        .footer {{
            text-align: center;
            margin-top: 3rem;
            padding: 2rem;
            background: #374151;
            color: white;
            border-radius: 12px;
        }}
        .breadcrumb {{
            background: #f1f5f9;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }}
        .breadcrumb a {{
            color: #2563eb;
            text-decoration: none;
        }}
        .breadcrumb a:hover {{
            text-decoration: underline;
        }}
        @media (max-width: 768px) {{
            body {{
                padding: 1rem;
            }}
            .header h1 {{
                font-size: 2rem;
            }}
            .navigation {{
                flex-direction: column;
                gap: 1rem;
            }}
            .nav-button {{
                width: 100%;
                justify-content: center;
            }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>RoleFerry Documentation</h1>
        <p>{title}</p>
    </div>

    <div class="breadcrumb">
        <a href="../index.html">Home</a> &gt; 
        <a href="../WEEK_4_UPDATES.html">Week 4 Updates</a> &gt; 
        {title}
    </div>

    <div class="navigation">
        {"<a href='" + prev_file + "' class='nav-button'>← Previous</a>" if prev_file else "<span class='nav-button' style='background: #9ca3af; cursor: not-allowed;'>← Previous</span>"}
        
        <div class="nav-center">
            <h3>{title}</h3>
            <p>Documentation Navigation</p>
        </div>
        
        {"<a href='" + next_file + "' class='nav-button'>Next →</a>" if next_file else "<span class='nav-button' style='background: #9ca3af; cursor: not-allowed;'>Next →</span>"}
    </div>

    <div class="content">
        {html_content}
    </div>

    <div class="navigation">
        {"<a href='" + prev_file + "' class='nav-button'>← Previous</a>" if prev_file else "<span class='nav-button' style='background: #9ca3af; cursor: not-allowed;'>← Previous</span>"}
        
        <div class="nav-center">
            <h3>{title}</h3>
            <p>Documentation Navigation</p>
        </div>
        
        {"<a href='" + next_file + "' class='nav-button'>Next →</a>" if next_file else "<span class='nav-button' style='background: #9ca3af; cursor: not-allowed;'>Next →</span>"}
    </div>

    <div class="footer">
        <h3>RoleFerry Documentation</h3>
        <p>Complete platform documentation with navigation</p>
        <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
</body>
</html>"""
    
    # Create output directory
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write HTML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    
    return True

def main():
    """Main conversion function"""
    print("Creating HTML documentation with navigation...")
    
    # Key documentation files to convert
    docs_to_convert = [
        ("01-strategic/executive-summary.md", "html/01-strategic/executive-summary.html", "Executive Summary"),
        ("02-requirements/functional-requirements.md", "html/02-requirements/functional-requirements.html", "Functional Requirements"),
        ("03-architecture/system-architecture_conceptual.md", "html/03-architecture/system-architecture_conceptual.html", "System Architecture - Conceptual"),
        ("04-technical/api-specification.md", "html/04-technical/api-specification.html", "API Specification"),
        ("05-ux-design/ui-specifications.md", "html/05-ux-design/ui-specifications.html", "UI Specifications"),
        ("08-business/investor-faq.md", "html/08-business/investor-faq.html", "Investor FAQ"),
        ("09-monetization/resume-database-concept.md", "html/09-monetization/resume-database-concept.html", "Resume Database Concept"),
        ("10-innovation/one-click-employment-concept.md", "html/10-innovation/one-click-employment-concept.html", "One-Click Employment Concept"),
        ("11-design/offer-first-design-concept.md", "html/11-design/offer-first-design-concept.html", "Offer-First Design Concept"),
        ("12-features/livepages-concept.md", "html/12-features/livepages-concept.html", "LivePages Concept"),
        ("13-development/frontend-first-philosophy.md", "html/13-development/frontend-first-philosophy.html", "Frontend-First Philosophy")
    ]
    
    converted_count = 0
    
    for i, (md_file, html_file, title) in enumerate(docs_to_convert):
        md_path = Path(md_file)
        html_path = Path(html_file)
        
        # Determine previous and next files with proper relative paths
        prev_file = None
        next_file = None
        
        if i > 0:
            prev_file = docs_to_convert[i-1][1]
            # Calculate relative path from current file to previous file
            current_dir = Path(html_file).parent
            prev_path = Path(prev_file)
            prev_file = os.path.relpath(prev_path, current_dir)
        
        if i < len(docs_to_convert) - 1:
            next_file = docs_to_convert[i+1][1]
            # Calculate relative path from current file to next file
            current_dir = Path(html_file).parent
            next_path = Path(next_file)
            next_file = os.path.relpath(next_path, current_dir)
        
        if create_html_doc(md_path, html_path, title, prev_file, next_file):
            converted_count += 1
            print(f"Converted: {md_file} -> {html_file}")
        else:
            print(f"Failed to convert: {md_file}")
    
    # Create index page for HTML docs
    create_html_index()
    
    print(f"\nConversion complete! {converted_count} files converted to HTML with navigation.")
    print("All files are now accessible via GitHub Pages with next/previous navigation!")

def create_html_index():
    """Create index page for HTML documentation"""
    
    html_index = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RoleFerry Documentation - HTML Navigation</title>
    <link rel="stylesheet" href="../styles.css">
    <link rel="icon" href="../assets/roleferry_trans.png">
    <style>
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #f8fafc;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem;
            background: linear-gradient(135deg, #2563eb 0%, #10b981 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        .content {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .doc-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }
        .doc-card {
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s ease;
        }
        .doc-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .doc-card h3 {
            margin: 0 0 1rem 0;
            color: #2563eb;
        }
        .doc-card p {
            margin: 0 0 1rem 0;
            color: #6b7280;
        }
        .doc-card a {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        .doc-card a:hover {
            background: #1d4ed8;
        }
        .breadcrumb {
            background: #f1f5f9;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        .breadcrumb a {
            color: #2563eb;
            text-decoration: none;
        }
        .breadcrumb a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>RoleFerry Documentation</h1>
        <p>Complete HTML Documentation with Navigation</p>
    </div>

    <div class="breadcrumb">
        <a href="../index.html">Home</a> &gt; 
        <a href="../WEEK_4_UPDATES.html">Week 4 Updates</a> &gt; 
        HTML Documentation
    </div>

    <div class="content">
        <h1>HTML Documentation Navigation</h1>
        <p>All documentation files have been converted to HTML with next/previous navigation buttons for easy browsing.</p>
        
        <div class="doc-grid">
            <div class="doc-card">
                <h3>Executive Summary</h3>
                <p>High-level overview of RoleFerry's vision, problem, solution, and business model.</p>
                <a href="01-strategic/executive-summary.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>Functional Requirements</h3>
                <p>Detailed functional specifications for all features including the 10-tab workflow system.</p>
                <a href="02-requirements/functional-requirements.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>System Architecture</h3>
                <p>Conceptual, logical, and implementable system architecture documentation.</p>
                <a href="03-architecture/system-architecture_conceptual.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>API Specification</h3>
                <p>Complete API documentation for all endpoints and integrations.</p>
                <a href="04-technical/api-specification.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>UI Specifications</h3>
                <p>Detailed UI component specifications and interaction patterns.</p>
                <a href="05-ux-design/ui-specifications.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>Investor FAQ</h3>
                <p>Frequently asked questions for investors and stakeholders.</p>
                <a href="08-business/investor-faq.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>Resume Database Concept</h3>
                <p>Monetization strategy for resume database and candidate matching.</p>
                <a href="09-monetization/resume-database-concept.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>One-Click Employment</h3>
                <p>Revolutionary concept for streamlined job application process.</p>
                <a href="10-innovation/one-click-employment-concept.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>Offer-First Design</h3>
                <p>Design philosophy prioritizing value proposition and two-way exchange.</p>
                <a href="11-design/offer-first-design-concept.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>LivePages Concept</h3>
                <p>Personalized landing pages for targeted email campaigns.</p>
                <a href="12-features/livepages-concept.html">Read More</a>
            </div>
            
            <div class="doc-card">
                <h3>Frontend-First Philosophy</h3>
                <p>Development approach prioritizing frontend with mock data integration.</p>
                <a href="13-development/frontend-first-philosophy.html">Read More</a>
            </div>
        </div>
        
        <h2>Navigation Features</h2>
        <ul>
            <li><strong>Next/Previous Buttons:</strong> Navigate through documentation sequentially</li>
            <li><strong>Responsive Design:</strong> Works on desktop, tablet, and mobile devices</li>
            <li><strong>Breadcrumb Navigation:</strong> Easy navigation back to main sections</li>
            <li><strong>Professional Styling:</strong> Consistent with RoleFerry brand colors</li>
            <li><strong>GitHub Pages Ready:</strong> All files accessible via public GitHub Pages</li>
        </ul>
    </div>
</body>
</html>"""
    
    with open('html/index.html', 'w', encoding='utf-8') as f:
        f.write(html_index)

if __name__ == "__main__":
    main()
