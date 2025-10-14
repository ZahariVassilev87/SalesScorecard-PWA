#!/bin/bash

# COMPREHENSIVE PWA BACKUP SCRIPT
# Creates a complete backup of PWA (code, structure, CSS, data, files, everything)
# Date: 2025-10-01-040444

TIMESTAMP="20251001-040444"
BACKUP_DIR="backups/pwa"

echo "🚀 Starting comprehensive PWA backup..."
echo "📅 Timestamp: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup source code
echo "💻 Backing up PWA source code..."
cp -r src "$BACKUP_DIR/src-${TIMESTAMP}"
echo "✅ Source code backed up"

# Backup public files
echo "🌐 Backing up public files..."
cp -r public "$BACKUP_DIR/public-${TIMESTAMP}"
echo "✅ Public files backed up"

# Backup configuration files
echo "⚙️  Backing up configuration files..."
mkdir -p "$BACKUP_DIR/config-${TIMESTAMP}"
cp package.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ package.json not found"
cp package-lock.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ package-lock.json not found"
cp tsconfig.json "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ tsconfig.json not found"
cp craco.config.js "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ craco.config.js not found"
cp README.md "$BACKUP_DIR/config-${TIMESTAMP}/" 2>/dev/null || echo "❌ README.md not found"

# Backup build files (if they exist)
if [ -d "build" ]; then
    echo "🏗️  Backing up build files..."
    cp -r build "$BACKUP_DIR/build-${TIMESTAMP}"
    echo "✅ Build files backed up"
fi

# Backup deployment scripts
echo "🚀 Backing up deployment scripts..."
mkdir -p "$BACKUP_DIR/scripts-${TIMESTAMP}"
cp deploy-aws.sh "$BACKUP_DIR/scripts-${TIMESTAMP}/" 2>/dev/null || echo "❌ deploy-aws.sh not found"
cp deploy-test.sh "$BACKUP_DIR/scripts-${TIMESTAMP}/" 2>/dev/null || echo "❌ deploy-test.sh not found"
cp setup-*.sh "$BACKUP_DIR/scripts-${TIMESTAMP}/" 2>/dev/null || echo "❌ setup scripts not found"
cp update-*.sh "$BACKUP_DIR/scripts-${TIMESTAMP}/" 2>/dev/null || echo "❌ update scripts not found"

# Backup documentation
echo "📚 Backing up documentation..."
mkdir -p "$BACKUP_DIR/docs-${TIMESTAMP}"
cp *.md "$BACKUP_DIR/docs-${TIMESTAMP}/" 2>/dev/null || echo "❌ Markdown files not found"

# Backup test files
echo "🧪 Backing up test files..."
mkdir -p "$BACKUP_DIR/tests-${TIMESTAMP}"
cp test-*.html "$BACKUP_DIR/tests-${TIMESTAMP}/" 2>/dev/null || echo "❌ Test HTML files not found"
cp test-*.js "$BACKUP_DIR/tests-${TIMESTAMP}/" 2>/dev/null || echo "❌ Test JS files not found"

# Backup utility files
echo "🛠️  Backing up utility files..."
mkdir -p "$BACKUP_DIR/utils-${TIMESTAMP}"
cp *.js "$BACKUP_DIR/utils-${TIMESTAMP}/" 2>/dev/null || echo "❌ Utility JS files not found"
cp *.html "$BACKUP_DIR/utils-${TIMESTAMP}/" 2>/dev/null || echo "❌ Utility HTML files not found"

# Create PWA backup manifest
echo "📋 Creating PWA backup manifest..."
cat > "$BACKUP_DIR/pwa-manifest-${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "backup_type": "pwa_comprehensive",
  "version": "1.0.0",
  "pwa_info": {
    "name": "Sales Scorecard PWA",
    "description": "Progressive Web Application for Sales Scorecard Management",
    "version": "1.0.0"
  },
  "components": {
    "source_code": {
      "backup_path": "src-${TIMESTAMP}",
      "description": "React TypeScript source code"
    },
    "public_files": {
      "backup_path": "public-${TIMESTAMP}",
      "description": "Public assets, manifest, service worker"
    },
    "build_files": {
      "backup_path": "build-${TIMESTAMP}",
      "description": "Production build files"
    },
    "scripts": {
      "backup_path": "scripts-${TIMESTAMP}",
      "description": "Deployment and setup scripts"
    },
    "documentation": {
      "backup_path": "docs-${TIMESTAMP}",
      "description": "Project documentation"
    },
    "tests": {
      "backup_path": "tests-${TIMESTAMP}",
      "description": "Test files and utilities"
    },
    "utils": {
      "backup_path": "utils-${TIMESTAMP}",
      "description": "Utility files and helpers"
    },
    "config": {
      "backup_path": "config-${TIMESTAMP}",
      "description": "Configuration files"
    }
  },
  "key_files": [
    "package.json",
    "package-lock.json", 
    "tsconfig.json",
    "craco.config.js",
    "README.md"
  ],
  "features_included": [
    "React TypeScript application",
    "Progressive Web App functionality",
    "Service worker for offline support",
    "Push notifications",
    "Responsive design",
    "Internationalization (i18n)",
    "Authentication system",
    "Evaluation forms",
    "Team management",
    "Performance monitoring",
    "Offline data synchronization"
  ],
  "restore_instructions": [
    "1. Copy all backup directories to project root",
    "2. Rename directories to remove timestamp suffix",
    "3. Run: npm install",
    "4. Run: npm run build",
    "5. Deploy to S3 and CloudFront"
  ]
}
EOF

# Create restore script
echo "📜 Creating restore script..."
cat > "$BACKUP_DIR/restore-pwa-${TIMESTAMP}.sh" << 'EOF'
#!/bin/bash

# PWA RESTORE SCRIPT
# Restores PWA from backup files

TIMESTAMP="20251001-040444"
BACKUP_DIR="backups/pwa"

echo "🔄 Starting PWA restore..."

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# Restore source code
if [ -d "$BACKUP_DIR/src-$TIMESTAMP" ]; then
    echo "💻 Restoring source code..."
    rm -rf src
    cp -r "$BACKUP_DIR/src-$TIMESTAMP" src
    echo "✅ Source code restored"
else
    echo "❌ Source code backup not found"
fi

# Restore public files
if [ -d "$BACKUP_DIR/public-$TIMESTAMP" ]; then
    echo "🌐 Restoring public files..."
    rm -rf public
    cp -r "$BACKUP_DIR/public-$TIMESTAMP" public
    echo "✅ Public files restored"
else
    echo "❌ Public files backup not found"
fi

# Restore build files
if [ -d "$BACKUP_DIR/build-$TIMESTAMP" ]; then
    echo "🏗️  Restoring build files..."
    rm -rf build
    cp -r "$BACKUP_DIR/build-$TIMESTAMP" build
    echo "✅ Build files restored"
else
    echo "❌ Build files backup not found"
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

# Restore documentation
if [ -d "$BACKUP_DIR/docs-$TIMESTAMP" ]; then
    echo "📚 Restoring documentation..."
    cp "$BACKUP_DIR/docs-$TIMESTAMP"/* .
    echo "✅ Documentation restored"
fi

# Restore tests and utils
if [ -d "$BACKUP_DIR/tests-$TIMESTAMP" ]; then
    echo "🧪 Restoring test files..."
    cp "$BACKUP_DIR/tests-$TIMESTAMP"/* .
    echo "✅ Test files restored"
fi

if [ -d "$BACKUP_DIR/utils-$TIMESTAMP" ]; then
    echo "🛠️  Restoring utility files..."
    cp "$BACKUP_DIR/utils-$TIMESTAMP"/* .
    echo "✅ Utility files restored"
fi

echo "🎉 PWA restore completed!"
echo "📝 Next steps:"
echo "   1. Run: npm install"
echo "   2. Run: npm run build"
echo "   3. Deploy to S3 and CloudFront"
EOF

chmod +x "$BACKUP_DIR/restore-pwa-${TIMESTAMP}.sh"

# Create compressed archive
echo "📦 Creating compressed archive..."
cd backups
tar -czf "pwa-backup-${TIMESTAMP}.tar.gz" pwa/
echo "✅ Compressed archive created: pwa-backup-${TIMESTAMP}.tar.gz"
cd ..

echo "🎉 PWA backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
echo "📦 Archive: backups/pwa-backup-${TIMESTAMP}.tar.gz"