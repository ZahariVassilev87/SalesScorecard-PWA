#!/usr/bin/env node
/**
 * seed-dev-data.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds the local dev database with:
 *   • Test users (all roles)
 *   • A default company
 *   • Evaluation form categories & items (same as production)
 *
 * Usage:
 *   node seed-dev-data.js
 *   node seed-dev-data.js --reset   (drops all data first)
 *
 * Requires the DATABASE_URL env var (or a running local postgres via .env.dev).
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: '.env.dev' });
const { Client } = require('pg');
const crypto = require('crypto');

// bcrypt is a prod dependency — use it if available, fallback to plaintext marker
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = null;
  console.warn('⚠️  bcrypt not found — passwords will be stored as plain text (dev only).');
}

const DB_URL = process.env.DATABASE_URL || 'postgres://scorecard:scorecard_dev_pass@localhost:5432/salesscorecard_dev';
const RESET = process.argv.includes('--reset');

async function hashPassword(plain) {
  if (bcrypt) return bcrypt.hash(plain, 10);
  return `PLAIN:${plain}`; // only acceptable in dev!
}

// ─── Test Users ──────────────────────────────────────────────────────────────
const TEST_USERS = [
  {
    id: crypto.randomUUID(),
    email: 'admin@dev.local',
    password: 'password',
    displayName: 'Dev Admin',
    role: 'ADMIN',
    isActive: true,
    companyId: 'company_metro',
  },
  {
    id: crypto.randomUUID(),
    email: 'director@dev.local',
    password: 'password',
    displayName: 'Sales Director',
    role: 'SALES_DIRECTOR',
    isActive: true,
    companyId: 'company_metro',
  },
  {
    id: crypto.randomUUID(),
    email: 'manager@dev.local',
    password: 'password',
    displayName: 'Regional Manager',
    role: 'REGIONAL_SALES_MANAGER',
    isActive: true,
    companyId: 'company_metro',
  },
  {
    id: crypto.randomUUID(),
    email: 'lead@dev.local',
    password: 'password',
    displayName: 'Sales Lead',
    role: 'SALES_LEAD',
    isActive: true,
    companyId: 'company_metro',
  },
  {
    id: crypto.randomUUID(),
    email: 'salesperson@dev.local',
    password: 'password',
    displayName: 'Salesperson One',
    role: 'SALESPERSON',
    isActive: true,
    companyId: 'company_metro',
  },
];

// ─── Evaluation Form Data (mirrors production seed) ───────────────────────────
const EVAL_CATEGORIES = [
  // Form 1: Sales Lead → Salesperson
  {
    id: crypto.randomUUID(),
    name: 'Discovery (SALESPERSON)',
    order: 1,
    weight: 0.25,
    items: [
      { name: 'Asks open-ended questions', order: 1 },
      { name: 'Uncovers customer pain points', order: 2 },
      { name: 'Identifies decision makers', order: 3 },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'Solution Positioning (SALESPERSON)',
    order: 2,
    weight: 0.25,
    items: [
      { name: 'Tailors solution to customer context', order: 1 },
      { name: 'Articulates clear value proposition', order: 2 },
      { name: 'Demonstrates product knowledge', order: 3 },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'Closing & Next Steps (SALESPERSON)',
    order: 3,
    weight: 0.25,
    items: [
      { name: 'Makes clear asks', order: 1 },
      { name: 'Identifies next steps', order: 2 },
      { name: 'Sets mutual commitments', order: 3 },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: 'Professionalism (SALESPERSON)',
    order: 4,
    weight: 0.25,
    items: [
      { name: 'Arrives prepared', order: 1 },
      { name: 'Manages time effectively', order: 2 },
      { name: 'Maintains professional demeanor', order: 3 },
    ],
  },
  // Form 2: Regional Manager → Sales Lead Coaching
  {
    id: crypto.randomUUID(),
    name: 'Coaching Skills (SALES_LEAD)',
    order: 1,
    weight: 1.0,
    items: [
      { name: 'Exploratory Questioning Skills', order: 1 },
      { name: 'Behavioral Feedback Focus', order: 2 },
      { name: 'Collaborative Goal Setting', order: 3 },
      { name: 'Activity-Specific Goal Linking', order: 4 },
      { name: 'Specific Behavior Identification', order: 5 },
      { name: 'Customer Impact Discussion', order: 6 },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  Sales Scorecard — Dev Data Seeder');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = new Client({ connectionString: DB_URL, ssl: false });
  await client.connect();
  console.log('✅  Connected to dev database\n');

  try {
    if (RESET) {
      console.log('⚠️   --reset flag detected. Clearing existing data...');
      await client.query('DELETE FROM behavior_items');
      await client.query('DELETE FROM behavior_categories');
      await client.query('DELETE FROM users WHERE email LIKE \'%@dev.local\'');
      console.log('✅  Cleared\n');
    }

    // ── Users ──────────────────────────────────────────────────────────────
    console.log('👤  Seeding test users...');
    for (const u of TEST_USERS) {
      const hashed = await hashPassword(u.password);
      await client.query(
        `INSERT INTO users (id, email, password, "displayName", role, "isActive", "companyId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [u.id, u.email, hashed, u.displayName, u.role, u.isActive, u.companyId]
      );
      console.log(`   ✓ ${u.role.padEnd(24)} ${u.email}`);
    }

    // ── Evaluation Categories & Items ──────────────────────────────────────
    console.log('\n📋  Seeding evaluation form categories...');
    for (const cat of EVAL_CATEGORIES) {
      await client.query(
        `INSERT INTO behavior_categories (id, name, "order", weight, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [cat.id, cat.name, cat.order, cat.weight]
      );
      console.log(`   📂 ${cat.name}`);

      for (const item of cat.items) {
        const itemId = crypto.randomUUID();
        await client.query(
          `INSERT INTO behavior_items (id, "categoryId", name, "order", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [itemId, cat.id, item.name, item.order]
        );
        console.log(`      ✓ ${item.name}`);
      }
    }

    // ── Summary ────────────────────────────────────────────────────────────
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE email LIKE '%@dev.local') AS dev_users,
        (SELECT COUNT(*) FROM behavior_categories)                   AS categories,
        (SELECT COUNT(*) FROM behavior_items)                        AS items
    `);
    const s = stats.rows[0];

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅  Seeding complete!\n');
    console.log(`   Dev users:   ${s.dev_users}`);
    console.log(`   Categories:  ${s.categories}`);
    console.log(`   Items:       ${s.items}`);
    console.log('\n🔑  Test credentials (all passwords: "password"):');
    for (const u of TEST_USERS) {
      console.log(`   ${u.role.padEnd(24)} → ${u.email}`);
    }
    console.log('');

  } catch (err) {
    console.error('\n❌  Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
