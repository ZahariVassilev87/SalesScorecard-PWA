#!/bin/bash

# 🌐 Validate Certificate and Setup CloudFront
# This script validates the SSL certificate and updates CloudFront

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

echo "🌐 Validate Certificate and Setup CloudFront"
echo "==========================================="
echo ""

# Check if certificate files exist
if [ ! -f "certificate-arn.txt" ]; then
    print_error "certificate-arn.txt not found. Please run setup-wix-step-by-step.sh first."
    exit 1
fi

# Load certificate info
CERT_ARN=$(cat certificate-arn.txt)

# Load deployment info
DISTRIBUTION_ID=$(jq -r '.distributionId' deployment-info.json)
CLOUDFRONT_DOMAIN=$(jq -r '.domainName' deployment-info.json)

print_status "Using SSL Certificate: $CERT_ARN"
print_status "Using CloudFront Distribution: $DISTRIBUTION_ID"

# Step 1: Check certificate status
print_status "Step 1: Checking certificate validation status..."

CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn $CERT_ARN \
    --region $CERT_REGION \
    --query 'Certificate.Status' \
    --output text)

print_status "Certificate status: $CERT_STATUS"

if [ "$CERT_STATUS" != "ISSUED" ]; then
    print_warning "Certificate is not yet validated. Waiting for validation..."
    print_status "Waiting for certificate validation (this may take 5-10 minutes)..."
    
    aws acm wait certificate-validated \
        --certificate-arn $CERT_ARN \
        --region $CERT_REGION
    
    print_success "Certificate validated successfully!"
else
    print_success "Certificate is already validated!"
fi

# Step 2: Update CloudFront distribution
print_status "Step 2: Updating CloudFront distribution with custom domain..."

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

# Step 3: Update deployment info
print_status "Step 3: Updating deployment information..."

jq --arg domain "$DOMAIN" --arg cert "$CERT_ARN" '
    .customDomain = $domain |
    .certificateArn = $cert |
    .updatedAt = now | todateiso8601
' deployment-info.json > deployment-info-temp.json && mv deployment-info-temp.json deployment-info.json

print_success "Deployment information updated"

# Step 4: Wait for CloudFront deployment
print_status "Step 4: Waiting for CloudFront distribution to be deployed (this may take 10-15 minutes)..."

aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID

print_success "🎉 CloudFront setup completed!"
echo ""
echo "📋 Final Step - Add CNAME Record in Wix:"
echo "======================================="
echo ""
echo "1. Log into your Wix account"
echo "2. Go to your domain settings for instorm.io"
echo "3. Add this CNAME record:"
echo ""
echo "   📝 Subdomain Record:"
echo "   - Name: scorecard"
echo "   - Type: CNAME"
echo "   - Value: $CLOUDFRONT_DOMAIN"
echo "   - TTL: 300"
echo ""
echo "4. Wait 5-10 minutes for DNS propagation"
echo "5. Test your domain: https://$DOMAIN"
echo ""
echo "📊 Summary:"
echo "  - Domain: https://$DOMAIN"
echo "  - SSL Certificate: $CERT_ARN"
echo "  - CloudFront Distribution: $DISTRIBUTION_ID"
echo "  - CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo ""
echo "⏱️  Timeline:"
echo "  - Certificate validation: ✅ Complete"
echo "  - CloudFront deployment: ✅ Complete"
echo "  - DNS propagation: 5-10 minutes (after Wix DNS update)"
echo ""
print_warning "Note: The domain won't work until you add the CNAME record in Wix!"

# Clean up temporary files
rm -f certificate-arn.txt validation-name.txt validation-value.txt
