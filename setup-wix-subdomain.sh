#!/bin/bash

# 🌐 Wix Subdomain Setup for scorecard.instorm.io
# This script sets up SSL certificate and CloudFront for Wix-managed domain

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

echo "🌐 Wix Subdomain Setup for $DOMAIN"
echo "=================================="
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

# Step 3: Update CloudFront distribution
print_status "Step 3: Updating CloudFront distribution with custom domain..."

# Get current distribution config
CURRENT_CONFIG=$(aws cloudfront get-distribution-config --id $DISTRIBUTION_ID)
ETAG=$(echo $CURRENT_CONFIG | jq -r '.ETag')
DISTRIBUTION_CONFIG=$(echo $CURRENT_CONFIG | jq -r '.DistributionConfig')

# Update the configuration
UPDATED_CONFIG=$(echo $DISTRIBUTION_CONFIG | jq --arg domain "$DOMAIN" --arg cert "$CERT_ARN" '
    .Aliases = {
        "Quantity": 1,
        "Items": [$domain]
    } |
    .ViewerCertificate = {
        "ACMCertificateArn": $cert,
        "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2021"
    }
')

# Update the distribution
aws cloudfront update-distribution \
    --id $DISTRIBUTION_ID \
    --distribution-config "$UPDATED_CONFIG" \
    --if-match $ETAG

print_success "CloudFront distribution updated with custom domain"

# Step 4: Update deployment info
print_status "Step 4: Updating deployment information..."

jq --arg domain "$DOMAIN" --arg cert "$CERT_ARN" '
    .customDomain = $domain |
    .certificateArn = $cert |
    .updatedAt = now | todateiso8601
' deployment-info.json > deployment-info-temp.json && mv deployment-info-temp.json deployment-info.json

print_success "Deployment information updated"

# Step 5: Wait for CloudFront deployment
print_status "Step 5: Waiting for CloudFront distribution to be deployed (this may take 10-15 minutes)..."

aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID

print_success "🎉 CloudFront setup completed!"
echo ""
echo "📋 Next Steps - Configure DNS in Wix:"
echo "====================================="
echo ""
echo "1. Log into your Wix account"
echo "2. Go to your domain settings for instorm.io"
echo "3. Add these DNS records:"
echo ""
echo "   📝 Certificate Validation Record:"
echo "   - Name: $VALIDATION_NAME"
echo "   - Type: CNAME"
echo "   - Value: $VALIDATION_VALUE"
echo "   - TTL: 300"
echo ""
echo "   📝 Subdomain Record:"
echo "   - Name: scorecard"
echo "   - Type: CNAME"
echo "   - Value: $CLOUDFRONT_DOMAIN"
echo "   - TTL: 300"
echo ""
echo "4. Wait for DNS propagation (5-10 minutes)"
echo "5. Test your domain: https://$DOMAIN"
echo ""
echo "📊 Summary:"
echo "  - Domain: https://$DOMAIN"
echo "  - SSL Certificate: $CERT_ARN"
echo "  - CloudFront Distribution: $DISTRIBUTION_ID"
echo "  - CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo ""
echo "⏱️  Timeline:"
echo "  - Certificate validation: 5-10 minutes (after DNS record added)"
echo "  - CloudFront deployment: ✅ Complete"
echo "  - DNS propagation: 5-10 minutes (after Wix DNS update)"
echo ""
print_warning "Note: The domain won't work until you add the DNS records in Wix!"
