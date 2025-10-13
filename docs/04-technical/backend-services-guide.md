# Backend Services Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers  
**Purpose**: Detailed service implementations and patterns

---

## 1. Service Layer Architecture

### 1.1 Service Structure
```
backend/app/services/
├── __init__.py
├── job_matching_service.py      # Match scoring
├── enrichment_service.py         # Contact discovery
├── outreach_service.py           # Email sequencing
├── deliverability_service.py     # Health monitoring
├── ai_service.py                 # LLM operations
└── analytics_service.py          # Metrics, reporting
```

---

## 2. Job Matching Service

### 2.1 Complete Implementation
```python
# backend/app/services/job_matching_service.py
from typing import Dict, List
from app.db import SessionLocal
from app.models import User, Job, JobPreferences, Resume
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class JobMatchingService:
    """Calculate match scores between users and jobs"""
    
    def __init__(self):
        self.vectorizer = TfidfVectorizer(max_features=500, stop_words='english')
    
    def calculate_match_score(self, user_id: int, job_id: int) -> Dict:
        """
        Calculate 0-100 match score
        
        Returns:
            {
                "score": 85,
                "breakdown": {
                    "experience": 90,
                    "skills": 80,
                    "industry": 100
                }
            }
        """
        db = SessionLocal()
        
        try:
            user = db.query(User).filter_by(id=user_id).first()
            job = db.query(Job).filter_by(id=job_id).first()
            ijp = db.query(JobPreferences).filter_by(user_id=user_id).first()
            resume = db.query(Resume).filter_by(user_id=user_id).first()
            
            if not all([user, job, ijp]):
                return {"score": 50, "breakdown": {}}  # Default neutral
            
            # Calculate sub-scores
            exp_score = self._calculate_experience_match(resume, job)
            skills_score = self._calculate_skills_match(resume, job)
            industry_score = self._calculate_industry_match(ijp, job)
            
            # Weighted average (40% exp, 40% skills, 20% industry)
            total_score = int(0.4 * exp_score + 0.4 * skills_score + 0.2 * industry_score)
            
            return {
                "score": total_score,
                "breakdown": {
                    "experience": exp_score,
                    "skills": skills_score,
                    "industry": industry_score
                }
            }
        finally:
            db.close()
    
    def _calculate_experience_match(self, resume, job) -> int:
        """Match years of experience to role level"""
        if not resume or not resume.roles:
            return 50
        
        # Extract total years
        total_years = sum(self._parse_tenure(role.get('tenure', '')) for role in resume.roles)
        
        # Match to job level
        title_lower = job.title.lower()
        
        if 'senior' in title_lower or 'lead' in title_lower:
            # Senior roles: 5-10 years optimal
            if 5 <= total_years <= 10:
                return 100
            elif 3 <= total_years < 5:
                return 80
            elif total_years > 10:
                return 90
            else:
                return 60
        elif 'junior' in title_lower or 'associate' in title_lower:
            # Junior roles: 0-3 years optimal
            if total_years <= 3:
                return 100
            else:
                return 70
        else:
            # Mid-level: 3-7 years
            if 3 <= total_years <= 7:
                return 100
            else:
                return 80
        
        return 50
    
    def _calculate_skills_match(self, resume, job) -> int:
        """Jaccard similarity of skills"""
        if not resume or not resume.skills:
            return 50
        
        user_skills = set(s.lower() for s in resume.skills)
        
        # Extract skills from job description (simplified)
        job_text = (job.title + ' ' + (job.description or '')).lower()
        
        # Common tech skills to match
        tech_skills = [
            'python', 'javascript', 'java', 'sql', 'aws', 'react',
            'product management', 'agile', 'scrum', 'a/b testing',
            'analytics', 'machine learning', 'data science'
        ]
        
        job_skills = set(skill for skill in tech_skills if skill in job_text)
        
        if not job_skills:
            return 50  # Can't determine job skills
        
        # Jaccard similarity
        intersection = user_skills.intersection(job_skills)
        union = user_skills.union(job_skills)
        
        if not union:
            return 50
        
        jaccard = len(intersection) / len(union)
        
        return int(jaccard * 100)
    
    def _calculate_industry_match(self, ijp, job) -> int:
        """Binary industry match"""
        if not ijp or not ijp.industries:
            return 50
        
        user_industries = [i.lower() for i in ijp.industries]
        job_industry = (job.company.industry or '').lower()
        
        if any(ind in job_industry for ind in user_industries):
            return 100
        else:
            return 0
    
    def _parse_tenure(self, tenure_str: str) -> float:
        """Parse '3 years', '6 months' → float years"""
        import re
        
        years_match = re.search(r'(\d+)\s*years?', tenure_str)
        months_match = re.search(r'(\d+)\s*months?', tenure_str)
        
        years = int(years_match.group(1)) if years_match else 0
        months = int(months_match.group(1)) if months_match else 0
        
        return years + (months / 12.0)
```

---

## 3. Enrichment Service (Celery Tasks)

### 3.1 Complete Enrichment Workflow
```python
# backend/app/services/enrichment_service.py
from celery import Celery, chain, group, chord
from app.clients.apollo import ApolloClient
from app.clients.clay import ClayClient
from app.services.email_verifier import NeverBounceClient
import logging

celery_app = Celery('roleferry')

@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def enrich_application(self, application_id: int):
    """
    Master enrichment task
    Waterfall: Company Domain → People → Emails → Verification
    """
    db = SessionLocal()
    
    try:
        application = db.query(Application).get(application_id)
        if not application:
            return {"status": "error", "message": "Application not found"}
        
        company = application.job.company
        
        # Step 1: Ensure company has domain
        if not company.domain:
            domain = find_company_domain(company.name)
            if domain:
                company.domain = domain
                db.commit()
            else:
                return {"status": "error", "message": "Company domain not found"}
        
        # Step 2: Find people (waterfall)
        people = []
        
        # Try Apollo first
        try:
            apollo = ApolloClient()
            people = apollo.search_people(
                domain=company.domain,
                titles=["VP", "Head", "Director", "Manager", "HR"],
                limit=10
            )
            logging.info(f"Apollo returned {len(people)} contacts")
        except Exception as e:
            logging.warning(f"Apollo failed: {e}")
        
        # Fallback to Clay if Apollo returned <3
        if len(people) < 3:
            try:
                clay = ClayClient()
                clay_results = clay.find_people(company.domain, titles=["hiring manager", "HR"])
                people.extend(clay_results)
                logging.info(f"Clay returned {len(clay_results)} additional contacts")
            except Exception as e:
                logging.warning(f"Clay failed: {e}")
        
        if not people:
            return {"status": "error", "message": "No contacts found"}
        
        # Step 3: Verify emails
        emails = [p.get('email') for p in people if p.get('email')]
        
        if emails:
            verifier = NeverBounceClient()
            verification_results = verifier.verify_bulk(emails)
            
            # Filter to valid/risky only
            verified_people = []
            for person in people:
                email = person.get('email')
                if email and verification_results.get(email) in ['valid', 'risky']:
                    person['verified'] = True
                    person['confidence'] = 0.95 if verification_results[email] == 'valid' else 0.75
                    verified_people.append(person)
            
            people = verified_people
        
        # Step 4: Rank and save top 3
        people_ranked = sorted(people, key=lambda p: self._rank_contact(p), reverse=True)
        
        for person_data in people_ranked[:3]:
            contact = Contact(
                company_id=company.id,
                full_name=person_data['name'],
                first_name=person_data.get('first_name'),
                last_name=person_data.get('last_name'),
                title=person_data.get('title'),
                email=person_data['email'],
                email_verified=person_data.get('verified', False),
                email_confidence=person_data.get('confidence', 0.5),
                linkedin_url=person_data.get('linkedin'),
                source=person_data['source']
            )
            db.add(contact)
        
        db.commit()
        
        # Step 5: Trigger sequence
        from app.services.outreach_service import start_sequence_for_application
        start_sequence_for_application.delay(application_id)
        
        return {
            "status": "success",
            "contacts_found": len(people_ranked[:3])
        }
    
    except Exception as e:
        logging.exception(f"Enrichment failed for application {application_id}")
        # Retry with exponential backoff
        raise self.retry(exc=e)
    
    finally:
        db.close()
    
    def _rank_contact(self, person: dict) -> int:
        """Rank contact by title seniority"""
        title = (person.get('title') or '').lower()
        
        if 'vp' in title or 'vice president' in title:
            return 5
        elif 'head' in title:
            return 4
        elif 'director' in title:
            return 3
        elif 'manager' in title:
            return 2
        elif 'hr' in title or 'recruiter' in title:
            return 1
        else:
            return 0
```

---

## 4. Analytics Service

### 4.1 Dashboard Metrics
```python
# backend/app/services/analytics_service.py
from sqlalchemy import func
from app.models import Application, Outreach
from datetime import datetime, timedelta

class AnalyticsService:
    """Generate analytics and reporting"""
    
    def get_dashboard_metrics(self, user_id: int, period_days: int = 30):
        """Get user dashboard KPIs"""
        db = SessionLocal()
        
        try:
            start_date = datetime.utcnow() - timedelta(days=period_days)
            
            # Total applications
            total_apps = db.query(func.count(Application.id))\
                .filter(Application.user_id == user_id,
                       Application.applied_at >= start_date)\
                .scalar()
            
            # Reply rate
            total_sent = db.query(func.count(Outreach.id))\
                .join(Application)\
                .filter(Application.user_id == user_id,
                       Outreach.status.in_(['sent', 'delivered', 'replied']),
                       Outreach.sent_at >= start_date)\
                .scalar()
            
            total_replied = db.query(func.count(Outreach.id))\
                .join(Application)\
                .filter(Application.user_id == user_id,
                       Outreach.status == 'replied',
                       Outreach.sent_at >= start_date)\
                .scalar()
            
            reply_rate = (total_replied / total_sent) if total_sent > 0 else 0
            
            # Interviews scheduled
            interviews = db.query(func.count(Application.id))\
                .filter(Application.user_id == user_id,
                       Application.status == 'interviewing',
                       Application.last_action_at >= start_date)\
                .scalar()
            
            # Average match score
            avg_match = db.query(func.avg(Application.match_score))\
                .filter(Application.user_id == user_id,
                       Application.match_score.isnot(None))\
                .scalar()
            
            return {
                "period_days": period_days,
                "total_applications": total_apps,
                "reply_rate": round(reply_rate, 3),
                "interviews_scheduled": interviews,
                "avg_match_score": int(avg_match) if avg_match else None
            }
        finally:
            db.close()
```

---

## 5. Testing Services

```python
# tests/services/test_job_matching.py
import pytest
from app.services.job_matching_service import JobMatchingService

@pytest.fixture
def matching_service():
    return JobMatchingService()

def test_perfect_match(matching_service, db_session):
    # Create test user with resume
    user = User(email="test@example.com", mode="job_seeker")
    db_session.add(user)
    
    resume = Resume(
        user_id=user.id,
        roles=[{"title": "Senior PM", "tenure": "5 years"}],
        skills=["Product Strategy", "SQL", "A/B Testing"]
    )
    db_session.add(resume)
    
    # Create test job
    company = Company(name="Acme", domain="acme.com", industry="SaaS")
    db_session.add(company)
    
    job = Job(
        title="Senior Product Manager",
        company_id=company.id,
        description="Looking for experienced PM with SQL skills..."
    )
    db_session.add(job)
    db_session.commit()
    
    # Calculate match
    result = matching_service.calculate_match_score(user.id, job.id)
    
    assert result['score'] >= 75, "Should be strong match"
    assert result['breakdown']['experience'] >= 80
    assert result['breakdown']['skills'] >= 70
```

---

## 6. Acceptance Criteria

- [ ] All services implemented with clear interfaces
- [ ] Unit tests cover 80%+ of service logic
- [ ] Services use dependency injection (testable)
- [ ] Error handling comprehensive (try/except, logging)
- [ ] Performance optimized (caching, batch operations)

---

**Document Owner**: Backend Lead  
**Version**: 1.0  
**Date**: October 2025

