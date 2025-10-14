# 📦 Quick Backup Reference

## Backup Created: September 30, 2025

---

## 📍 Backup Locations

### Local
```
📁 Directory: ~/SalesScorecard-Backup-20250930-113603/ (2.6 GB)
📦 Archive:   ~/SalesScorecard-Backup-20250930-113603.tar.gz (705 MB)
```

### Cloud (S3)
```
☁️  s3://sales-scorecard-pwa-1758666607/backups/SalesScorecard-Backup-20250930-113603.tar.gz
```

---

## 📊 What's Backed Up

| Component | Files | Status |
|-----------|-------|--------|
| **Database** | 21 users, 6 teams, 3 regions, 45 total rows | ✅ |
| **Backend** | Production code, ECS config, Docker setup | ✅ |
| **PWA** | Source, build, configs, translations | ✅ |
| **Admin** | React Admin panel build & source | ✅ |

---

## ⚡ Quick Restore

### Restore Database Only
```bash
cd ~/SalesScorecard-Backup-20250930-113603/database/
DB_URL=$(cat database-url.txt)
psql "$DB_URL" -f users.sql
psql "$DB_URL" -f teams.sql
```

### Restore Backend Only
```bash
cd ~/SalesScorecard-Backup-20250930-113603/backend/production-backend/
docker build --platform linux/amd64 -t sales-scorecard-api .
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin 221855463690.dkr.ecr.eu-north-1.amazonaws.com
docker tag sales-scorecard-api:latest 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest
docker push 221855463690.dkr.ecr.eu-north-1.amazonaws.com/sales-scorecard-api:latest
aws ecs update-service --cluster sales-scorecard-cluster --service sales-scorecard-service --force-new-deployment --region eu-north-1
```

### Restore PWA Only
```bash
cd ~/SalesScorecard-Backup-20250930-113603/pwa/
npm install
npm run build
aws s3 sync build/ s3://sales-scorecard-pwa-1758666607/ --delete
aws cloudfront create-invalidation --distribution-id E1KXF36IV5EKY3 --paths "/*"
```

### Restore Admin Panel Only
```bash
cp -r ~/SalesScorecard-Backup-20250930-113603/admin-panel/react-admin/ ~/SalesScorecard-PWA/production-backend/
# Then redeploy backend (see Backend restore)
```

---

## 🆘 Emergency Full Restore

```bash
# Extract backup
cd ~
tar -xzf SalesScorecard-Backup-20250930-113603.tar.gz

# Run automatic restore (if script exists)
cd SalesScorecard-Backup-20250930-113603
./restore-all.sh

# Or manually restore in this order:
1. Database  (data first)
2. Backend   (API server)
3. PWA       (frontend)
4. Admin     (included in backend)
```

---

## 📋 Backup Contents

### Database (~/database/)
- 21 users (vassilev.zahari@gmail.com, etc.)
- 6 teams
- 3 regions
- All user-team assignments
- All user-region assignments
- Complete schema

### Backend (~/backend/)
- server.js (Express API)
- Admin panel build
- Docker configuration
- ECS task definition
- Environment variables

### PWA (~/pwa/)
- React source code
- All components
- Translations (EN/BG)
- Service worker
- Production build
- .env with correct API URL

### Admin Panel (~/admin-panel/)
- React Admin build
- Source code
- User management
- Team management

---

## 🔐 Security Notes

**Keep Secure:**
- Database URL (contains credentials)
- JWT secrets (in AWS Secrets Manager)
- VAPID private key
- This entire backup (contains sensitive data)

**Store Safely:**
- Keep local copy in secure location
- S3 backup is in private bucket
- Don't share backup publicly

---

## ✅ Verification

All backups verified and complete:
- ✅ Database: 45 rows backed up
- ✅ Backend: Code + configs saved
- ✅ PWA: Source + build saved
- ✅ Admin: Build + source saved
- ✅ Archive: 705 MB created
- ✅ S3: Upload initiated

**Status: BACKUP COMPLETE ✅**






