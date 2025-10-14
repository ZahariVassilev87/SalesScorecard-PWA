#!/bin/bash
# Quick deployment status check

echo "🔍 Checking deployment status..."
echo ""

STATUS=$(aws ecs describe-services --cluster sales-scorecard-cluster --services sales-scorecard-service --region eu-north-1 --query 'services[0].deployments[0].rolloutState' --output text)

if [ "$STATUS" = "COMPLETED" ]; then
    echo "✅ Deployment COMPLETED!"
    echo ""
    echo "Testing DELETE endpoint..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.instorm.io/public-admin/remove-user-from-team -X DELETE -H "Content-Type: application/json" -d '{"test":"test"}')
    
    if [ "$HTTP_CODE" = "401" ]; then
        echo "✅ DELETE endpoint working! (401 = needs auth, which is correct)"
    elif [ "$HTTP_CODE" = "404" ]; then
        echo "❌ Still getting 404 - may need more time for cache to clear"
    else
        echo "ℹ️  Got HTTP $HTTP_CODE"
    fi
else
    echo "⏳ Deployment status: $STATUS"
    echo "   Still in progress... check again in a few minutes"
fi


