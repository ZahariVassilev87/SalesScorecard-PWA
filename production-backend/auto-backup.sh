#!/bin/bash

# 📦 Automatic Daily Database Backup Script
# This script can be run manually or via cron

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load environment variables (Node.js scripts use dotenv, so we don't need to export here)
# The .env file will be loaded by Node.js scripts using require('dotenv').config()

# Database URL (use from .env or set default)
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:SalesScorecard2024!@sales-scorecard-db.cvmwi48oaptu.eu-north-1.rds.amazonaws.com:5432/sales_scorecard}"

# Backup directory
BACKUP_DIR="$SCRIPT_DIR/backups"
LOG_FILE="$BACKUP_DIR/backup.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "${BLUE}📦 Starting automatic backup...${NC}"

# Run backup script and capture output
BACKUP_OUTPUT=$(node backup-database.js 2>&1)
BACKUP_EXIT_CODE=$?

if [ $BACKUP_EXIT_CODE -eq 0 ]; then
    log "${GREEN}✅ Backup completed successfully${NC}"
    
    # Get latest backup directory
    LATEST_BACKUP=$(ls -td "$BACKUP_DIR"/backup-* 2>/dev/null | head -1)
    
    # Extract backup details from output
    BACKUP_SIZE=""
    TOTAL_ROWS=""
    TABLES_INFO=""
    
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_SIZE=$(du -sh "$LATEST_BACKUP" | cut -f1)
        log "${GREEN}📁 Latest backup: $(basename $LATEST_BACKUP) (Size: $BACKUP_SIZE)${NC}"
        
        # Try to extract total rows from summary.txt
        if [ -f "$LATEST_BACKUP/summary.txt" ]; then
            TOTAL_ROWS=$(grep "Total Rows:" "$LATEST_BACKUP/summary.txt" | awk '{print $3}' || echo "")
        fi
    fi
    
    # Cleanup old backups (keep last 30 days)
    log "${BLUE}🧹 Cleaning up old backups (keeping last 30 days)...${NC}"
    find "$BACKUP_DIR" -type d -name "backup-*" -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
    
    log "${GREEN}✅ Backup process completed${NC}"
    
    # Send success notification
    log "${BLUE}📧 Sending notification email...${NC}"
    NOTIFICATION_DETAILS=$(cat <<EOF
{
  "backupPath": "$(basename $LATEST_BACKUP)",
  "backupFullPath": "$LATEST_BACKUP",
  "backupDir": "$BACKUP_DIR",
  "backupSize": "$BACKUP_SIZE",
  "totalRows": "$TOTAL_ROWS"
}
EOF
)
    node send-backup-notification.js success "$NOTIFICATION_DETAILS" || log "${YELLOW}⚠️  Failed to send notification${NC}"
    
    exit 0
else
    log "${RED}❌ Backup failed!${NC}"
    log "${RED}Error output: $BACKUP_OUTPUT${NC}"
    
    # Send failure notification
    log "${BLUE}📧 Sending failure notification email...${NC}"
    ERROR_DETAILS=$(cat <<EOF
{
  "error": "$(echo "$BACKUP_OUTPUT" | head -5 | tr '\n' ' ')"
}
EOF
)
    node send-backup-notification.js failure "$ERROR_DETAILS" || log "${YELLOW}⚠️  Failed to send notification${NC}"
    
    exit 1
fi

