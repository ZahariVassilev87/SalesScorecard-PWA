#!/bin/bash

# 🧹 Debug Log Cleanup Script
# Removes or gates debug logging statements behind environment checks

set -e

echo "🧹 Debug Log Cleanup Script"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Count debug statements
echo "📊 Current debug log count:"
DEBUG_COUNT=$(grep -r "console.log.*DEBUG\|console.log.*MOBILE DEBUG" src/ --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
echo -e "${YELLOW}   Found ${DEBUG_COUNT} debug log statements${NC}"
echo ""

# Option 1: Show all debug statements
echo "1️⃣  Show all debug statements:"
echo ""
grep -n "console.log.*DEBUG\|console.log.*MOBILE DEBUG" src/ --include="*.ts" --include="*.tsx" | head -20
echo ""
echo -e "${YELLOW}   (Showing first 20, total: ${DEBUG_COUNT})${NC}"
echo ""

# Option 2: Ask user what to do
echo "What would you like to do?"
echo ""
echo "  1) Remove ALL debug logs (dangerous - backup recommended)"
echo "  2) Convert to conditional logs (if NODE_ENV === 'development')"
echo "  3) Just show the report (no changes)"
echo "  4) Exit"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo -e "${RED}⚠️  WARNING: This will REMOVE all debug logs!${NC}"
    read -p "Are you sure? Type 'yes' to confirm: " confirm
    if [ "$confirm" = "yes" ]; then
      echo ""
      echo "🗑️  Removing debug logs..."
      
      # Remove lines containing DEBUG logs
      find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' '/console\.log.*DEBUG/d' {} +
      
      echo -e "${GREEN}✅ Debug logs removed!${NC}"
      
      # Count remaining
      REMAINING=$(grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
      echo "📊 Remaining console.log statements: ${REMAINING}"
    else
      echo "❌ Cancelled"
    fi
    ;;
    
  2)
    echo ""
    echo "🔄 Converting to conditional logs..."
    echo -e "${YELLOW}⚠️  This is a complex operation and may require manual review${NC}"
    echo ""
    echo "Recommendation: Manually replace debug logs with:"
    echo ""
    echo "  if (process.env.NODE_ENV === 'development') {"
    echo "    console.log(...);"
    echo "  }"
    echo ""
    echo "Or create a logger utility:"
    echo ""
    echo "  // src/utils/logger.ts"
    echo "  export const logger = {"
    echo "    debug: (...args: any[]) => {"
    echo "      if (process.env.NODE_ENV === 'development') {"
    echo "        console.log(...args);"
    echo "      }"
    echo "    }"
    echo "  };"
    ;;
    
  3)
    echo ""
    echo "📋 Debug Log Report"
    echo "==================="
    echo ""
    echo "Files with most debug logs:"
    grep -r "console.log.*DEBUG" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
    echo ""
    ;;
    
  4)
    echo "👋 Exiting..."
    exit 0
    ;;
    
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "✅ Done!"
echo ""
echo "📝 Next steps:"
echo "  1. Review changes with: git diff"
echo "  2. Test the application"
echo "  3. Run linter: npm run lint"
echo "  4. Build: npm run build"
echo ""

