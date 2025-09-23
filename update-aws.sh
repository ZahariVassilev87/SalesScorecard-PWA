#!/bin/bash

# 🔄 AWS CloudFront PWA Update Script
# This script updates an existing PWA deployment

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if deployment info exists
if [ ! -f "deployment-info.json" ]; then
    echo "❌ deployment-info.json not found. Please run deploy-aws.sh first."
    exit 1
fi

# Read deployment info
BUCKET_NAME=$(jq -r '.bucketName' deployment-info.json)
DISTRIBUTION_ID=$(jq -r '.distributionId' deployment-info.json)
DOMAIN_NAME=$(jq -r '.domainName' deployment-info.json)

echo "🔄 Updating PWA deployment..."
echo "Bucket: $BUCKET_NAME"
echo "Distribution: $DISTRIBUTION_ID"
echo "Domain: $DOMAIN_NAME"
echo ""

# Step 1: Build the PWA
print_status "Building PWA for production..."
npm run build

# Step 2: Upload files to S3
print_status "Uploading updated files to S3..."
aws s3 sync build/ s3://$BUCKET_NAME --delete

# Step 3: Invalidate CloudFront cache
print_status "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

print_success "🎉 PWA updated successfully!"
print_success "URL: https://$DOMAIN_NAME"
print_status "Cache invalidation in progress. Changes will be visible in 5-10 minutes."
