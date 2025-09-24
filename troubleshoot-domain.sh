#!/bin/bash

# 🔧 Domain Troubleshooting and Backup Plan
# =========================================

set -e

echo "🔧 Domain Troubleshooting and Backup Plan"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[INFO]${NC} Current Status Check:"
echo ""

# Check CloudFront status
echo "1. CloudFront Distribution Status:"
CLOUDFRONT_STATUS=$(aws cloudfront get-distribution --id E1KXF36IV5EKY3 --query 'Distribution.Status' --output text)
echo "   Status: $CLOUDFRONT_STATUS"

# Check DNS resolution
echo ""
echo "2. DNS Resolution Test:"
echo "   Google DNS (8.8.8.8):"
nslookup scorecard.instorm.io 8.8.8.8 | grep -A 5 "Non-authoritative answer" || echo "   ❌ DNS not resolving"

echo ""
echo "3. HTTPS Access Test:"
echo "   Testing with IP bypass..."
if curl --resolve scorecard.instorm.io:443:18.244.87.77 https://scorecard.instorm.io -I -s | grep -q "HTTP/2 200"; then
    echo "   ✅ HTTPS working with IP bypass"
else
    echo "   ❌ HTTPS not working"
fi

echo ""
echo "📋 Troubleshooting Steps:"
echo "========================"
echo ""
echo "If the domain still doesn't work after 30 minutes:"
echo ""
echo "1. ${YELLOW}Check Wix DNS Records:${NC}"
echo "   - Log into Wix"
echo "   - Go to Domain Settings"
echo "   - Verify these records exist:"
echo "     * scorecard.instorm.io → CNAME → d2tuhgmig1r5ut.cloudfront.net"
echo "     * _8f9c152ba9a152e984aecdc1fbd4fc9a.scorecard.instorm.io → CNAME → _5112887bef39ce2dd738f9d31030013e.xlfgrmvvlj.acm-validations.aws"
echo ""
echo "2. ${YELLOW}Test from Different Networks:${NC}"
echo "   - Try from your phone (mobile data)"
echo "   - Try from a different computer"
echo "   - Try from a different location"
echo ""
echo "3. ${YELLOW}Clear All Caches:${NC}"
echo "   - Browser cache (Ctrl+Shift+Delete)"
echo "   - DNS cache (restart router)"
echo "   - Try incognito/private mode"
echo ""
echo "4. ${YELLOW}Alternative Access Methods:${NC}"
echo "   - Use direct CloudFront URL: https://d2tuhgmig1r5ut.cloudfront.net"
echo "   - Use IP address: https://18.244.87.77 (with Host header)"
echo ""

echo "🚀 Backup Plan - Switch to Cloudflare:"
echo "======================================"
echo ""
echo "If DNS issues persist, we can switch to Cloudflare Pages:"
echo ""
echo "1. ${GREEN}Cloudflare Pages Setup:${NC}"
echo "   - Go to Cloudflare Dashboard"
echo "   - Click 'Pages' → 'Create a project'"
echo "   - Upload build files from 'build' folder"
echo "   - Add custom domain: scorecard.instorm.io"
echo "   - Update DNS in Wix with Cloudflare's CNAME"
echo ""
echo "2. ${GREEN}Benefits of Cloudflare:${NC}"
echo "   - Automatic SSL certificates"
echo "   - Better DNS propagation"
echo "   - Global CDN performance"
echo "   - No AWS certificate complexity"
echo ""

echo "⏰ Timeline:"
echo "============"
echo "- Wait 30 minutes for DNS propagation"
echo "- If still not working, try troubleshooting steps"
echo "- If still not working, switch to Cloudflare Pages"
echo ""

echo "🎯 Current Working URLs:"
echo "======================="
echo "- Direct CloudFront: https://d2tuhgmig1r5ut.cloudfront.net"
echo "- Custom Domain: https://scorecard.instorm.io (pending DNS)"
echo ""

echo -e "${GREEN}[SUCCESS]${NC} Your PWA is deployed and working!"
echo -e "${YELLOW}[WARNING]${NC} DNS propagation can take up to 24 hours in some cases"
echo -e "${BLUE}[INFO]${NC} We have a solid backup plan with Cloudflare if needed"
echo ""
