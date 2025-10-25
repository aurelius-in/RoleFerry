#!/usr/bin/env python3
"""
Convert all markdown documentation files to HTML with navigation
"""

import os
import re
from pathlib import Path
import markdown
from datetime import datetime

def convert_md_to_html(md_file_path, output_dir, nav_data):
    """Convert a markdown file to HTML with navigation"""
    
    # Read markdown content
    with open(md_file_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Convert to HTML
    html_content = markdown.markdown(md_content, extensions=['tables', 'fenced_code', 'toc'])
    
    # Get relative path for navigation
    rel_path = str(md_file_path.relative_to(Path('docs')))
    current_index = nav_data['files'].index(rel_path) if rel_path in nav_data['files'] else 0
    
    # Get previous and next files
    prev_file = nav_data['files'][current_index - 1] if current_index > 0 else None
    next_file = nav_data['files'][current_index + 1] if current_index < len(nav_data['files']) - 1 else None
    
    # Create HTML template
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{nav_data['titles'][current_index]} - RoleFerry Documentation</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="icon" href="assets/roleferry_trans.png">
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
        .content h1, .content h2, .content h3 {{
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
        .toc {{
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 8px;
            margin: 2rem 0;
            border-left: 4px solid #2563eb;
        }}
        .toc h3 {{
            margin-top: 0;
            color: #2563eb;
        }}
        .toc ul {{
            list-style: none;
            padding-left: 0;
        }}
        .toc li {{
            margin: 0.5rem 0;
        }}
        .toc a {{
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
        }}
        .toc a:hover {{
            text-decoration: underline;
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
    </style>
</head>
<body>
    <div class="header">
        <h1>RoleFerry Documentation</h1>
        <p>{nav_data['titles'][current_index]}</p>
    </div>

    <div class="breadcrumb">
        <a href="index.html">Home</a> &gt; 
        <a href="WEEK_4_UPDATES.html">Week 4 Updates</a> &gt; 
        {nav_data['titles'][current_index]}
    </div>

    <div class="navigation">
        {"<a href='" + prev_file + "' class='nav-button'>← Previous</a>" if prev_file else "<span class='nav-button' style='background: #9ca3af; cursor: not-allowed;'>← Previous</span>"}
        
        <div class="nav-center">
            <h3>{nav_data['titles'][current_index]}</h3>
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
            <h3>{nav_data['titles'][current_index]}</h3>
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
    
    return html_template

def get_documentation_structure():
    """Get the complete documentation structure"""
    return {
        'files': [
            '01-strategic/executive-summary.md',
            '01-strategic/product-vision.md',
            '01-strategic/vision-mission-values.md',
            '01-strategic/product-positioning.md',
            '01-strategic/product-roadmap.md',
            '01-strategic/exit-strategy.md',
            '01-strategic/risk-assessment.md',
            '01-strategic/success-criteria.md',
            '01-strategic/stakeholder-register.md',
            '01-strategic/competitor-response-plan.md',
            '01-strategic/technical-debt-management.md',
            '02-requirements/functional-requirements.md',
            '02-requirements/non-functional-requirements.md',
            '02-requirements/user-stories.md',
            '02-requirements/use-cases.md',
            '02-requirements/acceptance-criteria.md',
            '02-requirements/user-flows.md',
            '02-requirements/epic-breakdown.md',
            '02-requirements/feature-backlog.md',
            '02-requirements/data-model-erd.md',
            '02-requirements/user-research-methodology.md',
            '02-requirements/internationalization-plan.md',
            '02-requirements/release-process.md',
            '03-architecture/system-architecture_conceptual.md',
            '03-architecture/system-architecture_logical.md',
            '03-architecture/system-architecture_implementable.md',
            '03-architecture/data-architecture_conceptual.md',
            '03-architecture/data-architecture_logical.md',
            '03-architecture/data-architecture_implementable.md',
            '03-architecture/security-architecture_conceptual.md',
            '03-architecture/security-architecture_logical.md',
            '03-architecture/security-architecture_implementable.md',
            '03-architecture/integration-architecture_conceptual.md',
            '03-architecture/integration-architecture_logical.md',
            '03-architecture/integration-architecture_implementable.md',
            '04-technical/tech-stack.md',
            '04-technical/api-specification.md',
            '04-technical/database-schema.md',
            '04-technical/frontend-architecture.md',
            '04-technical/backend-services-guide.md',
            '04-technical/api-integration-guide.md',
            '04-technical/third-party-integrations.md',
            '04-technical/caching-strategy.md',
            '04-technical/performance-optimization.md',
            '04-technical/error-handling-guide.md',
            '04-technical/security-policies.md',
            '04-technical/environment-configuration.md',
            '04-technical/deployment-guide.md',
            '04-technical/cicd-pipeline.md',
            '04-technical/infrastructure-as-code.md',
            '04-technical/messaging-queue-architecture.md',
            '04-technical/email-infrastructure-guide.md',
            '04-technical/webhooks-guide.md',
            '04-technical/api-versioning-strategy.md',
            '04-technical/api-rate-limiting.md',
            '04-technical/feature-flag-strategy.md',
            '05-ux-design/user-personas.md',
            '05-ux-design/user-journey-maps.md',
            '05-ux-design/design-system.md',
            '05-ux-design/ui-specifications.md',
            '05-ux-design/accessibility-guide.md',
            '05-ux-design/mobile-considerations.md',
            '05-ux-design/onboarding-flow.md',
            '05-ux-design/content-strategy.md',
            '05-ux-design/feature-specifications.md',
            '06-operations/monitoring-observability.md',
            '06-operations/log-management.md',
            '06-operations/performance-benchmarks.md',
            '06-operations/capacity-planning.md',
            '06-operations/scaling-guide.md',
            '06-operations/backup-restore-procedures.md',
            '06-operations/disaster-recovery.md',
            '06-operations/disaster-recovery-plan.md',
            '06-operations/incident-response-plan.md',
            '06-operations/security-incident-runbook.md',
            '06-operations/secrets-management.md',
            '06-operations/data-migration-guide.md',
            '06-operations/customer-support-playbook.md',
            '06-operations/support-runbook.md',
            '06-operations/quality-assurance-plan.md',
            '06-operations/testing-strategy.md',
            '06-operations/release-process.md',
            '07-compliance/privacy-policy.md',
            '07-compliance/terms-of-service.md',
            '07-compliance/acceptable-use-policy.md',
            '07-compliance/security-policies.md',
            '07-compliance/data-retention-policy.md',
            '07-compliance/gdpr-compliance-guide.md',
            '07-compliance/can-spam-compliance.md',
            '08-business/business-model.md',
            '08-business/market-analysis.md',
            '08-business/competitive-analysis.md',
            '08-business/financial-projections.md',
            '08-business/funding-strategy.md',
            '08-business/revenue-model.md',
            '08-business/pricing-strategy.md',
            '08-business/sales-strategy.md',
            '08-business/marketing-strategy.md',
            '08-business/customer-acquisition.md',
            '08-business/partnership-strategy.md',
            '08-business/risk-management.md',
            '08-business/legal-considerations.md',
            '08-business/intellectual-property.md',
            '08-business/regulatory-compliance.md',
            '08-business/insurance-requirements.md',
            '08-business/contract-templates.md',
            '08-business/terms-conditions.md',
            '08-business/privacy-policy-business.md',
            '08-business/cookie-policy.md',
            '08-business/data-protection.md',
            '08-business/security-standards.md',
            '08-business/investor-faq.md',
            '09-monetization/resume-database-concept.md',
            '10-innovation/one-click-employment-concept.md',
            '11-design/offer-first-design-concept.md',
            '12-features/livepages-concept.md',
            '13-development/frontend-first-philosophy.md'
        ],
        'titles': [
            'Executive Summary',
            'Product Vision',
            'Vision, Mission & Values',
            'Product Positioning',
            'Product Roadmap',
            'Exit Strategy',
            'Risk Assessment',
            'Success Criteria',
            'Stakeholder Register',
            'Competitor Response Plan',
            'Technical Debt Management',
            'Functional Requirements',
            'Non-Functional Requirements',
            'User Stories',
            'Use Cases',
            'Acceptance Criteria',
            'User Flows',
            'Epic Breakdown',
            'Feature Backlog',
            'Data Model ERD',
            'User Research Methodology',
            'Internationalization Plan',
            'Release Process',
            'System Architecture - Conceptual',
            'System Architecture - Logical',
            'System Architecture - Implementable',
            'Data Architecture - Conceptual',
            'Data Architecture - Logical',
            'Data Architecture - Implementable',
            'Security Architecture - Conceptual',
            'Security Architecture - Logical',
            'Security Architecture - Implementable',
            'Integration Architecture - Conceptual',
            'Integration Architecture - Logical',
            'Integration Architecture - Implementable',
            'Tech Stack',
            'API Specification',
            'Database Schema',
            'Frontend Architecture',
            'Backend Services Guide',
            'API Integration Guide',
            'Third-Party Integrations',
            'Caching Strategy',
            'Performance Optimization',
            'Error Handling Guide',
            'Security Policies',
            'Environment Configuration',
            'Deployment Guide',
            'CI/CD Pipeline',
            'Infrastructure as Code',
            'Messaging Queue Architecture',
            'Email Infrastructure Guide',
            'Webhooks Guide',
            'API Versioning Strategy',
            'API Rate Limiting',
            'Feature Flag Strategy',
            'User Personas',
            'User Journey Maps',
            'Design System',
            'UI Specifications',
            'Accessibility Guide',
            'Mobile Considerations',
            'Onboarding Flow',
            'Content Strategy',
            'Feature Specifications',
            'Monitoring & Observability',
            'Log Management',
            'Performance Benchmarks',
            'Capacity Planning',
            'Scaling Guide',
            'Backup & Restore Procedures',
            'Disaster Recovery',
            'Disaster Recovery Plan',
            'Incident Response Plan',
            'Security Incident Runbook',
            'Secrets Management',
            'Data Migration Guide',
            'Customer Support Playbook',
            'Support Runbook',
            'Quality Assurance Plan',
            'Testing Strategy',
            'Release Process',
            'Privacy Policy',
            'Terms of Service',
            'Acceptable Use Policy',
            'Security Policies',
            'Data Retention Policy',
            'GDPR Compliance Guide',
            'CAN-SPAM Compliance',
            'Business Model',
            'Market Analysis',
            'Competitive Analysis',
            'Financial Projections',
            'Funding Strategy',
            'Revenue Model',
            'Pricing Strategy',
            'Sales Strategy',
            'Marketing Strategy',
            'Customer Acquisition',
            'Partnership Strategy',
            'Risk Management',
            'Legal Considerations',
            'Intellectual Property',
            'Regulatory Compliance',
            'Insurance Requirements',
            'Contract Templates',
            'Terms & Conditions',
            'Privacy Policy - Business',
            'Cookie Policy',
            'Data Protection',
            'Security Standards',
            'Investor FAQ',
            'Resume Database Concept',
            'One-Click Employment Concept',
            'Offer-First Design Concept',
            'LivePages Concept',
            'Frontend-First Philosophy'
        ]
    }

def main():
    """Main conversion function"""
    print("🔄 Converting documentation to HTML with navigation...")
    
    # Get documentation structure
    nav_data = get_documentation_structure()
    
    # Create output directory
    output_dir = Path('docs/html')
    output_dir.mkdir(exist_ok=True)
    
    # Convert each file
    converted_count = 0
    for i, md_file in enumerate(nav_data['files']):
        md_path = Path('docs') / md_file
        
        if md_path.exists():
            try:
                # Convert to HTML
                html_content = convert_md_to_html(md_path, output_dir, nav_data)
                
                # Create output path
                html_file = md_file.replace('.md', '.html')
                output_path = output_dir / html_file
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Write HTML file
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                
                converted_count += 1
                print(f"✅ Converted: {md_file}")
                
            except Exception as e:
                print(f"❌ Error converting {md_file}: {e}")
        else:
            print(f"⚠️  File not found: {md_file}")
    
    print(f"\n🎉 Conversion complete! {converted_count} files converted to HTML with navigation.")
    print(f"📁 Output directory: {output_dir}")
    print("🌐 All files are now accessible via GitHub Pages with next/previous navigation!")

if __name__ == "__main__":
    main()
