#!/bin/bash

# 🚀 Deploy Backend to AWS ECS
# This script builds and deploys the backend with the delete functionality fixes

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying Backend with Delete Fixes${NC}"
echo ""

# Configuration
ECR_REPOSITORY="221855463690.dkr.ecr.us-east-1.amazonaws.com/sales-scorecard-api"
ECS_CLUSTER="sales-scorecard-cluster"
ECS_SERVICE="sales-scorecard-service"
REGION="eu-north-1"
TASK_FAMILY="sales-scorecard-task"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${BLUE}✅ AWS CLI configured${NC}"

# Step 1: Build Docker image (Dockerfile is multi-stage: builds admin-panel SPA, then API — no separate admin step)
echo -e "${BLUE}📦 Building Docker image...${NC}"
cd production-backend
docker build -t sales-scorecard-api:latest .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

# Step 2: Login to ECR
echo -e "${BLUE}🔐 Logging in to ECR...${NC}"
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPOSITORY

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Logged in to ECR${NC}"
else
    echo -e "${RED}❌ ECR login failed${NC}"
    exit 1
fi

# Step 3: Tag and push image
echo -e "${BLUE}📤 Pushing image to ECR...${NC}"
docker tag sales-scorecard-api:latest $ECR_REPOSITORY:latest
docker push $ECR_REPOSITORY:latest

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image pushed to ECR${NC}"
else
    echo -e "${RED}❌ Image push failed${NC}"
    exit 1
fi

# Step 4: Force new deployment
echo -e "${BLUE}🔄 Forcing new deployment on ECS...${NC}"
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --force-new-deployment \
    --region $REGION \
    --no-cli-pager

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment initiated${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Step 5: Wait for deployment
echo -e "${BLUE}⏳ Waiting for deployment to complete (this may take 5-10 minutes)...${NC}"
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Deployment may still be in progress. Check ECS console for status.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Backend deployed with delete fixes!${NC}"
echo ""
echo -e "${BLUE}📋 What was deployed:${NC}"
echo "  ✅ Enhanced team deletion with validation"
echo "  ✅ New remove-user-from-team endpoint"
echo "  ✅ Better error messages for 500 errors"
echo "  ✅ Foreign key constraint handling"
echo ""
echo -e "${BLUE}🔗 API Endpoint: https://api.instorm.io${NC}"
echo ""
echo -e "${BLUE}📝 Test the fixes:${NC}"
echo "  • Try deleting a team in admin panel"
echo "  • Try removing a member from a team"
echo "  • Check for specific error messages"
echo ""
echo -e "${YELLOW}⚠️  Monitor logs with:${NC}"
echo "  aws logs tail /ecs/sales-scorecard-task --follow --region $REGION"


