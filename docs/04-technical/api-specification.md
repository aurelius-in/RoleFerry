# API Specification
## RoleFerry Platform

**API Version**: v1  
**Base URL**: `https://api.roleferry.com/v1`  
**Authentication**: Bearer Token (JWT)  
**Format**: JSON

---

## 1. Overview

### 1.1 API Principles
- **RESTful**: Resources accessed via HTTP methods (GET, POST, PUT, DELETE)
- **Stateless**: Each request contains all necessary context (JWT token)
- **Paginated**: List endpoints return max 100 items; use `page` and `limit` params
- **Rate Limited**: 60 requests/minute per user (429 if exceeded)
- **10-Tab Workflow**: Complete API coverage for all workflow tabs
- **Dual-Mode Support**: Job Seeker and Recruiter mode endpoints

### 1.2 Authentication
All endpoints (except `/auth/*`) require JWT bearer token in header:
```
Authorization: Bearer <access_token>
```

Tokens expire in 15 minutes; use `/auth/refresh` to obtain new token.

---

## 2. 10-Tab Workflow APIs

### 2.1 Job Preferences/ICP APIs

#### GET /job-preferences
Retrieve user's job preferences or ICP.

**Response**:
```json
{
  "industries": ["Software", "AI & Machine Learning"],
  "roles": ["Software Engineer", "ML Engineer"],
  "salary_range": "$100,000 - $150,000",
  "location": "Remote",
  "work_type": ["Remote"],
  "mode": "job-seeker"
}
```

#### POST /job-preferences
Create or update job preferences/ICP.

**Request Body**:
```json
{
  "industries": ["Software", "AI & Machine Learning"],
  "roles": ["Software Engineer", "ML Engineer"],
  "salary_range": "$100,000 - $150,000",
  "location": "Remote",
  "work_type": ["Remote"],
  "mode": "job-seeker"
}
```

### 2.2 Resume/Candidate Profile APIs

#### POST /resume/upload-and-parse
Upload and parse resume file.

**Request**: Multipart form with file
**Response**:
```json
{
  "positions": [
    {"title": "Senior Software Engineer", "company": "TechCorp", "tenure": "3 years"}
  ],
  "metrics": ["Increased system efficiency by 20%"],
  "skills": ["Python", "React", "AWS", "Machine Learning"],
  "accomplishments": ["Developed new feature X"],
  "problems_solved": ["Optimized database queries"]
}
```

### 2.3 Job Descriptions APIs

#### POST /job-descriptions/parse
Parse job description from URL or text.

**Request Body**:
```json
{
  "source_type": "url",
  "content": "https://www.linkedin.com/jobs/view/..."
}
```

**Response**:
```json
{
  "pain_points": ["Scaling our backend infrastructure to handle 10x traffic"],
  "required_skills": ["Python", "Distributed Systems", "Cloud Architecture"],
  "success_metrics": ["Reduce latency by 30%"]
}
```

### 2.4 Pain Point Match APIs

#### POST /painpoint-match/calculate
Calculate alignment score between resume and job description.

**Response**:
```json
{
  "alignment_score": 85,
  "painpoint_matches": [
    {
      "pain point": "Scaling our backend infrastructure to handle 10x traffic",
      "solution": "My experience scaling microservices on AWS",
      "metric": "Achieved 99.9% uptime and 20% cost reduction"
    }
  ]
}
```

### 2.5 Find Contact APIs

#### POST /find-contact
Find contacts with email verification.

**Request Body**:
```json
{
  "query": "TechCorp hiring manager"
}
```

**Response**:
```json
{
  "contacts": [
    {
      "name": "Jane Doe",
      "title": "Hiring Manager",
      "email": "jane.doe@example.com",
      "confidence": 0.95,
      "verification_status": "valid",
      "badge": {"label": "Valid", "color": "green", "icon": "✓"}
    }
  ]
}
```

### 2.6 Context Research APIs

#### GET /context-research
Get company and contact summaries.

**Response**:
```json
{
  "company_summary": "ExampleCorp is a leading technology company...",
  "recent_news": "ExampleCorp recently announced a strategic partnership...",
  "contact_bio": "Jane Doe is the Hiring Manager for the AI Solutions division..."
}
```

### 2.7 Offer Creation APIs

#### POST /offer-creation/create
Create personalized offer based on pain point matches.

**Request Body**:
```json
{
  "painpoint_matches": [...],
  "tone": "manager",
  "format": "text",
  "user_mode": "job-seeker"
}
```

**Response**:
```json
{
  "success": true,
  "offer": {
    "id": "offer_1",
    "title": "How I Can Solve Your Engineering Challenges",
    "content": "I understand you're facing...",
    "tone": "manager",
    "format": "text"
  }
}
```

### 2.8 Compose APIs

#### POST /compose/generate
Generate email with variable substitution and jargon detection.

**Request Body**:
```json
{
  "tone": "manager",
  "user_mode": "job-seeker",
  "variables": [...],
  "painpoint_matches": [...],
  "context_data": {...}
}
```

**Response**:
```json
{
  "success": true,
  "email_template": {
    "id": "email_1",
    "subject": "Quick advice on Senior Software Engineer at TechCorp?",
    "body": "Hi Jane,\n\nI spotted the Senior Software Engineer role...",
    "tone": "manager",
    "variables": [...],
    "jargon_terms": [...],
    "simplified_body": "..."
  }
}
```

### 2.9 Campaign APIs

#### POST /campaign/create
Create 3-email campaign sequence.

**Request Body**:
```json
{
  "campaign_name": "Job Application Campaign",
  "emails": [
    {
      "step_number": 1,
      "subject": "Quick advice on Senior Software Engineer at TechCorp?",
      "body": "Hi Jane,\n\nI spotted the Senior Software Engineer role...",
      "delay_days": 0,
      "delay_hours": 0,
      "stop_on_reply": true
    }
  ]
}
```

### 2.10 Deliverability/Launch APIs

#### POST /deliverability-launch/pre-flight-checks
Run comprehensive pre-flight checks.

**Request Body**:
```json
{
  "campaign_id": "camp_12345",
  "emails": [...],
  "contacts": [...]
}
```

**Response**:
```json
{
  "checks": [
    {
      "name": "Email Verification",
      "status": "pass",
      "message": "All emails verified successfully"
    },
    {
      "name": "Spam Score Check",
      "status": "warning",
      "message": "Spam score: 2.1 (acceptable)"
    }
  ]
}
```

#### POST /deliverability-launch/launch
Launch campaign after pre-flight checks pass.

**Response**:
```json
{
  "success": true,
  "message": "Campaign launched successfully!",
  "campaign_id": "camp_12345",
  "emails_sent": 1,
  "scheduled_emails": 2
}
```

---

## 3. Authentication Endpoints

### POST /auth/signup
Create new user account.

**Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "SecureP@ss123",
  "full_name": "Jane Doe",
  "mode": "job_seeker"  // or "recruiter"
}
```

**Response** (201 Created):
```json
{
  "user_id": 1234,
  "email": "jane@example.com",
  "full_name": "Jane Doe",
  "mode": "job_seeker",
  "access_token": "eyJhbGc...",
  "refresh_token": "dGhpcyBp...",
  "expires_in": 900
}
```

**Errors**:
- `400`: Email already registered
- `422`: Password too weak

---

### POST /auth/login
Authenticate existing user.

**Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "SecureP@ss123"
}
```

**Response** (200 OK):
```json
{
  "user_id": 1234,
  "access_token": "eyJhbGc...",
  "refresh_token": "dGhpcyBp...",
  "expires_in": 900
}
```

**Errors**:
- `401`: Invalid credentials

---

### POST /auth/refresh
Refresh expired access token.

**Request Body**:
```json
{
  "refresh_token": "dGhpcyBp..."
}
```

**Response** (200 OK):
```json
{
  "access_token": "newToken...",
  "expires_in": 900
}
```

---

### GET /auth/me
Get current authenticated user info.

**Response** (200 OK):
```json
{
  "user_id": 1234,
  "email": "jane@example.com",
  "full_name": "Jane Doe",
  "mode": "job_seeker",
  "subscription_tier": "pro",
  "created_at": "2025-10-01T12:00:00Z"
}
```

---

## 3. Jobs Endpoints

### GET /jobs
List jobs matched to user's preferences.

**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 20, max: 100)
- `role` (string): Filter by role keyword
- `location` (string): Filter by location
- `remote` (boolean): Remote jobs only
- `min_match_score` (int, 0-100): Min match score

**Response** (200 OK):
```json
{
  "jobs": [
    {
      "id": 5678,
      "title": "Senior Product Manager",
      "company": {
        "id": 101,
        "name": "Acme Corp",
        "domain": "acme.com",
        "logo_url": "https://cdn.roleferry.com/logos/acme.png"
      },
      "location": "San Francisco, CA",
      "remote": true,
      "comp_min": 150000,
      "comp_max": 200000,
      "match_score": 85,
      "match_breakdown": {
        "experience": 90,
        "skills": 80,
        "industry": 85
      },
      "posted_date": "2025-10-10",
      "requires_visa": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "total_pages": 6
  }
}
```

---

### GET /jobs/{id}
Get job details.

**Response** (200 OK):
```json
{
  "id": 5678,
  "title": "Senior Product Manager",
  "company": {
    "id": 101,
    "name": "Acme Corp",
    "domain": "acme.com",
    "logo_url": "https://cdn.roleferry.com/logos/acme.png",
    "size": "50-200",
    "industry": "SaaS",
    "glassdoor_rating": 4.2
  },
  "location": "San Francisco, CA",
  "description": "We're seeking a Senior PM to lead...",
  "description_summary": "Lead product strategy for B2B SaaS platform.",
  "match_score": 85,
  "posted_date": "2025-10-10"
}
```

---

## 4. Applications Endpoints

### POST /applications
Create new application (Apply to job).

**Request Body**:
```json
{
  "job_id": 5678
}
```

**Response** (201 Created):
```json
{
  "application_id": 9012,
  "job_id": 5678,
  "status": "applied",
  "created_at": "2025-10-13T14:30:00Z",
  "enrichment_job_id": "abc123"  // Background job ID
}
```

---

### GET /applications
List user's applications (Tracker).

**Query Parameters**:
- `mode` (string): "job_seeker" or "recruiter" (defaults to user's mode)
- `status` (string): Filter by status
- `page`, `limit`

**Response** (200 OK):
```json
{
  "applications": [
    {
      "id": 9012,
      "job": {
        "id": 5678,
        "title": "Senior Product Manager",
        "company": {"name": "Acme Corp", "logo_url": "..."}
      },
      "status": "applied",
      "match_score": 85,
      "applied_at": "2025-10-13T14:30:00Z",
      "last_action_at": "2025-10-13T15:00:00Z",
      "reply_status": "pending",
      "outreach_summary": {
        "sent": 2,
        "delivered": 2,
        "replied": 0
      }
    }
  ],
  "pagination": {...}
}
```

---

### GET /applications/{id}
Get application details.

**Response** (200 OK):
```json
{
  "id": 9012,
  "job": {...},
  "status": "applied",
  "notes": "Great culture fit based on Glassdoor reviews.",
  "interview_dates": [
    {"date": "2025-10-20", "stage": "phone", "interviewer": "John Doe"}
  ],
  "contacts": [
    {
      "id": 301,
      "name": "Sarah Smith",
      "title": "VP Product",
      "email": "sarah@acme.com",
      "verified": true,
      "linkedin_url": "https://linkedin.com/in/sarahsmith"
    }
  ],
  "outreach": [
    {
      "id": 401,
      "contact_id": 301,
      "step_no": 1,
      "subject": "Quick advice on PM role at Acme?",
      "status": "delivered",
      "sent_at": "2025-10-13T15:00:00Z",
      "delivered_at": "2025-10-13T15:02:00Z",
      "link_clicks": 1
    }
  ]
}
```

---

### PUT /applications/{id}
Update application (status, notes, etc.).

**Request Body**:
```json
{
  "status": "interviewing",
  "notes": "Phone screen scheduled for Oct 20"
}
```

**Response** (200 OK):
```json
{
  "id": 9012,
  "status": "interviewing",
  "notes": "Phone screen scheduled for Oct 20",
  "updated_at": "2025-10-14T10:00:00Z"
}
```

---

### POST /applications/import
Bulk import applications from CSV.

**Request** (multipart/form-data):
```
file: applications.csv
```

**CSV Format**:
```
Company,Title,Status,Date Applied,Notes
Acme Corp,Senior PM,applied,2025-10-01,Great fit
Beta Inc,PM Lead,saved,2025-10-05,
```

**Response** (200 OK):
```json
{
  "imported": 25,
  "skipped": 3,
  "errors": [
    {"row": 12, "error": "Missing required field: Company"}
  ]
}
```

---

## 5. Enrichment Endpoints

### POST /enrichment/start
Manually trigger enrichment for application.

**Request Body**:
```json
{
  "application_id": 9012,
  "persona_id": 5  // Optional: Override default persona
}
```

**Response** (202 Accepted):
```json
{
  "job_id": "xyz789",
  "status": "queued",
  "estimated_completion": "2025-10-13T15:05:00Z"
}
```

---

### GET /enrichment/status/{job_id}
Check enrichment job status.

**Response** (200 OK):
```json
{
  "job_id": "xyz789",
  "status": "completed",  // queued, processing, completed, failed
  "contacts_found": 2,
  "completed_at": "2025-10-13T15:03:00Z",
  "errors": []
}
```

---

## 6. Sequences Endpoints

### POST /sequences/start
Launch outreach sequence.

**Request Body**:
```json
{
  "application_id": 9012,
  "contact_ids": [301, 302],
  "sequence_template_id": 1,  // Default job seeker sequence
  "custom_variables": {
    "my_metric": "Reduced churn by 25%"
  }
}
```

**Response** (201 Created):
```json
{
  "sequence_instance_id": "seq_123",
  "contacts": 2,
  "steps": 3,
  "first_send_at": "2025-10-13T15:10:00Z"
}
```

---

### POST /sequences/{instance_id}/stop
Stop active sequence.

**Request Body**:
```json
{
  "reason": "manual"  // manual, reply, bounce
}
```

**Response** (200 OK):
```json
{
  "stopped_steps": 4,
  "stopped_at": "2025-10-14T12:00:00Z"
}
```

---

### GET /sequences/templates
List available sequence templates.

**Response** (200 OK):
```json
{
  "templates": [
    {
      "id": 1,
      "name": "Job Seeker Default",
      "description": "3-step mentor ask",
      "is_platform": true,
      "steps": [
        {"step_no": 1, "delay_hours": 0},
        {"step_no": 2, "delay_hours": 48},
        {"step_no": 3, "delay_hours": 72}
      ]
    }
  ]
}
```

---

## 7. Analytics Endpoints

### GET /analytics/dashboard
Get dashboard KPIs.

**Query Parameters**:
- `period` (string): "7d", "30d", "90d", "all"

**Response** (200 OK):
```json
{
  "period": "30d",
  "metrics": {
    "total_applications": 45,
    "reply_rate": 0.12,
    "interviews_scheduled": 5,
    "offers_received": 1,
    "avg_match_score": 78
  },
  "comparison": {
    "total_applications": "+8 from previous period",
    "reply_rate": "+0.03"
  }
}
```

---

### GET /analytics/sequences
Sequence performance report.

**Response** (200 OK):
```json
{
  "sequences": [
    {
      "template_id": 1,
      "name": "Job Seeker Default",
      "sent": 120,
      "delivered": 118,
      "opened": 45,
      "clicked": 12,
      "replied": 15,
      "reply_rate": 0.127
    }
  ]
}
```

---

## 8. Deliverability Endpoints

### GET /deliverability/mailboxes
List sending mailboxes (admin/ops only).

**Response** (200 OK):
```json
{
  "mailboxes": [
    {
      "id": 1,
      "email": "auto1@rf-send-01.com",
      "domain": "rf-send-01.com",
      "health_score": 87,
      "status": "active",
      "daily_cap": 50,
      "sent_today": 23,
      "bounce_count_7d": 1,
      "spam_reports_7d": 0
    }
  ]
}
```

---

### POST /deliverability/custom-domain
Set up custom tracking domain.

**Request Body**:
```json
{
  "domain": "click.mycompany.com"
}
```

**Response** (200 OK):
```json
{
  "domain": "click.mycompany.com",
  "status": "pending_verification",
  "dns_records": [
    {"type": "CNAME", "name": "click", "value": "cname.roleferry.com"}
  ],
  "instructions": "Add the CNAME record to your DNS provider and click Verify."
}
```

---

## 9. Copilot Endpoints

### POST /copilot/ask
Ask AI Copilot a question.

**Request Body**:
```json
{
  "context": {
    "job_id": 5678,  // Optional
    "application_id": 9012  // Optional
  },
  "question": "Why is this a fit for me?"
}
```

**Response** (200 OK, streaming):
```json
{
  "answer": "This Senior PM role at Acme Corp matches your background because...",
  "citations": [
    {"source": "resume", "text": "Your 5 years as PM at SaaS companies"},
    {"source": "job_description", "text": "Acme is Series B SaaS"}
  ],
  "tokens": 250
}
```

---

### POST /copilot/generate-draft
Generate email draft.

**Request Body**:
```json
{
  "job_id": 5678,
  "contact_id": 301,
  "tone": "casual"  // casual, formal
}
```

**Response** (200 OK):
```json
{
  "subject": "Quick advice on PM role at Acme?",
  "body": "Hi Sarah,\n\nI spotted the Senior PM opening at Acme...",
  "tokens": 180
}
```

---

## 10. Webhooks (Inbound)

### POST /webhooks/sendgrid
SendGrid event webhook (delivered, bounced, spam, opened, clicked).

**Request Body** (from SendGrid):
```json
[
  {
    "event": "delivered",
    "email": "recipient@example.com",
    "smtp-id": "<outreach_401@roleferry.com>",
    "timestamp": 1697200000
  }
]
```

**Response** (200 OK):
```json
{"status": "ok"}
```

---

### POST /webhooks/email-reply
Inbound reply detection (from Mailgun/Postmark).

**Request Body**:
```json
{
  "from": "sarah@acme.com",
  "to": "auto1@rf-send-01.com",
  "subject": "Re: Quick advice on PM role at Acme?",
  "body": "Hi Jane, Happy to chat! Let's set up a call..."
}
```

**Response** (200 OK):
```json
{"status": "ok", "sequence_stopped": true}
```

---

## 11. Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: email",
    "details": {"field": "email"}
  }
}
```

### Common Status Codes
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing/invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side issue

---

## 12. Rate Limiting

**Limits**:
- Authenticated requests: 60/minute per user
- Webhook endpoints: 1,000/minute (no auth required)

**Headers**:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1697200060  (Unix timestamp)
```

**429 Response**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Retry after 30 seconds.",
    "retry_after": 30
  }
}
```

---

## 13. Pagination

List endpoints return paginated results.

**Request**:
```
GET /jobs?page=2&limit=50
```

**Response**:
```json
{
  "jobs": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 250,
    "total_pages": 5,
    "has_next": true,
    "has_prev": true
  }
}
```

---

## 14. OpenAPI Specification

Full OpenAPI 3.0 spec available at:  
**`https://api.roleferry.com/v1/openapi.json`**

Interactive docs:  
**`https://api.roleferry.com/v1/docs`** (Swagger UI)  
**`https://api.roleferry.com/v1/redoc`** (ReDoc)

---

**Document Owner**: API Team  
**Version**: 1.0  
**Last Updated**: October 2025  
**Support**: api-support@roleferry.com

