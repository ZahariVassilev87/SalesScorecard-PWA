#!/bin/bash

# COMPREHENSIVE BACKEND BACKUP SCRIPT
# Creates a complete backup of backend (code, structure, configuration, data, everything)
# Date: 2025-10-01-040444

TIMESTAMP="20251001-040444"
BACKUP_DIR="backups/backend"

echo "🚀 Starting comprehensive backend backup..."
echo "📅 Timestamp: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup main backend files
echo "🔧 Backing up main backend files..."
if [ -d "production-backend" ]; then
    cp -r production-backend "$BACKUP_DIR/production-backend-${TIMESTAMP}"
    echo "✅ Production backend files backed up"
else
    echo "❌ Production backend directory not found"
fi

# Backup local backend
echo "💻 Backing up local backend..."
if [ -d "local-backend" ]; then
    cp -r local-backend "$BACKUP_DIR/local-backend-${TIMESTAMP}"
    echo "✅ Local backend files backed up"
else
    echo "❌ Local backend directory not found"
fi

# Backup backend configuration files
echo "⚙️  Backing up backend configuration..."
mkdir -p "$BACKUP_DIR/config-${TIMESTAMP}"

# Copy backend-related config files
cp production-backend/Dockerfile "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ Dockerfile not found"
cp production-backend/package.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ package.json not found"
cp production-backend/package-lock.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ package-lock.json not found"

# Copy deployment configurations
cp current-task-def.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ current-task-def.json not found"
cp new-task-def.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ new-task-def.json not found"
cp updated-config.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ updated-config.json not found"

# Backup deployment scripts
echo "🚀 Backing up deployment scripts..."
mkdir -p "$BACKUP_DIR/scripts-${TIMESTAMP}"
cp deploy-backend.sh "$BACKUP_DIR/scripts-${TIMESTAMP}/" 2>/dev/null || echo "❌ deploy-backend.sh not found"
cp deploy-aws.sh "$BACKUP_DIR/scripts-${TIMESTAMP}/" 2>/dev/null || echo "❌ deploy-aws.sh not found"
cp update-aws.sh "$BACKUP_DIR/scripts-${TIMESTAMP}/" 2>/dev/null || echo "❌ update-aws.sh not found"

# Backup backend-related utility files
echo "🛠️  Backing up backend utilities..."
mkdir -p "$BACKUP_DIR/utils-${TIMESTAMP}"
cp backend-server.js "$BACKUP_DIR/utils-${TIMESTAMP}/" 2>/dev/null || echo "❌ backend-server.js not found"
cp backend-refresh-token-example.js "$BACKUP_DIR/utils-${TIMESTAMP}/" 2>/dev/null || echo "❌ backend-refresh-token-example.js not found"
cp local-backend-server.js "$BACKUP_DIR/utils-${TIMESTAMP}/" 2>/dev/null || echo "❌ local-backend-server.js not found"

# Backup package files
echo "📦 Backing up package files..."
mkdir -p "$BACKUP_DIR/packages-${TIMESTAMP}"
cp package-backend.json "$BACKUP_DIR/packages-${TIMESTAMP}/" 2>/dev/null || echo "❌ package-backend.json not found"
cp package-backend-refresh.json "$BACKUP_DIR/packages-${TIMESTAMP}/" 2>/dev/null || echo "❌ package-backend-refresh.json not found"
cp package-local-backend.json "$BACKUP_DIR/packages-${TIMESTAMP}/" 2>/dev/null || echo "❌ package-local-backend.json not found"

# Backup SQL files
echo "🗄️  Backing up SQL files..."
mkdir -p "$BACKUP_DIR/sql-${TIMESTAMP}"
cp *.sql "$BACKUP_DIR/sql-${TIMESTAMP}/" 2>/dev/null || echo "❌ SQL files not found"

# Backup environment and certificate files
echo "🔐 Backing up environment and certificate files..."
mkdir -p "$BACKUP_DIR/env-${TIMESTAMP}"
cp certificate-arn.txt "$BACKUP_DIR/env-${TIMESTAMP}/" 2>/dev/null || echo "❌ certificate-arn.txt not found"
cp validation-name.txt "$BACKUP_DIR/env-${TIMESTAMP}/" 2>/dev/null || echo "❌ validation-name.txt not found"
cp validation-value.txt "$BACKUP_DIR/env-${TIMESTAMP}/" 2>/dev/null || echo "❌ validation-value.txt not found"

# Create backend backup manifest
echo "📋 Creating backend backup manifest..."
cat > "$BACKUP_DIR/backend-manifest-${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "backup_type": "backend_comprehensive",
  "version": "1.0.0",
  "components": {
    "production_backend": {
      "backup_path": "production-backend-${TIMESTAMP}",
      "description": "Production backend application files"
    },
    "local_backend": {
      "backup_path": "local-backend-${TIMESTAMP}",
      "description": "Local development backend files"
    },
    "configuration": {
      "backup_path": "config-${TIMESTAMP}",
      "description": "Backend configuration files"
    },
    "scripts": {
      "backup_path": "scripts-${TIMESTAMP}",
      "description": "Deployment and setup scripts"
    },
    "utilities": {
      "backup_path": "utils-${TIMESTAMP}",
      "description": "Backend utility files"
    },
    "packages": {
      "backup_path": "packages-${TIMESTAMP}",
      "description": "Package configuration files"
    },
    "sql": {
      "backup_path": "sql-${TIMESTAMP}",
      "description": "SQL scripts and migrations"
    },
    "environment": {
      "backup_path": "env-${TIMESTAMP}",
      "description": "Environment and certificate files"
    }
  },
  "key_files": [
    "production-backend/server.js",
    "production-backend/package.json",
    "production-backend/Dockerfile",
    "current-task-def.json",
    "new-task-def.json"
  ],
  "features_included": [
    "Node.js Express server",
    "PostgreSQL database integration",
    "JWT authentication",
    "RESTful API endpoints",
    "Docker containerization",
    "AWS ECS deployment",
    "Database migrations",
    "Environment configuration",
    "Refresh token system",
    "Admin panel backend",
    "Evaluation system backend",
    "Team management backend"
  ],
  "restore_instructions": [
    "1. Copy production-backend-${TIMESTAMP} to production-backend",
    "2. Copy local-backend-${TIMESTAMP} to local-backend",
    "3. Copy config-${TIMESTAMP} contents to project root",
    "4. Copy scripts-${TIMESTAMP} contents to project root",
    "5. Copy utils-${TIMESTAMP} contents to project root",
    "6. Copy packages-${TIMESTAMP} contents to project root",
    "7. Copy sql-${TIMESTAMP} contents to project root",
    "8. Copy env-${TIMESTAMP} contents to project root",
    "9. Run: cd production-backend && npm install",
    "10. Rebuild and redeploy Docker image"
  ]
}
EOF

# Create restore script
echo "📜 Creating restore script..."
cat > "$BACKUP_DIR/restore-backend-${TIMESTAMP}.sh" << 'EOF'
#!/bin/bash

# BACKEND RESTORE SCRIPT
# Restores backend from backup files

TIMESTAMP="20251001-040444"
BACKUP_DIR="backups/backend"

echo "🔄 Starting backend restore..."

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# Restore production backend
if [ -d "$BACKUP_DIR/production-backend-$TIMESTAMP" ]; then
    echo "🔧 Restoring production backend..."
    rm -rf production-backend
    cp -r "$BACKUP_DIR/production-backend-$TIMESTAMP" production-backend
    echo "✅ Production backend restored"
else
    echo "❌ Production backend backup not found"
fi

# Restore local backend
if [ -d "$BACKUP_DIR/local-backend-$TIMESTAMP" ]; then
    echo "💻 Restoring local backend..."
    rm -rf local-backend
    cp -r "$BACKUP_DIR/local-backend-$TIMESTAMP" local-backend
    echo "✅ Local backend restored"
else
    echo "❌ Local backend backup not found"
fi

# Restore configuration files
if [ -d "$BACKUP_DIR/config-$TIMESTAMP" ]; then
    echo "⚙️  Restoring configuration files..."
    cp "$BACKUP_DIR/config-$TIMESTAMP"/* .
    echo "✅ Configuration files restored"
fi

# Restore scripts
if [ -d "$BACKUP_DIR/scripts-$TIMESTAMP" ]; then
    echo "🚀 Restoring scripts..."
    cp "$BACKUP_DIR/scripts-$TIMESTAMP"/* .
    echo "✅ Scripts restored"
fi

# Restore utilities
if [ -d "$BACKUP_DIR/utils-$TIMESTAMP" ]; then
    echo "🛠️  Restoring utilities..."
    cp "$BACKUP_DIR/utils-$TIMESTAMP"/* .
    echo "✅ Utilities restored"
fi

# Restore packages
if [ -d "$BACKUP_DIR/packages-$TIMESTAMP" ]; then
    echo "📦 Restoring packages..."
    cp "$BACKUP_DIR/packages-$TIMESTAMP"/* .
    echo "✅ Packages restored"
fi

# Restore SQL files
if [ -d "$BACKUP_DIR/sql-$TIMESTAMP" ]; then
    echo "🗄️  Restoring SQL files..."
    cp "$BACKUP_DIR/sql-$TIMESTAMP"/* .
    echo "✅ SQL files restored"
fi

# Restore environment files
if [ -d "$BACKUP_DIR/env-$TIMESTAMP" ]; then
    echo "🔐 Restoring environment files..."
    cp "$BACKUP_DIR/env-$TIMESTAMP"/* .
    echo "✅ Environment files restored"
fi

echo "🎉 Backend restore completed!"
echo "📝 Next steps:"
echo "   1. Run: cd production-backend && npm install"
echo "   2. Rebuild Docker image"
echo "   3. Redeploy to AWS ECS"
EOF

chmod +x "$BACKUP_DIR/restore-backend-${TIMESTAMP}.sh"

# Create compressed archive
echo "📦 Creating compressed archive..."
cd backups
tar -czf "backend-backup-${TIMESTAMP}.tar.gz" backend/
echo "✅ Compressed archive created: backend-backup-${TIMESTAMP}.tar.gz"
cd ..

echo "🎉 Backend backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
echo "📦 Archive: backups/backend-backup-${TIMESTAMP}.tar.gz"
