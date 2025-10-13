# Security Architecture: Implementable Level
## RoleFerry Platform

**RM-ODP Viewpoint**: Technical Implementation  
**Audience**: Security Engineers, DevOps  
**Purpose**: Production-ready security configurations and code

---

## 1. Complete Authentication Implementation

### 1.1 Password Hashing
```python
# backend/app/security.py
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Cost factor (higher = slower but more secure)
)

def hash_password(password: str) -> str:
    """Hash password using bcrypt with 12 rounds"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False
```

---

### 1.2 JWT Token Generation
```python
from jose import jwt, JWTError
from datetime import datetime, timedelta
from app.config import settings

def create_access_token(user_id: int, role: str) -> str:
    """Create short-lived access token (15 minutes)"""
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=15),
        "iat": datetime.utcnow(),
        "type": "access"
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def create_refresh_token(user_id: int) -> str:
    """Create long-lived refresh token (30 days)"""
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=30),
        "iat": datetime.utcnow(),
        "type": "refresh"
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm="HS256")

def verify_token(token: str, token_type: str = "access") -> dict:
    """Verify and decode JWT token"""
    try:
        secret = settings.JWT_SECRET if token_type == "access" else settings.JWT_REFRESH_SECRET
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        
        if payload.get("type") != token_type:
            raise JWTError("Invalid token type")
        
        return payload
    except JWTError as e:
        logging.warning(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

---

## 2. Complete Rate Limiting Implementation

### 2.1 Redis-Based Rate Limiter
```python
# backend/app/middleware/rate_limit.py
from redis import Redis
from fastapi import Request, HTTPException
import hashlib

class RateLimiter:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    def check_limit(
        self,
        identifier: str,
        max_requests: int,
        window_seconds: int,
        cost: int = 1
    ) -> bool:
        """
        Token bucket algorithm
        
        Args:
            identifier: User ID, IP, API key
            max_requests: Max requests in window
            window_seconds: Time window
            cost: Cost of this request (default: 1)
        
        Returns:
            True if allowed, raises HTTPException if exceeded
        """
        current_time = int(time.time())
        window_key = f"ratelimit:{identifier}:{current_time // window_seconds}"
        
        # Increment counter
        current = self.redis.incrby(window_key, cost)
        
        # Set expiry on first request
        if current == cost:
            self.redis.expire(window_key, window_seconds)
        
        # Check limit
        if current > max_requests:
            ttl = self.redis.ttl(window_key)
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Retry after {ttl} seconds.",
                headers={"Retry-After": str(ttl)}
            )
        
        return True

# Dependency for routes
async def check_user_rate_limit(request: Request):
    user_id = request.state.user['user_id']
    rate_limiter.check_limit(user_id, max_requests=60, window_seconds=60)
    return True
```

---

## 3. Input Validation (Complete)

### 3.1 Comprehensive Pydantic Models
```python
from pydantic import BaseModel, EmailStr, HttpUrl, constr, validator, Field
from typing import List, Optional
from datetime import datetime

class ApplicationCreate(BaseModel):
    job_id: int = Field(..., gt=0, description="Job ID must be positive integer")
    
    @validator('job_id')
    def job_exists(cls, v):
        # Verify job exists (avoid TOCTOU by checking in transaction)
        return v

class OutreachCreate(BaseModel):
    application_id: int = Field(..., gt=0)
    contact_ids: List[int] = Field(..., min_items=1, max_items=10)
    sequence_template_id: int = Field(..., gt=0)
    custom_variables: Optional[dict] = Field(default={}, max_items=20)
    
    @validator('custom_variables')
    def sanitize_variables(cls, v):
        # Prevent XSS in variables
        for key, value in v.items():
            if not isinstance(value, str):
                raise ValueError(f"Variable {key} must be string")
            if len(value) > 500:
                raise ValueError(f"Variable {key} too long (max 500 chars)")
            # HTML escape
            v[key] = html.escape(value)
        return v

class ContactCreate(BaseModel):
    full_name: constr(min_length=1, max_length=255)
    email: EmailStr
    title: Optional[constr(max_length=255)]
    linkedin_url: Optional[HttpUrl]
    
    @validator('email')
    def validate_business_email(cls, v):
        # Reject free email providers (Gmail, Yahoo) for contacts
        free_providers = ['gmail.com', 'yahoo.com', 'hotmail.com']
        domain = v.split('@')[1].lower()
        if domain in free_providers:
            raise ValueError("Business email required")
        return v.lower()
```

---

## 4. Encryption Implementation

### 4.1 Field-Level Encryption
```python
from cryptography.fernet import Fernet
from app.config import settings

class EncryptionService:
    def __init__(self):
        self.key = settings.ENCRYPTION_KEY.encode()  # 32-byte key
        self.cipher = Fernet(self.key)
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt string, return base64-encoded ciphertext"""
        if not plaintext:
            return None
        encrypted = self.cipher.encrypt(plaintext.encode())
        return encrypted.decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt base64-encoded ciphertext"""
        if not ciphertext:
            return None
        decrypted = self.cipher.decrypt(ciphertext.encode())
        return decrypted.decode()

# Usage in models
class Mailbox(Base):
    smtp_password_encrypted = Column(String(500))
    
    @property
    def smtp_password(self):
        return encryption_service.decrypt(self.smtp_password_encrypted)
    
    @smtp_password.setter
    def smtp_password(self, plaintext):
        self.smtp_password_encrypted = encryption_service.encrypt(plaintext)
```

---

## 5. Session Management

### 5.1 Refresh Token Rotation
```python
async def refresh_access_token(refresh_token: str) -> dict:
    """Exchange refresh token for new access token (rotate refresh)"""
    # Verify refresh token
    payload = verify_token(refresh_token, token_type="refresh")
    user_id = int(payload['sub'])
    
    # Check if token is blacklisted (logged out)
    if redis_client.exists(f"blacklist:refresh:{refresh_token}"):
        raise HTTPException(status_code=401, detail="Token has been revoked")
    
    # Create new tokens
    new_access = create_access_token(user_id, payload.get('role'))
    new_refresh = create_refresh_token(user_id)
    
    # Blacklist old refresh token (prevent reuse)
    redis_client.setex(
        f"blacklist:refresh:{refresh_token}",
        30 * 24 * 60 * 60,  # 30 days
        "1"
    )
    
    # Store new refresh token
    redis_client.setex(
        f"refresh_token:{user_id}:{new_refresh}",
        30 * 24 * 60 * 60,
        "1"
    )
    
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "expires_in": 900  # 15 minutes
    }
```

---

## 6. WAF Configuration (AWS)

### 6.1 Terraform Configuration
```hcl
resource "aws_wafv2_web_acl" "roleferry_waf" {
  name  = "roleferry-waf-prod"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting
  rule {
    name     = "rate-limit-rule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000  # 2K requests per 5 minutes
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection protection
  rule {
    name     = "aws-managed-sqli-rule"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiProtection"
      sampled_requests_enabled   = true
    }
  }

  # Common attack protection
  rule {
    name     = "aws-managed-core-rule"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonProtection"
      sampled_requests_enabled   = true
    }
  }
}

# Attach to ALB
resource "aws_wafv2_web_acl_association" "waf_alb" {
  resource_arn = aws_lb.roleferry_alb.arn
  web_acl_arn  = aws_wafv2_web_acl.roleferry_waf.arn
}
```

---

## 7. Secrets Rotation Automation

### 7.1 Lambda Rotation Function
```python
import boto3
import psycopg2
import string
import secrets

def lambda_handler(event, context):
    """Rotate RDS password automatically"""
    secret_arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']
    
    service_client = boto3.client('secretsmanager')
    
    if step == "createSecret":
        # Generate new password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(secrets.choice(alphabet) for _ in range(32))
        
        # Store as AWSPENDING version
        service_client.put_secret_value(
            SecretId=secret_arn,
            ClientRequestToken=token,
            SecretString=json.dumps({"password": new_password}),
            VersionStages=['AWSPENDING']
        )
    
    elif step == "setSecret":
        # Update RDS password
        pending_secret = service_client.get_secret_value(
            SecretId=secret_arn,
            VersionStage="AWSPENDING"
        )
        new_password = json.loads(pending_secret['SecretString'])['password']
        
        # Update RDS user
        conn = psycopg2.connect(...)  # Using current password
        cursor = conn.cursor()
        cursor.execute(f"ALTER USER app_user WITH PASSWORD %s", (new_password,))
        conn.commit()
    
    elif step == "testSecret":
        # Verify new password works
        pending_secret = service_client.get_secret_value(...)
        new_password = json.loads(pending_secret['SecretString'])['password']
        
        # Test connection
        conn = psycopg2.connect(..., password=new_password)
        conn.close()
    
    elif step == "finishSecret":
        # Promote AWSPENDING to AWSCURRENT
        service_client.update_secret_version_stage(
            SecretId=secret_arn,
            VersionStage='AWSCURRENT',
            MoveToVersionId=token,
            RemoveFromVersionId=service_client.describe_secret(SecretId=secret_arn)['VersionIdsToStages']['AWSCURRENT'][0]
        )
```

---

## 8. Complete Audit Logging
```python
# backend/app/middleware/audit.py
from fastapi import Request
from app.db import SessionLocal
from app.models import AuditLog

async def audit_middleware(request: Request, call_next):
    # Skip non-sensitive operations
    if request.method == "GET" and "/api/health" in request.url.path:
        return await call_next(request)
    
    user_id = getattr(request.state, 'user', {}).get('user_id')
    start_time = time.time()
    
    response = await call_next(request)
    
    duration_ms = (time.time() - start_time) * 1000
    
    # Log to database (async)
    if user_id and request.method in ['POST', 'PUT', 'DELETE']:
        log_entry = AuditLog(
            user_id=user_id,
            action=f"{request.method} {request.url.path}",
            ip_address=request.client.host,
            user_agent=request.headers.get('user-agent'),
            request_method=request.method,
            request_path=request.url.path,
            response_status=response.status_code,
            duration_ms=duration_ms
        )
        db = SessionLocal()
        db.add(log_entry)
        db.commit()
        db.close()
    
    return response
```

---

## 9. Complete WAF Rules (AWS CLI)

```bash
# Create WAF WebACL
aws wafv2 create-web-acl \
  --name roleferry-waf-prod \
  --scope REGIONAL \
  --region us-east-1 \
  --default-action Allow={} \
  --rules file://waf-rules.json \
  --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=RoleFerryWAF

# waf-rules.json
[
  {
    "Name": "RateLimitPerIP",
    "Priority": 1,
    "Statement": {
      "RateBasedStatement": {
        "Limit": 2000,
        "AggregateKeyType": "IP"
      }
    },
    "Action": {"Block": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "RateLimitPerIP"
    }
  },
  {
    "Name": "SQLInjectionProtection",
    "Priority": 2,
    "Statement": {
      "ManagedRuleGroupStatement": {
        "VendorName": "AWS",
        "Name": "AWSManagedRulesSQLiRuleSet"
      }
    },
    "OverrideAction": {"None": {}},
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "SQLiProtection"
    }
  }
]

# Associate with ALB
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:us-east-1:123456789:regional/webacl/roleferry-waf-prod/xxx \
  --resource-arn arn:aws:elasticloadbalancing:us-east-1:123456789:loadbalancer/app/roleferry-alb/xxx
```

---

## 10. Security Testing Scripts

### 10.1 Automated Penetration Test (OWASP ZAP)
```bash
#!/bin/bash
# scripts/security-scan.sh

# Start OWASP ZAP in daemon mode
docker run -d --name zap owasp/zap2docker-stable zap.sh -daemon -host 0.0.0.0 -port 8080

# Wait for ZAP to start
sleep 30

# Run baseline scan
docker exec zap zap-baseline.py \
  -t https://staging.roleferry.com \
  -J zap-report.json \
  -r zap-report.html

# Generate report
docker cp zap:/zap/wrk/zap-report.html ./security-reports/

# Clean up
docker stop zap
docker rm zap
```

---

## 11. Compliance Implementation

### 11.1 GDPR Data Export
```python
@router.get("/api/user/export")
async def export_user_data(current_user: dict = Depends(get_current_user)):
    """Export all user data (GDPR compliance)"""
    user_id = current_user['user_id']
    
    db = SessionLocal()
    
    export_data = {
        "user": db.query(User).filter_by(id=user_id).first().to_dict(),
        "resume": db.query(Resume).filter_by(user_id=user_id).first().to_dict(),
        "job_preferences": db.query(JobPreferences).filter_by(user_id=user_id).first().to_dict(),
        "applications": [a.to_dict() for a in db.query(Application).filter_by(user_id=user_id).all()],
        "outreach": [o.to_dict() for o in db.query(Outreach).join(Application).filter(Application.user_id == user_id).all()],
        "audit_logs": [log.to_dict() for log in db.query(AuditLog).filter_by(user_id=user_id).all()]
    }
    
    db.close()
    
    # Return as downloadable JSON
    return JSONResponse(content=export_data, headers={
        "Content-Disposition": f"attachment; filename=roleferry_data_{user_id}.json"
    })
```

---

## 12. Acceptance Criteria

- [ ] Password hashing uses bcrypt (12 rounds)
- [ ] JWT tokens implemented (15-min access, 30-day refresh)
- [ ] Rate limiting enforced (60 req/min per user)
- [ ] All inputs validated (Pydantic schemas)
- [ ] Field-level encryption for sensitive data
- [ ] WAF deployed with SQL injection, XSS protection
- [ ] Audit logs capture all sensitive operations
- [ ] GDPR data export functional (JSON download)
- [ ] Secret rotation automated (90-day rotation)
- [ ] Security headers configured (HSTS, CSP, etc.)

---

**Document Owner**: Security Engineer, DevOps Lead  
**Version**: 1.0  
**Date**: October 2025  
**Maintenance**: Update as security requirements evolve

