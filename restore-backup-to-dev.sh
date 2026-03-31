#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# restore-backup-to-dev.sh — Safe restore of production backup into DEV DB
#
# ✅ ВАЖНО:
# - Никога НЕ се свързва към production RDS.
# - Работи само със DEV контейнера scorecard-db-dev (docker-compose.dev.yml).
# - Изисква вече стартиран ./start-dev.sh (или docker compose up) за dev DB.
#
# Usage:
#   ./restore-backup-to-dev.sh path/to/backup.sql
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 path/to/backup.sql"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "🚧 Preparing to restore backup into DEV database."
echo "   Backup file: $BACKUP_FILE"
echo

# ── Safety checks ────────────────────────────────────────────────────────────

if ! docker ps --format '{{.Names}}' | grep -q '^scorecard-db-dev$'; then
  echo "❌ Dev Postgres container 'scorecard-db-dev' is not running."
  echo "   Start dev environment first:"
  echo "     ./start-dev.sh"
  exit 1
fi

echo "✅ Found running dev DB container: scorecard-db-dev"
echo

echo "⚠️  This will DROP ALL DATA in the DEV database (salesscorecard_dev)"
echo "   and restore it from the specified backup."
read -rp "   Are you sure you want to continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "ℹ️  Restore aborted."
  exit 0
fi

echo
echo "🔄 Dropping existing dev schema and recreating database inside container..."
docker exec -i scorecard-db-dev psql -v ON_ERROR_STOP=1 -U scorecard -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'salesscorecard_dev';"
docker exec -i scorecard-db-dev psql -v ON_ERROR_STOP=1 -U scorecard -d postgres \
  -c "DROP DATABASE IF EXISTS salesscorecard_dev;"
docker exec -i scorecard-db-dev psql -v ON_ERROR_STOP=1 -U scorecard -d postgres \
  -c "CREATE DATABASE salesscorecard_dev OWNER scorecard;"

echo "✅ Dev database recreated."
echo

echo "📥 Restoring backup into dev database (this may take a while)..."
# - Strip transaction_timeout (not supported on older local Postgres versions).
# - Strip OWNER TO ... to avoid role-mismatch failures (e.g. OWNER TO postgres).
sed \
  -e '/^SET transaction_timeout = /d' \
  -e '/ OWNER TO /d' \
  "$BACKUP_FILE" | docker exec -i scorecard-db-dev psql -v ON_ERROR_STOP=1 -U scorecard -d salesscorecard_dev

echo
echo "🔎 Quick validation..."
docker exec -i scorecard-db-dev psql -U scorecard -d salesscorecard_dev -c \
  "SELECT 'companies' AS table, COUNT(*) FROM companies
   UNION ALL SELECT 'users', COUNT(*) FROM users
   UNION ALL SELECT 'teams', COUNT(*) FROM teams
   UNION ALL SELECT 'evaluations', COUNT(*) FROM evaluations;"

echo
echo "✅ Restore completed successfully."
echo "   Dev backend at http://localhost:3001 is now using data from:"
echo "   $BACKUP_FILE"

