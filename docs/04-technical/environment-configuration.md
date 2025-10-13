# Environment Configuration Guide
## RoleFerry Platform

**Purpose**: Configuration management across environments  
**Audience**: DevOps, Engineers

---

## 1. Environment Overview

| Environment | Purpose | URL | Database | Deployment |
|-------------|---------|-----|----------|------------|
| **Local** | Development | localhost:3000 | Docker PostgreSQL | Manual |
| **Staging** | Pre-prod testing | staging.roleferry.com | RDS (db.t4g.medium) | Auto (develop branch) |
| **Production** | Live users | roleferry.com | RDS (db.t4g.large, Multi-AZ) | Manual approval |

---

## 2. Configuration Files

### Backend (.env)
```bash
# Environment
ENV=production  # local | staging | production

# Database
DATABASE_URL=postgresql://user:pass@localhost/roleferry
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Authentication
JWT_SECRET=your-256-bit-secret-key-here
JWT_REFRESH_SECRET=another-256-bit-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15

# External APIs
APOLLO_API_KEY=your-apollo-key
CLAY_API_KEY=your-clay-key
HUNTER_API_KEY=your-hunter-key
NEVERBOUNCE_API_KEY=your-neverbounce-key

# Email Services
SENDGRID_API_KEY=SG.xxx
MAILGUN_API_KEY=xxx
MAILGUN_DOMAIN=mg.roleferry.com

# LLM Providers
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# Payments
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Monitoring
DATADOG_API_KEY=xxx
DATADOG_APP_KEY=xxx
SENTRY_DSN=https://xxx@sentry.io/xxx

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET_RESUMES=roleferry-prod-resumes

# Feature Flags
ENABLE_AI_COPILOT=true
ENABLE_LIVEPAGES=true
ENABLE_ANALYTICS=true
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 3. AWS Secrets Manager

**Production secrets stored in**:
```
roleferry/prod/database_url
roleferry/prod/jwt_secret
roleferry/prod/jwt_refresh_secret
roleferry/prod/apollo_api_key
roleferry/prod/sendgrid_api_key
roleferry/prod/stripe_secret_key
```

**Access via IAM role** (no hardcoded keys):
```python
import boto3
import json

def get_secret(secret_name):
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# Usage
db_secret = get_secret('roleferry/prod/database_url')
```

---

## 4. Feature Flags

```python
# backend/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Feature flags
    ENABLE_AI_COPILOT: bool = False
    ENABLE_LIVEPAGES: bool = False
    ENABLE_ANALYTICS: bool = True
    ENABLE_2FA: bool = False  # Phase 2
    
    # Environment
    ENV: str = "local"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str
    
    class Config:
        env_file = ".env"

settings = Settings()
```

**Usage in code**:
```python
if settings.ENABLE_AI_COPILOT:
    response = generate_copilot_response(question)
else:
    response = {"error": "Copilot not enabled"}
```

---

## 5. Database Migrations

### Apply Migrations
```bash
# Staging
alembic upgrade head

# Production (requires approval)
alembic upgrade head --sql > migration.sql  # Review first
psql -h prod-db.xxx.rds.amazonaws.com -U admin -d roleferry < migration.sql
```

### Rollback
```bash
alembic downgrade -1  # Rollback 1 version
```

---

## 6. Deployment Checklist

### Pre-Deploy
- [ ] All tests pass (CI/CD)
- [ ] Database migrations reviewed
- [ ] Environment variables updated in Secrets Manager
- [ ] Feature flags configured
- [ ] Rollback plan documented

### Deploy
- [ ] Deploy to staging first
- [ ] Smoke tests on staging
- [ ] Monitor for 30 minutes
- [ ] Deploy to production (blue-green)
- [ ] Verify health checks

### Post-Deploy
- [ ] Monitor error rates (Datadog)
- [ ] Check key metrics (signups, applications)
- [ ] Announce in Slack (#releases)

---

**Document Owner**: DevOps Lead  
**Version**: 1.0  
**Date**: October 2025

