/**
 * Phase 1A — CORS middleware factory (same allowlist + callbacks as before).
 */
const cors = require('cors');

const defaultAllowedOrigins = [
  'https://d2tuhgmig1r5ut.cloudfront.net',
  'https://scorecard.instorm.io',
  'https://api.scorecard.instorm.io',
  'https://api.instorm.io',
  'https://instorm.io',
  'https://www.instorm.io',
  'http://localhost:3000',
];

const localDevOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isLocalDevOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  try {
    const u = new URL(origin);
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (h === '[::1]' || h === '::1') return true;
    return false;
  } catch {
    return localDevOriginPattern.test(origin);
  }
}

function createCorsMiddleware() {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const effectiveAllowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...allowedOrigins]));

  return cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (
        effectiveAllowedOrigins.includes(origin) ||
        localDevOriginPattern.test(origin) ||
        isLocalDevOrigin(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  });
}

module.exports = { createCorsMiddleware, defaultAllowedOrigins, localDevOriginPattern, isLocalDevOrigin };
