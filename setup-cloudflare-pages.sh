#!/bin/bash

# 🌐 Cloudflare Pages Setup for PWA Subdomain Only
# ================================================

set -e

echo "🌐 Cloudflare Pages Setup for PWA Subdomain"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[INFO]${NC} This setup will ONLY affect scorecard.instorm.io"
echo -e "${BLUE}[INFO]${NC} Your main instorm.io website on Wix will remain unchanged"
echo ""

echo "📋 Cloudflare Pages Setup Steps:"
echo "================================"
echo ""
echo "1. Go to Cloudflare Dashboard"
echo "2. Click 'Pages' in the sidebar"
echo "3. Click 'Create a project'"
echo "4. Choose 'Upload assets' (not Git integration)"
echo "5. Give it a name like 'sales-scorecard-pwa'"
echo ""
echo "📁 Prepare your files:"
echo "======================"
echo "First, build your PWA:"
echo "npm run build"
echo ""
echo "Then upload these files from the 'build' folder:"
echo "- index.html"
echo "- manifest.json" 
echo "- sw.js"
echo "- static/ folder (entire folder)"
echo "- icons/ folder (entire folder)"
echo ""
echo "🌐 Custom Domain Setup:"
echo "======================="
echo "1. After uploading, go to 'Custom domains'"
echo "2. Add custom domain: scorecard.instorm.io"
echo "3. Cloudflare will provide DNS instructions"
echo ""
echo "📝 DNS Records to Add in Wix:"
echo "============================="
echo "Remove these existing records:"
echo "- _8f9c152ba9a152e984aecdc1fbd4fc9a.scorecard.instorm.io"
echo "- scorecard.instorm.io → d2tuhgmig1r5ut.cloudfront.net"
echo ""
echo "Add this new record (Cloudflare will provide the exact value):"
echo "- scorecard.instorm.io → CNAME → [Cloudflare Pages domain]"
echo ""
echo "✅ Benefits:"
echo "============"
echo "- Automatic SSL certificates"
echo "- Global CDN performance"
echo "- No interference with main website"
echo "- No nameserver changes needed"
echo "- Free tier available"
echo ""
echo "🎯 This approach keeps your main instorm.io on Wix unchanged!"
echo ""
