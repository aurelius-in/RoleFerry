#!/bin/bash
# RoleFerry Rollback Script
# Reverts to previous deployment if issues detected

set -e

echo "🔄 RoleFerry Rollback Procedure"
echo "==============================="
echo ""

# Confirm rollback
read -p "⚠️  ROLLBACK to previous version? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Rollback cancelled."
    exit 0
fi

# Get current task definition
echo "📋 Finding previous task definition..."

current_task_def=$(aws ecs describe-services \
    --cluster roleferry-prod \
    --services api \
    --query 'services[0].taskDefinition' \
    --output text \
    --region us-east-1)

echo "Current: $current_task_def"

# Get previous revision (decrement revision number by 1)
task_family=$(echo $current_task_def | cut -d':' -f6 | cut -d'/' -f2)
current_revision=$(echo $current_task_def | cut -d':' -f7)
previous_revision=$((current_revision - 1))
previous_task_def="$task_family:$previous_revision"

echo "Rollback to: $previous_task_def"
echo ""

# Rollback API service
echo "🔙 Rolling back API service..."
aws ecs update-service \
    --cluster roleferry-prod \
    --service api \
    --task-definition $previous_task_def \
    --force-new-deployment \
    --region us-east-1 \
    --no-cli-pager

# Rollback Workers service
echo "🔙 Rolling back Workers service..."
aws ecs update-service \
    --cluster roleferry-prod \
    --service workers \
    --task-definition $previous_task_def \
    --force-new-deployment \
    --region us-east-1 \
    --no-cli-pager

# Wait for stability
echo ""
echo "⏳ Waiting for rollback to complete..."
aws ecs wait services-stable \
    --cluster roleferry-prod \
    --services api workers \
    --region us-east-1

# Verify
echo ""
echo "🧪 Verifying rollback..."
api_health=$(curl -s -o /dev/null -w "%{http_code}" https://api.roleferry.com/health)
if [ "$api_health" == "200" ]; then
    echo "✅ API is healthy after rollback"
else
    echo "❌ API health check failed (HTTP $api_health)"
    echo "⚠️  Manual intervention required!"
    exit 1
fi

echo ""
echo "✅ ROLLBACK SUCCESSFUL"
echo "====================="
echo ""
echo "Previous version restored. Monitor for stability."
echo ""

