# Deployment Guide
## RoleFerry Platform

**Environment**: Production (AWS)  
**Orchestration**: ECS Fargate + RDS + ElastiCache  
**CI/CD**: GitHub Actions

---

## 1. Infrastructure Overview

### 1.1 AWS Services Used
- **Compute**: ECS Fargate (API servers, Celery workers)
- **Database**: RDS PostgreSQL 15 (Multi-AZ)
- **Cache/Queue**: ElastiCache Redis (cluster mode)
- **Storage**: S3 (resumes, logs, backups)
- **Networking**: VPC, ALB, CloudFront (CDN)
- **Monitoring**: CloudWatch, Datadog
- **Secrets**: AWS Secrets Manager

### 1.2 Architecture Diagram
```
Internet → CloudFront (CDN) → ALB (Load Balancer)
                                 ↓
                    ┌────────────┴────────────┐
                    │                         │
              ECS Fargate (API)        ECS Fargate (Workers)
                    │                         │
                    └────────────┬────────────┘
                                 ↓
                    ┌────────────┴────────────┐
                    │                         │
            RDS PostgreSQL              ElastiCache Redis
                    │                         │
                    └────────────┬────────────┘
                                 ↓
                              S3 Buckets
```

---

## 2. Prerequisites

### 2.1 AWS Account Setup
- **AWS Account**: Production account with appropriate IAM roles
- **IAM User**: Deploy user with ECS, RDS, S3 permissions
- **AWS CLI**: v2.13+ installed and configured

### 2.2 Required Secrets
Store in AWS Secrets Manager:
```json
{
  "DATABASE_URL": "postgresql://user:pass@rds-endpoint/roleferry",
  "REDIS_HOST": "redis-cluster.cache.amazonaws.com",
  "JWT_SECRET": "random-256-bit-key",
  "JWT_REFRESH_SECRET": "random-256-bit-key",
  "APOLLO_API_KEY": "...",
  "SENDGRID_API_KEY": "...",
  "ANTHROPIC_API_KEY": "...",
  "DATADOG_API_KEY": "...",
  "STRIPE_SECRET_KEY": "..."
}
```

### 2.3 Domain Setup
- **DNS**: Route 53 or external DNS provider
- **Domains**: 
  - `roleferry.com` → CloudFront (frontend)
  - `api.roleferry.com` → ALB (backend)
  - `rf-send-01.com` → Sending infrastructure (MX, SPF, DKIM)

---

## 3. Initial Infrastructure Setup

### 3.1 VPC & Networking
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=roleferry-prod-vpc}]'

# Create subnets (3 AZs for high availability)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.3.0/24 --availability-zone us-east-1c

# Create private subnets for DB
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.10.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.11.0/24 --availability-zone us-east-1b

# Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=roleferry-igw}]'
aws ec2 attach-internet-gateway --vpc-id vpc-xxx --internet-gateway-id igw-xxx
```

### 3.2 RDS PostgreSQL
```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name roleferry-db-subnet \
  --db-subnet-group-description "RoleFerry DB subnet group" \
  --subnet-ids subnet-xxx subnet-yyy

# Create RDS instance (Multi-AZ)
aws rds create-db-instance \
  --db-instance-identifier roleferry-prod-db \
  --db-instance-class db.t4g.large \
  --engine postgres \
  --engine-version 15.5 \
  --master-username admin \
  --master-user-password 'SecurePassword123!' \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --db-subnet-group-name roleferry-db-subnet \
  --vpc-security-group-ids sg-xxx \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00"
```

### 3.3 ElastiCache Redis
```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id roleferry-redis \
  --engine redis \
  --cache-node-type cache.t4g.medium \
  --num-cache-nodes 2 \
  --cache-subnet-group-name roleferry-redis-subnet \
  --security-group-ids sg-xxx \
  --engine-version 7.0 \
  --snapshot-retention-limit 7
```

### 3.4 S3 Buckets
```bash
# Resumes bucket
aws s3 mb s3://roleferry-prod-resumes --region us-east-1
aws s3api put-bucket-encryption \
  --bucket roleferry-prod-resumes \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'

# Backups bucket
aws s3 mb s3://roleferry-prod-backups --region us-east-1

# Logs bucket
aws s3 mb s3://roleferry-prod-logs --region us-east-1
```

---

## 4. Application Deployment

### 4.1 Build Docker Images
```bash
# Backend API
cd backend
docker build -t roleferry-api:latest .
docker tag roleferry-api:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/roleferry-api:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/roleferry-api:latest

# Frontend
cd frontend
docker build -t roleferry-frontend:latest .
docker tag roleferry-frontend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/roleferry-frontend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/roleferry-frontend:latest
```

### 4.2 ECS Task Definitions

**API Task Definition** (`ecs-api-task.json`):
```json
{
  "family": "roleferry-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/roleferry-api:latest",
      "portMappings": [{"containerPort": 8000, "protocol": "tcp"}],
      "environment": [
        {"name": "ENV", "value": "production"},
        {"name": "REDIS_HOST", "value": "redis-cluster.cache.amazonaws.com"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:roleferry/prod/database_url"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:roleferry/prod/jwt_secret"}
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

**Register task definition**:
```bash
aws ecs register-task-definition --cli-input-json file://ecs-api-task.json
```

### 4.3 ECS Services

**Create API service**:
```bash
aws ecs create-service \
  --cluster roleferry-prod \
  --service-name api \
  --task-definition roleferry-api:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=api,containerPort=8000" \
  --health-check-grace-period-seconds 60
```

**Create Worker service**:
```bash
aws ecs create-service \
  --cluster roleferry-prod \
  --service-name workers \
  --task-definition roleferry-worker:1 \
  --desired-count 5 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```

### 4.4 ALB Configuration

**Create target group**:
```bash
aws elbv2 create-target-group \
  --name roleferry-api-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id vpc-xxx \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --target-type ip
```

**Create load balancer**:
```bash
aws elbv2 create-load-balancer \
  --name roleferry-alb \
  --subnets subnet-xxx subnet-yyy subnet-zzz \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application
```

**Create listener**:
```bash
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

---

## 5. Database Migration

### 5.1 Run Alembic Migrations
```bash
# SSH into ECS task (or run via ECS Exec)
aws ecs execute-command \
  --cluster roleferry-prod \
  --task <task-id> \
  --container api \
  --interactive \
  --command "/bin/bash"

# Inside container
cd /app
alembic upgrade head
```

### 5.2 Seed Initial Data
```bash
# Create platform sequence templates
python scripts/seed_sequences.py

# Create test users (staging only)
python scripts/seed_test_users.py
```

---

## 6. CI/CD Pipeline (GitHub Actions)

### 6.1 Workflow File (`.github/workflows/deploy.yml`)
```yaml
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
          pip install -r requirements.txt pytest
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
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/roleferry-api:$IMAGE_TAG .
          docker push $ECR_REGISTRY/roleferry-api:$IMAGE_TAG
          docker tag $ECR_REGISTRY/roleferry-api:$IMAGE_TAG $ECR_REGISTRY/roleferry-api:latest
          docker push $ECR_REGISTRY/roleferry-api:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster roleferry-prod --service api --force-new-deployment
          aws ecs update-service --cluster roleferry-prod --service workers --force-new-deployment
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable --cluster roleferry-prod --services api workers
      - name: Smoke tests
        run: |
          curl -f https://api.roleferry.com/health || exit 1
```

---

## 7. Monitoring & Alerts

### 7.1 CloudWatch Alarms
```bash
# API 5xx error rate
aws cloudwatch put-metric-alarm \
  --alarm-name roleferry-api-5xx-errors \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789:roleferry-alerts

# RDS CPU utilization
aws cloudwatch put-metric-alarm \
  --alarm-name roleferry-db-high-cpu \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=roleferry-prod-db \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789:roleferry-alerts
```

### 7.2 Datadog Integration
```python
# backend/app/main.py
from datadog import initialize, statsd

initialize(
    api_key=os.getenv("DATADOG_API_KEY"),
    app_key=os.getenv("DATADOG_APP_KEY"),
    statsd_host="localhost",
    statsd_port=8125
)

# Track metrics
@app.middleware("http")
async def track_request_metrics(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000
    
    statsd.histogram(
        'roleferry.api.request_duration',
        duration,
        tags=[f'endpoint:{request.url.path}', f'status:{response.status_code}']
    )
    
    return response
```

---

## 8. Scaling Configuration

### 8.1 ECS Auto-Scaling
```bash
# Create scaling policy (CPU-based)
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/roleferry-prod/api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 3 \
  --max-capacity 20

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/roleferry-prod/api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-scaling-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

### 8.2 RDS Scaling
```bash
# Vertical scaling (manual, requires downtime)
aws rds modify-db-instance \
  --db-instance-identifier roleferry-prod-db \
  --db-instance-class db.m6g.xlarge \
  --apply-immediately

# Read replica (horizontal scaling for reads)
aws rds create-db-instance-read-replica \
  --db-instance-identifier roleferry-prod-db-replica \
  --source-db-instance-identifier roleferry-prod-db \
  --db-instance-class db.t4g.large
```

---

## 9. Backup & Disaster Recovery

### 9.1 RDS Automated Backups
- **Retention**: 30 days
- **Backup window**: 3:00-4:00 AM UTC (low traffic)
- **Point-in-time recovery**: Available (transaction logs retained)

### 9.2 Manual Snapshots
```bash
# Create snapshot before major changes
aws rds create-db-snapshot \
  --db-instance-identifier roleferry-prod-db \
  --db-snapshot-identifier roleferry-prod-pre-migration-$(date +%Y%m%d)
```

### 9.3 S3 Bucket Versioning
```bash
# Enable versioning on resumes bucket
aws s3api put-bucket-versioning \
  --bucket roleferry-prod-resumes \
  --versioning-configuration Status=Enabled
```

### 9.4 Disaster Recovery Plan
**RTO (Recovery Time Objective)**: 1 hour  
**RPO (Recovery Point Objective)**: 15 minutes

**Failover Procedure**:
1. Promote read replica to primary (if primary fails)
2. Update DNS to point to DR region (Route 53 health checks)
3. Restore ECS services in DR region from same container images

---

## 10. Security Hardening

### 10.1 IAM Roles
- **ECS Task Role**: Permissions to access S3, Secrets Manager
- **ECS Execution Role**: Pull images from ECR, write CloudWatch logs

### 10.2 Security Groups
```bash
# API security group (allow ALB traffic only)
aws ec2 authorize-security-group-ingress \
  --group-id sg-api \
  --protocol tcp \
  --port 8000 \
  --source-group sg-alb

# DB security group (allow API traffic only)
aws ec2 authorize-security-group-ingress \
  --group-id sg-db \
  --protocol tcp \
  --port 5432 \
  --source-group sg-api
```

### 10.3 Secrets Rotation
```bash
# Enable automatic rotation for database password
aws secretsmanager rotate-secret \
  --secret-id roleferry/prod/database_url \
  --rotation-lambda-arn arn:aws:lambda:... \
  --rotation-rules AutomaticallyAfterDays=30
```

---

## 11. Rollback Procedure

### 11.1 ECS Rollback
```bash
# Revert to previous task definition
aws ecs update-service \
  --cluster roleferry-prod \
  --service api \
  --task-definition roleferry-api:5  # Previous version

# Force immediate deployment
aws ecs update-service \
  --cluster roleferry-prod \
  --service api \
  --force-new-deployment
```

### 11.2 Database Rollback
```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier roleferry-prod-db-restored \
  --db-snapshot-identifier roleferry-prod-pre-migration-20251013

# Point app to restored instance (update DATABASE_URL in Secrets Manager)
```

---

## 12. Post-Deployment Checklist

- [ ] Health check endpoints return 200 OK
- [ ] API latency <500ms (check Datadog)
- [ ] Database connections stable (<80% max_connections)
- [ ] Redis cache hit rate >80%
- [ ] Celery workers processing jobs (check queue depth)
- [ ] Email sending functional (test via staging mailbox)
- [ ] CloudWatch alarms configured and active
- [ ] Smoke tests passed (curl critical endpoints)
- [ ] DNS resolves correctly (dig api.roleferry.com)
- [ ] SSL certificates valid (https://www.ssllabs.com/ssltest/)

---

**Document Owner**: DevOps Team  
**Version**: 1.0  
**Date**: October 2025  
**Support**: devops@roleferry.com

