# 📦 Sales Scorecard Comprehensive Backup

**Date:** September 30, 2025 - 11:36 AM
**Status:** ✅ COMPLETE

---

## 📊 Backup Summary

### Total Backup Size
- **Archive:** 705 MB (compressed)
- **Uncompressed:** 2.6 GB
- **Total Files:** 210,288 files

### Backup Components

#### 1. 📊 Database Backup ✅
**Location:** `~/SalesScorecard-Backup-20250930-113603/database/`

**Tables Backed Up:**
- ✅ **users** - 21 rows (All user accounts with passwords, roles, etc.)
- ✅ **teams** - 6 rows (All teams)
- ✅ **evaluations** - 0 rows (Evaluation records)
- ✅ **regions** - 3 rows (Geographic regions)
- ✅ **user_teams** - 11 rows (User-team assignments)
- ✅ **user_regions** - 3 rows (User-region assignments)
- ✅ **_prisma_migrations** - 1 row (Database migrations)
- ✅ **Plus 7 more tables** (behavior_categories, behavior_items, evaluation_items, invites, audit_logs, etc.)

**Total Database Rows:** 45 rows

**Files:**
- `database-url.txt` - Database connection URL
- `schema-info.json` - Complete schema structure
- `<table>.json` - JSON export of each table
- `<table>.sql` - SQL INSERT statements for each table
- `BACKUP-SUMMARY.md` - Detailed backup information

**Restore Command:**
```bash
cd ~/SalesScorecard-Backup-20250930-113603/database/
# Restore each table:
psql <database-url> -f users.sql
psql <database-url> -f teams.sql
# etc...
```

---

#### 2. 🖥️ Backend Backup ✅
**Location:** `~/SalesScorecard-Backup-20250930-113603/backend/`

**What's Included:**
- ✅ **production-backend/** - Complete Node.js/Express backend code
  - `server.js` - Main API server
  - `package.json` - Dependencies
  - `Dockerfile` - Container configuration
  - `react-admin/` - Admin panel build (served by backend)
- ✅ **ecs-task-definition.json** - AWS ECS task configuration
- ✅ **ecs-service-config.json** - AWS ECS service configuration
- ✅ **env-variables.txt** - Environment variables template

**Current Configuration:**
- **AWS Region:** eu-north-1 (Stockholm)
- **ECS Cluster:** sales-scorecard-cluster
- **ECS Service:** sales-scorecard-service
- **ECR Repository:** 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api
- **Port:** 3000
- **CPU:** 256
- **Memory:** 512 MB

**Restore Command:**
```bash
cd ~/SalesScorecard-Backup-20250930-113603/backend/production-backend/
# Build Docker image
docker build --platform linux/amd64 -t sales-scorecard-api .
# Push to ECR
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin 221855463690.dkr.ecr.eu-north-1.amazonaws.com
docker tag sales-scorecard-api:latest 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest
docker push 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest
# Update ECS
aws ecs update-service --cluster sales-scorecard-cluster --service sales-scorecard-service --force-new-deployment --region eu-north-1
```

---

#### 3. 📱 PWA Backup ✅
**Location:** `~/SalesScorecard-Backup-20250930-113603/pwa/`

**What's Included:**
- ✅ **src/** - Complete React source code
  - `components/` - All React components (LoginForm, SalesApp, Notifications, etc.)
  - `contexts/` - AuthContext for authentication
  - `services/` - API service, analytics, offline service
  - `utils/` - Notification service, sync manager, etc.
  - `locales/` - EN/BG translations
  - `App.tsx` - Main app component
  - `index.tsx` - Entry point
- ✅ **public/** - Public assets
  - `icons/` - PWA icons (all sizes)
  - `manifest.json` - PWA manifest
  - `sw.js` - Service worker
  - `index.html` - HTML template
- ✅ **build/** - Production build (ready to deploy)
- ✅ **package.json** - Dependencies
- ✅ **.env** - Environment variables (API URL, VAPID keys)
- ✅ **cloudfront-config.json** - CloudFront distribution configuration
- ✅ **s3-bucket-*.json** - S3 bucket configurations

**Current Configuration:**
- **Production URL:** https://scorecard.instorm.io
- **CloudFront ID:** E1KXF36IV5EKY3
- **S3 Bucket:** sales-scorecard-pwa-1758666607
- **API URL:** https://api.instorm.io
- **VAPID Public Key:** BObSOgKLv2p6nSlc6gawMFGvyr-tL_v6x2C7A9ZSStYETKUzUA205tTuRfWh9Y1LD5rtoGY75xOaLv9fX3r-Tgc

**Restore Command:**
```bash
cd ~/SalesScorecard-Backup-20250930-113603/pwa/
# Copy source
cp -r src public package.json .env ~/SalesScorecard-PWA/
# Build
cd ~/SalesScorecard-PWA
npm install
npm run build
# Deploy
aws s3 sync build/ s3://sales-scorecard-pwa-1758666607/ --delete
aws cloudfront create-invalidation --distribution-id E1KXF36IV5EKY3 --paths "/*"
```

---

#### 4. 👤 Admin Panel Backup ✅
**Location:** `~/SalesScorecard-Backup-20250930-113603/admin-panel/`

**What's Included:**
- ✅ **react-admin/** - Production build (served by backend at `/public-admin/react-admin`)
- ✅ **src/** - Source code (if available from backup)
  - Complete React Admin interface
  - User management
  - Team management
  - RBAC implementation
- ✅ **package.json** - Dependencies (if available)

**Current Configuration:**
- **Admin URL:** https://api.instorm.io/public-admin/react-admin
- **Authentication:** JWT-based, protected by AdminGuard
- **Features:**
  - User management (Create, Edit, Delete, Deactivate)
  - Team management (Create, Edit, Delete, Assign members)
  - Role-based access control (ADMIN only)

**Restore Command:**
```bash
# Copy admin panel build to backend
cp -r ~/SalesScorecard-Backup-20250930-113603/admin-panel/react-admin/ ~/SalesScorecard-PWA/production-backend/
# Rebuild backend Docker image and deploy (see Backend restore)
```

---

## 🗂️ Backup Locations

### Local Backups
1. **Directory:** `~/SalesScorecard-Backup-20250930-113603/` (2.6 GB)
2. **Archive:** `~/SalesScorecard-Backup-20250930-113603.tar.gz` (705 MB)

### Cloud Backups
1. **S3 Bucket:** `s3://sales-scorecard-pwa-1758666607/backups/`
2. **File:** `SalesScorecard-Backup-20250930-113603.tar.gz`

---

## 🔄 How to Restore

### Complete System Restore (All Components)

```bash
# 1. Extract backup
cd ~
tar -xzf SalesScorecard-Backup-20250930-113603.tar.gz
cd SalesScorecard-Backup-20250930-113603

# 2. Restore Database
cd database
# Edit database-url.txt if needed
psql "$(cat database-url.txt)" -f users.sql
psql "$(cat database-url.txt)" -f teams.sql
psql "$(cat database-url.txt)" -f evaluations.sql
# ... restore other tables

# 3. Restore Backend
cd ../backend/production-backend
docker build --platform linux/amd64 -t sales-scorecard-api .
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin 221855463690.dkr.ecr.eu-north-1.amazonaws.com
docker tag sales-scorecard-api:latest 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest
docker push 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest
aws ecs update-service --cluster sales-scorecard-cluster --service sales-scorecard-service --force-new-deployment --region eu-north-1

# 4. Restore PWA
cd ../pwa
npm install
npm run build
aws s3 sync build/ s3://sales-scorecard-pwa-1758666607/ --delete
aws cloudfront create-invalidation --distribution-id E1KXF36IV5EKY3 --paths "/*"

# 5. Admin Panel (already included in backend)
# Admin panel is part of backend deployment
```

---

## 📝 Important Notes

### Database
- **21 users** backed up (including all admins, sales leads, salespeople)
- **6 teams** backed up
- **All passwords** are hashed with bcrypt
- **Schema** is fully documented

### Backend
- All API endpoints functional
- Admin panel integrated
- CORS configured for scorecard.instorm.io
- JWT authentication working
- Push notifications enabled

### PWA
- **Working state** with mobile login fixed
- **Language switcher** enabled (EN/BG)
- **Service workers** enabled for offline functionality
- **Push notifications** configured
- **Beautiful UI** with redesigned notifications page

### Admin Panel
- User management with delete function
- Team management
- Working on both desktop and mobile

---

## ✅ Verification Checklist

- [x] Database backup created (45 rows across 14 tables)
- [x] Backend code backed up (production-backend/)
- [x] PWA source code backed up (src/, public/, build/)
- [x] Admin panel backed up (react-admin/, src/)
- [x] ECS configurations saved
- [x] CloudFront configuration saved
- [x] S3 configuration saved
- [x] Environment variables documented
- [x] Archive created (705 MB)
- [x] S3 upload initiated
- [x] Restore instructions documented

---

## 🔐 Security

All sensitive data:
- Database credentials: AWS Secrets Manager
- JWT secrets: AWS Secrets Manager
- VAPID private key: In backup (keep secure!)
- Database URL: In backup (keep secure!)

**Keep this backup secure and private!**

---

## 📞 Support

If you need to restore from this backup, follow the instructions in this document or refer to:
- `database/BACKUP-SUMMARY.md` - Database details
- `BACKUP-INFO.md` - General backup info
- Individual README files in each directory

**Backup Created By:** AI Assistant
**Backup Script:** `create-comprehensive-backup.sh`
**Timestamp:** 20250930-113603






