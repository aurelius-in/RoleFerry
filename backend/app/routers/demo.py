from fastapi import APIRouter
from ..storage import store
from ..services import gate_sendability
from ..services_match import score_match
from datetime import datetime, timedelta


router = APIRouter()


@router.post("/demo/seed")
def seed_demo():
    demo_msgs = [
        {"id": "m1", "opened": True, "replied": False, "label": None},
        {"id": "m2", "opened": True, "replied": True, "label": "positive"},
        {"id": "m3", "opened": False, "replied": False, "label": None},
    ]
    store.seed_messages(demo_msgs)
    # Seed IJP mock filters for ijp_demo_1
    ijp_mock = {
        "company_sizes": ["51-200", "201-500", "501-1,000", "1,001-5,000"],
        "industries": ["SaaS", "B2B", "Data/Analytics", "AI/ML"],
        "titles": [
            "Senior Product Manager",
            "Lead Product Manager",
            "Group Product Manager",
            "Director of Product",
            "Head of Product",
        ],
        "levels": ["Senior", "Lead", "Director"],
        "salary_min": 170000,
        "salary_max": 260000,
        "locations": ["Remote", "NYC", "SF Bay Area", "Austin", "Seattle"],
        "skills_must": [
            "PLG",
            "Activation",
            "Analytics",
            "Roadmapping",
            "Experimentation",
            "Stakeholder Management",
        ],
        "skills_nice": [
            "SQL",
            "Snowflake",
            "Amplitude",
            "Looker",
            "AI product"
        ],
    }
    store.save_ijp("ijp_demo_1", ijp_mock)
    # Seed Jobs mock postings
    job_id = "demo_jobs_1"
    postings = [
        # Acme
        {
            "id": "acme_dir_prod",
            "title": "Director of Product",
            "company": "Acme",
            "location": "Remote (US)",
            "salary_text": "$220k–$260k + equity",
            "jd_url": "https://example.com/acme/director-product",
            "jd_text": "Own product strategy for the core platform. Lead a team of PMs. Drive PLG and enterprise adoption across key verticals.",
            "tags": ["PLG", "Strategy", "Leadership"],
            "posted_at": "2025-09-01",
        },
        {
            "id": "acme_spm_activation",
            "title": "Senior Product Manager, Activation",
            "company": "Acme",
            "location": "NYC (Hybrid)",
            "salary_text": "$180k–$210k + bonus",
            "jd_url": "https://example.com/acme/spm-activation",
            "jd_text": "Increase activation, onboard enterprise customers, and run experiments across signup → first value.",
            "tags": ["Activation", "Experiments", "Onboarding"],
            "posted_at": "2025-08-20",
        },
        {
            "id": "acme_spm_data",
            "title": "Senior Product Manager, Data Platform",
            "company": "Acme",
            "location": "NYC (Hybrid)",
            "salary_text": "$175k–$205k + equity",
            "jd_url": "https://example.com/acme/spm-data",
            "jd_text": "Build self-serve data platform, governance, and metrics layer for analytics at scale.",
            "tags": ["Data Platform", "Governance", "Metrics"],
            "posted_at": "2025-08-10",
        },
        # Globex
        {
            "id": "globex_lead_pm_analytics",
            "title": "Lead Product Manager, Analytics",
            "company": "Globex",
            "location": "SF Bay Area",
            "salary_text": "$190k–$230k + equity",
            "jd_url": "https://example.com/globex/lead-pm-analytics",
            "jd_text": "Own analytics roadmap; partner with data science and eng to ship insights and ML-powered workflows.",
            "tags": ["Analytics", "ML", "Insights"],
            "posted_at": "2025-09-05",
        },
        {
            "id": "globex_gpm_platform",
            "title": "Group PM, Platform",
            "company": "Globex",
            "location": "Remote (US)",
            "salary_text": "$210k–$250k + equity",
            "jd_url": "https://example.com/globex/gpm-platform",
            "jd_text": "Lead platform initiatives, APIs, and shared services; manage 3 PMs; align with GTM.",
            "tags": ["Platform", "APIs", "Leadership"],
            "posted_at": "2025-08-25",
        },
        {
            "id": "globex_pm_billing",
            "title": "Product Manager, Billing",
            "company": "Globex",
            "location": "Remote (US)",
            "salary_text": "$160k–$190k",
            "jd_url": "https://example.com/globex/pm-billing",
            "jd_text": "Own billing, entitlements, and invoicing. Partner with finance and GTM ops to reduce churn.",
            "tags": ["Billing", "Entitlements", "Payments"],
            "posted_at": "2025-09-02",
        },
        # Initech
        {
            "id": "initech_spm_growth",
            "title": "Senior Product Manager, Growth",
            "company": "Initech",
            "location": "Austin, TX",
            "salary_text": "$170k–$200k",
            "jd_url": "https://example.com/initech/spm-growth",
            "jd_text": "Drive PLG funnel, pricing/packaging experiments, and self-serve monetization.",
            "tags": ["Growth", "Pricing", "Monetization"],
            "posted_at": "2025-09-03",
        },
        {
            "id": "initech_dir_prod_ai",
            "title": "Director of Product, AI",
            "company": "Initech",
            "location": "Seattle, WA",
            "salary_text": "$230k–$270k + equity",
            "jd_url": "https://example.com/initech/dir-prod-ai",
            "jd_text": "Define AI product strategy, partner with research, and ship copilots and intelligent automation.",
            "tags": ["AI", "Copilots", "Automation"],
            "posted_at": "2025-08-15",
        },
        {
            "id": "initech_pm_core",
            "title": "Product Manager, Core",
            "company": "Initech",
            "location": "Remote (US)",
            "salary_text": "$150k–$180k",
            "jd_url": "https://example.com/initech/pm-core",
            "jd_text": "Own core workflows, reliability, and user journeys across web and mobile.",
            "tags": ["Core", "Reliability", "Web/Mobile"],
            "posted_at": "2025-09-06",
        },
        {
            "id": "initech_head_prod",
            "title": "Head of Product",
            "company": "Initech",
            "location": "SF Bay Area",
            "salary_text": "$260k–$320k + equity",
            "jd_url": "https://example.com/initech/head-product",
            "jd_text": "Scale product org, hire PM leaders, and drive cross-functional roadmap alignment.",
            "tags": ["Leadership", "Hiring", "Strategy"],
            "posted_at": "2025-08-05",
        },
        # Umbrella
        {
            "id": "umbrella_tpm_platform",
            "title": "Technical Program Manager, Platform",
            "company": "Umbrella",
            "location": "Chicago, IL",
            "salary_text": "$140k–$175k",
            "jd_url": "https://example.com/umbrella/tpm-platform",
            "jd_text": "Drive execution across platform teams; manage dependencies and risk; partner with PM/Eng leads.",
            "tags": ["TPM", "Execution", "Platform"],
            "posted_at": "2025-08-28",
        },
        # Hooli
        {
            "id": "hooli_spm_relevance",
            "title": "Senior Product Manager, Relevance",
            "company": "Hooli",
            "location": "Remote (US)",
            "salary_text": "$180k–$220k",
            "jd_url": "https://example.com/hooli/spm-relevance",
            "jd_text": "Improve search and recommendation relevance; partner with ML to lift CTR and retention.",
            "tags": ["Search", "Relevance", "ML"],
            "posted_at": "2025-09-04",
        },
        # Vandelay
        {
            "id": "vandelay_pm_supply_chain",
            "title": "Product Manager, Supply Chain",
            "company": "Vandelay Industries",
            "location": "Remote (US)",
            "salary_text": "$155k–$185k",
            "jd_url": "https://example.com/vandelay/pm-supply-chain",
            "jd_text": "Build tools for logistics, inventory optimization, and vendor performance analytics.",
            "tags": ["Supply Chain", "Logistics", "Analytics"],
            "posted_at": "2025-08-30",
        },
        # WayneTech
        {
            "id": "waynetech_pm_security",
            "title": "Product Manager, Security",
            "company": "WayneTech",
            "location": "Gotham, NJ",
            "salary_text": "$165k–$195k",
            "jd_url": "https://example.com/waynetech/pm-security",
            "jd_text": "Ship security features (SSO, SCIM, audit logs, anomaly detection) for enterprise customers.",
            "tags": ["Security", "SSO", "Enterprise"],
            "posted_at": "2025-08-18",
        },
        # Stark Industries
        {
            "id": "stark_pm_ai_ops",
            "title": "Product Manager, AI Ops",
            "company": "Stark Industries",
            "location": "Los Angeles, CA",
            "salary_text": "$175k–$210k + equity",
            "jd_url": "https://example.com/stark/pm-ai-ops",
            "jd_text": "Automate internal ops with AI agents; build oversight tooling; comply with governance.",
            "tags": ["AI", "Agents", "Ops"],
            "posted_at": "2025-09-07",
        },
        # Wonka
        {
            "id": "wonka_pm_commerce",
            "title": "Product Manager, Commerce",
            "company": "Wonka",
            "location": "Remote (US/EU)",
            "salary_text": "$150k–$180k",
            "jd_url": "https://example.com/wonka/pm-commerce",
            "jd_text": "Own checkout, subscriptions, and promotions; lift conversion and lifetime value.",
            "tags": ["Checkout", "Subscriptions", "Growth"],
            "posted_at": "2025-08-22",
        },
        # Pied Piper
        {
            "id": "piedpiper_gpm_distributed",
            "title": "Group PM, Distributed Systems",
            "company": "Pied Piper",
            "location": "Palo Alto, CA",
            "salary_text": "$220k–$260k + equity",
            "jd_url": "https://example.com/piedpiper/gpm-distributed",
            "jd_text": "Lead distributed storage and compression initiatives; manage PM team; define 2-year roadmap.",
            "tags": ["Distributed Systems", "Compression", "Leadership"],
            "posted_at": "2025-08-12",
        },
        # Add a few more diverse roles
        {
            "id": "acme_pm_mobile",
            "title": "Product Manager, Mobile",
            "company": "Acme",
            "location": "Remote (US)",
            "salary_text": "$150k–$180k",
            "jd_url": "https://example.com/acme/pm-mobile",
            "jd_text": "Own iOS/Android roadmap, performance, and engagement. Coordinate with design and growth.",
            "tags": ["Mobile", "iOS", "Android"],
            "posted_at": "2025-09-08",
        },
        {
            "id": "globex_pm_integrations",
            "title": "Product Manager, Integrations",
            "company": "Globex",
            "location": "Remote (Americas)",
            "salary_text": "$155k–$185k",
            "jd_url": "https://example.com/globex/pm-integrations",
            "jd_text": "Ship integrations marketplace and SDKs; partner ecosystem growth; developer relations.",
            "tags": ["Integrations", "SDK", "Marketplace"],
            "posted_at": "2025-09-09",
        },
        {
            "id": "initech_pm_ux_research",
            "title": "Product Manager, UX Research Ops",
            "company": "Initech",
            "location": "Remote (US)",
            "salary_text": "$145k–$170k",
            "jd_url": "https://example.com/initech/pm-ux-research",
            "jd_text": "Build research repository, panel, and insight workflows; speed up discovery.",
            "tags": ["UX Research", "Repository", "Discovery"],
            "posted_at": "2025-08-27",
        },
    ]
    store.save_jobs(job_id, postings)
    # Seed Candidates (expanded: longer resumes, diverse domains/sectors)
    candidates = [
        {
            "id": "cand_alex_pm",
            "name": "Alex Martin",
            "email": "alex.martin@example.com",
            "linkedin": "https://linkedin.com/in/alexmartin",
            "seniority": "Senior",
            "domains": ["product", "growth", "b2b"],
            "resume_text": "Senior Product Manager with 8+ years in B2B SaaS. Led activation, onboarding, and pricing/packaging programs for PLG and enterprise. Known for crisp execution, strong partnership with design/eng, and making metrics move while reducing operational burden.",
            "metrics_json": {
                "KeyMetrics": [
                    "Lifted activation rate +12% in 2 quarters",
                    "Reduced CAC by 18% via pricing/packaging",
                    "Improved trial→paid conversion +9pp",
                    "Cut onboarding time-to-first-value from 3d to 36h"
                ],
                "ProblemsSolved": ["Activation drop-off", "Pricing confusion", "Onboarding friction", "Enterprise rollout delays"],
                "NotableAccomplishments": ["Launched self-serve annual plans", "Rolled out guided onboarding", "Introduced value-based packaging"],
                "Positions": [
                    {"title": "Senior PM", "company": "Acme", "start_date": "2022-01-01", "end_date": None},
                    {"title": "PM", "company": "Globex", "start_date": "2019-01-01", "end_date": "2021-12-31"}
                ],
                "Tenure": ["Acme: 3y", "Globex: 3y"]
            }
        },
        {
            "id": "cand_sam_ai",
            "name": "Samira Qureshi",
            "email": "samira.q@example.com",
            "linkedin": "https://linkedin.com/in/samiraq",
            "seniority": "Director",
            "domains": ["ai", "platform", "enterprise"],
            "resume_text": "Director of Product (AI) with 10+ years across enterprise platforms. Scaled agent-assist and copilots with human-in-the-loop oversight, building policy, observability, and governance layers to ship reliable AI features in regulated environments.",
            "metrics_json": {
                "KeyMetrics": [
                    "Cut case resolution time 35% with agent assist",
                    "Increased model adoption to 70% of workflows",
                    "Reduced false positives by 22%",
                    "Improved NPS +11 for AI-enabled workflows"
                ],
                "ProblemsSolved": ["Model drift", "Compliance guardrails", "Explainability", "Rollout safety"],
                "NotableAccomplishments": ["Launched GenAI copilot", "SOC2-aligned governance", "Model evaluation harness"],
                "Positions": [
                    {"title": "Director of Product, AI", "company": "Initech", "start_date": "2021-03-01", "end_date": None},
                    {"title": "Lead PM", "company": "WayneTech", "start_date": "2017-01-01", "end_date": "2021-02-28"}
                ],
                "Tenure": ["Initech: 4y", "WayneTech: 4y"]
            }
        },
        {
            "id": "cand_lee_data",
            "name": "Jordan Lee",
            "email": "jordan.lee@example.com",
            "linkedin": "https://linkedin.com/in/jordanlee",
            "seniority": "Lead",
            "domains": ["data", "analytics", "platform"],
            "resume_text": "Lead PM for the data platform. Introduced metrics catalog, governance workflows, and self-serve pipelines for 200+ internal users and 50+ product surfaces. Comfortable with SQL, lineage, and privacy/security controls.",
            "metrics_json": {
                "KeyMetrics": [
                    "Cut time-to-insight from 5 days to 1 day",
                    "Drove 60% adoption of metrics catalog",
                    "Reduced data incidents by 40%",
                    "Improved dashboard freshness SLA from 93% to 99.7%"
                ],
                "ProblemsSolved": ["Metric definition drift", "Access control gaps", "Data quality incidents", "Siloed reporting"],
                "NotableAccomplishments": ["Launched metrics store", "Governance workflow", "Backfill and validation tooling"],
                "Positions": [
                    {"title": "Lead PM, Data", "company": "Globex", "start_date": "2020-06-01", "end_date": None},
                    {"title": "PM", "company": "Acme", "start_date": "2016-06-01", "end_date": "2020-05-31"}
                ],
                "Tenure": ["Globex: 5y", "Acme: 4y"]
            }
        },
        {
            "id": "cand_priya_design",
            "name": "Priya Desai",
            "email": "priya.desai@example.com",
            "linkedin": "https://linkedin.com/in/priyadesai",
            "seniority": "Lead",
            "domains": ["product", "design", "ecommerce"],
            "resume_text": "Lead Product Designer turned PM. Specializes in checkout, subscriptions, and conversion optimization. Cross-functional leader with deep research chops and experimentation mindset.",
            "metrics_json": {
                "KeyMetrics": [
                    "Checkout conversion +4.2pp",
                    "Subscription churn −9%",
                    "AOV +6% via bundles and trials"
                ],
                "ProblemsSolved": ["Funnel drop-offs", "Promo abuse", "Cross-device friction"],
                "NotableAccomplishments": ["Launched new checkout", "Experimentation playbook", "Design system refresh"],
                "Positions": [
                    {"title": "Lead PM", "company": "Wonka", "start_date": "2022-04-01", "end_date": None},
                    {"title": "Product Designer", "company": "Wonka", "start_date": "2018-01-01", "end_date": "2022-03-31"}
                ],
                "Tenure": ["Wonka: 7y"]
            }
        },
        {
            "id": "cand_mateo_platform",
            "name": "Mateo Alvarez",
            "email": "mateo.alvarez@example.com",
            "linkedin": "https://linkedin.com/in/mateoalvarez",
            "seniority": "Senior",
            "domains": ["product", "platform", "developer"],
            "resume_text": "Platform PM focused on APIs, SDKs, and reliability. Bridges product and engineering to deliver great developer experience and scalable shared services.",
            "metrics_json": {
                "KeyMetrics": [
                    "p95 latency −28%",
                    "Internal platform NPS +15",
                    "Partner integration time −35%"
                ],
                "ProblemsSolved": ["API consistency", "Breaking changes", "Operational toil"],
                "NotableAccomplishments": ["Versioned API program", "Golden paths and templates", "Incident review loop"],
                "Positions": [
                    {"title": "Senior PM, Platform", "company": "Globex", "start_date": "2021-02-01", "end_date": None},
                    {"title": "PM", "company": "Pied Piper", "start_date": "2017-06-01", "end_date": "2021-01-31"}
                ],
                "Tenure": ["Globex: 4y", "Pied Piper: 3.5y"]
            }
        },
        {
            "id": "cand_chen_security",
            "name": "Chen Wei",
            "email": "chen.wei@example.com",
            "linkedin": "https://linkedin.com/in/chenwei",
            "seniority": "Senior",
            "domains": ["product", "security", "enterprise"],
            "resume_text": "Security PM with enterprise background. Delivered SSO, SCIM, audit logs, and anomaly detection. Collaborates closely with compliance and customer security teams.",
            "metrics_json": {
                "KeyMetrics": [
                    "Security questionnaires closed −30% time",
                    "SSO adoption 78% of enterprise tenants",
                    "Auth-related support tickets −22%"
                ],
                "ProblemsSolved": ["Fragmented identity", "Least-privilege gaps", "Auditability"],
                "NotableAccomplishments": ["SSO/SCIM GA", "Admin audit center", "Suspicious login detection"],
                "Positions": [
                    {"title": "Senior PM, Security", "company": "WayneTech", "start_date": "2020-08-01", "end_date": None},
                    {"title": "PM", "company": "Initech", "start_date": "2016-02-01", "end_date": "2020-07-31"}
                ],
                "Tenure": ["WayneTech: 5y", "Initech: 4.5y"]
            }
        },
        {
            "id": "cand_riley_growth",
            "name": "Riley Thompson",
            "email": "riley.t@example.com",
            "linkedin": "https://linkedin.com/in/rileythompson",
            "seniority": "Senior",
            "domains": ["product", "growth", "marketplace"],
            "resume_text": "Marketplace growth PM. Experienced in supply-demand balance, reputation systems, and pricing incentives. Data-driven and experiment-heavy approach.",
            "metrics_json": {
                "KeyMetrics": [
                    "New supplier activation +18%",
                    "Repeat purchase rate +7pp",
                    "Fraud rate −35% via trust signals"
                ],
                "ProblemsSolved": ["Cold-start supply", "Bad actor mitigation", "Price elasticity"],
                "NotableAccomplishments": ["Tiered incentives", "Reputation revamp", "Elastic pricing experiments"],
                "Positions": [
                    {"title": "Senior PM, Growth", "company": "Umbrella", "start_date": "2021-10-01", "end_date": None},
                    {"title": "PM", "company": "Vandelay Industries", "start_date": "2018-03-01", "end_date": "2021-09-30"}
                ],
                "Tenure": ["Umbrella: 3.9y", "Vandelay: 3.5y"]
            }
        },
        {
            "id": "cand_fatima_fintech",
            "name": "Fatima Khan",
            "email": "fatima.khan@example.com",
            "linkedin": "https://linkedin.com/in/fatimakhan",
            "seniority": "Lead",
            "domains": ["product", "fintech", "payments"],
            "resume_text": "Fintech PM in billing and entitlements. Worked across ledger, invoicing, tax, and reconciliation. Partners closely with finance ops and compliance.",
            "metrics_json": {
                "KeyMetrics": [
                    "Payment success rate +2.1pp",
                    "Invoice aging >30d −24%",
                    "Chargebacks −19%"
                ],
                "ProblemsSolved": ["Billing edge cases", "Tax compliance", "Revenue leakage"],
                "NotableAccomplishments": ["Entitlements service", "Tax engine integration", "Revenue reporting"],
                "Positions": [
                    {"title": "Lead PM, Billing", "company": "Globex", "start_date": "2020-01-01", "end_date": None},
                    {"title": "PM", "company": "Acme", "start_date": "2016-08-01", "end_date": "2019-12-31"}
                ],
                "Tenure": ["Globex: 5.7y", "Acme: 3.4y"]
            }
        },
        {
            "id": "cand_sven_i18n",
            "name": "Sven Nilsson",
            "email": "sven.nilsson@example.com",
            "linkedin": "https://linkedin.com/in/svennilsson",
            "seniority": "Senior",
            "domains": ["product", "international", "compliance"],
            "resume_text": "Internationalization and localization PM. Launched multi-language, regional pricing, and data residency features across EU/US/APAC.",
            "metrics_json": {
                "KeyMetrics": [
                    "EU ARR +21% post localization",
                    "Checkout error rate −17% for RTL languages",
                    "Regional price tests +6% conversion"
                ],
                "ProblemsSolved": ["Locale handling", "Tax/VAT variants", "Content ops"],
                "NotableAccomplishments": ["i18n platform", "Regional pricing framework", "Data residency controls"],
                "Positions": [
                    {"title": "Senior PM, International", "company": "Stark Industries", "start_date": "2020-09-01", "end_date": None},
                    {"title": "PM", "company": "Wonka", "start_date": "2017-05-01", "end_date": "2020-08-31"}
                ],
                "Tenure": ["Stark: 5y", "Wonka: 3.3y"]
            }
        },
        {
            "id": "cand_naomi_devtools",
            "name": "Naomi Park",
            "email": "naomi.park@example.com",
            "linkedin": "https://linkedin.com/in/naomipark",
            "seniority": "Senior",
            "domains": ["product", "developer", "devtools"],
            "resume_text": "Devtools PM. Built SDKs, CLIs, and observability features for developer-led adoption. Ran beta programs and docs strategy to accelerate integration.",
            "metrics_json": {
                "KeyMetrics": [
                    "Time-to-first-API-call −40%",
                    "Docs satisfaction +22%",
                    "Monthly active SDKs +31%"
                ],
                "ProblemsSolved": ["Onboarding gaps", "Debugging blind spots", "Fragmented tooling"],
                "NotableAccomplishments": ["Unified CLI", "Quickstarts and templates", "Developer advisory board"],
                "Positions": [
                    {"title": "Senior PM, Devtools", "company": "Pied Piper", "start_date": "2021-01-01", "end_date": None},
                    {"title": "PM", "company": "Globex", "start_date": "2018-02-01", "end_date": "2020-12-31"}
                ],
                "Tenure": ["Pied Piper: 4.7y", "Globex: 2.9y"]
            }
        }
    ]
    for c in candidates:
        store.upsert_candidate(c)
    # Seed Contacts (decision-makers and recruiters) with verification states
    contacts = [
        {
            "id": "alex@acme.com",
            "company": "Acme",
            "name": "Alex Rivera",
            "title": "Director of Product",
            "seniority": "Director",
            "tenure_months": 20,
            "email": "alex@acme.com",
            "linkedin": "https://linkedin.com/in/alexrivera",
            "city": "New York",
            "state": "NY",
            "country": "US",
            "source": "apollo",
            "valid": True,
            "verification_status": "valid",
            "verification_score": 0.98,
            "verified_at": "2025-09-05",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "mutual", "note": "2 shared connections"},
                {"type": "recent_post", "note": "Podcast on activation metrics"}
            ],
            "notes": "Likes concise emails; prefers Tues/Thurs meetings",
        },
        {
            "id": "sam@globex.com",
            "company": "Globex",
            "name": "Samantha Lee",
            "title": "VP Product",
            "seniority": "VP",
            "tenure_months": 34,
            "email": "sam@globex.com",
            "linkedin": "https://linkedin.com/in/samanthalee",
            "city": "San Francisco",
            "state": "CA",
            "country": "US",
            "source": "apollo",
            "valid": None,
            "verification_status": "accept_all",
            "verification_score": 0.82,
            "verified_at": "2025-09-02",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "alma_mater", "note": "UC Berkeley alum"},
                {"type": "product_news", "note": "New analytics launch"}
            ],
            "notes": None,
        },
        {
            "id": "recruiter@initech.com",
            "company": "Initech",
            "name": "Jordan Patel",
            "title": "Senior Technical Recruiter",
            "seniority": "Senior",
            "tenure_months": 12,
            "email": "recruiter@initech.com",
            "linkedin": "https://linkedin.com/in/jordanpatel",
            "city": "Seattle",
            "state": "WA",
            "country": "US",
            "source": "linkedin",
            "valid": False,
            "verification_status": "invalid",
            "verification_score": 0.12,
            "verified_at": "2025-08-29",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "mutual", "note": "Shared connection with Samira"}
            ],
            "notes": "Use LinkedIn for first touch (email invalid)",
        },
        {
            "id": "cto@stark.com",
            "company": "Stark Industries",
            "name": "Morgan Stark",
            "title": "CTO",
            "seniority": "C-level",
            "tenure_months": 48,
            "email": "cto@stark.com",
            "linkedin": "https://linkedin.com/in/morganstark",
            "city": "Los Angeles",
            "state": "CA",
            "country": "US",
            "source": "apollo",
            "valid": None,
            "verification_status": "unknown",
            "verification_score": 0.0,
            "verified_at": None,
            "verifier": None,
            "warm_angles": [
                {"type": "podcast_mention", "note": "Interview on AI Ops"}
            ],
            "notes": "Prospect for AI Ops initiative",
        },
        {
            "id": "cpo@wonka.com",
            "company": "Wonka",
            "name": "Augustus Bloom",
            "title": "Chief Product Officer",
            "seniority": "C-level",
            "tenure_months": 26,
            "email": "cpo@wonka.com",
            "linkedin": "https://linkedin.com/in/augustusbloom",
            "city": "Remote",
            "state": "",
            "country": "US",
            "source": "apollo",
            "valid": True,
            "verification_status": "valid",
            "verification_score": 0.94,
            "verified_at": "2025-08-15",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "product_news", "note": "Subscriptions relaunch"}
            ],
            "notes": "Open to concise intro with proof points",
        }
        ,
        {
            "id": "head.growth@umbrella.com",
            "company": "Umbrella",
            "name": "Diego Sanchez",
            "title": "Head of Growth",
            "seniority": "Head",
            "tenure_months": 16,
            "email": "head.growth@umbrella.com",
            "linkedin": "https://linkedin.com/in/diegosanchez",
            "city": "Chicago",
            "state": "IL",
            "country": "US",
            "source": "apollo",
            "valid": True,
            "verification_status": "valid",
            "verification_score": 0.96,
            "verified_at": "2025-09-01",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "mutual", "note": "1 shared advisor"},
                {"type": "recent_post", "note": "Thread on pricing tests"}
            ],
            "notes": "Interested in PLG benchmarks",
        },
        {
            "id": "eng.manager@piedpiper.com",
            "company": "Pied Piper",
            "name": "Maya Patel",
            "title": "Engineering Manager (Platform)",
            "seniority": "Manager",
            "tenure_months": 22,
            "email": "eng.manager@piedpiper.com",
            "linkedin": "https://linkedin.com/in/mayapatel",
            "city": "Palo Alto",
            "state": "CA",
            "country": "US",
            "source": "linkedin",
            "valid": None,
            "verification_status": "accept_all",
            "verification_score": 0.76,
            "verified_at": "2025-08-26",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "mutual", "note": "Shared with Naomi (Devtools)"},
                {"type": "product_news", "note": "New SDK launch"}
            ],
            "notes": "Platform SDK owner",
        },
        {
            "id": "security.lead@waynetech.com",
            "company": "WayneTech",
            "name": "Bruce Nguyen",
            "title": "Security Lead",
            "seniority": "Lead",
            "tenure_months": 29,
            "email": "security.lead@waynetech.com",
            "linkedin": "https://linkedin.com/in/brucenguyen",
            "city": "Gotham",
            "state": "NJ",
            "country": "US",
            "source": "apollo",
            "valid": True,
            "verification_status": "valid",
            "verification_score": 0.92,
            "verified_at": "2025-09-03",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "mutual", "note": "CISSP study group"}
            ],
            "notes": "Security roadmap includes SSO hardening",
        },
        {
            "id": "recruiting@globex.com",
            "company": "Globex",
            "name": "Taylor Brooks",
            "title": "Recruiting Manager",
            "seniority": "Manager",
            "tenure_months": 8,
            "email": "recruiting@globex.com",
            "linkedin": "https://linkedin.com/in/taylorbrooks",
            "city": "Austin",
            "state": "TX",
            "country": "US",
            "source": "linkedin",
            "valid": False,
            "verification_status": "invalid",
            "verification_score": 0.09,
            "verified_at": "2025-09-06",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "mutual", "note": "Shared connection with Alex"}
            ],
            "notes": "Message via LinkedIn (email invalid)",
        },
        {
            "id": "head.analytics@vandelay.com",
            "company": "Vandelay Industries",
            "name": "Elaine Benes",
            "title": "Head of Analytics",
            "seniority": "Head",
            "tenure_months": 36,
            "email": "head.analytics@vandelay.com",
            "linkedin": "https://linkedin.com/in/elainebenes",
            "city": "Remote",
            "state": "",
            "country": "US",
            "source": "apollo",
            "valid": None,
            "verification_status": "unknown",
            "verification_score": 0.0,
            "verified_at": None,
            "verifier": None,
            "warm_angles": [
                {"type": "recent_post", "note": "Article on metrics governance"}
            ],
            "notes": "Ask about metrics catalog pain points",
        },
        {
            "id": "eu.pm@wonka.eu",
            "company": "Wonka",
            "name": "Léa Dubois",
            "title": "Senior Product Manager (EU)",
            "seniority": "Senior",
            "tenure_months": 19,
            "email": "eu.pm@wonka.eu",
            "linkedin": "https://linkedin.com/in/leadubois",
            "city": "Paris",
            "state": "",
            "country": "FR",
            "source": "apollo",
            "valid": True,
            "verification_status": "valid",
            "verification_score": 0.97,
            "verified_at": "2025-09-08",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "alma_mater", "note": "HEC Paris"},
                {"type": "product_news", "note": "EU launch of subscriptions"}
            ],
            "notes": "Prefers French for first touch",
        },
        {
            "id": "apac.ops@umbrella.sg",
            "company": "Umbrella",
            "name": "Kenji Tanaka",
            "title": "Operations Director (APAC)",
            "seniority": "Director",
            "tenure_months": 27,
            "email": "apac.ops@umbrella.sg",
            "linkedin": "https://linkedin.com/in/kenjitanaka",
            "city": "Singapore",
            "state": "",
            "country": "SG",
            "source": "apollo",
            "valid": None,
            "verification_status": "accept_all",
            "verification_score": 0.84,
            "verified_at": "2025-09-07",
            "verifier": "millionverifier",
            "warm_angles": [
                {"type": "mutual", "note": "Vendor reference in APAC"}
            ],
            "notes": "Time-zone friendly slots early morning PT",
        }
    ]
    for c in contacts:
        store.upsert_contact(c)
    # Seed Outreach variable presets
    outreach_presets = [
        {
            "id": "preset_short_email_pm",
            "label": "Short Email – PM intro",
            "mode": "email",
            "length": "short",
            "variables": {
                "FirstName": "Alex",
                "Company": "Acme",
                "RoleTitle": "Director of Product",
                "JD_Link": "https://example.com/acme/director-product",
                "Portfolio_URL": "https://portfolio.example.com/alex",
                "Match_Score": 87,
                "CalendlyURL": "https://calendly.com/oliveraellison/15min",
                "TheirRecentThing": "podcast on activation metrics",
                "YourEdge": "PLG playbook lifted activation +12%",
                "SpecificBenefit": "reduce time-to-value for enterprise rollouts"
            }
        },
        {
            "id": "preset_li_note_growth",
            "label": "LinkedIn Note – Growth angle",
            "mode": "linkedin",
            "length": "short",
            "variables": {
                "FirstName": "Diego",
                "Company": "Umbrella",
                "RoleTitle": "Head of Growth",
                "Portfolio_URL": "https://portfolio.example.com/growth-cases",
                "CalendlyURL": "https://calendly.com/oliveraellison/20min",
                "TheirRecentThing": "thread on pricing tests",
                "YourEdge": "pricing/packaging experiments cut CAC 18%",
            }
        },
        {
            "id": "preset_intro_mutual_ai",
            "label": "Intro via Mutual – AI copilot",
            "mode": "intro-via-mutual",
            "length": "medium",
            "variables": {
                "FirstName": "Samantha",
                "Company": "Globex",
                "RoleTitle": "VP Product",
                "JD_Link": "https://example.com/globex/lead-pm-analytics",
                "Portfolio_URL": "https://portfolio.example.com/ai-copilot",
                "CalendlyURL": "https://calendly.com/oliveraellison/30min",
                "TheirRecentThing": "analytics launch",
                "YourEdge": "agent assist cut case time 35%",
            }
        },
        {
            "id": "preset_email_long_billing",
            "label": "Email – Long – Billing/Entitlements case",
            "mode": "email",
            "length": "long",
            "variables": {
                "FirstName": "Taylor",
                "Company": "Globex",
                "RoleTitle": "Head of Billing",
                "JD_Link": "https://example.com/globex/pm-billing",
                "Portfolio_URL": "https://portfolio.example.com/billing-entitlements",
                "Match_Score": 84,
                "CalendlyURL": "https://calendly.com/oliveraellison/30min",
                "TheirRecentThing": "post on reducing invoice aging",
                "YourEdge": "entitlements platform cut revenue leakage",
                "SpecificBenefit": "increase payment success and reduce overdue AR"
            }
        },
        {
            "id": "preset_email_medium_security",
            "label": "Email – Medium – Security/SSO + Audit",
            "mode": "email",
            "length": "medium",
            "variables": {
                "FirstName": "Bruce",
                "Company": "WayneTech",
                "RoleTitle": "Security Lead",
                "Portfolio_URL": "https://portfolio.example.com/security-audit",
                "CalendlyURL": "https://calendly.com/oliveraellison/20min",
                "TheirRecentThing": "roadmap hint on SSO hardening",
                "YourEdge": "SSO/SCIM rollout lifted enterprise adoption",
                "SpecificBenefit": "fewer security questionnaires and faster closes"
            }
        },
        {
            "id": "preset_li_note_data_platform",
            "label": "LinkedIn Note – Data Platform / Metrics Catalog",
            "mode": "linkedin",
            "length": "short",
            "variables": {
                "FirstName": "Elaine",
                "Company": "Vandelay Industries",
                "RoleTitle": "Head of Analytics",
                "Portfolio_URL": "https://portfolio.example.com/metrics-catalog",
                "CalendlyURL": "https://calendly.com/oliveraellison/15min",
                "TheirRecentThing": "article on metrics governance",
                "YourEdge": "metrics layer cut time-to-insight 5d→1d"
            }
        },
        {
            "id": "preset_email_medium_i18n",
            "label": "Email – Medium – i18n/Regional Pricing",
            "mode": "email",
            "length": "medium",
            "variables": {
                "FirstName": "Léa",
                "Company": "Wonka",
                "RoleTitle": "Senior Product Manager",
                "Portfolio_URL": "https://portfolio.example.com/i18n-pricing",
                "CalendlyURL": "https://calendly.com/oliveraellison/20min",
                "TheirRecentThing": "EU subscriptions launch",
                "YourEdge": "regional pricing boosted EU ARR 21%",
                "SpecificBenefit": "lift conversion in FR/DE without promo fatigue"
            }
        },
        {
            "id": "preset_intro_mutual_platform_sdk",
            "label": "Intro via Mutual – Platform SDKs",
            "mode": "intro-via-mutual",
            "length": "short",
            "variables": {
                "FirstName": "Maya",
                "Company": "Pied Piper",
                "RoleTitle": "Engineering Manager",
                "Portfolio_URL": "https://portfolio.example.com/platform-sdks",
                "CalendlyURL": "https://calendly.com/oliveraellison/25min",
                "TheirRecentThing": "SDK launch",
                "YourEdge": "golden paths cut integration time 35%"
            }
        },
        {
            "id": "preset_email_long_ai_ops",
            "label": "Email – Long – AI Ops / Copilots",
            "mode": "email",
            "length": "long",
            "variables": {
                "FirstName": "Morgan",
                "Company": "Stark Industries",
                "RoleTitle": "CTO",
                "Portfolio_URL": "https://portfolio.example.com/ai-ops",
                "CalendlyURL": "https://calendly.com/oliveraellison/30min",
                "TheirRecentThing": "interview on AI Ops",
                "YourEdge": "agent assist cut resolution time 35%",
                "SpecificBenefit": "lower escalations while improving accuracy"
            }
        },
        {
            "id": "preset_li_note_growth_marketplace",
            "label": "LinkedIn Note – Marketplace Growth",
            "mode": "linkedin",
            "length": "short",
            "variables": {
                "FirstName": "Riley",
                "Company": "Umbrella",
                "RoleTitle": "Senior PM, Growth",
                "Portfolio_URL": "https://portfolio.example.com/marketplace-growth",
                "CalendlyURL": "https://calendly.com/oliveraellison/15min",
                "TheirRecentThing": "pricing experiments thread",
                "YourEdge": "tiered incentives drove supplier activation +18%"
            }
        }
    ]
    for p in outreach_presets:
        store.upsert_outreach_preset(p)
    # Seed Sequence rows (compose from contacts + relevant email-mode presets)
    all_presets = [p for p in store.list_outreach_presets() if (p.get("mode") == "email")]
    # Simple mapping by title/company keywords → preset id
    preset_map = {
        "billing": "preset_email_long_billing",
        "security": "preset_email_medium_security",
        "cto": "preset_email_long_ai_ops",
        "analytics": "preset_li_note_data_platform",  # will fallback if not email
        "i18n": "preset_email_medium_i18n",
        "product": "preset_short_email_pm",
        "growth": "preset_short_email_pm",
    }

    def choose_preset_for_contact(contact: dict) -> dict:
        title = (contact.get("title") or "").lower()
        company = (contact.get("company") or "").lower()
        chosen_id = None
        for key, pid in preset_map.items():
            if key in title or key in company:
                chosen_id = pid
                break
        # ensure email-mode
        if chosen_id:
            p = store.get_outreach_preset(chosen_id)
            if p and p.get("mode") == "email":
                return p
        # fallback: first email preset
        return next(iter([p for p in all_presets if p.get("mode") == "email"]), None) or (all_presets[0] if all_presets else {})

    def build_subject(vars_dict: dict, company: str, length: str) -> str:
        role = vars_dict.get("RoleTitle", "the role")
        base = f"Quick intro on {role} at {company}"
        if length == "long":
            return base + " (ideas + outcomes)"
        if length == "medium":
            return base + " — a few ideas"
        return base

    def build_body(first_name: str, v: dict, length: str) -> str:
        calendly = v.get("CalendlyURL", "")
        recent = v.get("TheirRecentThing")
        edge = v.get("YourEdge") or "relevant wins"
        benefit = v.get("SpecificBenefit")
        jd = v.get("JD_Link")
        portfolio = v.get("Portfolio_URL")
        hello = f"Hi {first_name or 'there'},"
        line_recent = f" I enjoyed your {recent}." if recent else ""
        line_benefit = f" I mapped how {edge} could {benefit}." if benefit else f" I mapped how {edge} could help."
        line_refs = "".join(
            [f" JD: {jd}." if jd else "", f" 1-pager: {portfolio}." if portfolio else ""]
        ).strip()
        if length == "short":
            return f"{hello}{line_recent}{line_benefit} If helpful, grab a quick slot: {calendly}. {line_refs}".strip()
        if length == "medium":
            return (
                f"{hello}{line_recent}{line_benefit}\n\n"
                f"Happy to share a brief overview and learn where this might fit. {line_refs}\n"
                f"If useful, here’s a few times: {calendly}"
            ).strip()
        # long
        return (
            f"{hello}{line_recent}{line_benefit}\n\n"
            f"Over the last few quarters, I partnered with teams on similar problems and shipped outcomes without heavy lift from eng."
            f" I put together a concise brief with examples. {line_refs}\n\n"
            f"If a quick scan looks promising, feel free to pick a time that works: {calendly}"
        ).strip()

    rows: list[dict] = []
    for c in contacts:
        email = c.get("email")
        if not email:
            continue
        # Gate by verification/sendability for realism
        if not gate_sendability(c.get("verification_status"), c.get("verification_score")):
            continue
        preset = choose_preset_for_contact(c)
        vars_base = preset.get("variables", {})
        length = preset.get("length", "short")
        first, last = (c.get("name", " ").split(" ", 1) + [""])[:2]
        subject = build_subject(vars_base, c.get("company", ""), length)
        message = build_body(first, vars_base, length)
        rows.append({
            "email": email,
            "first_name": first,
            "last_name": last,
            "company": c.get("company", ""),
            "title": c.get("title", ""),
            "jd_link": vars_base.get("JD_Link", ""),
            "portfolio_url": vars_base.get("Portfolio_URL", ""),
            "match_score": vars_base.get("Match_Score", 0),
            "verification_status": c.get("verification_status"),
            "verification_score": c.get("verification_score"),
            "subject": subject,
            "message": message,
            "variant": preset.get("id", "A"),
        })
    store.set_sequence_rows(rows)
    # Seed Messages based on rows with variant-based rates
    rate_map = {
        "preset_short_email_pm": {"open": 62, "reply": 13, "positive": 7},
        "preset_email_long_billing": {"open": 58, "reply": 11, "positive": 6},
        "preset_email_medium_security": {"open": 60, "reply": 12, "positive": 7},
        "preset_email_long_ai_ops": {"open": 64, "reply": 15, "positive": 9},
        "preset_email_medium_i18n": {"open": 59, "reply": 12, "positive": 7},
    }
    def rate_bool(index: int, percent: int) -> bool:
        return ((index * 13) % 100) < percent
    messages_rows = []
    for i, r in enumerate(rows):
        rates = rate_map.get(r.get("variant"), {"open": 60, "reply": 12, "positive": 6})
        opened = rate_bool(i, rates["open"])
        replied = opened and rate_bool(i + 7, rates["reply"])  # reply subset of opens
        positive = replied and rate_bool(i + 17, rates["positive"])  # positive subset of replies
        label = "positive" if positive else ("meeting" if replied and rate_bool(i + 29, 2) else ("neutral" if replied else None))
        messages_rows.append({
            "id": r.get("email"),
            "opened": opened,
            "replied": replied,
            "label": label,
            "variant": r.get("variant") or "",
        })
    store.seed_messages(messages_rows)
    # Seed CRM board with a few cards distributed across lanes
    crm_board = {
        "People": [
            {"id": "alex@acme.com", "name": "Alex Rivera", "note": "Warm via mutual; send value-first brief", "assignee": "Oliver", "due_date": None},
            {"id": "sam@globex.com", "name": "Samantha Lee", "note": "High-value target; wait for analytics launch", "assignee": "Oliver", "due_date": None},
            {"id": "security.lead@waynetech.com", "name": "Bruce Nguyen", "note": "Security demo assets queued", "assignee": "Oliver", "due_date": None},
            {"id": "apac.ops@umbrella.sg", "name": "Kenji Tanaka", "note": "APAC ops; schedule early PT slot", "assignee": "Oliver", "due_date": None},
        ],
        "Conversation": [
            {"id": "cpo@wonka.com", "name": "Augustus Bloom", "note": "Positive reply; propose intro call (15–20m)", "assignee": "Oliver", "due_date": "2025-09-12"},
            {"id": "cto@stark.com", "name": "Morgan Stark", "note": "Replied with interest on AI Ops; share 1-pager", "assignee": "Oliver", "due_date": "2025-09-13"},
            {"id": "head.analytics@vandelay.com", "name": "Elaine Benes", "note": "Asked for metrics catalog examples", "assignee": "Oliver", "due_date": "2025-09-14"}
        ],
        "Meeting": [
            {"id": "head.growth@umbrella.com", "name": "Diego Sanchez", "note": "Booked 30-min; prep PLG deck + 2 case studies", "assignee": "Oliver", "due_date": "2025-09-15"},
            {"id": "eu.pm@wonka.eu", "name": "Léa Dubois", "note": "French-first call; i18n focus; bring FR examples", "assignee": "Oliver", "due_date": "2025-09-16"}
        ],
        "Deal": [
            {"id": "head.billing@globex.com", "name": "Taylor Brooks", "note": "Billing pilot in legal review; confirm data processing", "assignee": "Oliver", "due_date": "2025-09-20"},
            {"id": "security.lead.meeting@waynetech.com", "name": "Bruce Nguyen (Deal)", "note": "SSO/SCIM phase plan; finalize success criteria", "assignee": "Oliver", "due_date": "2025-09-22"}
        ],
    }
    store.set_crm_board(crm_board)
    # Seed Warm Angles by linkedin/domain/school keys
    store.upsert_warm_angles("li:https://linkedin.com/in/alexrivera", [
        {"type": "mutual", "detail": "2 shared connections (Jordan L., Priya D.)"},
        {"type": "recent_post", "detail": "Podcast on activation metrics"},
    ])
    store.upsert_warm_angles("domain:acme.com", [
        {"type": "product_news", "detail": "Launched new onboarding"},
    ])
    store.upsert_warm_angles("school:HEC Paris", [
        {"type": "alma_mater", "detail": "Shared school: HEC Paris"},
    ])
    # Additional warm angles (diverse, longer, realistic)
    store.upsert_warm_angles("li:https://linkedin.com/in/samanthalee", [
        {"type": "mutual", "detail": "Shared with data science director (Anita S.) and PM (Jordan L.)"},
        {"type": "product_news", "detail": "Globex announced analytics GA last week; blog outlines KPI uplift targets"},
        {"type": "podcast_mention", "detail": "Guest on 'Roadmap Radio' discussing ML-powered workflows"},
    ])
    store.upsert_warm_angles("domain:globex.com", [
        {"type": "recent_post", "detail": "Case study on enterprise activation improving time-to-first-value by 28%"},
        {"type": "product_news", "detail": "New billing revamp planned Q4; looking for entitlements best practices"},
    ])
    store.upsert_warm_angles("li:https://linkedin.com/in/mayapatel", [
        {"type": "mutual", "detail": "You and Maya are both connected to Naomi (Devtools) and platform SRE lead"},
        {"type": "recent_post", "detail": "SDK launch thread asking for DX feedback; link to GitHub examples"},
    ])
    store.upsert_warm_angles("domain:piedpiper.com", [
        {"type": "product_news", "detail": "Announced compression SDK v3; migration guide published"},
        {"type": "podcast_mention", "detail": "Engineering podcast on distributed storage roadmap"},
    ])
    store.upsert_warm_angles("li:https://linkedin.com/in/brucenguyen", [
        {"type": "mutual", "detail": "CISSP study group overlap; both follow Security Weekly"},
        {"type": "recent_post", "detail": "Post on SSO pitfalls and SCIM provisioning edge cases"},
    ])
    store.upsert_warm_angles("domain:waynetech.com", [
        {"type": "product_news", "detail": "Rolling out admin audit center; seeking examples of anomaly detection UX"},
    ])
    store.upsert_warm_angles("li:https://linkedin.com/in/leadubois", [
        {"type": "alma_mater", "detail": "HEC Paris alum (2016) – Paris product meetup organizer"},
        {"type": "recent_post", "detail": "French-language note on i18n pitfalls and RTL testing"},
    ])
    store.upsert_warm_angles("domain:wonka.com", [
        {"type": "product_news", "detail": "EU subscriptions relaunch; exploring regional pricing experiments"},
    ])
    store.upsert_warm_angles("li:https://linkedin.com/in/kenjitanaka", [
        {"type": "mutual", "detail": "Shared vendor reference in APAC ops (logistics tooling)"},
        {"type": "recent_post", "detail": "Ops thread on reducing handoffs and SLA breaches"},
    ])
    store.upsert_warm_angles("domain:umbrella.sg", [
        {"type": "product_news", "detail": "APAC fulfillment pilot; case study coming with regional partners"},
        {"type": "podcast_mention", "detail": "Mentioned on APAC Ops Leaders roundtable"},
    ])
    store.upsert_warm_angles("li:https://linkedin.com/in/elainebenes", [
        {"type": "recent_post", "detail": "Metrics governance article – seeking examples of lineage UI"},
        {"type": "mutual", "detail": "Connection to Jordan Lee (Data) and analytics guild lead"},
    ])
    store.upsert_warm_angles("domain:vandelay.com", [
        {"type": "product_news", "detail": "Supply chain analytics expansion; vendor scorecards in beta"},
    ])
    store.upsert_warm_angles("li:https://linkedin.com/in/morganstark", [
        {"type": "podcast_mention", "detail": "Interview on AI Ops guardrails and human-in-the-loop design"},
        {"type": "mutual", "detail": "Shared board advisor in common; both follow AI reliability research group"},
    ])
    store.upsert_warm_angles("domain:stark.com", [
        {"type": "product_news", "detail": "Internal AI agent assist hitting 70% adoption in targeted workflows"},
    ])
    store.upsert_warm_angles("school:UC Berkeley", [
        {"type": "alma_mater", "detail": "Shared school: UC Berkeley; product alumni group"},
    ])
    store.upsert_warm_angles("school:National University of Singapore", [
        {"type": "alma_mater", "detail": "Shared school: NUS; APAC product circle"},
    ])
    store.upsert_warm_angles("school:NYU Stern", [
        {"type": "alma_mater", "detail": "Shared school: NYU Stern; analytics alumni chapter"},
    ])
    # Seed Replies linked to messages/contacts
    sample_replies = [
        {
            "id": "r1",
            "message_id": "cpo@wonka.com",
            "contact_id": "cpo@wonka.com",
            "body": "This looks promising. Can you share a 1-pager and a couple of brief case studies?",
            "label": "positive",
        },
        {
            "id": "r2",
            "message_id": "head.growth@umbrella.com",
            "contact_id": "head.growth@umbrella.com",
            "body": "Interested, but timing is tight this week. Early next okay?",
            "label": "positive",
        },
        {
            "id": "r3",
            "message_id": "eng.manager@piedpiper.com",
            "contact_id": "eng.manager@piedpiper.com",
            "body": "Not the right quarter; we're focused on SDK stability. Circle back Q4?",
            "label": "objection",
        },
        {
            "id": "r4",
            "message_id": "recruiting@globex.com",
            "contact_id": "recruiting@globex.com",
            "body": "Out of office until Monday.",
            "label": "ooo",
        },
        {
            "id": "r5",
            "message_id": "alex@acme.com",
            "contact_id": "alex@acme.com",
            "body": "Thanks for reaching out. Do you have a one-pager and 2-3 concise examples we can skim?",
            "label": "neutral",
        },
        {
            "id": "r6",
            "message_id": "sam@globex.com",
            "contact_id": "sam@globex.com",
            "body": "Let's find a time next week. Tues/Wed 10-12 PT is generally open.",
            "label": "positive",
        },
        {
            "id": "r7",
            "message_id": "cto@stark.com",
            "contact_id": "cto@stark.com",
            "body": "Looping in our Head of AI for a deeper look. If you have a 1-pager, please share.",
            "label": "positive",
        },
        {
            "id": "r8",
            "message_id": "head.analytics@vandelay.com",
            "contact_id": "head.analytics@vandelay.com",
            "body": "Curious about your governance workflow. Can you walk me through metric ownership + lineage?",
            "label": "neutral",
        },
        {
            "id": "r9",
            "message_id": "eu.pm@wonka.eu",
            "contact_id": "eu.pm@wonka.eu",
            "body": "Happy to chat. Prefer FR for first call; ok to switch to EN after.",
            "label": "positive",
        },
        {
            "id": "r10",
            "message_id": "apac.ops@umbrella.sg",
            "contact_id": "apac.ops@umbrella.sg",
            "body": "Can we do 08:30 SGT? We have a window before standups.",
            "label": "positive",
        },
        {
            "id": "r11",
            "message_id": "recruiter@initech.com",
            "contact_id": "recruiter@initech.com",
            "body": "I'm not the right owner—try Jordan in product ops (jordan@initech.com).",
            "label": "referral",
        },
        {
            "id": "r12",
            "message_id": "sam@globex.com",
            "contact_id": "sam@globex.com",
            "body": "Please remove me from this list.",
            "label": "unsubscribe",
        },
        {
            "id": "r13",
            "message_id": "security.lead@waynetech.com",
            "contact_id": "security.lead@waynetech.com",
            "body": "Looks relevant. Can you share your SOC2 and details on SSO/SCIM edge cases?",
            "label": "positive",
        },
        {
            "id": "r14",
            "message_id": "alex@acme.com",
            "contact_id": "alex@acme.com",
            "body": "Booked for Thursday. Send any prep material beforehand.",
            "label": "meeting",
        },
        {
            "id": "r15",
            "message_id": "eng.manager@piedpiper.com",
            "contact_id": "eng.manager@piedpiper.com",
            "body": "If you have a migration plan for SDK v3 with minimal churn, that'd help the convo.",
            "label": "objection",
        },
        {
            "id": "r16",
            "message_id": "cpo@wonka.com",
            "contact_id": "cpo@wonka.com",
            "body": "Let's do 20 minutes tomorrow at 11:30am ET. Send an invite.",
            "label": "meeting",
        },
    ]
    store.set_replies(sample_replies)
    # Reflect replies in message list
    for rep in sample_replies:
        for m in store.messages:
            if m.get("id") == rep.get("message_id"):
                m["replied"] = True
                if rep.get("label") in ("positive", "meeting", "ooo", "objection", "unsubscribe", "referral", "neutral"):
                    m["label"] = rep.get("label")
                break
    # Seed One-pagers for top candidates
    onepagers = [
        {
            "candidate_id": "cand_alex_pm",
            "job_id": postings[0]["id"],
            "url": "https://example.com/onepager/alex.pdf",
            "portfolio_url": "https://portfolio.example.com/alex",
            "deck_url": "https://drive.example.com/alex-deck",
            "video_url": "https://video.example.com/alex-intro",
            "blurb": "PLG activation, onboarding, and pricing wins with quantified lift; includes rollout plan and experiment backlog.",
            "highlights": [
                "Activation +12% in 2 quarters",
                "Trial→Paid +9pp via guided onboarding",
                "CAC −18% through value-based packaging"
            ],
            "metrics": ["TTFV 3d→36h", "Annual plans +31% adoption"],
            "case_studies": [
                {"title": "Guided Onboarding", "outcome": "+9pp conversion"},
                {"title": "Pricing/Packaging", "outcome": "CAC −18%"}
            ],
        },
        {
            "candidate_id": "cand_sam_ai",
            "job_id": postings[3]["id"],
            "url": "https://example.com/onepager/samira.pdf",
            "portfolio_url": "https://portfolio.example.com/ai-copilot",
            "deck_url": "https://drive.example.com/ai-copilot-deck",
            "video_url": "https://video.example.com/ai-overview",
            "blurb": "GenAI copilot with human-in-the-loop guardrails; evaluation harness and governance aligned to SOC2.",
            "highlights": [
                "Case resolution time −35%",
                "Model adoption 70% of workflows",
                "False positives −22% with policy checks"
            ],
            "metrics": ["NPS +11 for AI-enabled flows"],
            "case_studies": [
                {"title": "Agent Assist", "outcome": "−35% handle time"},
                {"title": "Governance", "outcome": "SOC2-aligned controls"}
            ],
        },
        {
            "candidate_id": "cand_lee_data",
            "job_id": postings[5]["id"],
            "url": "https://example.com/onepager/jordan.pdf",
            "portfolio_url": "https://portfolio.example.com/metrics-catalog",
            "deck_url": "https://drive.example.com/metrics-deck",
            "video_url": "https://video.example.com/data-platform",
            "blurb": "Metrics catalog and governance workflows; self-serve pipelines and lineage to reduce incident rate.",
            "highlights": [
                "Time-to-insight 5d→1d",
                "60% catalog adoption",
                "Data incidents −40%"
            ],
            "metrics": ["Freshness SLA 93%→99.7%"],
            "case_studies": [
                {"title": "Metrics Layer", "outcome": "One source of truth"},
                {"title": "Governance", "outcome": "Reduced incident rate"}
            ],
        },
        {
            "candidate_id": "cand_priya_design",
            "job_id": postings[24 % len(postings)]["id"],
            "url": "https://example.com/onepager/priya.pdf",
            "portfolio_url": "https://portfolio.example.com/checkout",
            "deck_url": "https://drive.example.com/commerce-deck",
            "video_url": "https://video.example.com/checkout-walkthrough",
            "blurb": "Checkout/subscriptions conversion program with research insights and an experimentation playbook.",
            "highlights": [
                "Checkout conversion +4.2pp",
                "Subscription churn −9%",
                "AOV +6% via bundles"
            ],
            "metrics": ["Mobile conversion +3pp"],
            "case_studies": [
                {"title": "Design System Refresh", "outcome": "Faster iteration"},
                {"title": "Promo Controls", "outcome": "Reduced abuse"}
            ],
        },
        {
            "candidate_id": "cand_mateo_platform",
            "job_id": postings[4 % len(postings)]["id"],
            "url": "https://example.com/onepager/mateo.pdf",
            "portfolio_url": "https://portfolio.example.com/platform-sdks",
            "deck_url": "https://drive.example.com/platform-dx",
            "video_url": "https://video.example.com/sdk-demo",
            "blurb": "API/SDK platform with versioning, golden paths, and reliability wins; developer-first DX.",
            "highlights": [
                "p95 latency −28%",
                "Integration time −35%",
                "Internal platform NPS +15"
            ],
            "metrics": ["Error budget compliance 99.9%"],
            "case_studies": [
                {"title": "Versioned APIs", "outcome": "Zero-downtime migrations"},
                {"title": "Golden Paths", "outcome": "Faster partner onboarding"}
            ],
        },
        {
            "candidate_id": "cand_chen_security",
            "job_id": postings[20 % len(postings)]["id"],
            "url": "https://example.com/onepager/chen.pdf",
            "portfolio_url": "https://portfolio.example.com/security-suite",
            "deck_url": "https://drive.example.com/security-deck",
            "video_url": "https://video.example.com/security-overview",
            "blurb": "Enterprise security features: SSO/SCIM, audit trails, anomaly detection; enterprise trust accelerators.",
            "highlights": [
                "Security questionnaires cycle −30%",
                "SSO adoption 78% of tenants",
                "Auth tickets −22%"
            ],
            "metrics": ["MTTR incidents −18%"],
            "case_studies": [
                {"title": "Admin Audit Center", "outcome": "Improved compliance"},
                {"title": "Anomaly Detection", "outcome": "Fewer escalations"}
            ],
        },
        {
            "candidate_id": "cand_riley_growth",
            "job_id": postings[12 % len(postings)]["id"],
            "url": "https://example.com/onepager/riley.pdf",
            "portfolio_url": "https://portfolio.example.com/marketplace-growth",
            "deck_url": "https://drive.example.com/marketplace-deck",
            "video_url": "https://video.example.com/growth-overview",
            "blurb": "Marketplace supply/demand balancing; reputation and pricing incentives at scale.",
            "highlights": [
                "Supplier activation +18%",
                "Repeat purchase +7pp",
                "Fraud −35%"
            ],
            "metrics": ["LTV +10%"],
            "case_studies": [
                {"title": "Tiered Incentives", "outcome": "+18% activation"},
                {"title": "Reputation Revamp", "outcome": "Lower fraud"}
            ],
        },
        {
            "candidate_id": "cand_fatima_fintech",
            "job_id": postings[10 % len(postings)]["id"],
            "url": "https://example.com/onepager/fatima.pdf",
            "portfolio_url": "https://portfolio.example.com/billing-entitlements",
            "deck_url": "https://drive.example.com/billing-deck",
            "video_url": "https://video.example.com/billing-overview",
            "blurb": "Payments success, entitlements, and revenue integrity across invoicing and tax compliance.",
            "highlights": [
                "Payment success +2.1pp",
                "Invoice aging >30d −24%",
                "Chargebacks −19%"
            ],
            "metrics": ["Revenue reporting accuracy +"],
            "case_studies": [
                {"title": "Entitlements Service", "outcome": "Reduced revenue leakage"},
                {"title": "Tax Engine Integration", "outcome": "Compliance coverage"}
            ],
        },
        {
            "candidate_id": "cand_sven_i18n",
            "job_id": postings[22 % len(postings)]["id"],
            "url": "https://example.com/onepager/sven.pdf",
            "portfolio_url": "https://portfolio.example.com/i18n-pricing",
            "deck_url": "https://drive.example.com/i18n-deck",
            "video_url": "https://video.example.com/i18n-demo",
            "blurb": "Internationalization and regional pricing at scale; FR/DE focus with localization ops.",
            "highlights": [
                "EU ARR +21%",
                "RTL checkout errors −17%",
                "Regional price tests +6% conversion"
            ],
            "metrics": ["Localization coverage 12→24 locales"],
            "case_studies": [
                {"title": "Regional Pricing", "outcome": "Lift in EU markets"},
                {"title": "Data Residency", "outcome": "Compliance readiness"}
            ],
        },
        {
            "candidate_id": "cand_naomi_devtools",
            "job_id": postings[18 % len(postings)]["id"],
            "url": "https://example.com/onepager/naomi.pdf",
            "portfolio_url": "https://portfolio.example.com/devtools",
            "deck_url": "https://drive.example.com/devtools-deck",
            "video_url": "https://video.example.com/cli-demo",
            "blurb": "Devtools suite: SDKs, CLIs, observability; onboarding quickstarts and docs strategy.",
            "highlights": [
                "Time-to-first-API-call −40%",
                "Docs satisfaction +22%",
                "Monthly active SDKs +31%"
            ],
            "metrics": ["GitHub stars +2k"],
            "case_studies": [
                {"title": "Unified CLI", "outcome": "Streamlined DX"},
                {"title": "Quickstarts", "outcome": "Faster integrations"}
            ],
        },
    ]
    for op in onepagers:
        store.upsert_onepager(op)
    # Seed Onboarding checklist
    onboarding = [
        {"id": "env_keys", "title": "Add API keys (Apify, MV, Instantly, OpenAI, Calendly)", "done": False, "link": "/settings"},
        {"id": "health_check", "title": "Confirm API health on Status page", "done": True, "link": "/status"},
        {"id": "build_ijp", "title": "Build and save your first IJP", "done": True, "link": "/foundry/ijp"},
        {"id": "load_ijp", "title": "Load saved IJP preset", "done": True, "link": "/foundry/ijp"},
        {"id": "ingest_jobs", "title": "Ingest roles via Apify search or JD URLs", "done": True, "link": "/foundry/jobs"},
        {"id": "poll_jobs", "title": "Poll ingest job and open first JD", "done": True, "link": "/foundry/jobs"},
        {"id": "parse_resume", "title": "Paste resume to parse (5 sections)", "done": True, "link": "/foundry/candidate"},
        {"id": "score_match", "title": "Score candidate↔role matches (set min score)", "done": True, "link": "/foundry/match"},
        {"id": "find_contacts", "title": "Find decision-makers or recruiters", "done": False, "link": "/foundry/contacts"},
        {"id": "sendable_filter", "title": "Toggle ‘Sendable only’ (gated by MV status/score)", "done": False, "link": "/foundry/contacts"},
        {"id": "verify_emails", "title": "Verify emails (MillionVerifier)", "done": False, "link": "/foundry/verify"},
        {"id": "adjust_threshold", "title": "Adjust MV accept-all threshold", "done": False, "link": "/settings"},
        {"id": "warm_angles", "title": "Test Warm Angles finder (mutuals/alumni/posts)", "done": False, "link": "/warm-angles"},
        {"id": "generate_outreach", "title": "Generate outreach variants (email/LI/intro)", "done": False, "link": "/foundry/outreach"},
        {"id": "use_preset", "title": "Load an outreach variables preset", "done": False, "link": "/foundry/outreach"},
        {"id": "apply_variant", "title": "Apply selected variant to Sequence", "done": False, "link": "/foundry/outreach"},
        {"id": "export_sequence", "title": "Export or push Instantly CSV/API", "done": False, "link": "/foundry/sequence"},
        {"id": "analytics_check", "title": "Review Analytics (opens/replies/positive; per-variant)", "done": False, "link": "/analytics"},
        {"id": "messages_label", "title": "Open Messages and mock open/reply/positive", "done": False, "link": "/messages"},
        {"id": "crm_seed", "title": "View CRM board and drag cards across lanes", "done": False, "link": "/CRM"},
        {"id": "onepager_gen", "title": "Generate a One-pager for a candidate", "done": False, "link": "/onepager"},
        {"id": "deliverability", "title": "Skim Deliverability checklist (SPF/DKIM/DMARC)", "done": False, "link": "/deliverability"},
        {"id": "compliance", "title": "Open Compliance console placeholder", "done": False, "link": "/compliance"},
        {"id": "audit_log", "title": "Inspect Audit Log events", "done": False, "link": "/audit"},
        {"id": "tools_hub", "title": "Explore Tools hub and demo seed/reset", "done": False, "link": "/tools"},
        {"id": "theme_toggle", "title": "Toggle dark/day mode in Navbar", "done": False, "link": "/"},
    ]
    store.set_onboarding(onboarding)
    # Seed Deliverability checklist
    deliverability = [
        # DNS/Auth
        {"id": "spf", "title": "SPF record set with correct include mechanisms", "done": False},
        {"id": "dkim", "title": "DKIM keys published (selector s1/s2) and validated", "done": False},
        {"id": "dmarc", "title": "DMARC policy configured (rua/ruf, pct ramp, p=none→quarantine)", "done": False},
        {"id": "bimi", "title": "BIMI TXT and SVG logo present (optional)", "done": False},
        # Infrastructure
        {"id": "ptr_rdns", "title": "PTR/reverse DNS matches HELO/EHLO hostname", "done": False},
        {"id": "helo_hostname", "title": "HELO/EHLO hostname is a valid FQDN", "done": False},
        {"id": "mx_health", "title": "MX records healthy and consistent", "done": True},
        {"id": "tls_reporting", "title": "TLS and MTA-STS/TLS-RPT considered (where relevant)", "done": False},
        # Policy & Sending
        {"id": "ip_warmup_wk1", "title": "IP/mailbox warm-up week 1 plan applied", "done": False},
        {"id": "ip_warmup_wk2", "title": "IP/mailbox warm-up week 2 plan applied", "done": False},
        {"id": "caps", "title": "Daily send caps set per mailbox (and staggered)", "done": False},
        {"id": "windows", "title": "Send windows configured (avoid blasts; respect time zones)", "done": False},
        {"id": "segmentation", "title": "List segmentation (new vs. engaged; suppression list)", "done": False},
        # Content & Compliance
        {"id": "from_reply", "title": "Human-friendly From name and valid Reply-To", "done": True},
        {"id": "unsub", "title": "Unsubscribe/opt-out visible and one-click where supported", "done": True},
        {"id": "footer_address", "title": "Footer includes physical address/disclaimer (as applicable)", "done": True},
        {"id": "link_tracking_toggle", "title": "Link/open tracking toggled per mailbox domain policy", "done": False},
        {"id": "dnc", "title": "Do-not-contact registry enforced across runs", "done": False},
        # Monitoring & Feedback
        {"id": "google_postmaster", "title": "Google Postmaster Tools connected (domain reputation)", "done": False},
        {"id": "microsoft_snds", "title": "Microsoft SNDS/Smart Network Data Services connected", "done": False},
        {"id": "blocklist", "title": "Blocklist checks monitored (Spamhaus/Spamcop/etc.)", "done": False},
        {"id": "seed_tests", "title": "Inbox placement/seed tests executed on sample", "done": False},
        {"id": "bounces", "title": "Bounce handling categorized (hard vs soft) and throttling rules", "done": False},
        {"id": "complaints", "title": "Complaint/feedback loops wired where offered", "done": False},
        # Alignment
        {"id": "domain_alignment", "title": "From, DKIM d=, and Return-Path aligned to same org domain", "done": False},
        {"id": "subdomain_strategy", "title": "Dedicated subdomain strategy for outreach (e.g., hello.example.com)", "done": False}
    ]
    store.set_deliverability(deliverability)
    # Seed Compliance rules and DNC registry
    rules = [
        {"region": "US (CAN-SPAM)", "rules": [
            "Honor unsubscribe within 10 days",
            "Include physical mailing address",
            "Clear and conspicuous identification",
            "No deceptive subject lines"
        ]},
        {"region": "EU (GDPR/ePrivacy)", "rules": [
            "Lawful basis (consent or legitimate interest)",
            "Provide data access/erasure routes",
            "Link to privacy policy and controller details",
            "Record consent and purpose limitation"
        ]},
        {"region": "UK (PECR + UK GDPR)", "rules": [
            "Consent or soft opt-in where applicable",
            "Unsubscribe in every message",
            "Maintain opt-out registry across campaigns"
        ]},
        {"region": "CA (CASL)", "rules": [
            "Express or implied consent windows",
            "Identify sender and contact details",
            "Functional unsubscribe within 10 business days"
        ]},
        {"region": "AU (Spam Act)", "rules": [
            "Consent required (express or inferred)",
            "Identify sender and contact info",
            "Functional unsubscribe facility"
        ]},
        {"region": "SG (PDPA)", "rules": [
            "Check DNC Registry prior to sending",
            "Obtain consent unless exempt",
            "Provide contact for withdrawal of consent"
        ]},
        {"region": "BR (LGPD)", "rules": [
            "Specify legal basis and purpose",
            "Enable data subject rights (access, deletion)",
            "Minimize data and secure processing"
        ]},
        {"region": "ZA (POPIA)", "rules": [
            "Lawful processing and purpose specification",
            "Objection and opt-out handling",
            "Information security safeguards"
        ]},
        {"region": "JP (APPI)", "rules": [
            "Notify purpose of use and obtain consent when required",
            "Cross-border transfer safeguards",
            "Prompt response to disclosure/correction requests"
        ]},
        {"region": "IN (DPDP)", "rules": [
            "Notice and consent for personal data processing",
            "Withdrawal of consent mechanisms",
            "Data minimization and accuracy"
        ]},
        {"region": "NZ (Privacy Act)", "rules": [
            "Collect only for lawful, necessary purposes",
            "Right to access/correct personal information",
            "Take reasonable security safeguards"
        ]},
        {"region": "CH (FADP)", "rules": [
            "Transparency and proportionality",
            "International transfer adequacy or safeguards",
            "Data subject rights facilitated"
        ]},
        {"region": "DE (BDSG)", "rules": [
            "Strict purpose limitation and data minimization",
            "Employee data processing rules",
            "Honor objections to direct marketing"
        ]}
    ]
    store.set_compliance_rules(rules)
    dnc = [
        {"id": "unsubscribe:sam@globex.com", "reason": "Unsubscribe requested"},
        {"id": "block:enterprise@acme.com", "reason": "Do-not-contact (enterprise policy)"},
        {"id": "gdpr:eu.pm@wonka.eu", "reason": "GDPR delete request"},
        {"id": "domain:*@examplebank.com", "reason": "Financial institution – restrict unsolicited outreach"},
        {"id": "role:*legal*@*", "reason": "Exclude legal/compliance roles from sequences"},
        {"id": "region:DE", "reason": "German recipients opted out of marketing"},
        {"id": "unsubscribe:cto@stark.com", "reason": "Unsubscribe – internal policy"},
        {"id": "bounce:recruiting@globex.com", "reason": "Hard bounce – suppress"},
        {"id": "complaint:ops@umbrella.sg", "reason": "Complaint received – add to DNC"},
        {"id": "privacy:head.analytics@vandelay.com", "reason": "Privacy request – no further contact"}
    ]
    store.set_dnc(dnc)
    # Seed Webhook-like events into Audit + reflect on messages
    webhook_events = [
        {"event": "opened", "email": "alex@acme.com", "campaign": "demo", "variant": "preset_short_email_pm"},
        {"event": "clicked", "email": "alex@acme.com", "campaign": "demo", "link": "https://calendly.com/oliveraellison/15min"},
        {"event": "reply", "email": "cpo@wonka.com", "campaign": "demo", "label": "meeting"},
        {"event": "opened", "email": "sam@globex.com", "campaign": "demo", "variant": "preset_email_long_billing"},
        {"event": "unsubscribe", "email": "sam@globex.com", "campaign": "demo"},
        {"event": "bounce", "email": "recruiting@globex.com", "campaign": "demo"},
        {"event": "opened", "email": "security.lead@waynetech.com", "campaign": "demo", "variant": "preset_email_medium_security"},
        {"event": "reply", "email": "security.lead@waynetech.com", "campaign": "demo", "label": "positive"},
        {"event": "opened", "email": "eu.pm@wonka.eu", "campaign": "demo", "variant": "preset_email_medium_i18n"},
        {"event": "clicked", "email": "eu.pm@wonka.eu", "campaign": "demo", "link": "https://portfolio.example.com/i18n-pricing"},
        {"event": "complaint", "email": "ops@umbrella.sg", "campaign": "demo"},
    ]
    for evt in webhook_events:
        store.add_audit(None, f"instantly_webhook:{evt['event']}", evt)
        if evt.get("email") and evt["event"] == "opened":
            store.update_message(evt["email"], opened=True)
        if evt.get("email") and evt["event"] == "reply":
            store.update_message(evt["email"], replied=True, label=evt.get("label") or "reply")
        if evt.get("email") and evt["event"] == "bounce":
            store.update_message(evt["email"], label="bounce")
        if evt.get("email") and evt["event"] == "unsubscribe":
            store.update_message(evt["email"], label="unsubscribe")
        if evt.get("email") and evt["event"] == "complaint":
            store.update_message(evt["email"], label="complaint")
    # Seed SequenceRun records
    sequence_runs = [
        {
            "id": "run_001",
            "user_id": "demo_user",
            "ijp_id": "ijp_demo_1",
            "candidate_id": "cand_alex_pm",
            "job_ids": [job_id],
            "contact_ids": [r.get("email") for r in rows[:8]],
            "status": "exported_csv",
            "created_at": "2025-09-09T10:00:00Z",
            "metrics": {"delivered": 8, "open": 5, "reply": 2, "positive": 1, "meetings": 1},
            "variant": "preset_short_email_pm",
        },
        {
            "id": "run_002",
            "user_id": "demo_user",
            "ijp_id": "ijp_demo_1",
            "candidate_id": "cand_sam_ai",
            "job_ids": [job_id],
            "contact_ids": [r.get("email") for r in rows[8:16]],
            "status": "pushed_api",
            "created_at": "2025-09-09T12:30:00Z",
            "metrics": {"delivered": 8, "open": 6, "reply": 2, "positive": 1, "meetings": 0},
            "variant": "preset_email_long_ai_ops",
        },
        {
            "id": "run_003",
            "user_id": "demo_user",
            "ijp_id": "ijp_demo_1",
            "candidate_id": "cand_lee_data",
            "job_ids": [job_id],
            "contact_ids": [r.get("email") for r in rows[16:26]],
            "status": "scheduled",
            "created_at": "2025-09-10T09:15:00Z",
            "metrics": {"delivered": 0, "open": 0, "reply": 0, "positive": 0, "meetings": 0},
            "variant": "preset_li_note_data_platform",
        },
        {
            "id": "run_004",
            "user_id": "demo_user",
            "ijp_id": "ijp_demo_1",
            "candidate_id": "cand_priya_design",
            "job_ids": [job_id],
            "contact_ids": [r.get("email") for r in rows[26:36]],
            "status": "in_progress",
            "created_at": "2025-09-10T11:40:00Z",
            "metrics": {"delivered": 6, "open": 3, "reply": 1, "positive": 0, "meetings": 0},
            "variant": "preset_li_note_growth_marketplace",
        },
        {
            "id": "run_005",
            "user_id": "demo_user",
            "ijp_id": "ijp_demo_1",
            "candidate_id": "cand_fatima_fintech",
            "job_ids": [job_id],
            "contact_ids": [r.get("email") for r in rows[36:46]],
            "status": "completed",
            "created_at": "2025-09-11T08:05:00Z",
            "metrics": {"delivered": 10, "open": 7, "reply": 3, "positive": 2, "meetings": 1},
            "variant": "preset_email_long_billing",
        },
    ]
    for r in sequence_runs:
        store.add_sequence_run(r)
    # Seed stored Matches for many candidates across a broader set of postings
    candidate_domains_map = {
        "cand_alex_pm": ["product", "growth", "b2b", "activation"],
        "cand_sam_ai": ["ai", "platform", "enterprise"],
        "cand_lee_data": ["data", "analytics", "platform"],
        "cand_priya_design": ["design", "ecommerce", "product"],
        "cand_mateo_platform": ["platform", "developer", "api"],
        "cand_chen_security": ["security", "enterprise", "identity"],
        "cand_riley_growth": ["growth", "marketplace", "pricing"],
        "cand_fatima_fintech": ["fintech", "payments", "billing"],
        "cand_sven_i18n": ["international", "pricing", "compliance"],
        "cand_naomi_devtools": ["developer", "devtools", "observability"],
    }
    seeded_matches: list[dict] = []
    # Evaluate against up to first 20 postings for breadth
    eval_postings = postings[:20] if len(postings) > 20 else postings
    for cid, domains in candidate_domains_map.items():
        scored = []
        for j in eval_postings:
            s = score_match({"id": cid, "domains": domains}, j)
            scored.append({
                "candidate_id": cid,
                "job_id": j["id"],
                "company": j.get("company"),
                "title": j.get("title"),
                "score": s.get("score", 0),
                "reasons": s.get("reasons", []),
                "blockers": s.get("blockers", []),
                "evidence": s.get("evidence", []),
            })
        # Keep top 6 per candidate for realism
        scored.sort(key=lambda x: x["score"], reverse=True)
        for rank, m in enumerate(scored[:6], start=1):
            m["rank"] = rank
            m["summary"] = f"{m['candidate_id']} vs {m['company']} – {m['title']}"
            m["created_at"] = "2025-09-10T10:00:00Z"
            seeded_matches.append(m)
    store.set_matches(seeded_matches)
    # Seed Analytics timeseries per day and variant (28 days, realistic noise)
    ts = []
    start_date = datetime(2025, 8, 15)
    num_days = 28
    variants = [
        "preset_short_email_pm",               # strong opener
        "preset_email_long_billing",          # longer copy, moderate opens
        "preset_email_medium_security",       # security audience
        "preset_email_long_ai_ops",           # AI ops interest
        "preset_email_medium_i18n",           # niche geo pricing
        "preset_li_note_data_platform",       # LinkedIn note (lower volume)
        "preset_li_note_growth_marketplace",  # LinkedIn note
        "preset_intro_mutual_platform_sdk",   # intro via mutual (very low volume, high quality)
    ]
    rates = {
        "preset_short_email_pm": {"open": 0.62, "reply": 0.13, "positive": 0.55},
        "preset_email_long_billing": {"open": 0.58, "reply": 0.12, "positive": 0.50},
        "preset_email_medium_security": {"open": 0.60, "reply": 0.12, "positive": 0.58},
        "preset_email_long_ai_ops": {"open": 0.64, "reply": 0.15, "positive": 0.60},
        "preset_email_medium_i18n": {"open": 0.59, "reply": 0.12, "positive": 0.55},
        "preset_li_note_data_platform": {"open": 0.35, "reply": 0.10, "positive": 0.45},
        "preset_li_note_growth_marketplace": {"open": 0.33, "reply": 0.09, "positive": 0.42},
        "preset_intro_mutual_platform_sdk": {"open": 0.75, "reply": 0.30, "positive": 0.70},
    }
    # Base daily volume per channel (email > li > intro)
    base_volume = {
        "preset_short_email_pm": 22,
        "preset_email_long_billing": 20,
        "preset_email_medium_security": 18,
        "preset_email_long_ai_ops": 20,
        "preset_email_medium_i18n": 16,
        "preset_li_note_data_platform": 8,
        "preset_li_note_growth_marketplace": 8,
        "preset_intro_mutual_platform_sdk": 3,
    }
    for day_idx in range(num_days):
        d = (start_date + timedelta(days=day_idx))
        is_weekend = d.weekday() >= 5
        date_str = d.strftime("%Y-%m-%d")
        for v in variants:
            # Weekend dip (except intro via mutual which is low volume anyway)
            vol = base_volume[v]
            if is_weekend:
                vol = max(1, int(vol * (0.35 if v.startswith("preset_email") else 0.5)))
            # Add mild daily noise
            noise = ((day_idx * (len(v) % 7 + 3)) % 5) - 2  # -2..+2
            delivered = max(1, vol + noise)
            r = rates[v]
            opens = int(round(delivered * r["open"]))
            replies = int(round(opens * r["reply"]))
            positives = int(round(max(0, replies) * r["positive"]))
            # Secondary metrics
            bounces = int(round(delivered * (0.01 if v.startswith("preset_email") else 0.0)))
            unsubscribes = int(round(delivered * (0.005 if v.startswith("preset_email") else 0.0)))
            complaints = 1 if (v.startswith("preset_email") and day_idx % 19 == 0 and delivered > 10) else 0
            ts.append({
                "date": date_str,
                "variant": v,
                "delivered": delivered,
                "open": opens,
                "reply": replies,
                "positive": positives,
                "bounces": bounces,
                "unsubscribes": unsubscribes,
                "complaints": complaints,
            })
    store.set_timeseries(ts)
    # Seed richer CandidateExperience arrays
    store.set_candidate_experience("cand_alex_pm", [
        {"title": "Senior Product Manager", "company": "Acme", "start_date": "2022-01-01", "end_date": None, "bullets": [
            "Led activation program (TTFV 3d→36h)",
            "Launched value-based packaging; CAC −18%",
            "Partnered with design to ship guided onboarding"
        ], "tenure_months": 36, "location": "NYC", "employment_type": "Full-time", "skills": ["PLG","Pricing","Experimentation"]},
        {"title": "Product Manager", "company": "Globex", "start_date": "2019-01-01", "end_date": "2021-12-31", "bullets": [
            "Owned growth experiments across signup and paywall",
            "Built analytics dashboards for funnel visibility"
        ], "tenure_months": 36, "location": "SF", "employment_type": "Full-time", "skills": ["Analytics","Funnel","SQL"]},
    ])
    store.set_candidate_experience("cand_sam_ai", [
        {"title": "Director of Product, AI", "company": "Initech", "start_date": "2021-03-01", "end_date": None, "bullets": [
            "Shipped agent assist; handle time −35%",
            "Established AI governance and evaluation harness"
        ]},
        {"title": "Lead PM", "company": "WayneTech", "start_date": "2017-01-01", "end_date": "2021-02-28", "bullets": [
            "Ownership of platform ML workflows and policy"
        ]},
    ])
    # Seed PortfolioAssets per candidate
    store.set_portfolio_assets("cand_alex_pm", [
        {"id": "pa_alex_1", "type": "doc", "title": "PLG Playbook", "url": "https://drive.example.com/alex-plg", "tags": ["PLG", "Activation"], "thumbnail_url": "https://img.example.com/plg.png", "preview_text": "Activation system design...", "source": "doc", "relevance_score": 0.92, "created_at": "2024-11-12"},
        {"id": "pa_alex_2", "type": "deck", "title": "Onboarding Redesign", "url": "https://drive.example.com/alex-onboarding", "tags": ["Onboarding"], "thumbnail_url": "https://img.example.com/onboarding.png", "preview_text": "Guided flows and value moments...", "source": "deck", "relevance_score": 0.88, "created_at": "2025-02-20"},
        {"id": "pa_alex_3", "type": "link", "title": "Case Study – Conversion", "url": "https://portfolio.example.com/case-conv", "tags": ["CaseStudy"], "thumbnail_url": "https://img.example.com/case.png", "preview_text": "Trial→paid uplift...", "source": "link", "relevance_score": 0.81, "created_at": "2025-05-02"},
    ])
    store.set_portfolio_assets("cand_sam_ai", [
        {"id": "pa_sam_1", "type": "deck", "title": "AI Copilot Overview", "url": "https://drive.example.com/ai-copilot", "tags": ["AI", "Copilot"], "thumbnail_url": "https://img.example.com/copilot.png", "preview_text": "Guardrails and evaluation...", "source": "deck", "relevance_score": 0.9, "created_at": "2025-01-10"},
        {"id": "pa_sam_2", "type": "video", "title": "Agent Assist Demo", "url": "https://video.example.com/agent-assist", "tags": ["Demo"], "thumbnail_url": "https://img.example.com/assist.png", "preview_text": "Live resolution walkthrough...", "source": "video", "relevance_score": 0.86, "created_at": "2025-03-04"},
    ])
    # Seed Instantly campaign objects (mock)
    campaigns = [
        {"id": "cmp_001", "name": "Demo – PM Intro", "variant": "preset_short_email_pm", "list_size": 50, "status": "active", "created_at": "2025-09-09T09:00:00Z"},
        {"id": "cmp_002", "name": "Demo – AI Ops", "variant": "preset_email_long_ai_ops", "list_size": 40, "status": "paused", "created_at": "2025-09-09T11:30:00Z"},
        {"id": "cmp_003", "name": "Demo – Billing", "variant": "preset_email_long_billing", "list_size": 35, "status": "draft", "created_at": "2025-09-10T08:45:00Z"},
    ]
    for c in campaigns:
        store.add_campaign(c)
    # Seed Audit logs
    for evt in [
        ("demo_seed_start", {"note": "Seeding demo data", "env": "dev"}),
        ("settings_read", {"mv_threshold": 0.8, "instantly_enabled": False}),
        ("ijp_saved", {"id": "ijp_demo_1", "filters": {"titles": ijp_mock.get("titles", [])}}),
        ("jobs_ingest_started", {"query": "product manager remote", "source": "apify"}),
        ("jobs_seeded", {"job_id": job_id, "count": len(postings)}),
        ("resume_parsed", {"candidate_id": "cand_alex_pm", "sections": ["KeyMetrics", "Positions"]}),
        ("matches_scored", {"candidate_id": "cand_alex_pm", "job_ids": [postings[0]["id"], postings[1]["id"]]}),
        ("contacts_found", {"source": "apollo", "company": "Acme", "count": 3}),
        ("contacts_seeded", {"count": len(contacts)}),
        ("verify_batch_started", {"contact_ids": [c["id"] for c in contacts[:3]]}),
        ("verify_batch_completed", {"valid": 2, "accept_all": 1, "invalid": 1}),
        ("outreach_presets_seeded", {"count": len(outreach_presets)}),
        ("sequence_rows_seeded", {"count": len(rows)}),
        ("instantly_export_ready", {"filename": "instantly.csv"}),
        ("messages_seeded", {"count": len(messages_rows)}),
        ("crm_board_seeded", {"lanes": {k: len(v) for k, v in crm_board.items()}}),
        ("demo_seed_complete", {"ok": True}),
    ]:
        store.add_audit(None, evt[0], evt[1])
    return {
        "seeded_messages": len(demo_msgs),
        "seeded_ijp_id": "ijp_demo_1",
        "seeded_job_id": job_id,
        "postings": len(postings),
        "seeded_candidates": len(candidates),
        "seeded_contacts": len(contacts),
        "seeded_outreach_presets": len(outreach_presets),
        "seeded_sequence_rows": len(rows),
        "seeded_messages": len(messages_rows),
        "seeded_crm_cards": sum(len(v) for v in crm_board.values()),
        "seeded_audit": 16,
    }


@router.post("/demo/cleanup")
def cleanup_demo():
    store.clear_messages()
    return {"cleared": True}


@router.post("/demo/bootstrap")
def demo_bootstrap():
    """
    One-call demo bootstrap so the 12-step workflow never lacks upstream data.
    """
    # Reuse the existing rich seeding (jobs/candidates/contacts/messages, etc.)
    seed_demo()

    # Minimal “continuous workflow” context (also cached in memory)
    prefs = {
        "values": ["Impactful work", "Work-life balance", "Progressive leadership"],
        "role_categories": ["Technical & Engineering"],
        "location_preferences": ["Remote", "Hybrid"],
        "work_type": ["Remote", "Hybrid"],
        "role_type": ["Full-Time"],
        "company_size": ["51-200 employees", "201-500 employees"],
        "industries": ["Enterprise Software", "Data & Analytics"],
        "skills": ["Python", "SQL", "AWS", "Experimentation", "Stakeholder Management"],
        "minimum_salary": "$160,000",
        "job_search_status": "Actively looking",
        "state": "California",
        "user_mode": "job-seeker",
    }
    store.demo_job_preferences = prefs

    # Use the first seeded posting as a stable job description seed
    postings = store.get_jobs("demo_jobs_1")
    posting = postings[0] if postings else {}
    job_desc_id = "jd_demo_bootstrap_1"
    store.demo_job_descriptions[job_desc_id] = {
        "id": job_desc_id,
        "title": posting.get("title") or "Senior Product Manager, Activation",
        "company": posting.get("company") or "Acme",
        "url": posting.get("jd_url"),
        "content": posting.get("jd_text") or "",
        "parsed_json": {
            "pain_points": [
                "Improve onboarding activation and reduce drop-off",
                "Reduce churn by improving time-to-value",
                "Improve experiment velocity and insight quality",
            ],
            "required_skills": ["SQL", "Experimentation", "Analytics", "Product strategy", "Stakeholder management"],
            "success_metrics": ["+15% activation", "-10% churn", "2x experiment velocity"],
        },
    }

    # Resume seed (so match can run without uploads)
    store.demo_latest_resume_text = (
        "Alex Kim\nSenior Product Manager\n\n"
        "Highlights: Led onboarding experiments; improved activation; reduced churn; built analytics dashboards.\n"
        "Experience: GrowthLoop (PM), Initech (PM).\n"
    )
    store.demo_latest_resume = {
        "NotableAccomplishments": [
            "Led onboarding funnel revamp and improved activation via experiments",
            "Reduced early churn with lifecycle messaging and better time-to-value",
            "Implemented event taxonomy + dashboards for attribution",
        ],
        "KeyMetrics": ["+12% activation", "-8% churn", "4x faster insights"],
        "Skills": ["SQL", "Experimentation", "Analytics", "Roadmapping"],
    }

    # Pinpoint match seed (so offer/compose can proceed immediately)
    store.demo_pinpoint_matches = [
        {
            "pinpoint_1": "Improve onboarding activation and reduce drop-off",
            "solution_1": "Led onboarding funnel revamp and improved activation via experiments",
            "metric_1": "+12% activation",
            "pinpoint_2": "Reduce churn by improving time-to-value",
            "solution_2": "Built lifecycle messaging that reduced early churn",
            "metric_2": "-8% churn",
            "pinpoint_3": "Improve insight quality and attribution",
            "solution_3": "Implemented event taxonomy + dashboards for attribution",
            "metric_3": "4x faster insights",
            "alignment_score": 0.82,
        }
    ]

    # Contacts (selected) seed
    store.demo_selected_contacts = [
        {
            "id": "contact_demo_1",
            "name": "Jane Doe",
            "title": "VP Product",
            "company": store.demo_job_descriptions[job_desc_id]["company"],
            "email": "jane.doe@acme.com",
            "linkedin_url": "https://linkedin.com/in/janedoe",
            "verification_status": "valid",
            "verification_score": 92,
        }
    ]

    return {
        "success": True,
        "job_preferences": prefs,
        "job_description_id": job_desc_id,
        "pinpoint_matches": store.demo_pinpoint_matches,
        "selected_contacts": store.demo_selected_contacts,
    }

