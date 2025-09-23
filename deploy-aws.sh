#!/bin/bash

# 🚀 AWS CloudFront PWA Deployment Script
# This script deploys the Sales Scorecard PWA to AWS S3 + CloudFront

set -e

echo "🚀 Starting AWS CloudFront PWA Deployment..."

# Configuration
BUCKET_NAME="sales-scorecard-pwa-$(date +%s)"
REGION="us-east-1"
DISTRIBUTION_ID=""
DOMAIN_NAME=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in to AWS
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

print_status "AWS CLI is configured and ready."

# Step 1: Build the PWA
print_status "Building PWA for production..."
npm run build

if [ ! -d "build" ]; then
    print_error "Build directory not found. Build failed."
    exit 1
fi

print_success "PWA built successfully."

# Step 2: Create S3 bucket
print_status "Creating S3 bucket: $BUCKET_NAME"
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Step 3: Configure S3 bucket for static website hosting
print_status "Configuring S3 bucket for static website hosting..."
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html

# Step 4: Configure bucket for public access
print_status "Configuring bucket for public access..."

# Disable block public access
aws s3api put-public-access-block --bucket $BUCKET_NAME --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Set bucket policy for public read access
print_status "Setting bucket policy for public read access..."
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json
rm bucket-policy.json

# Step 5: Upload files to S3
print_status "Uploading PWA files to S3..."
aws s3 sync build/ s3://$BUCKET_NAME --delete

print_success "Files uploaded to S3 successfully."

# Step 6: Create CloudFront distribution
print_status "Creating CloudFront distribution..."

# Create CloudFront configuration
cat > cloudfront-config.json << EOF
{
    "CallerReference": "sales-scorecard-pwa-$(date +%s)",
    "Comment": "Sales Scorecard PWA Distribution",
    "DefaultRootObject": "index.html",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-$BUCKET_NAME",
                "DomainName": "$BUCKET_NAME.s3-website-$REGION.amazonaws.com",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-$BUCKET_NAME",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000
    },
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    },
    "Enabled": true,
    "PriceClass": "PriceClass_100"
}
EOF

# Create the distribution
DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution --distribution-config file://cloudfront-config.json)
DISTRIBUTION_ID=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.Id')
DOMAIN_NAME=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.DomainName')

rm cloudfront-config.json

print_success "CloudFront distribution created: $DISTRIBUTION_ID"
print_success "Domain: https://$DOMAIN_NAME"

# Step 7: Save deployment info
print_status "Saving deployment information..."
cat > deployment-info.json << EOF
{
    "bucketName": "$BUCKET_NAME",
    "distributionId": "$DISTRIBUTION_ID",
    "domainName": "$DOMAIN_NAME",
    "region": "$REGION",
    "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

print_success "Deployment information saved to deployment-info.json"

# Step 8: Wait for distribution to be deployed
print_status "Waiting for CloudFront distribution to be deployed (this may take 10-15 minutes)..."
aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID

print_success "🎉 PWA deployed successfully!"
print_success "URL: https://$DOMAIN_NAME"
print_warning "Note: It may take a few minutes for the distribution to be fully available globally."

# Step 9: Display next steps
echo ""
echo "📋 Next Steps:"
echo "1. Update your API configuration to point to this domain"
echo "2. Configure CORS settings if needed"
echo "3. Set up custom domain (optional)"
echo "4. Configure SSL certificate (if using custom domain)"
echo ""
echo "🔧 Useful Commands:"
echo "  - Update files: aws s3 sync build/ s3://$BUCKET_NAME --delete"
echo "  - Invalidate cache: aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths '/*'"
echo "  - Check status: aws cloudfront get-distribution --id $DISTRIBUTION_ID"
echo ""
echo "📁 Deployment info saved in: deployment-info.json"
