#!/bin/bash

# 🌐 Cloudflare Setup for Sales Scorecard PWA
# ===========================================

set -e

echo "🌐 Cloudflare Setup for Sales Scorecard PWA"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if deployment info exists
if [ ! -f "deployment-info.json" ]; then
    echo -e "${RED}[ERROR]${NC} deployment-info.json not found. Please run deploy-aws.sh first."
    exit 1
fi

# Read deployment info
BUCKET_NAME=$(jq -r '.bucketName' deployment-info.json)
CLOUDFRONT_DOMAIN=$(jq -r '.domainName' deployment-info.json)
REGION=$(jq -r '.region' deployment-info.json)

echo -e "${BLUE}[INFO]${NC} Current AWS Setup:"
echo "  - S3 Bucket: $BUCKET_NAME"
echo "  - CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "  - Region: $REGION"
echo ""

echo -e "${YELLOW}[WARNING]${NC} This script will help you set up Cloudflare for your PWA."
echo "You have two options:"
echo ""
echo "1. ${GREEN}Cloudflare CDN${NC} - Point Cloudflare to your existing S3 bucket"
echo "2. ${GREEN}Cloudflare Pages${NC} - Deploy directly to Cloudflare Pages"
echo ""

read -p "Choose option (1 or 2): " OPTION

case $OPTION in
    1)
        echo ""
        echo -e "${BLUE}[INFO]${NC} Setting up Cloudflare CDN..."
        echo ""
        echo "📋 Cloudflare CDN Setup Steps:"
        echo "=============================="
        echo ""
        echo "1. Log into your Cloudflare dashboard"
        echo "2. Add a new site: scorecard.instorm.io"
        echo "3. Choose 'Free' plan"
        echo "4. Update your DNS records in Wix:"
        echo ""
        echo "   ${GREEN}Remove these records:${NC}"
        echo "   - _8f9c152ba9a152e984aecdc1fbd4fc9a.scorecard.instorm.io"
        echo "   - scorecard.instorm.io → d2tuhgmig1r5ut.cloudfront.net"
        echo ""
        echo "   ${GREEN}Add this record:${NC}"
        echo "   - scorecard.instorm.io → CNAME → [Cloudflare will provide this]"
        echo ""
        echo "5. In Cloudflare, go to 'DNS' tab and add:"
        echo "   - Type: CNAME"
        echo "   - Name: scorecard"
        echo "   - Target: $CLOUDFRONT_DOMAIN"
        echo "   - Proxy status: Proxied (orange cloud)"
        echo ""
        echo "6. Go to 'SSL/TLS' tab and set:"
        echo "   - Encryption mode: Full (strict)"
        echo ""
        echo "7. Go to 'Page Rules' and add:"
        echo "   - URL: scorecard.instorm.io/*"
        echo "   - Settings: Cache Level = Cache Everything"
        echo ""
        ;;
    2)
        echo ""
        echo -e "${BLUE}[INFO]${NC} Setting up Cloudflare Pages..."
        echo ""
        echo "📋 Cloudflare Pages Setup Steps:"
        echo "================================"
        echo ""
        echo "1. Log into your Cloudflare dashboard"
        echo "2. Go to 'Pages' in the sidebar"
        echo "3. Click 'Create a project'"
        echo "4. Choose 'Upload assets'"
        echo "5. Upload your build folder contents"
        echo "6. Set custom domain: scorecard.instorm.io"
        echo ""
        echo "📁 Files to upload:"
        echo "==================="
        echo "Upload all files from your 'build' folder:"
        echo "- index.html"
        echo "- manifest.json"
        echo "- sw.js"
        echo "- static/ folder"
        echo "- icons/ folder"
        echo ""
        echo "🔧 Build the project first:"
        echo "npm run build"
        echo ""
        ;;
    *)
        echo -e "${RED}[ERROR]${NC} Invalid option. Please choose 1 or 2."
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}[SUCCESS]${NC} Setup instructions provided!"
echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. Follow the steps above"
echo "2. Test access to scorecard.instorm.io"
echo "3. Verify SSL certificate is working"
echo ""
echo "💡 Benefits of Cloudflare:"
echo "- Automatic SSL certificates"
echo "- Global CDN for better performance"
echo "- DDoS protection"
echo "- Easy DNS management"
echo "- Consistent with your existing setup"
echo ""
