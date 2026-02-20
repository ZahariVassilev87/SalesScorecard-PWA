#!/bin/bash

# 🔧 Setup Daily Automatic Backups
# This script sets up cron job for daily backups

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_SCRIPT="$SCRIPT_DIR/auto-backup.sh"

echo -e "${BLUE}🔧 Setting up daily automatic backups...${NC}"
echo ""

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Check if cron job already exists
# Backup at 23:00 (11 PM) every day
CRON_JOB="0 23 * * * cd $SCRIPT_DIR && $BACKUP_SCRIPT >> $SCRIPT_DIR/backups/backup.log 2>&1"

if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo -e "${YELLOW}⚠️  Cron job already exists!${NC}"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep "$BACKUP_SCRIPT" || true
    echo ""
    read -p "Do you want to replace it? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove existing cron job
        crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
        echo -e "${BLUE}✅ Removed existing cron job${NC}"
    else
        echo -e "${YELLOW}Keeping existing cron job${NC}"
        exit 0
    fi
fi

# Add new cron job (runs daily at 23:00 / 11 PM)
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}✅ Daily backup cron job added!${NC}"
echo ""
echo -e "${BLUE}📋 Backup Schedule:${NC}"
echo "   Time: Every day at 23:00 (11:00 PM)"
echo "   Script: $BACKUP_SCRIPT"
echo "   Logs: $SCRIPT_DIR/backups/backup.log"
echo "   Notifications: Email will be sent after each backup"
echo ""
echo -e "${BLUE}📝 Current cron jobs:${NC}"
crontab -l | grep "$BACKUP_SCRIPT" || true
echo ""
echo -e "${GREEN}✅ Setup completed!${NC}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • View logs: tail -f $SCRIPT_DIR/backups/backup.log"
echo "   • Test backup: $BACKUP_SCRIPT"
echo "   • Remove cron job: crontab -e (then delete the line)"
echo "   • List all cron jobs: crontab -l"

