# RoleFerry - Production Deployment Guide

**Version**: 1.0  
**Target**: AWS ECS + RDS + ElastiCache  
**Estimated Setup Time**: 2-3 hours  
**Prerequisites**: AWS account, Terraform, Docker

---

## 🚀 Quick Deploy (One Command)

```bash
# Complete production deployment
./scripts/deploy-production.sh
```

This script will:
1. Build and push Docker images
2. Apply Terraform infrastructure
3. Run database migrations
4. Deploy frontend + backend
5. Configure monitoring and alerts

---

## 📋 Prerequisites

### Required Tools
- [x] AWS CLI configured (`aws configure`)
- [x] Terraform 1.5+ installed
- [x] Docker 24+ installed
- [x] Node.js 20+ for frontend
- [x] Python 3.11+ for backend

### AWS Resources Needed
- [x] AWS account with billing enabled
- [x] IAM user with AdministratorAccess (or specific permissions)
- [x] Route 53 hosted zone for domain
- [x] ACM certificate for HTTPS

### Environment Variables
```bash
# Required
export AWS_REGION=us-east-1
export DOMAIN_NAME=roleferry.com
export DATABASE_PASSWORD=<secure-password>
export JWT_SECRET=<256-bit-key>

# API Keys
export APOLLO_API_KEY=<key>
export SENDGRID_API_KEY=<key>
export STRIPE_SECRET_KEY=<key>
export ANTHROPIC_API_KEY=<key>
```

---

## 🏗️ Infrastructure Setup (Terraform)

### Step 1: Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### Step 2: Plan Infrastructure

```bash
terraform plan \
  -var="domain_name=roleferry.com" \
  -var="environment=production" \
  -var="database_password=${DATABASE_PASSWORD}" \
  -out=tfplan
```

**What This Creates**:
- VPC with public/private subnets (3 AZs)
- Application Load Balancer (ALB)
- ECS Fargate cluster (API + Workers)
- RDS PostgreSQL (Multi-AZ, automated backups)
- ElastiCache Redis (cluster mode)
- S3 buckets (assets, backups)
- CloudFront CDN (frontend)
- Route 53 DNS records
- Secrets Manager (API keys)
- CloudWatch Logs + Alarms
- IAM roles and policies

**Estimated Cost**: $500-800/month (initial scale)

### Step 3: Apply Infrastructure

```bash
terraform apply tfplan
```

**Duration**: 15-20 minutes

**Outputs**:
```
alb_dns_name = "roleferry-prod-123456.us-east-1.elb.amazonaws.com"
rds_endpoint = "roleferry-prod.xxxxx.us-east-1.rds.amazonaws.com"
redis_endpoint = "roleferry-prod.xxxxx.cache.amazonaws.com"
s3_bucket = "roleferry-prod-assets"
```

---

## 🐳 Docker Images

### Backend Image

```bash
cd backend
docker build -t roleferry-api:latest .
docker tag roleferry-api:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/roleferry-api:latest
docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/roleferry-api:latest
```

### Frontend Image

```bash
cd frontend
docker build -t roleferry-web:latest .
docker tag roleferry-web:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/roleferry-web:latest
docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/roleferry-web:latest
```

---

## 🗄️ Database Setup

### Run Migrations

```bash
# SSH into ECS task or run locally pointing to RDS
export DATABASE_URL=postgresql://admin:${DATABASE_PASSWORD}@<rds_endpoint>:5432/roleferry

cd backend
alembic upgrade head
```

### Seed Initial Data (Optional)

```bash
python scripts/seed_data.py
```

---

## 🚀 Deploy Application

### Update ECS Services

```bash
aws ecs update-service \
  --cluster roleferry-prod \
  --service api \
  --force-new-deployment

aws ecs update-service \
  --cluster roleferry-prod \
  --service workers \
  --force-new-deployment
```

### Verify Deployment

```bash
# Check service health
aws ecs describe-services \
  --cluster roleferry-prod \
  --services api workers

# Check task status
aws ecs list-tasks --cluster roleferry-prod --service-name api
```

---

## 🌐 DNS Configuration

### Point Domain to ALB

```bash
# Get ALB DNS name
terraform output alb_dns_name

# Create Route 53 record (or in your DNS provider)
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone_id> \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.roleferry.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "<alb_dns_name>"}]
      }
    }]
  }'
```

---

## 📊 Post-Deployment Verification

### Health Checks

```bash
# API health
curl https://api.roleferry.com/health
# Expected: {"status": "healthy"}

# Frontend
curl https://roleferry.com
# Expected: 200 OK

# Database connectivity
curl https://api.roleferry.com/health/db
# Expected: {"status": "connected"}
```

### Smoke Tests

```bash
# Run end-to-end tests against production
cd frontend
npm run test:e2e -- --env=production
```

---

## 🔐 Secrets Management

### Store Secrets in AWS Secrets Manager

```bash
# JWT Secret
aws secretsmanager create-secret \
  --name roleferry/prod/jwt_secret \
  --secret-string '{"key": "<your-256-bit-key>"}'

# Database URL
aws secretsmanager create-secret \
  --name roleferry/prod/database_url \
  --secret-string '{"url": "postgresql://admin:${DATABASE_PASSWORD}@<rds_endpoint>:5432/roleferry"}'

# API Keys (batch)
aws secretsmanager create-secret \
  --name roleferry/prod/api_keys \
  --secret-string '{
    "apollo": "<key>",
    "sendgrid": "<key>",
    "stripe": "<key>",
    "anthropic": "<key>"
  }'
```

---

## 📈 Monitoring Setup

### Datadog Integration

```bash
# Set Datadog API key as environment variable in ECS task definition
# Datadog agent auto-discovers containers

# Verify metrics flowing
datadog-cli monitor list | grep roleferry
```

### CloudWatch Alarms

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name roleferry-api-errors-high \
  --alarm-description "API error rate >5%" \
  --metric-name Errors \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

---

## 🔄 CI/CD (GitHub Actions)

Pipeline automatically runs on push to `main`:
1. Run tests (unit, integration)
2. Build Docker images
3. Push to ECR
4. Update ECS services
5. Run smoke tests
6. Notify Slack

**File**: `.github/workflows/deploy-production.yml`

---

## 📊 Capacity Planning

### Initial Scale (1,000 users)
- **API**: 2 ECS tasks (2 vCPU, 4 GB each)
- **Workers**: 5 ECS tasks (2 vCPU, 4 GB each)
- **RDS**: db.t4g.medium (2 vCPU, 4 GB)
- **Redis**: cache.t4g.medium (2 vCPU, 3.09 GB)

**Cost**: ~$500/month

### Scale to 10,000 users
- **API**: 10 tasks
- **Workers**: 15 tasks
- **RDS**: db.m6g.xlarge (4 vCPU, 16 GB)
- **Redis**: cache.m6g.large (2 vCPU, 6.38 GB)

**Cost**: ~$1,500/month

---

## 🔥 Rollback Procedure

```bash
# 1. Find previous task definition
aws ecs describe-services \
  --cluster roleferry-prod \
  --services api \
  --query 'services[0].taskDefinition'

# 2. Revert to previous version
aws ecs update-service \
  --cluster roleferry-prod \
  --service api \
  --task-definition <previous_task_def>

# 3. Verify
curl https://api.roleferry.com/health
```

**Downtime**: < 2 minutes

---

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (unit, integration, E2E)
- [ ] Database migrations tested on staging
- [ ] Environment variables configured
- [ ] Secrets stored in Secrets Manager
- [ ] DNS records ready
- [ ] SSL certificates valid

### Deployment Day
- [ ] Announce in #engineering (Slack)
- [ ] Run Terraform apply
- [ ] Deploy backend (ECS update)
- [ ] Deploy frontend (CloudFront invalidation)
- [ ] Run smoke tests
- [ ] Monitor for 2 hours (error rates, latency)

### Post-Deployment
- [ ] Update status page
- [ ] Send launch email (if public launch)
- [ ] Monitor metrics (Datadog, CloudWatch)
- [ ] Be ready to rollback (on-call engineer)

---

## 🆘 Troubleshooting

### Issue: ECS Tasks Won't Start
**Solution**: Check CloudWatch Logs for container errors

```bash
aws logs tail /ecs/roleferry-prod-api --follow
```

### Issue: Database Connection Fails
**Solution**: Verify security group allows ECS → RDS traffic

```bash
aws ec2 describe-security-groups --group-ids <rds_sg>
```

### Issue: High Latency (>1s)
**Solution**: Check RDS connections, enable read replica

```bash
# Monitor active connections
psql -h <rds_endpoint> -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## 📚 Additional Resources

- [Infrastructure as Code](docs/04-technical/infrastructure-as-code.md) - Terraform details
- [Monitoring Guide](docs/06-operations/monitoring-alerting.md) - Datadog setup
- [Incident Response](docs/06-operations/incident-response-plan.md) - On-call procedures
- [Disaster Recovery](docs/06-operations/disaster-recovery-plan.md) - Failover strategies

---

**Document Owner**: DevOps Lead, CTO  
**Last Updated**: January 2025  
**Next Review**: After each production deployment

