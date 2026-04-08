/**
 * Phase 1A — shared PostgreSQL pool (parity with previous server.js wiring).
 */
const { Pool } = require('pg');
const { databaseUrl, isLocalDatabaseUrl } = require('./env');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDatabaseUrl(databaseUrl) ? false : { rejectUnauthorized: false },
});

module.exports = { pool };
