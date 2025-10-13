# CI/CD Pipeline Documentation
## RoleFerry Platform

**Version**: 1.0  
**Tool**: GitHub Actions  
**Audience**: DevOps, Engineering

---

## 1. Pipeline Overview

```
Code Push → Lint → Test → Build → Deploy Staging → E2E Tests → Deploy Production
```

**Trigger Branches**:
- `develop` → Auto-deploy to **staging**
- `main` → Manual approval → **production**
- `feature/*` → Run tests only (no deploy)

---

## 2. Complete GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: 123456789.dkr.ecr.us-east-1.amazonaws.com

jobs:
  # Job 1: Lint & Security Scan
  lint-and-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install Python dependencies
        run: |
          cd backend
          pip install black isort mypy bandit
      
      - name: Run Black (formatter check)
        run: cd backend && black --check .
      
      - name: Run isort (import sorting)
        run: cd backend && isort --check-only .
      
      - name: Run mypy (type checking)
        run: cd backend && mypy app/
      
      - name: Run Bandit (security scan)
        run: cd backend && bandit -r app/ -f json -o bandit-report.json
      
      - name: Upload Bandit report
        uses: actions/upload-artifact@v3
        with:
          name: bandit-report
          path: backend/bandit-report.json
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install frontend dependencies
        run: cd frontend && npm ci
      
      - name: Run ESLint
        run: cd frontend && npm run lint
      
      - name: Run TypeScript check
        run: cd frontend && npm run type-check
      
      - name: Run Snyk (dependency scan)
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: test
          args: --severity-threshold=high
  
  # Job 2: Unit Tests
  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-scan
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: roleferry_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
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
          pip install pytest pytest-cov pytest-asyncio
      
      - name: Run pytest
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/roleferry_test
          REDIS_HOST: localhost
        run: |
          cd backend
          pytest tests/ --cov=app --cov-report=xml --cov-report=html
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml
          flags: backend
      
      - name: Frontend tests
        run: |
          cd frontend
          npm ci
          npm test -- --coverage
      
      - name: Upload frontend coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/coverage-final.json
          flags: frontend
  
  # Job 3: Build Docker Images
  build:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main'
    
    outputs:
      image_tag: ${{ steps.meta.outputs.version }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Extract metadata (tags, labels)
        id: meta
        run: |
          if [[ $GITHUB_REF == refs/heads/main ]]; then
            echo "version=prod-$(date +%Y%m%d-%H%M%S)" >> $GITHUB_OUTPUT
          else
            echo "version=staging-$(date +%Y%m%d-%H%M%S)" >> $GITHUB_OUTPUT
          fi
      
      - name: Build and push API image
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/roleferry-api:${{ steps.meta.outputs.version }} .
          docker push $ECR_REGISTRY/roleferry-api:${{ steps.meta.outputs.version }}
          
          # Also tag as latest
          docker tag $ECR_REGISTRY/roleferry-api:${{ steps.meta.outputs.version }} \
                     $ECR_REGISTRY/roleferry-api:latest
          docker push $ECR_REGISTRY/roleferry-api:latest
      
      - name: Build and push Worker image
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/roleferry-worker:${{ steps.meta.outputs.version }} \
                       -f Dockerfile.worker .
          docker push $ECR_REGISTRY/roleferry-worker:${{ steps.meta.outputs.version }}
  
  # Job 4: Deploy to Staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Deploy to ECS (Staging)
        run: |
          aws ecs update-service \
            --cluster roleferry-staging \
            --service api \
            --force-new-deployment
          
          aws ecs update-service \
            --cluster roleferry-staging \
            --service workers \
            --force-new-deployment
      
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster roleferry-staging \
            --services api workers
      
      - name: Run smoke tests
        run: |
          curl -f https://staging.roleferry.com/health || exit 1
          curl -f https://staging-api.roleferry.com/health || exit 1
  
  # Job 5: E2E Tests (Staging)
  e2e-tests:
    runs-on: ubuntu-latest
    needs: deploy-staging
    if: github.ref == 'refs/heads/develop'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Playwright
        run: |
          npm ci
          npx playwright install --with-deps
      
      - name: Run E2E tests
        env:
          BASE_URL: https://staging.roleferry.com
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
  
  # Job 6: Deploy to Production (Manual Approval)
  deploy-production:
    runs-on: ubuntu-latest
    needs: [build, e2e-tests]
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://roleferry.com
    
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Deploy to ECS (Production)
        run: |
          aws ecs update-service \
            --cluster roleferry-prod \
            --service api \
            --force-new-deployment
          
          aws ecs update-service \
            --cluster roleferry-prod \
            --service workers \
            --force-new-deployment
      
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster roleferry-prod \
            --services api workers
      
      - name: Smoke tests (Production)
        run: |
          curl -f https://roleferry.com/health || exit 1
          curl -f https://api.roleferry.com/health || exit 1
      
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_RELEASES }}
          payload: |
            {
              "text": "🚀 Production deployment successful",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Production Deployment*\nCommit: ${{ github.sha }}\nBranch: main\nStatus: ✅ Success"
                  }
                }
              ]
            }
```

---

## 3. Pipeline Metrics

| Stage | Target Duration | Failure Rate |
|-------|-----------------|--------------|
| **Lint & Scan** | <2 min | <1% |
| **Unit Tests** | <5 min | <2% |
| **Build Images** | <10 min | <1% |
| **Deploy Staging** | <5 min | <1% |
| **E2E Tests** | <15 min | <5% (flakes) |
| **Deploy Production** | <5 min | <0.5% |
| **Total** | **<45 min** | **<2%** |

---

## 4. Acceptance Criteria

- [ ] CI/CD pipeline runs on every PR
- [ ] Staging deploys automatically on `develop` push
- [ ] Production requires manual approval
- [ ] All tests pass before deploy (unit, integration, E2E)
- [ ] Rollback possible within 5 minutes
- [ ] Deployment notifications to Slack
- [ ] Pipeline completes in <45 minutes

---

**Document Owner**: DevOps Lead  
**Version**: 1.0  
**Date**: October 2025

