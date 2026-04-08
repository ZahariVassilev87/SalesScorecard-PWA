/**
 * Phase 1A — environment and shared constants (dotenv side effects + exports).
 * Keep behavior aligned with previous production-backend/server.js inline logic.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.dev') });

const DEFAULT_LOCAL_DEV_DATABASE_URL =
  'postgres://scorecard:scorecard_dev_pass@127.0.0.1:5432/salesscorecard_dev';

const PORT = process.env.PORT || 3001;
const DEFAULT_COMPANY_ID = 'company_metro';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_for_access_tokens';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your_refresh_secret_key_for_refresh_tokens';

const CUSTOMIZATION_ALLOWLIST = new Set(
  (process.env.COMPANY_CUSTOMIZATION_COMPANIES || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
);

let databaseUrl = (process.env.DATABASE_URL || '').trim();
if (!databaseUrl && process.env.NODE_ENV !== 'production') {
  databaseUrl = DEFAULT_LOCAL_DEV_DATABASE_URL;
  console.warn(
    '[server] DATABASE_URL unset — using local dev default (docker-compose.dev.yml / seed-dev-data.js). Set DATABASE_URL in production.'
  );
}
if (!databaseUrl) {
  console.error(
    '[server] FATAL: DATABASE_URL is not set. Add it to production-backend/.env or the environment.'
  );
}

function isLocalDatabaseUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('localhost') ||
    url.includes('@db:') ||
    url.includes('@127.0.0.1:')
  );
}

module.exports = {
  PORT,
  DEFAULT_COMPANY_ID,
  JWT_SECRET,
  REFRESH_SECRET,
  CUSTOMIZATION_ALLOWLIST,
  DEFAULT_LOCAL_DEV_DATABASE_URL,
  /** Resolved connection string (may be empty in misconfigured prod). */
  databaseUrl,
  isLocalDatabaseUrl,
};
