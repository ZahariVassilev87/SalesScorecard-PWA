#!/usr/bin/env node
/**
 * Phase 1A — minimal LOCAL dev DB fixture (test setup only).
 *
 * Seeds the minimum rows needed for Phase 1A API smoke tests:
 * - one company
 * - one region (if table supports it)
 * - one team (lead = manager, salesperson = member)
 * - two users: SALES_LEAD, SALESPERSON
 * - one behavior category + item (name must include SALESPERSON for /scoring/categories as SALES_LEAD)
 *
 * Does NOT change production code. Run against local DATABASE_URL only.
 *
 * Usage:
 *   node scripts/phase1a-minimal-seed.js
 *
 * Env: loads ../.env.dev then ../production-backend/.env (repo root relative to this file)
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

let bcrypt;
try {
  bcrypt = require(path.join(repoRoot, 'production-backend', 'node_modules', 'bcrypt'));
} catch {
  try {
    bcrypt = require('bcrypt');
  } catch {
    bcrypt = null;
  }
}

const DB_URL =
  process.env.DATABASE_URL ||
  'postgres://scorecard:scorecard_dev_pass@127.0.0.1:5432/salesscorecard_dev';

/** Stable IDs for documentation and fixture scripts */
const IDS = {
  companyId: 'phase1a_company',
  regionId: 'phase1a_region_1',
  teamId: 'phase1a_team_1',
  leadId: 'phase1a0000-0000-4000-8000-000000000001',
  salespersonId: 'phase1a0000-0000-4000-8000-000000000002',
  categoryId: 'phase1a0000-0000-4000-8000-000000000010',
  itemId: 'phase1a0000-0000-4000-8000-000000000011',
  userTeamMembershipId: 'phase1a0000-0000-4000-8000-000000000020',
};

const USERS = [
  {
    id: IDS.leadId,
    email: 'lead@phase1a.local',
    password: 'password',
    displayName: 'Phase1A Sales Lead',
    role: 'SALES_LEAD',
  },
  {
    id: IDS.salespersonId,
    email: 'salesperson@phase1a.local',
    password: 'password',
    displayName: 'Phase1A Salesperson',
    role: 'SALESPERSON',
  },
];

async function hashPassword(plain) {
  if (bcrypt) return bcrypt.hash(plain, 10);
  return `PLAIN:${plain}`;
}

async function tableHasColumn(client, table, col) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, col]
  );
  return r.rowCount > 0;
}

async function seed() {
  const client = new Client({ connectionString: DB_URL, ssl: false });
  await client.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO companies (id, name, slug, "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
      [IDS.companyId, 'Phase1A Test Co', 'phase1a-test-co']
    );

    const regionsHasCompany = await tableHasColumn(client, 'regions', 'companyId');
    if (regionsHasCompany) {
      await client.query(
        `
        INSERT INTO regions (id, name, "companyId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `,
        [IDS.regionId, 'Phase1A Region', IDS.companyId]
      );
    } else {
      await client.query(
        `
        INSERT INTO regions (id, name, "createdAt", "updatedAt")
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `,
        [IDS.regionId, 'Phase1A Region']
      );
    }

    for (const u of USERS) {
      const hashed = await hashPassword(u.password);
      await client.query(
        `
        INSERT INTO users (id, email, password, "displayName", role, "isActive", "companyId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          password = EXCLUDED.password,
          "displayName" = EXCLUDED."displayName",
          role = EXCLUDED.role,
          "isActive" = EXCLUDED."isActive",
          "companyId" = EXCLUDED."companyId"
      `,
        [u.id, u.email, hashed, u.displayName, u.role, IDS.companyId]
      );
    }

    const teamsHasCompany = await tableHasColumn(client, 'teams', 'companyId');
    const teamsCols = ['id', 'name', '"regionId"', '"managerId"'];
    const teamsVals = [IDS.teamId, 'Phase1A Team', IDS.regionId, IDS.leadId];
    if (teamsHasCompany) {
      teamsCols.push('"companyId"');
      teamsVals.push(IDS.companyId);
    }
    teamsCols.push('"createdAt"', '"updatedAt"');
    const placeholders = teamsVals.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `
      INSERT INTO teams (${teamsCols.join(', ')})
      VALUES (${placeholders}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "regionId" = EXCLUDED."regionId",
        "managerId" = EXCLUDED."managerId"
        ${teamsHasCompany ? ', "companyId" = EXCLUDED."companyId"' : ''}
    `,
      teamsVals
    );

    const utCols = ['id', '"userId"', '"teamId"', '"companyId"'];
    const utVals = [IDS.userTeamMembershipId, IDS.salespersonId, IDS.teamId, IDS.companyId];
    const utPh = utVals.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `
      INSERT INTO user_teams (${utCols.join(', ')})
      VALUES (${utPh})
      ON CONFLICT ("userId", "teamId") DO NOTHING
    `,
      utVals
    );

    await client.query(
      `
      INSERT INTO behavior_categories (id, name, "order", weight, "createdAt", "updatedAt")
      VALUES ($1, $2, 1, 1.0, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
      [IDS.categoryId, 'Phase1A Discovery (SALESPERSON)']
    );

    await client.query(
      `
      INSERT INTO behavior_items (id, "categoryId", name, "order", "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 1, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
      [IDS.itemId, IDS.categoryId, 'Phase1A behavior item']
    );

    await client.query('COMMIT');
    console.log('✅ phase1a-minimal-seed: complete');
    console.log(`   Company: ${IDS.companyId}`);
    console.log(`   Users:   ${USERS.map((u) => `${u.role} → ${u.email}`).join(' | ')}`);
    console.log(`   Team:    ${IDS.teamId} (manager = SALES_LEAD)`);
    console.log(`   Scoring: category ${IDS.categoryId} + item ${IDS.itemId}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ phase1a-minimal-seed failed:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
