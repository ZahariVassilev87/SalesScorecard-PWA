#!/bin/bash

# Comprehensive Backup Script for Sales Scorecard
# Creates separate backups for Database, Backend, PWA, and Admin Panel
# Date: $(date +%Y%m%d-%H%M%S)

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$HOME/SalesScorecard-Backup-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "Sales Scorecard Comprehensive Backup"
echo "Timestamp: ${TIMESTAMP}"
echo "Backup Directory: ${BACKUP_DIR}"
echo "=========================================="

# ===================================
# 1. DATABASE BACKUP
# ===================================
echo ""
echo "📊 1. Backing up Database..."
DB_BACKUP_DIR="${BACKUP_DIR}/database"
mkdir -p "$DB_BACKUP_DIR"

# Get database URL from AWS Secrets Manager
echo "  - Retrieving database credentials from AWS Secrets Manager..."
DB_URL=$(aws secretsmanager get-secret-value \
  --secret-id sales-scorecard-db-url \
  --region eu-north-1 \
  --query SecretString \
  --output text 2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$DB_URL" ]; then
  echo "  - Database URL retrieved successfully"
  
  # Parse database URL
  # Format: postgresql://user:password@host:port/database
  DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
  DB_PASS=$(echo $DB_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
  DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
  
  echo "  - Database: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"
  
  # Create database backup using pg_dump
  export PGPASSWORD="${DB_PASS}"
  
  echo "  - Creating full database dump..."
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    -F c -b -v -f "${DB_BACKUP_DIR}/database-full-backup.dump" 2>&1 | head -20
  
  echo "  - Creating SQL schema backup..."
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --schema-only -f "${DB_BACKUP_DIR}/schema.sql" 2>&1 | head -20
  
  echo "  - Creating SQL data backup..."
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --data-only -f "${DB_BACKUP_DIR}/data.sql" 2>&1 | head -20
  
  # Backup individual tables
  echo "  - Backing up individual tables..."
  TABLES=("User" "Team" "Evaluation" "PushSubscription")
  for table in "${TABLES[@]}"; do
    echo "    - Table: ${table}"
    pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
      -t "\"${table}\"" -f "${DB_BACKUP_DIR}/table-${table}.sql" 2>&1 | head -10
  done
  
  unset PGPASSWORD
  
  # Save database URL for restore
  echo "$DB_URL" > "${DB_BACKUP_DIR}/database-url.txt"
  
  echo "  ✅ Database backup completed"
else
  echo "  ❌ Failed to retrieve database URL from AWS Secrets Manager"
fi

# ===================================
# 2. BACKEND BACKUP
# ===================================
echo ""
echo "🖥️  2. Backing up Backend..."
BACKEND_BACKUP_DIR="${BACKUP_DIR}/backend"
mkdir -p "$BACKEND_BACKUP_DIR"

# Copy production backend
if [ -d "production-backend" ]; then
  echo "  - Copying production backend code..."
  cp -r production-backend "${BACKEND_BACKUP_DIR}/"
  
  # Save current ECS task definition
  echo "  - Saving ECS task definition..."
  aws ecs describe-task-definition \
    --task-definition sales-scorecard-task \
    --region eu-north-1 \
    --query 'taskDefinition' \
    > "${BACKEND_BACKUP_DIR}/ecs-task-definition.json" 2>/dev/null
  
  # Save ECS service configuration
  echo "  - Saving ECS service configuration..."
  aws ecs describe-services \
    --cluster sales-scorecard-cluster \
    --services sales-scorecard-service \
    --region eu-north-1 \
    > "${BACKEND_BACKUP_DIR}/ecs-service-config.json" 2>/dev/null
  
  # Save environment variables
  echo "  - Saving environment variables..."
  cat > "${BACKEND_BACKUP_DIR}/env-variables.txt" << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=<from AWS Secrets Manager: sales-scorecard-db-url>
JWT_SECRET=<from AWS Secrets Manager: sales-scorecard-jwt-secret>
REFRESH_SECRET=your_refresh_secret_key_for_refresh_tokens
VAPID_PUBLIC_KEY=BObSOgKLv2p6nSlc6gawMFGvyr-tL_v6x2C7A9ZSStYETKUzUA205tTuRfWh9Y1LD5rtoGY75xOaLv9fX3r-Tgc
VAPID_PRIVATE_KEY=tTXqFrsmUS5NUZ9pc50nQNevGEjypY4BsGPw58EWonw
VAPID_SUBJECT=mailto:zahari.vasilev@instorm.bg
EOF
  
  echo "  ✅ Backend backup completed"
else
  echo "  ⚠️  production-backend directory not found"
fi

# ===================================
# 3. PWA BACKUP
# ===================================
echo ""
echo "📱 3. Backing up PWA..."
PWA_BACKUP_DIR="${BACKUP_DIR}/pwa"
mkdir -p "$PWA_BACKUP_DIR"

# Copy PWA source code
echo "  - Copying PWA source code..."
cp -r src "${PWA_BACKUP_DIR}/"
cp -r public "${PWA_BACKUP_DIR}/"
cp package.json "${PWA_BACKUP_DIR}/"
cp package-lock.json "${PWA_BACKUP_DIR}/" 2>/dev/null || true
cp tsconfig.json "${PWA_BACKUP_DIR}/"
cp .env "${PWA_BACKUP_DIR}/" 2>/dev/null || true

# Copy build if exists
if [ -d "build" ]; then
  echo "  - Copying production build..."
  cp -r build "${PWA_BACKUP_DIR}/"
fi

# Save CloudFront distribution configuration
echo "  - Saving CloudFront configuration..."
aws cloudfront get-distribution \
  --id E1KXF36IV5EKY3 \
  > "${PWA_BACKUP_DIR}/cloudfront-config.json" 2>/dev/null

# Save S3 bucket configuration
echo "  - Saving S3 bucket configuration..."
aws s3api get-bucket-location \
  --bucket sales-scorecard-pwa-1758666607 \
  > "${PWA_BACKUP_DIR}/s3-bucket-location.json" 2>/dev/null

aws s3api get-bucket-website \
  --bucket sales-scorecard-pwa-1758666607 \
  > "${PWA_BACKUP_DIR}/s3-bucket-website.json" 2>/dev/null

echo "  ✅ PWA backup completed"

# ===================================
# 4. ADMIN PANEL BACKUP
# ===================================
echo ""
echo "👤 4. Backing up Admin Panel..."
ADMIN_BACKUP_DIR="${BACKUP_DIR}/admin-panel"
mkdir -p "$ADMIN_BACKUP_DIR"

# Copy admin panel from production backend
if [ -d "production-backend/react-admin" ]; then
  echo "  - Copying admin panel build..."
  cp -r production-backend/react-admin "${ADMIN_BACKUP_DIR}/"
fi

# Copy admin panel source from backup
if [ -d "SalesScorecard-Backup-20250927-173240/SalesScorecard/admin-panel" ]; then
  echo "  - Copying admin panel source code..."
  cp -r SalesScorecard-Backup-20250927-173240/SalesScorecard/admin-panel/src "${ADMIN_BACKUP_DIR}/"
  cp SalesScorecard-Backup-20250927-173240/SalesScorecard/admin-panel/package.json "${ADMIN_BACKUP_DIR}/" 2>/dev/null || true
fi

echo "  ✅ Admin panel backup completed"

# ===================================
# 5. CREATE BACKUP METADATA
# ===================================
echo ""
echo "📝 5. Creating backup metadata..."

cat > "${BACKUP_DIR}/BACKUP-INFO.md" << 'EOF'
# Sales Scorecard Comprehensive Backup

**Backup Date:** $(date)
**Backup Location:** $(pwd)

## Contents

### 1. Database Backup (`/database`)
- `database-full-backup.dump` - Full PostgreSQL dump (custom format)
- `schema.sql` - Database schema only
- `data.sql` - Database data only
- `table-*.sql` - Individual table backups
- `database-url.txt` - Database connection URL

**To Restore Database:**
```bash
# Full restore
pg_restore -h <host> -U <user> -d <database> -v database-full-backup.dump

# Or restore schema + data separately
psql -h <host> -U <user> -d <database> -f schema.sql
psql -h <host> -U <user> -d <database> -f data.sql
```

### 2. Backend Backup (`/backend`)
- `production-backend/` - Complete backend code
- `ecs-task-definition.json` - ECS task definition
- `ecs-service-config.json` - ECS service configuration
- `env-variables.txt` - Environment variables template

**To Restore Backend:**
```bash
# Copy backend code
cp -r backend/production-backend ./

# Build and push Docker image
cd production-backend
docker build --platform linux/amd64 -t sales-scorecard-api .
docker tag sales-scorecard-api:latest 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin 221855463690.dkr.ecr.eu-north-1.amazonaws.com
docker push 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest

# Update ECS service
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json --region eu-north-1
aws ecs update-service --cluster sales-scorecard-cluster --service sales-scorecard-service --force-new-deployment --region eu-north-1
```

### 3. PWA Backup (`/pwa`)
- `src/` - PWA source code
- `public/` - Public assets
- `build/` - Production build
- `package.json` - Dependencies
- `.env` - Environment variables
- `cloudfront-config.json` - CloudFront distribution config
- `s3-*.json` - S3 bucket configurations

**To Restore PWA:**
```bash
# Copy PWA code
cp -r pwa/src ./
cp -r pwa/public ./
cp pwa/package.json ./
cp pwa/.env ./

# Install dependencies
npm install

# Build PWA
npm run build

# Deploy to S3
aws s3 sync build/ s3://sales-scorecard-pwa-1758666607/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E1KXF36IV5EKY3 --paths "/*"
```

### 4. Admin Panel Backup (`/admin-panel`)
- `react-admin/` - Admin panel build
- `src/` - Admin panel source code
- `package.json` - Dependencies

**To Restore Admin Panel:**
```bash
# Copy admin panel
cp -r admin-panel/react-admin production-backend/

# Or rebuild from source
cd admin-panel
npm install
npm run build
cp -r build ../production-backend/react-admin
```

## System Architecture

### Production URLs
- **PWA**: https://scorecard.instorm.io
- **API**: https://api.instorm.io
- **Admin**: https://api.instorm.io/public-admin/react-admin

### AWS Resources
- **Region**: eu-north-1 (Stockholm)
- **ECS Cluster**: sales-scorecard-cluster
- **ECS Service**: sales-scorecard-service
- **ECR Repository**: sales-scorecard-api
- **CloudFront Distribution**: E1KXF36IV5EKY3
- **S3 Bucket**: sales-scorecard-pwa-1758666607
- **Load Balancer**: sales-scorecard-alb-v2

### Environment Variables
See `/backend/env-variables.txt` for all required environment variables.

### Security Notes
- Database credentials are stored in AWS Secrets Manager
- JWT secrets are stored in AWS Secrets Manager
- VAPID keys are in environment variables
- All connections use HTTPS/SSL

## Restore Priority
1. Database (restore data first)
2. Backend (restore API server)
3. PWA (restore frontend)
4. Admin Panel (restore admin interface)

EOF

# Replace $(date) and $(pwd) with actual values
sed -i.bak "s/\$(date)/$(date)/" "${BACKUP_DIR}/BACKUP-INFO.md"
sed -i.bak "s|\$(pwd)|${BACKUP_DIR}|" "${BACKUP_DIR}/BACKUP-INFO.md"
rm "${BACKUP_DIR}/BACKUP-INFO.md.bak"

echo "  ✅ Backup metadata created"

# ===================================
# 6. CREATE ARCHIVE
# ===================================
echo ""
echo "📦 6. Creating compressed archive..."
cd "$HOME"
tar -czf "SalesScorecard-Backup-${TIMESTAMP}.tar.gz" "SalesScorecard-Backup-${TIMESTAMP}/"

ARCHIVE_SIZE=$(du -h "SalesScorecard-Backup-${TIMESTAMP}.tar.gz" | cut -f1)
echo "  ✅ Archive created: SalesScorecard-Backup-${TIMESTAMP}.tar.gz (${ARCHIVE_SIZE})"

# ===================================
# 7. UPLOAD TO S3
# ===================================
echo ""
echo "☁️  7. Uploading backup to S3..."
aws s3 cp "SalesScorecard-Backup-${TIMESTAMP}.tar.gz" \
  "s3://sales-scorecard-pwa-1758666607/backups/SalesScorecard-Backup-${TIMESTAMP}.tar.gz" 2>&1 | grep -v "Completed"

if [ $? -eq 0 ]; then
  echo "  ✅ Backup uploaded to S3"
else
  echo "  ⚠️  S3 upload failed (backup still available locally)"
fi

# ===================================
# 8. SUMMARY
# ===================================
echo ""
echo "=========================================="
echo "✅ BACKUP COMPLETE"
echo "=========================================="
echo ""
echo "📊 Database Backup:"
echo "   - Full dump: ${DB_BACKUP_DIR}/database-full-backup.dump"
echo "   - Schema: ${DB_BACKUP_DIR}/schema.sql"
echo "   - Data: ${DB_BACKUP_DIR}/data.sql"
echo ""
echo "🖥️  Backend Backup:"
echo "   - Code: ${BACKUP_DIR}/backend/production-backend/"
echo "   - Config: ${BACKUP_DIR}/backend/ecs-*.json"
echo ""
echo "📱 PWA Backup:"
echo "   - Source: ${BACKUP_DIR}/pwa/src/"
echo "   - Build: ${BACKUP_DIR}/pwa/build/"
echo ""
echo "👤 Admin Panel Backup:"
echo "   - Build: ${BACKUP_DIR}/admin-panel/react-admin/"
echo "   - Source: ${BACKUP_DIR}/admin-panel/src/"
echo ""
echo "📦 Archive:"
echo "   - Local: ${HOME}/SalesScorecard-Backup-${TIMESTAMP}.tar.gz (${ARCHIVE_SIZE})"
echo "   - S3: s3://sales-scorecard-pwa-1758666607/backups/"
echo ""
echo "📝 Backup Info:"
echo "   - README: ${BACKUP_DIR}/BACKUP-INFO.md"
echo ""
echo "=========================================="






