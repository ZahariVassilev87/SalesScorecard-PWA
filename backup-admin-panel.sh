#!/bin/bash

# COMPREHENSIVE ADMIN PANEL BACKUP SCRIPT
# Creates a complete backup of admin panel (code, structure, CSS, files, everything)
# Date: 2025-10-01-040444

TIMESTAMP="20251001-040444"
BACKUP_DIR="backups/admin-panel"
ADMIN_SOURCE="production-backend/public/react-admin"
ADMIN_ADMIN_PANEL="production-backend/production-backend/admin-panel"

echo "🚀 Starting comprehensive admin panel backup..."
echo "📅 Timestamp: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup main admin panel files
echo "📁 Backing up admin panel files..."
if [ -d "$ADMIN_SOURCE" ]; then
    cp -r "$ADMIN_SOURCE" "$BACKUP_DIR/react-admin-${TIMESTAMP}"
    echo "✅ React admin files backed up"
else
    echo "❌ React admin directory not found: $ADMIN_SOURCE"
fi

if [ -d "$ADMIN_ADMIN_PANEL" ]; then
    cp -r "$ADMIN_ADMIN_PANEL" "$BACKUP_DIR/admin-panel-${TIMESTAMP}"
    echo "✅ Admin panel files backed up"
else
    echo "❌ Admin panel directory not found: $ADMIN_ADMIN_PANEL"
fi

# Backup admin-related backend files
echo "🔧 Backing up admin backend files..."
mkdir -p "$BACKUP_DIR/backend-${TIMESTAMP}"

# Copy admin-related server files
cp production-backend/server.js "$BACKUP_DIR/backend-${TIMESTAMP}/" 2>/dev/null || echo "❌ server.js not found"
cp production-backend/package.json "$BACKUP_DIR/backend-${TIMESTAMP}/" 2>/dev/null || echo "❌ package.json not found"

# Copy admin-specific files
find production-backend -name "*admin*" -type f | while read file; do
    relative_path=${file#production-backend/}
    mkdir -p "$BACKUP_DIR/backend-${TIMESTAMP}/$(dirname "$relative_path")"
    cp "$file" "$BACKUP_DIR/backend-${TIMESTAMP}/$relative_path"
done

# Backup admin configuration files
echo "⚙️  Backing up admin configuration..."
cp production-backend/Dockerfile "$BACKUP_DIR/backend-${TIMESTAMP}/" 2>/dev/null || echo "❌ Dockerfile not found"

# Create admin backup manifest
echo "📋 Creating admin backup manifest..."
cat > "$BACKUP_DIR/admin-manifest-${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "backup_type": "admin_panel_comprehensive",
  "version": "1.0.0",
  "components": {
    "react_admin": {
      "source": "$ADMIN_SOURCE",
      "backup_path": "react-admin-${TIMESTAMP}",
      "description": "React Admin frontend files"
    },
    "admin_panel": {
      "source": "$ADMIN_ADMIN_PANEL",
      "backup_path": "admin-panel-${TIMESTAMP}",
      "description": "Admin panel application files"
    },
    "backend": {
      "source": "production-backend",
      "backup_path": "backend-${TIMESTAMP}",
      "description": "Backend server and admin-related files"
    }
  },
  "files_included": [
    "All React admin frontend files",
    "Admin panel application files", 
    "Backend server.js",
    "Package.json files",
    "Dockerfile",
    "Admin-specific configuration files",
    "CSS and styling files",
    "JavaScript and TypeScript files"
  ],
  "restore_instructions": [
    "1. Copy react-admin-${TIMESTAMP} to production-backend/public/react-admin",
    "2. Copy admin-panel-${TIMESTAMP} to production-backend/production-backend/admin-panel", 
    "3. Copy backend-${TIMESTAMP} contents to production-backend/",
    "4. Run npm install in production-backend directory",
    "5. Rebuild and redeploy Docker image"
  ]
}
EOF

# Create restore script
echo "📜 Creating restore script..."
cat > "$BACKUP_DIR/restore-admin-${TIMESTAMP}.sh" << 'EOF'
#!/bin/bash

# ADMIN PANEL RESTORE SCRIPT
# Restores admin panel from backup files

TIMESTAMP="20251001-040444"
BACKUP_DIR="backups/admin-panel"

echo "🔄 Starting admin panel restore..."

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# Restore React admin files
if [ -d "$BACKUP_DIR/react-admin-$TIMESTAMP" ]; then
    echo "📁 Restoring React admin files..."
    rm -rf production-backend/public/react-admin
    cp -r "$BACKUP_DIR/react-admin-$TIMESTAMP" production-backend/public/react-admin
    echo "✅ React admin files restored"
else
    echo "❌ React admin backup not found"
fi

# Restore admin panel files
if [ -d "$BACKUP_DIR/admin-panel-$TIMESTAMP" ]; then
    echo "📁 Restoring admin panel files..."
    rm -rf production-backend/production-backend/admin-panel
    cp -r "$BACKUP_DIR/admin-panel-$TIMESTAMP" production-backend/production-backend/admin-panel
    echo "✅ Admin panel files restored"
else
    echo "❌ Admin panel backup not found"
fi

# Restore backend files
if [ -d "$BACKUP_DIR/backend-$TIMESTAMP" ]; then
    echo "🔧 Restoring backend files..."
    cp -r "$BACKUP_DIR/backend-$TIMESTAMP"/* production-backend/
    echo "✅ Backend files restored"
else
    echo "❌ Backend backup not found"
fi

echo "🎉 Admin panel restore completed!"
echo "📝 Next steps:"
echo "   1. Run: cd production-backend && npm install"
echo "   2. Rebuild Docker image"
echo "   3. Redeploy to AWS ECS"
EOF

chmod +x "$BACKUP_DIR/restore-admin-${TIMESTAMP}.sh"

# Create compressed archive
echo "📦 Creating compressed archive..."
cd backups
tar -czf "admin-panel-backup-${TIMESTAMP}.tar.gz" admin-panel/
echo "✅ Compressed archive created: admin-panel-backup-${TIMESTAMP}.tar.gz"
cd ..

echo "🎉 Admin panel backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
echo "📦 Archive: backups/admin-panel-backup-${TIMESTAMP}.tar.gz"