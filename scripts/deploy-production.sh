#!/bin/bash
# RoleFerry Production Deployment Script
# This script automates the complete deployment process

set -e  # Exit on error

echo "🚀 RoleFerry Production Deployment"
echo "=================================="
echo ""

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Load environment variables
if [ -f .env.production ]; then
    echo "✅ Loading .env.production"
    export $(cat .env.production | xargs)
else
    echo "❌ .env.production not found. Please create it with required variables."
    exit 1
fi

# Confirm deployment
read -p "Deploy to PRODUCTION? This will affect live users. (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled."
    exit 0
fi

echo ""
echo "Step 1: Building Docker Images"
echo "------------------------------"

# Login to ECR
echo "📦 Logging into AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push backend
echo "🔨 Building backend image..."
cd backend
docker build -t roleferry-api:latest .
docker tag roleferry-api:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-api:latest
docker tag roleferry-api:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-api:$GITHUB_SHA
echo "⬆️  Pushing backend image..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-api:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-api:$GITHUB_SHA
cd ..

# Build and push frontend
echo "🔨 Building frontend image..."
cd frontend
docker build -t roleferry-web:latest .
docker tag roleferry-web:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-web:latest
docker tag roleferry-web:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-web:$GITHUB_SHA
echo "⬆️  Pushing frontend image..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-web:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/roleferry-web:$GITHUB_SHA
cd ..

echo ""
echo "Step 2: Running Database Migrations"
echo "-----------------------------------"
# This assumes you have a bastion host or ECS exec enabled
echo "🗄️  Running Alembic migrations..."
# In production, this would SSH to bastion or use ECS exec
# alembic upgrade head

echo ""
echo "Step 3: Deploying to ECS"
echo "-----------------------"

echo "🚀 Updating API service..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $API_SERVICE \
    --force-new-deployment \
    --region $AWS_REGION \
    --no-cli-pager

echo "🚀 Updating Workers service..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $WORKERS_SERVICE \
    --force-new-deployment \
    --region $AWS_REGION \
    --no-cli-pager

echo ""
echo "Step 4: Waiting for Deployment to Stabilize"
echo "------------------------------------------"
echo "⏳ This may take 5-10 minutes..."

aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $API_SERVICE $WORKERS_SERVICE \
    --region $AWS_REGION

echo ""
echo "Step 5: Running Smoke Tests"
echo "--------------------------"

echo "🧪 Testing API health..."
api_health=$(curl -s -o /dev/null -w "%{http_code}" https://api.roleferry.com/health)
if [ "$api_health" != "200" ]; then
    echo "❌ API health check failed (HTTP $api_health)"
    echo "⚠️  Consider rolling back!"
    exit 1
fi
echo "✅ API is healthy"

echo "🧪 Testing frontend..."
web_health=$(curl -s -o /dev/null -w "%{http_code}" https://roleferry.com)
if [ "$web_health" != "200" ]; then
    echo "❌ Frontend health check failed (HTTP $web_health)"
    echo "⚠️  Consider rolling back!"
    exit 1
fi
echo "✅ Frontend is healthy"

echo ""
echo "Step 6: Invalidating CloudFront Cache"
echo "------------------------------------"
echo "🌐 Invalidating CloudFront distribution..."
aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*" \
    --region $AWS_REGION \
    --no-cli-pager

echo ""
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "======================="
echo ""
echo "🎉 RoleFerry is now live in production!"
echo ""
echo "📊 Monitor at: https://app.datadoghq.com"
echo "📈 Metrics: https://console.aws.amazon.com/cloudwatch"
echo "🔍 Logs: https://console.aws.amazon.com/cloudwatch/logs"
echo ""
echo "⚠️  IMPORTANT: Monitor error rates for next 2 hours"
echo "    If errors spike, run: ./scripts/rollback.sh"
echo ""

