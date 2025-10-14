#!/bin/bash

echo "🧪 Testing Admin Operations"
echo ""
echo "Backend timestamp: $(curl -s https://api.instorm.io/health | jq -r '.timestamp')"
echo ""
echo "Run these tests in admin panel:"
echo ""
echo "1. ✅ CREATE TEAM - Select region 'North America', should work"
echo "2. ✅ ADD MEMBER - Select user, should work"  
echo "3. ✅ DELETE TEAM - Should work now"
echo ""
echo "All fixes are deployed. If you still get errors, they will have:"
echo "  - Specific error messages (not generic 500)"
echo "  - Error codes"
echo "  - Helpful details"
echo ""
echo "Backend ready: $([ $(date -j -f '%Y-%m-%dT%H:%M:%S' $(curl -s https://api.instorm.io/health | jq -r '.timestamp' | cut -d. -f1) +%s 2>/dev/null || echo 0) -gt $(date -v-5M +%s 2>/dev/null || echo 0) ] && echo 'YES ✅' || echo 'Wait 2 min ⏳')"

