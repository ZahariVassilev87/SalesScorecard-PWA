#!/bin/bash

# 🌐 Route 53 Hosted Zone Setup for instorm.io
# This script creates a hosted zone for your domain

set -e

# Configuration
ROOT_DOMAIN="instorm.io"
REGION="us-east-1"

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

echo "🌐 Setting up Route 53 hosted zone for $ROOT_DOMAIN"
echo "=================================================="

# Check if hosted zone already exists
print_status "Checking for existing hosted zone..."

EXISTING_ZONE=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='$ROOT_DOMAIN.'].Id" \
    --output text)

if [ ! -z "$EXISTING_ZONE" ]; then
    print_success "Hosted zone already exists: $EXISTING_ZONE"
    HOSTED_ZONE_ID=${EXISTING_ZONE#/hostedzone/}
    echo "Hosted Zone ID: $HOSTED_ZONE_ID"
    exit 0
fi

# Create hosted zone
print_status "Creating hosted zone for $ROOT_DOMAIN..."

CALLER_REFERENCE="instorm-io-$(date +%s)"

HOSTED_ZONE_OUTPUT=$(aws route53 create-hosted-zone \
    --name $ROOT_DOMAIN \
    --caller-reference $CALLER_REFERENCE)

HOSTED_ZONE_ID=$(echo $HOSTED_ZONE_OUTPUT | jq -r '.HostedZone.Id')
NAME_SERVERS=$(echo $HOSTED_ZONE_OUTPUT | jq -r '.DelegationSet.NameServers[]')

# Remove /hostedzone/ prefix
HOSTED_ZONE_ID=${HOSTED_ZONE_ID#/hostedzone/}

print_success "Hosted zone created successfully!"
print_success "Hosted Zone ID: $HOSTED_ZONE_ID"

echo ""
echo "📋 IMPORTANT: DNS Configuration Required"
echo "========================================"
echo ""
echo "You need to update your domain registrar with these name servers:"
echo ""

for ns in $NAME_SERVERS; do
    echo "  - $ns"
done

echo ""
echo "🔧 Next Steps:"
echo "1. Log into your domain registrar (where you bought instorm.io)"
echo "2. Update the name servers to the ones listed above"
echo "3. Wait for DNS propagation (usually 5-60 minutes)"
echo "4. Run the custom domain setup script: ./update-domain.sh"
echo ""
echo "⚠️  Note: The domain won't work until you update the name servers!"
echo ""
echo "📁 Hosted Zone ID saved for future use: $HOSTED_ZONE_ID"

# Save the hosted zone ID for future use
echo "$HOSTED_ZONE_ID" > hosted-zone-id.txt

print_success "Setup complete! Remember to update your domain registrar."
