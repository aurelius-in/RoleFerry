# Secrets Management Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: DevOps, Engineering  
**Purpose**: Secure handling of API keys, passwords, tokens

---

## 1. Secrets Inventory

### 1.1 Application Secrets

| Secret | Type | Rotation | Storage |
|--------|------|----------|---------|
| **JWT_SECRET** | Signing key (256-bit) | Never (backward compatibility) | AWS Secrets Manager |
| **JWT_REFRESH_SECRET** | Signing key | Never | AWS Secrets Manager |
| **ENCRYPTION_KEY** | AES key (256-bit) | Quarterly | AWS Secrets Manager |
| **DATABASE_URL** | Connection string | 90 days | AWS Secrets Manager |

### 1.2 Third-Party API Keys

| Service | Key Type | Rotation | Monthly Cost |
|---------|----------|----------|--------------|
| **Apollo** | API key | Manual (annually) | $99-$499 |
| **SendGrid** | API key | Quarterly | $20-$200 |
| **Anthropic** | API key | Quarterly | $500-$2K |
| **Stripe** | Secret key | Manual (security event only) | 2.9% of revenue |
| **Datadog** | API + App keys | Annually | $310 |

---

## 2. AWS Secrets Manager

### 2.1 Secret Naming Convention

```
roleferry/{environment}/{secret_name}
```

**Examples**:
- `roleferry/prod/database_url`
- `roleferry/prod/jwt_secret`
- `roleferry/staging/apollo_api_key`

---

### 2.2 Creating Secrets

```bash
# Create secret
aws secretsmanager create-secret \
  --name roleferry/prod/jwt_secret \
  --description "JWT signing key for access tokens" \
  --secret-string '{"key": "randomly-generated-256-bit-key"}'

# Enable automatic rotation (90 days)
aws secretsmanager rotate-secret \
  --secret-id roleferry/prod/jwt_secret \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789:function:rotate-jwt-secret \
  --rotation-rules AutomaticallyAfterDays=90
```

---

### 2.3 Retrieving Secrets (Application Code)

```python
# backend/app/config.py
import boto3
import json
from functools import lru_cache

@lru_cache(maxsize=128)
def get_secret(secret_name: str) -> dict:
    """
    Retrieve secret from AWS Secrets Manager
    Cached in memory (reduce API calls)
    """
    client = boto3.client('secretsmanager', region_name='us-east-1')
    
    try:
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except Exception as e:
        logging.error(f"Failed to retrieve secret {secret_name}: {e}")
        raise

# Usage
class Settings(BaseSettings):
    @property
    def JWT_SECRET(self) -> str:
        return get_secret('roleferry/prod/jwt_secret')['key']
    
    @property
    def DATABASE_URL(self) -> str:
        return get_secret('roleferry/prod/database_url')['url']
```

---

## 3. Secret Rotation

### 3.1 Manual Rotation (API Keys)

**Process** (SendGrid example):
1. **Create new key** in SendGrid dashboard
2. **Update Secrets Manager**:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id roleferry/prod/sendgrid_api_key \
     --secret-string '{"key": "SG.NEW_KEY_HERE"}'
   ```
3. **Redeploy application** (picks up new secret):
   ```bash
   aws ecs update-service --cluster roleferry-prod --service api --force-new-deployment
   ```
4. **Verify** (check logs, send test email)
5. **Delete old key** in SendGrid dashboard

**Downtime**: <5 minutes (during redeploy)

---

### 3.2 Automatic Rotation (Database Password)

**Lambda Function**:
```python
def lambda_handler(event, context):
    """Rotate RDS password automatically"""
    secret_arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']
    
    if step == "createSecret":
        # Generate new password (32 chars, alphanumeric + symbols)
        new_password = generate_secure_password(32)
        
        # Store as AWSPENDING
        secrets_manager.put_secret_value(
            SecretId=secret_arn,
            ClientRequestToken=token,
            SecretString=json.dumps({"password": new_password}),
            VersionStages=['AWSPENDING']
        )
    
    elif step == "setSecret":
        # Update RDS password
        rds_client.modify_db_instance(
            DBInstanceIdentifier='roleferry-prod-db',
            MasterUserPassword=new_password,
            ApplyImmediately=True
        )
    
    elif step == "testSecret":
        # Test new password works
        test_db_connection(new_password)
    
    elif step == "finishSecret":
        # Promote AWSPENDING → AWSCURRENT
        secrets_manager.update_secret_version_stage(...)
```

**Schedule**: Every 90 days (automatic)

---

## 4. Local Development Secrets

### 4.1 .env File (NEVER commit)

```bash
# backend/.env (gitignored)
DATABASE_URL=postgresql://localhost/roleferry_dev
REDIS_HOST=localhost
JWT_SECRET=local-dev-secret-not-for-production
APOLLO_API_KEY=test_key_from_apollo_sandbox

# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

---

### 4.2 Environment Template

```bash
# .env.example (committed to repo, no real values)
DATABASE_URL=postgresql://user:pass@localhost/roleferry
REDIS_HOST=localhost
JWT_SECRET=your-secret-key-here
APOLLO_API_KEY=your-apollo-key
SENDGRID_API_KEY=your-sendgrid-key
```

**Instructions**: `cp .env.example .env` → fill in real values

---

## 5. Secret Detection & Prevention

### 5.1 Git Hooks (pre-commit)

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Check for secrets in staged files
if git diff --cached | grep -E '(API_KEY|SECRET|PASSWORD|TOKEN).*=.*[a-zA-Z0-9]{20,}'; then
  echo "❌ Potential secret detected! Do not commit secrets."
  echo "Use environment variables or AWS Secrets Manager."
  exit 1
fi

# Check for .env files
if git diff --cached --name-only | grep -E '\.env$'; then
  echo "❌ Do not commit .env files!"
  exit 1
fi
```

---

### 5.2 GitHub Secret Scanning

**Auto-Enabled**: GitHub scans all commits for known secret patterns

**If Secret Leaked**:
1. GitHub alerts via email
2. **Immediately revoke** secret (SendGrid, Stripe, AWS)
3. Rotate secret (create new key)
4. Update Secrets Manager
5. Redeploy application

**Example Alert**:
```
GitHub detected a SendGrid API key in commit abc123.
Revoke this key immediately and rotate.
```

---

## 6. Access Control

### 6.1 Who Can Access Secrets?

| Role | Access Level | Method |
|------|--------------|--------|
| **Application** (ECS tasks) | Read (runtime) | IAM role (automatic) |
| **Engineers** (development) | None (use .env.example) | Local .env (not committed) |
| **DevOps** (deployment) | Read + Write | AWS Console (MFA required) |
| **CEO/CTO** | Read (audit) | AWS Console (MFA required) |

**Principle**: Humans should rarely access secrets (let applications fetch via IAM)

---

### 6.2 IAM Policy (ECS Task Role)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "secretsmanager:GetSecretValue"
    ],
    "Resource": [
      "arn:aws:secretsmanager:us-east-1:123456789:secret:roleferry/prod/*"
    ]
  }]
}
```

**Attached to**: ECS task role (not engineers' IAM users)

---

## 7. Monitoring & Alerts

### 7.1 Detect Secret Access

```bash
# CloudTrail query (who accessed secrets?)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue \
  --max-results 50
```

**Alert**: If secret accessed from unusual IP or user → investigate

---

### 7.2 Rotation Compliance

**Monitor**:
- Secrets older than 90 days (should be rotated)
- Failed rotation attempts (alert immediately)

**Datadog Check**:
```python
def check_secret_age():
    """Alert if secrets not rotated in 90+ days"""
    client = boto3.client('secretsmanager')
    
    secrets = client.list_secrets()
    
    for secret in secrets['SecretList']:
        last_rotated = secret.get('LastRotatedDate')
        
        if not last_rotated or (datetime.now() - last_rotated).days > 90:
            send_alert(f"Secret {secret['Name']} not rotated in 90+ days")
```

---

## 8. Acceptance Criteria

- [ ] All secrets stored in AWS Secrets Manager (not code, not .env in repo)
- [ ] .env files gitignored (never committed)
- [ ] Pre-commit hooks prevent secret commits
- [ ] GitHub secret scanning enabled
- [ ] Rotation schedule defined (quarterly for most secrets)
- [ ] IAM policies enforce least privilege (apps can read, humans rarely)
- [ ] Monitoring alerts on unusual secret access

---

**Document Owner**: DevOps Lead, Security Engineer  
**Version**: 1.0  
**Date**: October 2025

