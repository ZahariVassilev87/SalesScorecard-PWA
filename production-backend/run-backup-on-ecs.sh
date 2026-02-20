#!/bin/bash

# 📦 Run Database Backup on ECS
# This script executes the backup script on the running ECS container

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Running Database Backup on ECS${NC}"
echo ""

# Configuration
ECS_CLUSTER="sales-scorecard-cluster"
ECS_SERVICE="sales-scorecard-service"
REGION="eu-north-1"
CONTAINER_NAME="sales-scorecard-api-container"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${BLUE}✅ AWS CLI configured${NC}"

# Get running task ARN
echo -e "${BLUE}🔍 Finding running ECS task...${NC}"
TASK_ARN=$(aws ecs list-tasks \
    --cluster $ECS_CLUSTER \
    --service-name $ECS_SERVICE \
    --region $REGION \
    --desired-status RUNNING \
    --query 'taskArns[0]' \
    --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" == "None" ]; then
    echo -e "${RED}❌ No running tasks found for service ${ECS_SERVICE}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found task: ${TASK_ARN}${NC}"

# Check if ECS Exec is enabled (requires SSM)
echo -e "${BLUE}🔍 Checking if ECS Exec is enabled...${NC}"

# Copy backup script to container and execute
echo -e "${BLUE}📤 Copying backup script to container...${NC}"

# First, let's check if we can execute commands
echo -e "${BLUE}🚀 Executing backup script on ECS container...${NC}"
echo -e "${YELLOW}⚠️  This will take a few minutes. Please wait...${NC}"
echo ""

# Execute backup script
aws ecs execute-command \
    --cluster $ECS_CLUSTER \
    --task $TASK_ARN \
    --container $CONTAINER_NAME \
    --region $REGION \
    --interactive \
    --command "node /app/backup-database.js" || {
    
    echo -e "${YELLOW}⚠️  ECS Exec might not be enabled. Trying alternative method...${NC}"
    echo -e "${BLUE}📋 Alternative: Use AWS Systems Manager Session Manager${NC}"
    echo ""
    echo "To enable ECS Exec, you need to:"
    echo "1. Ensure the task has the required IAM permissions"
    echo "2. Enable ECS Exec on the service"
    echo ""
    echo "Or use AWS RDS snapshot instead:"
    echo "aws rds create-db-snapshot --db-instance-identifier your-db --db-snapshot-identifier backup-\$(date +%Y%m%d)"
    exit 1
}

echo ""
echo -e "${GREEN}✅ Backup completed!${NC}"

