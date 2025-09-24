#!/bin/bash

# 🌐 Step-by-Step Wix Subdomain Setup for scorecard.instorm.io
# This script sets up SSL certificate first, then CloudFront

set -e

# Configuration
DOMAIN="scorecard.instorm.io"
CERT_REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo "🌐 Step-by-Step Wix Subdomain Setup for $DOMAIN"
echo "=============================================="
echo ""

# Check prerequisites
print_status "Checking prerequisites..."

# Check if deployment-info.json exists
if [ ! -f "deployment-info.json" ]; then
    print_error "deployment-info.json not found. Please run deploy-aws.sh first."
    exit 1
fi

# Load deployment info
DISTRIBUTION_ID=$(jq -r '.distributionId' deployment-info.json)
CLOUDFRONT_DOMAIN=$(jq -r '.domainName' deployment-info.json)

if [ "$DISTRIBUTION_ID" = "null" ] || [ -z "$DISTRIBUTION_ID" ]; then
    print_error "Distribution ID not found in deployment-info.json"
    exit 1
fi

print_success "Found CloudFront Distribution: $DISTRIBUTION_ID"
print_success "CloudFront Domain: $CLOUDFRONT_DOMAIN"

# Step 1: Request SSL Certificate
print_status "Step 1: Requesting SSL certificate for $DOMAIN..."

CERT_ARN=$(aws acm request-certificate \
    --domain-name $DOMAIN \
    --subject-alternative-names "www.$DOMAIN" \
    --validation-method DNS \
    --region $CERT_REGION \
    --query 'CertificateArn' \
    --output text)

print_success "SSL certificate requested: $CERT_ARN"

# Step 2: Get certificate validation records
print_status "Step 2: Getting certificate validation records..."

sleep 5  # Wait for certificate to be created

CERT_DETAILS=$(aws acm describe-certificate \
    --certificate-arn $CERT_ARN \
    --region $CERT_REGION)

VALIDATION_RECORDS=$(echo $CERT_DETAILS | jq -r '.Certificate.DomainValidationOptions[] | select(.DomainName == "'$DOMAIN'") | .ResourceRecord')

VALIDATION_NAME=$(echo $VALIDATION_RECORDS | jq -r '.Name')
VALIDATION_VALUE=$(echo $VALIDATION_RECORDS | jq -r '.Value')

print_status "Certificate validation record:"
echo "  Name: $VALIDATION_NAME"
echo "  Value: $VALIDATION_VALUE"

# Save certificate info for later
echo "$CERT_ARN" > certificate-arn.txt
echo "$VALIDATION_NAME" > validation-name.txt
echo "$VALIDATION_VALUE" > validation-value.txt

print_success "🎉 SSL Certificate setup completed!"
echo ""
echo "📋 Next Steps - Configure DNS in Wix:"
echo "====================================="
echo ""
echo "1. Log into your Wix account"
echo "2. Go to your domain settings for instorm.io"
echo "3. Add this DNS record for certificate validation:"
echo ""
echo "   📝 Certificate Validation Record:"
echo "   - Name: $VALIDATION_NAME"
echo "   - Type: CNAME"
echo "   - Value: $VALIDATION_VALUE"
echo "   - TTL: 300"
echo ""
echo "4. Wait 5-10 minutes for DNS propagation"
echo "5. Run the next script: ./validate-and-setup-cloudfront.sh"
echo ""
echo "📊 Summary:"
echo "  - SSL Certificate: $CERT_ARN"
echo "  - CloudFront Distribution: $DISTRIBUTION_ID"
echo "  - CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo ""
print_warning "Note: The certificate must be validated before we can update CloudFront!"
