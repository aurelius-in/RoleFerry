# System Architecture: Implementable Level
## RoleFerry Platform

**RM-ODP Viewpoint**: Technical Implementation  
**Audience**: Engineers, DevOps, Implementation Teams  
**Purpose**: Production-ready specifications with complete code samples and configurations

---

## 1. Concrete Technology Stack

### 1.1 Application Layer

```yaml
Frontend:
  framework: Next.js 14.2
  language: TypeScript 5.3
  ui_library: React 18.2
  styling: TailwindCSS 3.4, shadcn/ui
  state_management: Zustand 4.5
  http_client: Axios 1.6
  forms: React Hook Form 7.5
  validation: Zod 3.22

Backend:
  framework: FastAPI 0.110
  language: Python 3.11
  async_runtime: uvicorn + asyncio
  orm: SQLAlchemy 2.0 (async)
  migrations: Alembic 1.13
  validation: Pydantic V2
  testing: Pytest 8.0

Background Jobs:
  queue: Celery 5.3
  broker: Redis 7.2
  result_backend: Redis
  concurrency: gevent workers

Database:
  primary: PostgreSQL 15.5
  extensions: pg_trgm (fuzzy search), pgcrypto (encryption)
  connection_pooling: PgBouncer

Cache/Queue:
  redis: Redis 7.2
  client: redis-py 5.0 (Python), ioredis (Node.js)

Object Storage:
  provider: AWS S3
  sdk: boto3 (Python)
```

### 1.2 Infrastructure

```yaml
Cloud Provider: AWS
Region: us-east-1 (primary), us-west-2 (DR)

Compute:
  api_servers: ECS Fargate (containers)
  workers: ECS Fargate (auto-scaled)
  
Networking:
  load_balancer: Application Load Balancer (ALB)
  cdn: CloudFront (static assets)
  waf: AWS WAF (DDoS, injection protection)
  
Database:
  service: RDS PostgreSQL (Multi-AZ)
  instance: db.t4g.large (2 vCPU, 8GB RAM) → scale to db.m6g.xlarge
  storage: gp3 (500 GB, 3000 IOPS)
  
Cache:
  service: ElastiCache Redis (cluster mode)
  node: cache.t4g.medium (2 nodes)
  
Monitoring:
  metrics: CloudWatch + Datadog
  logs: CloudWatch Logs → S3 (long-term)
  traces: Datadog APM
  alerts: PagerDuty
```

---

## 2. Implementation: API Gateway

### 2.1 FastAPI Application Structure

```python
# backend/app/main.py
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.routers import auth, jobs, applications, sequences, analytics
from app.middleware.auth import JWTAuthMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.db import engine, Base
import logging

# Initialize FastAPI
app = FastAPI(
    title="RoleFerry API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://roleferry.com", "https://app.roleferry.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(JWTAuthMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=60)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(sequences.router, prefix="/api/sequences", tags=["sequences"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])

# Lifespan events
@app.on_event("startup")
async def startup():
    logging.info("Starting RoleFerry API")
    # Initialize database connection pool
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("shutdown")
async def shutdown():
    logging.info("Shutting down RoleFerry API")
    await engine.dispose()

# Health check
@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}
```

### 2.2 Authentication Middleware

```python
# backend/app/middleware/auth.py
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings
import redis

security = HTTPBearer()
redis_client = redis.Redis(host=settings.REDIS_HOST, port=6379, decode_responses=True)

async def verify_token(credentials: HTTPAuthorizationCredentials):
    token = credentials.credentials
    
    # Check if token is blacklisted (logout)
    if redis_client.exists(f"blacklist:{token}"):
        raise HTTPException(status_code=401, detail="Token has been revoked")
    
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=["HS256"]
        )
        user_id = payload.get("sub")
        role = payload.get("role")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {"user_id": user_id, "role": role}
    
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate token")

# Dependency for protected routes
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return await verify_token(credentials)
```

### 2.3 Rate Limiting

```python
# backend/app/middleware/rate_limit.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import redis
import time

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.redis = redis.Redis(host="localhost", port=6379, decode_responses=True)
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        key = f"rate_limit:{client_ip}"
        
        current = self.redis.get(key)
        
        if current is None:
            self.redis.setex(key, 60, 1)
        elif int(current) >= self.requests_per_minute:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        else:
            self.redis.incr(key)
        
        response = await call_next(request)
        return response
```

---

## 3. Implementation: Database Models

### 3.1 SQLAlchemy Models

```python
# backend/app/models.py
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, JSON, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class UserModeEnum(str, enum.Enum):
    JOB_SEEKER = "job_seeker"
    RECRUITER = "recruiter"

class ApplicationStatusEnum(str, enum.Enum):
    SAVED = "saved"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    REJECTED = "rejected"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth users
    full_name = Column(String(255))
    mode = Column(Enum(UserModeEnum), default=UserModeEnum.JOB_SEEKER)
    subscription_tier = Column(String(50), default="free")  # free, pro, teams
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Relationships
    applications = relationship("Application", back_populates="user")
    resume = relationship("Resume", back_populates="user", uselist=False)
    ijp = relationship("JobPreferences", back_populates="user", uselist=False)

class Resume(Base):
    __tablename__ = "resumes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Resume extract fields (from AI parsing)
    roles = Column(JSON)  # [{"title": "PM", "company": "X", "tenure": "3 years"}]
    key_metrics = Column(JSON)  # ["Reduced time-to-hire by 30%", ...]
    accomplishments = Column(JSON)
    skills = Column(JSON)  # ["Python", "Product Strategy", ...]
    
    raw_text = Column(Text)  # Original resume text
    pdf_url = Column(String(500))  # S3 URL
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="resume")

class JobPreferences(Base):
    __tablename__ = "job_preferences"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    values = Column(JSON)  # ["work-life balance", "impact", "growth"]
    role_types = Column(JSON)  # ["full-time", "contract"]
    locations = Column(JSON)  # ["San Francisco", "Remote"]
    remote_ok = Column(Boolean, default=True)
    role_levels = Column(JSON)  # ["ic", "manager"]
    company_sizes = Column(JSON)  # ["startup", "mid-market"]
    industries = Column(JSON)  # ["saas", "fintech"]
    skills = Column(JSON)
    hidden_companies = Column(JSON)  # Blocklist
    min_salary = Column(Integer)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="ijp")

class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(255), unique=True, index=True)  # From job board
    source = Column(String(100))  # "indeed", "linkedin", "lever", "greenhouse"
    
    title = Column(String(500), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    location = Column(String(255))
    remote = Column(Boolean, default=False)
    job_type = Column(String(50))  # full-time, contract, etc.
    
    description = Column(Text)  # Full JD
    description_summary = Column(Text)  # AI-generated 2-sentence summary
    
    comp_min = Column(Integer)
    comp_max = Column(Integer)
    
    requires_visa_sponsorship = Column(Boolean, default=False)
    
    posted_date = Column(DateTime)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="jobs")
    applications = relationship("Application", back_populates="job")

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, index=True)
    domain = Column(String(255), unique=True, index=True)
    
    # Enrichment data
    size = Column(String(50))  # "1-10", "50-200", "1000+"
    industry = Column(String(255))
    founded_year = Column(Integer)
    funding_stage = Column(String(50))  # "Seed", "Series A", etc.
    tech_stack = Column(JSON)
    
    logo_url = Column(String(500))
    website = Column(String(500))
    linkedin_url = Column(String(500))
    glassdoor_rating = Column(Float)
    
    enriched_at = Column(DateTime)
    
    # Relationships
    jobs = relationship("Job", back_populates="company")
    contacts = relationship("Contact", back_populates="company")

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    
    status = Column(Enum(ApplicationStatusEnum), default=ApplicationStatusEnum.SAVED, index=True)
    match_score = Column(Integer)  # 0-100
    
    applied_at = Column(DateTime)
    last_action_at = Column(DateTime, default=datetime.utcnow)
    
    notes = Column(Text)
    interview_dates = Column(JSON)  # [{"date": "2025-10-20", "stage": "phone", "interviewer": "..."}]
    
    reply_status = Column(String(50))  # "pending", "replied", "no_reply"
    
    # Relationships
    user = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    outreach = relationship("Outreach", back_populates="application")

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    
    first_name = Column(String(100))
    last_name = Column(String(100))
    full_name = Column(String(255), index=True)
    title = Column(String(255))
    
    email = Column(String(255), index=True)
    email_verified = Column(Boolean, default=False)
    email_confidence = Column(Float)  # 0.0-1.0
    
    linkedin_url = Column(String(500))
    
    source = Column(String(100))  # "apollo", "clay", "hunter"
    discovered_at = Column(DateTime, default=datetime.utcnow)
    
    # Suppression
    opted_out = Column(Boolean, default=False)
    bounce_count = Column(Integer, default=0)
    
    # Relationships
    company = relationship("Company", back_populates="contacts")

class Sequence(Base):
    __tablename__ = "sequences"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    is_template = Column(Boolean, default=False)  # Platform template vs user-created
    
    steps = Column(JSON)  # [{"step_no": 1, "subject": "...", "body": "...", "delay_hours": 0}, ...]
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Outreach(Base):
    __tablename__ = "outreach"
    
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"), index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    sequence_id = Column(Integer, ForeignKey("sequences.id"))
    
    step_no = Column(Integer)  # Which step in sequence
    
    subject = Column(String(500))
    body = Column(Text)
    
    from_mailbox = Column(String(255))  # e.g., auto1@rf-send-01.com
    
    status = Column(String(50), default="queued")  # queued, sent, delivered, bounced, replied
    
    queued_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    opened_at = Column(DateTime)
    clicked_at = Column(DateTime)
    replied_at = Column(DateTime)
    
    link_clicks = Column(Integer, default=0)
    
    # Relationships
    application = relationship("Application", back_populates="outreach")

class Mailbox(Base):
    __tablename__ = "mailboxes"
    
    id = Column(Integer, primary_key=True)
    domain = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    
    health_score = Column(Integer, default=100)  # 0-100
    status = Column(String(50), default="active")  # active, paused, warmup
    
    warmup_enabled = Column(Boolean, default=False)
    warmup_start_date = Column(DateTime)
    
    daily_cap = Column(Integer, default=50)
    sent_today = Column(Integer, default=0)
    
    bounce_count_7d = Column(Integer, default=0)
    spam_reports_7d = Column(Integer, default=0)
    
    last_health_check = Column(DateTime, default=datetime.utcnow)
    
    smtp_host = Column(String(255))  # sendgrid.net, smtp.mailgun.org
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String(255))
    smtp_password = Column(String(255))  # Encrypted
```

### 3.2 Alembic Migration Example

```python
# backend/app/migrations/versions/001_initial_schema.py
"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2025-10-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255)),
        sa.Column('full_name', sa.String(255)),
        sa.Column('mode', sa.Enum('job_seeker', 'recruiter', name='usermodeenum'), server_default='job_seeker'),
        sa.Column('subscription_tier', sa.String(50), server_default='free'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()')),
        sa.Column('last_login', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_email', 'users', ['email'])
    
    # Companies table
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('domain', sa.String(255), unique=True),
        sa.Column('size', sa.String(50)),
        sa.Column('industry', sa.String(255)),
        sa.Column('logo_url', sa.String(500)),
        sa.Column('enriched_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_companies_domain', 'companies', ['domain'], unique=True)
    
    # Jobs table
    op.create_table(
        'jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(255), unique=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('company_id', sa.Integer()),
        sa.Column('location', sa.String(255)),
        sa.Column('description', sa.Text()),
        sa.Column('posted_date', sa.DateTime()),
        sa.Column('scraped_at', sa.DateTime(), server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_jobs_title', 'jobs', ['title'])
    
    # Applications table (continues...)
    
def downgrade():
    op.drop_table('jobs')
    op.drop_table('companies')
    op.drop_table('users')
```

---

## 4. Implementation: Enrichment Orchestrator

### 4.1 Celery Task

```python
# backend/app/services/enrichment.py
from celery import Celery, group, chord
from app.clients.apollo import ApolloClient
from app.clients.clay import ClayClient
from app.clients.neverbounce import NeverBounceClient
from app.db import SessionLocal
from app.models import Application, Contact, Company
import logging

celery_app = Celery('roleferry', broker='redis://localhost:6379/0')

@celery_app.task(bind=True, max_retries=3)
def enrich_application(self, application_id: int):
    """
    Main enrichment task: Company → People → Email → Verification
    """
    db = SessionLocal()
    
    try:
        application = db.query(Application).filter_by(id=application_id).first()
        if not application:
            logging.error(f"Application {application_id} not found")
            return {"status": "error", "message": "Application not found"}
        
        job = application.job
        company = job.company
        
        # Step 1: Ensure company has domain
        if not company.domain:
            company.domain = enrich_company_domain(company.name)
            db.commit()
        
        if not company.domain:
            return {"status": "error", "message": "Could not find company domain"}
        
        # Step 2: Find people at company
        people = find_people_at_company(company.domain, job.title)
        
        # Step 3: Verify emails (parallel)
        verified_contacts = verify_emails(people)
        
        # Step 4: Save top 3 contacts
        for contact_data in verified_contacts[:3]:
            contact = Contact(
                company_id=company.id,
                full_name=contact_data['name'],
                title=contact_data['title'],
                email=contact_data['email'],
                email_verified=True,
                email_confidence=contact_data['confidence'],
                linkedin_url=contact_data.get('linkedin'),
                source=contact_data['source']
            )
            db.add(contact)
        
        db.commit()
        
        # Step 5: Trigger sequence (call sequencer service)
        from app.services.sequencer import start_sequence_for_application
        start_sequence_for_application.delay(application_id)
        
        return {
            "status": "success",
            "contacts_found": len(verified_contacts)
        }
    
    except Exception as e:
        logging.exception(f"Enrichment failed for application {application_id}")
        self.retry(exc=e, countdown=60)  # Retry after 1 minute
    
    finally:
        db.close()

def enrich_company_domain(company_name: str) -> str:
    """
    Use Clearbit or Google to find company domain
    """
    # Try Clearbit
    try:
        from clearbit import Company as ClearbitCompany
        company = ClearbitCompany.find(name=company_name, stream=True)
        if company and company.get('domain'):
            return company['domain']
    except:
        pass
    
    # Fallback: Google search
    import requests
    query = f"{company_name} official website"
    # ... (simplified; use Google Custom Search API)
    
    return None

def find_people_at_company(domain: str, job_title: str) -> list:
    """
    Waterfall: Apollo → Clay
    """
    apollo = ApolloClient()
    clay = ClayClient()
    
    people = []
    
    # Try Apollo
    try:
        personas = ["VP", "Head", "Director", "HR", "Recruiting"]
        apollo_results = apollo.search_people(
            domain=domain,
            titles=personas,
            limit=10
        )
        people.extend(apollo_results)
    except Exception as e:
        logging.warning(f"Apollo failed: {e}")
    
    # Try Clay (if Apollo returned <3)
    if len(people) < 3:
        try:
            clay_results = clay.find_people(domain=domain, titles=["hiring manager", "HR"])
            people.extend(clay_results)
        except Exception as e:
            logging.warning(f"Clay failed: {e}")
    
    # Deduplicate by email/LinkedIn
    seen = set()
    unique_people = []
    for person in people:
        key = person.get('email') or person.get('linkedin')
        if key and key not in seen:
            seen.add(key)
            unique_people.append(person)
    
    return unique_people

def verify_emails(people: list) -> list:
    """
    Verify emails via NeverBounce
    """
    neverbounce = NeverBounceClient()
    
    emails = [p['email'] for p in people if p.get('email')]
    
    if not emails:
        return []
    
    verification_results = neverbounce.verify_bulk(emails)
    
    # Merge verification status back into people
    verified = []
    for person in people:
        email = person.get('email')
        if email and email in verification_results:
            status = verification_results[email]
            if status in ['valid', 'risky']:  # Accept valid + risky (>70% confidence)
                person['confidence'] = 0.95 if status == 'valid' else 0.75
                verified.append(person)
    
    # Sort by title rank (VP > Director > Manager)
    title_rank = {"vp": 1, "head": 2, "director": 3, "manager": 4, "hr": 5}
    
    def rank_contact(person):
        title_lower = person.get('title', '').lower()
        for key, rank in title_rank.items():
            if key in title_lower:
                return rank
        return 99
    
    verified.sort(key=rank_contact)
    
    return verified
```

### 4.2 Apollo Client Implementation

```python
# backend/app/clients/apollo.py
import requests
from app.config import settings
import logging

class ApolloClient:
    BASE_URL = "https://api.apollo.io/v1"
    
    def __init__(self):
        self.api_key = settings.APOLLO_API_KEY
    
    def search_people(self, domain: str, titles: list, limit: int = 10):
        """
        Search for people at a company by domain and title filters
        """
        url = f"{self.BASE_URL}/mixed_people/search"
        
        payload = {
            "api_key": self.api_key,
            "organization_domains": [domain],
            "person_titles": titles,
            "page": 1,
            "per_page": limit
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            people = data.get('people', [])
            
            # Transform to standard format
            results = []
            for person in people:
                results.append({
                    'name': person.get('name'),
                    'title': person.get('title'),
                    'email': person.get('email'),
                    'linkedin': person.get('linkedin_url'),
                    'source': 'apollo'
                })
            
            return results
        
        except requests.RequestException as e:
            logging.error(f"Apollo API error: {e}")
            return []
    
    def find_email(self, first_name: str, last_name: str, domain: str):
        """
        Find work email for a person
        """
        url = f"{self.BASE_URL}/email_finder"
        
        payload = {
            "api_key": self.api_key,
            "first_name": first_name,
            "last_name": last_name,
            "domain": domain
        }
        
        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return data.get('email')
        
        except requests.RequestException as e:
            logging.error(f"Apollo email finder error: {e}")
            return None
```

---

## 5. Implementation: Outreach Sequencer

### 5.1 Sequence Starter

```python
# backend/app/services/sequencer.py
from celery import Celery
from app.db import SessionLocal
from app.models import Application, Outreach, Sequence, Contact, Mailbox
from app.services.email_service import EmailServiceAdapter
from datetime import datetime, timedelta
import logging

celery_app = Celery('roleferry', broker='redis://localhost:6379/0')

@celery_app.task
def start_sequence_for_application(application_id: int):
    """
    Launch outreach sequence for an application's contacts
    """
    db = SessionLocal()
    
    try:
        application = db.query(Application).filter_by(id=application_id).first()
        
        # Get contacts for this application's company
        contacts = db.query(Contact).filter_by(
            company_id=application.job.company_id,
            opted_out=False
        ).limit(3).all()
        
        if not contacts:
            logging.warning(f"No contacts found for application {application_id}")
            return
        
        # Get default sequence (or user-selected)
        sequence = db.query(Sequence).filter_by(is_template=True, name="Job Seeker Default").first()
        
        if not sequence:
            logging.error("Default sequence not found")
            return
        
        # Create outreach records for each contact × step
        for contact in contacts:
            for step in sequence.steps:
                outreach = Outreach(
                    application_id=application.id,
                    contact_id=contact.id,
                    sequence_id=sequence.id,
                    step_no=step['step_no'],
                    subject=substitute_variables(step['subject'], application, contact),
                    body=substitute_variables(step['body'], application, contact),
                    status="queued"
                )
                
                # Schedule send time
                delay_hours = step.get('delay_hours', 0)
                outreach.queued_at = datetime.utcnow() + timedelta(hours=delay_hours)
                
                db.add(outreach)
        
        db.commit()
        
        # Enqueue immediate sends (step 1)
        send_queued_emails.delay()
    
    finally:
        db.close()

def substitute_variables(template: str, application: Application, contact: Contact):
    """
    Replace {{variable}} placeholders
    """
    user = application.user
    job = application.job
    company = job.company
    
    replacements = {
        '{{first_name}}': contact.first_name or contact.full_name.split()[0],
        '{{last_name}}': contact.last_name or '',
        '{{company}}': company.name,
        '{{role}}': job.title,
        '{{my_name}}': user.full_name,
        '{{my_email}}': user.email,
        # Add more as needed (my_metric, etc.)
    }
    
    result = template
    for key, value in replacements.items():
        result = result.replace(key, value)
    
    return result

@celery_app.task
def send_queued_emails():
    """
    Worker task: Send emails that are queued and due
    """
    db = SessionLocal()
    email_service = EmailServiceAdapter()
    
    try:
        # Get outreach records ready to send
        now = datetime.utcnow()
        outreach_list = db.query(Outreach).filter(
            Outreach.status == "queued",
            Outreach.queued_at <= now
        ).limit(100).all()  # Process in batches
        
        for outreach in outreach_list:
            # Select mailbox (healthy, under daily cap)
            mailbox = select_mailbox(db)
            
            if not mailbox:
                logging.warning("No available mailboxes")
                break
            
            # Get contact email
            contact = db.query(Contact).filter_by(id=outreach.contact_id).first()
            
            # Send email
            try:
                email_service.send(
                    from_addr=mailbox.email,
                    to_addr=contact.email,
                    subject=outreach.subject,
                    body_html=outreach.body,
                    reply_to=outreach.application.user.email
                )
                
                # Update status
                outreach.status = "sent"
                outreach.sent_at = datetime.utcnow()
                outreach.from_mailbox = mailbox.email
                
                # Increment mailbox sent count
                mailbox.sent_today += 1
                
                db.commit()
                
                logging.info(f"Sent outreach {outreach.id} from {mailbox.email}")
            
            except Exception as e:
                logging.error(f"Failed to send outreach {outreach.id}: {e}")
                outreach.status = "failed"
                db.commit()
    
    finally:
        db.close()

def select_mailbox(db) -> Mailbox:
    """
    Select a healthy mailbox under daily cap (round-robin)
    """
    mailbox = db.query(Mailbox).filter(
        Mailbox.status == "active",
        Mailbox.health_score >= 70,
        Mailbox.sent_today < Mailbox.daily_cap
    ).order_by(Mailbox.sent_today.asc()).first()
    
    return mailbox

@celery_app.task
def stop_sequence_on_reply(outreach_id: int):
    """
    Cancel remaining steps when recipient replies
    """
    db = SessionLocal()
    
    try:
        outreach = db.query(Outreach).filter_by(id=outreach_id).first()
        
        if not outreach:
            return
        
        # Find all future steps in this sequence for this contact
        db.query(Outreach).filter(
            Outreach.application_id == outreach.application_id,
            Outreach.contact_id == outreach.contact_id,
            Outreach.step_no > outreach.step_no,
            Outreach.status == "queued"
        ).update({"status": "canceled"})
        
        # Update application status
        application = outreach.application
        if application.status == "applied":
            application.status = "interviewing"
            application.reply_status = "replied"
        
        db.commit()
        
        logging.info(f"Stopped sequence for outreach {outreach_id}")
    
    finally:
        db.close()
```

---

## 6. Implementation: Email Service Webhook

```python
# backend/app/routers/webhooks.py
from fastapi import APIRouter, Request, BackgroundTasks
from app.services.sequencer import stop_sequence_on_reply
from app.db import SessionLocal
from app.models import Outreach
import logging

router = APIRouter()

@router.post("/webhooks/sendgrid")
async def sendgrid_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle SendGrid event webhooks
    Docs: https://docs.sendgrid.com/for-developers/tracking-events/event
    """
    events = await request.json()
    
    db = SessionLocal()
    
    for event in events:
        event_type = event.get('event')
        email_id = event.get('smtp-id')  # Custom header set during send
        
        # Find outreach record (assuming we tagged email with outreach_id in custom headers)
        outreach_id = extract_outreach_id_from_email_id(email_id)
        
        if not outreach_id:
            continue
        
        outreach = db.query(Outreach).filter_by(id=outreach_id).first()
        
        if not outreach:
            continue
        
        # Update based on event type
        if event_type == "delivered":
            outreach.status = "delivered"
            outreach.delivered_at = event.get('timestamp')
        
        elif event_type == "bounce":
            outreach.status = "bounced"
            # Increment contact bounce count
            contact = outreach.contact
            contact.bounce_count += 1
            if contact.bounce_count >= 3:
                contact.opted_out = True  # Hard suppress
        
        elif event_type == "spamreport":
            outreach.status = "spam"
            # Immediately opt out
            contact = outreach.contact
            contact.opted_out = True
            # Alert ops team
            logging.critical(f"Spam report for outreach {outreach_id}")
        
        elif event_type == "click":
            outreach.link_clicks += 1
            outreach.clicked_at = event.get('timestamp')
        
        db.commit()
    
    db.close()
    
    return {"status": "ok"}

@router.post("/webhooks/email-reply")
async def email_reply_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle inbound reply detection (via Mailgun, Postmark, or custom parser)
    """
    data = await request.json()
    
    from_email = data.get('from')
    to_email = data.get('to')  # Our mailbox that received reply
    body = data.get('body')
    
    db = SessionLocal()
    
    # Match reply to outreach record
    outreach = db.query(Outreach).filter(
        Outreach.from_mailbox == to_email,
        Outreach.status.in_(["sent", "delivered"])
    ).order_by(Outreach.sent_at.desc()).first()
    
    if outreach:
        outreach.status = "replied"
        outreach.replied_at = datetime.utcnow()
        db.commit()
        
        # Stop sequence in background
        background_tasks.add_task(stop_sequence_on_reply, outreach.id)
        
        logging.info(f"Reply detected for outreach {outreach.id}")
    
    db.close()
    
    return {"status": "ok"}

def extract_outreach_id_from_email_id(email_id: str) -> int:
    """
    Parse outreach ID from custom SMTP header or message ID
    Example: <outreach_123@roleferry.com>
    """
    import re
    match = re.search(r'outreach_(\d+)', email_id)
    if match:
        return int(match.group(1))
    return None
```

---

## 7. Deployment Configuration

### 7.1 Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: roleferry
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: roleferry_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
  
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.services.celery_app worker --loglevel=info
    env_file:
      - ./backend/.env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
  
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    command: npm run dev
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
```

### 7.2 Production Deployment (AWS ECS)

```yaml
# ecs-task-definition.json
{
  "family": "roleferry-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/roleferry-api:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://user:pass@roleferry-db.xxxx.us-east-1.rds.amazonaws.com/roleferry"
        },
        {
          "name": "REDIS_HOST",
          "value": "roleferry-redis.xxxx.cache.amazonaws.com"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/roleferry-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### 7.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run tests
        run: |
          cd backend
          pytest tests/ --cov=app --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push API image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: roleferry-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster roleferry-prod --service api --force-new-deployment
```

---

## 8. Monitoring & Observability

### 8.1 Datadog Integration

```python
# backend/app/monitoring.py
from datadog import initialize, statsd
from app.config import settings

initialize(
    api_key=settings.DATADOG_API_KEY,
    app_key=settings.DATADOG_APP_KEY
)

# Metric helpers
def track_enrichment_duration(duration_ms: float):
    statsd.histogram('roleferry.enrichment.duration', duration_ms, tags=['service:enrichment'])

def track_email_sent():
    statsd.increment('roleferry.email.sent', tags=['service:sequencer'])

def track_reply_received():
    statsd.increment('roleferry.email.reply', tags=['service:webhook'])

# Usage in code:
import time
start = time.time()
# ... enrichment logic
duration = (time.time() - start) * 1000
track_enrichment_duration(duration)
```

### 8.2 Logging Configuration

```python
# backend/app/logging_config.py
import logging
import json
from pythonjsonlogger import jsonlogger

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    logHandler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(name)s %(levelname)s %(message)s'
    )
    logHandler.setFormatter(formatter)
    logger.addHandler(logHandler)

# Structured logging example:
logging.info("Enrichment completed", extra={
    "application_id": 123,
    "contacts_found": 2,
    "duration_ms": 1250
})
```

---

## 9. Security Implementation

### 9.1 Password Hashing

```python
# backend/app/security.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

### 9.2 JWT Token Generation

```python
# backend/app/auth.py
from jose import jwt
from datetime import datetime, timedelta
from app.config import settings

def create_access_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=15),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def create_refresh_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=30),
        "type": "refresh"
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm="HS256")
```

---

## 10. Performance Optimization

### 10.1 Database Connection Pooling

```python
# backend/app/db.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600,  # Recycle connections every hour
    echo=False
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### 10.2 Redis Caching

```python
# backend/app/cache.py
import redis
import json
from app.config import settings

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=6379,
    decode_responses=True
)

def cache_match_score(user_id: int, job_id: int, score: int):
    key = f"match:{user_id}:{job_id}"
    redis_client.setex(key, 86400, score)  # TTL: 24 hours

def get_cached_match_score(user_id: int, job_id: int) -> int:
    key = f"match:{user_id}:{job_id}"
    score = redis_client.get(key)
    return int(score) if score else None
```

---

## 11. Acceptance Criteria (Implementation)

- [ ] API endpoints return JSON with <500ms P95 latency
- [ ] Database migrations run without data loss
- [ ] Celery workers process jobs with <30s average latency
- [ ] Email sending handles 1,000 emails/hour without errors
- [ ] Webhook handlers process events within 1 minute
- [ ] Docker Compose brings up full stack in <60 seconds
- [ ] CI/CD pipeline deploys to production in <10 minutes
- [ ] Health checks pass for all services
- [ ] Logs are structured JSON and ship to CloudWatch
- [ ] Metrics visible in Datadog dashboard

---

**Document Owner**: Engineering Team  
**Reviewed By**: CTO, DevOps Lead  
**Version**: 1.0  
**Date**: October 2025  
**Maintenance**: Update as implementation evolves

