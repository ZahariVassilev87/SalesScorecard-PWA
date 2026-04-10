#!/usr/bin/env node
/**
 * Dev-only: set per-company rating scale in company_scoring_profiles.settings.ratingScale
 * - Metro (default company_metro): legacy_1_4 (unchanged behavior)
 * - Instorm: zero_to_four_na (0–4 with 0 = not applicable for API validation + scoring)
 *
 * Usage:
 *   node scripts/dev-configure-rating-scale-pilot.js
 *
 * Env:
 *   DATABASE_URL (or production-backend/.env)
 *   INSTORM_COMPANY_ID — required if Instorm is not found by name
 *
 * Optional:
 *   METRO_COMPANY_ID (default: company_metro)
 */

const path = require('path');
const repoRoot = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(repoRoot, '.env.dev') });
require('dotenv').config({ path: path.join(repoRoot, 'production-backend', '.env') });

const pgPath = path.join(repoRoot, 'production-backend', 'node_modules', 'pg');
let Client;
try {
  ({ Client } = require(pgPath));
} catch {
  ({ Client } = require('pg'));
}

const METRO = process.env.METRO_COMPANY_ID || 'company_metro';

async function upsertRatingScale(client, companyId, ratingScale) {
  const { rows } = await client.query(
    `SELECT settings FROM company_scoring_profiles WHERE "companyId" = $1`,
    [companyId]
  );
  const prev = rows[0]?.settings && typeof rows[0].settings === 'object' ? rows[0].settings : {};
  const next = { ...prev, ratingScale };

  await client.query(
    `
    INSERT INTO company_scoring_profiles ("companyId", mode, settings, "createdAt", "updatedAt")
    VALUES ($1, 'legacy_average', $2::jsonb, NOW(), NOW())
    ON CONFLICT ("companyId")
    DO UPDATE SET
      settings = EXCLUDED.settings,
      "updatedAt" = NOW()
    `,
    [companyId, JSON.stringify(next)]
  );
}

async function findInstormCompanyId(client) {
  if (process.env.INSTORM_COMPANY_ID) return process.env.INSTORM_COMPANY_ID;
  const { rows } = await client.query(
    `SELECT id FROM companies WHERE LOWER(name) LIKE '%instorm%' OR LOWER(slug) LIKE '%instorm%' ORDER BY "createdAt" ASC LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgres://scorecard:scorecard_dev_pass@127.0.0.1:5432/salesscorecard_dev';

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await upsertRatingScale(client, METRO, 'legacy_1_4');
    console.log(`✅ Metro (${METRO}): ratingScale = legacy_1_4`);

    const instormId = await findInstormCompanyId(client);
    if (!instormId) {
      console.warn(
        '⚠️  Instorm company not found. Set INSTORM_COMPANY_ID or add a companies row with name/slug containing "instorm".'
      );
    } else {
      await upsertRatingScale(client, instormId, 'zero_to_four_na');
      console.log(`✅ Instorm (${instormId}): ratingScale = zero_to_four_na`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
