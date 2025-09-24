#!/bin/bash

# 🌐 Update Existing CloudFront Distribution with Custom Domain
# This script updates your existing distribution to use scorecard.instorm.io

set -e

# Configuration
DOMAIN="scorecard.instorm.io"
ROOT_DOMAIN="instorm.io"
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

echo "🌐 Updating CloudFront distribution with custom domain: $DOMAIN"
echo "=============================================================="

# Check if deployment-info.json exists
if [ ! -f "deployment-info.json" ]; then
    print_error "deployment-info.json not found. Please run deploy-aws.sh first."
    exit 1
fi

# Load deployment info
DISTRIBUTION_ID=$(jq -r '.distributionId' deployment-info.json)

if [ "$DISTRIBUTION_ID" = "null" ] || [ -z "$DISTRIBUTION_ID" ]; then
    print_error "Distribution ID not found in deployment-info.json"
    exit 1
fi

print_status "Using CloudFront Distribution: $DISTRIBUTION_ID"

# Step 1: Request SSL Certificate
print_status "Requesting SSL certificate for $DOMAIN..."

CERT_ARN=$(aws acm request-certificate \
    --domain-name $DOMAIN \
    --subject-alternative-names "www.$DOMAIN" \
    --validation-method DNS \
    --region $CERT_REGION \
    --query 'CertificateArn' \
    --output text)

print_success "SSL certificate requested: $CERT_ARN"

# Step 2: Get certificate validation records
print_status "Getting certificate validation records..."

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
echo "  Type: CNAME"

# Step 3: Find Route 53 hosted zone
print_status "Looking for Route 53 hosted zone for $ROOT_DOMAIN..."

HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='$ROOT_DOMAIN.'].Id" \
    --output text)

if [ -z "$HOSTED_ZONE_ID" ]; then
    print_error "No hosted zone found for $ROOT_DOMAIN. Please create one first."
    exit 1
fi

# Remove /hostedzone/ prefix if present
HOSTED_ZONE_ID=${HOSTED_ZONE_ID#/hostedzone/}

print_success "Found hosted zone: $HOSTED_ZONE_ID"

# Step 4: Create DNS validation record
print_status "Creating DNS validation record..."

cat > validation-record.json << EOF
{
    "Changes": [
        {
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "$VALIDATION_NAME",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [
                    {
                        "Value": "$VALIDATION_VALUE"
                    }
                ]
            }
        }
    ]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch file://validation-record.json

rm validation-record.json

print_success "DNS validation record created"

# Step 5: Wait for certificate validation
print_status "Waiting for certificate validation (this may take 5-10 minutes)..."

aws acm wait certificate-validated \
    --certificate-arn $CERT_ARN \
    --region $CERT_REGION

print_success "Certificate validated successfully!"

# Step 6: Update CloudFront distribution
print_status "Updating CloudFront distribution with custom domain..."

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

# Step 7: Create CNAME record
print_status "Creating CNAME record for $DOMAIN..."

CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.DomainName' --output text)

cat > cname-record.json << EOF
{
    "Changes": [
        {
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "$DOMAIN",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [
                    {
                        "Value": "$CLOUDFRONT_DOMAIN"
                    }
                ]
            }
        }
    ]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id $HOSTED_ZONE_ID \
    --change-batch file://cname-record.json

rm cname-record.json

print_success "CNAME record created for $DOMAIN"

# Step 8: Update deployment info
print_status "Updating deployment information..."

jq --arg domain "$DOMAIN" --arg cert "$CERT_ARN" --arg zone "$HOSTED_ZONE_ID" '
    .customDomain = $domain |
    .certificateArn = $cert |
    .hostedZoneId = $zone |
    .updatedAt = now | todateiso8601
' deployment-info.json > deployment-info-temp.json && mv deployment-info-temp.json deployment-info.json

print_success "Deployment information updated"

print_success "🎉 Custom domain setup completed!"
print_success "Your PWA will be available at: https://$DOMAIN"
print_warning "Note: It may take 10-15 minutes for CloudFront to deploy the changes."
print_warning "DNS propagation may take up to 24 hours, but usually works within a few minutes."

echo ""
echo "📋 Summary:"
echo "  - Domain: https://$DOMAIN"
echo "  - SSL Certificate: $CERT_ARN"
echo "  - CloudFront Distribution: $DISTRIBUTION_ID"
echo "  - Route 53 Hosted Zone: $HOSTED_ZONE_ID"
echo ""
echo "🔧 Next Steps:"
echo "1. Wait for CloudFront deployment to complete"
echo "2. Test the domain: https://$DOMAIN"
echo "3. Update your API CORS settings if needed"
echo ""
