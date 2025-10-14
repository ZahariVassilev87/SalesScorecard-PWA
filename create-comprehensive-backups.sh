#!/bin/bash

# Comprehensive Backup Script for SalesScorecard-PWA
# Creates frontend, backend, and database backups with timestamps

echo "🚀 Starting comprehensive backup process..."

# Create timestamp for backup naming
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="SalesScorecard-Backup-${TIMESTAMP}"

echo "📅 Timestamp: ${TIMESTAMP}"
echo "📁 Backup directory: ${BACKUP_DIR}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo "📦 Creating frontend backup..."

# Frontend backup (current directory minus backup directories and node_modules)
echo "  - Copying frontend source files..."
rsync -av --exclude='node_modules' \
           --exclude='build' \
           --exclude='SalesScorecard-Backup-*' \
           --exclude='temp-repo' \
           --exclude='.git' \
           --exclude='*.log' \
           --exclude='*.tmp' \
           ./ "${BACKUP_DIR}/frontend/"

echo "📦 Creating backend backup..."

# Backend backup
if [ -d "production-backend" ]; then
    echo "  - Copying production backend..."
    rsync -av --exclude='node_modules' \
               --exclude='SalesScorecard-Backup-*' \
               production-backend/ "${BACKUP_DIR}/backend/"
else
    echo "  - No production-backend directory found"
fi

if [ -d "local-backend" ]; then
    echo "  - Copying local backend..."
    rsync -av --exclude='node_modules' \
               --exclude='SalesScorecard-Backup-*' \
               local-backend/ "${BACKUP_DIR}/local-backend/"
else
    echo "  - No local-backend directory found"
fi

echo "📦 Creating database backup..."

# Database backup (if we have database connection info)
if [ -f ".env" ]; then
    echo "  - Creating database dump..."
    
    # Extract database connection info from .env (if available)
    if grep -q "DATABASE_URL" .env; then
        DATABASE_URL=$(grep "DATABASE_URL" .env | cut -d '=' -f2-)
        echo "  - Found DATABASE_URL in .env"
        
        # Create database dump
        pg_dump "${DATABASE_URL}" > "${BACKUP_DIR}/database_backup_${TIMESTAMP}.sql" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "  ✅ Database backup created successfully"
        else
            echo "  ⚠️  Database backup failed - check database connection"
            echo "  - This might be expected if database is not accessible from this machine"
        fi
    else
        echo "  - No DATABASE_URL found in .env"
    fi
else
    echo "  - No .env file found"
fi

echo "📦 Creating configuration backup..."

# Configuration files backup
echo "  - Copying configuration files..."
cp -f .env "${BACKUP_DIR}/" 2>/dev/null || echo "  - No .env file to copy"
cp -f package.json "${BACKUP_DIR}/" 2>/dev/null || echo "  - No package.json file to copy"
cp -f package-lock.json "${BACKUP_DIR}/" 2>/dev/null || echo "  - No package-lock.json file to copy"
cp -f tsconfig.json "${BACKUP_DIR}/" 2>/dev/null || echo "  - No tsconfig.json file to copy"
cp -f deployment-info.json "${BACKUP_DIR}/" 2>/dev/null || echo "  - No deployment-info.json file to copy"

# Copy any other important config files
for file in *.json *.md *.txt *.sh; do
    if [ -f "$file" ] && [[ "$file" != "package"* ]] && [[ "$file" != "tsconfig.json" ]]; then
        cp "$file" "${BACKUP_DIR}/" 2>/dev/null
    fi
done

echo "📦 Creating compressed archive..."

# Create compressed archive
tar -czf "${BACKUP_DIR}.tar.gz" "${BACKUP_DIR}/"
if [ $? -eq 0 ]; then
    echo "  ✅ Compressed archive created: ${BACKUP_DIR}.tar.gz"
    echo "  📊 Archive size: $(du -h "${BACKUP_DIR}.tar.gz" | cut -f1)"
    
    # Clean up uncompressed directory
    rm -rf "${BACKUP_DIR}"
    echo "  🧹 Cleaned up uncompressed directory"
else
    echo "  ❌ Failed to create compressed archive"
fi

echo "📋 Creating backup manifest..."

# Create backup manifest
cat > "${BACKUP_DIR}.tar.gz.manifest.txt" << EOF
SalesScorecard-PWA Backup Manifest
==================================

Backup Date: $(date)
Backup Timestamp: ${TIMESTAMP}
Backup File: ${BACKUP_DIR}.tar.gz

Contents:
---------
- Frontend source code (React/TypeScript)
- Backend source code (Node.js/Express)
- Database schema and data (if accessible)
- Configuration files (.env, package.json, etc.)
- Documentation and scripts

Frontend:
- React components in src/
- Translation files in src/locales/
- Build configuration
- PWA configuration

Backend:
- Production backend in backend/
- Local backend in local-backend/
- Database migrations and schemas
- API endpoints and business logic

Database:
- SQL dump file (if database was accessible)
- Schema and data backup

Configuration:
- Environment variables
- Package dependencies
- Build configurations
- Deployment settings

Restore Instructions:
---------------------
1. Extract the archive: tar -xzf ${BACKUP_DIR}.tar.gz
2. Navigate to the extracted directory
3. Install dependencies: npm install
4. Configure environment: cp .env.example .env (edit as needed)
5. Restore database: psql < database_backup_${TIMESTAMP}.sql (if available)
6. Build frontend: npm run build
7. Start backend: npm start (or use PM2/Docker as configured)

Notes:
------
- This backup was created on: $(date)
- Frontend build artifacts are not included (can be regenerated)
- Node modules are not included (can be reinstalled)
- Database backup depends on network access to production database
EOF

echo "✅ Backup completed successfully!"
echo "📁 Backup file: ${BACKUP_DIR}.tar.gz"
echo "📄 Manifest: ${BACKUP_DIR}.tar.gz.manifest.txt"
echo ""
echo "🔍 Backup contents:"
echo "  - Frontend: Complete React/TypeScript source code"
echo "  - Backend: Node.js/Express source code"
echo "  - Database: SQL dump (if accessible)"
echo "  - Config: Environment and configuration files"
echo "  - Docs: Documentation and scripts"
echo ""
echo "📦 To restore:"
echo "  1. Extract: tar -xzf ${BACKUP_DIR}.tar.gz"
echo "  2. Install: npm install"
echo "  3. Configure: edit .env file"
echo "  4. Build: npm run build"
echo ""
echo "🎉 Backup process completed!"
