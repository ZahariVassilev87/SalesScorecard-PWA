const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
let webpush = null;

const env = require('./src/config/env');
const { pool } = require('./src/config/database');
const { createCorsMiddleware } = require('./src/config/cors');
const { createAuthenticateToken } = require('./src/middleware/authenticateToken');
const { authorizeEvaluationCreation } = require('./src/middleware/requireRoles');
const { createCompanyContextHelpers } = require('./src/middleware/companyContext');
const { forwardErrorToExpressDefault } = require('./src/middleware/errorHandler');
const createAuthRouter = require('./src/routes/auth.routes');
const createEvaluationsRouter = require('./src/routes/evaluations.routes');
const {
  createAnalyticsRouter,
  registerDirectorDashboardRoute,
} = require('./src/routes/analytics.routes');
const {
  getCurrentPublishedMetadataConfig,
  publishEvaluationMetadataSchema,
  buildMetadataPreviewForUsers,
  buildCurrentVersionSummary,
} = require('./src/services/evaluationMetadataConfig.service');
const {
  getCurrentPublishedEvaluationStructure,
  publishEvaluationStructure,
  buildStructureSummaryRow,
  buildStructurePreviewPayload,
  getEvaluationStructureVersionForCompany,
} = require('./src/services/evaluationStructureConfig.service');
const { buildResultView } = require('./src/evaluation/mappers');

const app = express();
// Default 3001 so the root PWA can use 3000 in dev (see DEV-ENVIRONMENT.md, docker-compose.dev.yml).
const PORT = env.PORT;
const DEFAULT_COMPANY_ID = env.DEFAULT_COMPANY_ID;
const JWT_SECRET = env.JWT_SECRET;
const REFRESH_SECRET = env.REFRESH_SECRET;
const CUSTOMIZATION_ALLOWLIST = env.CUSTOMIZATION_ALLOWLIST;
const databaseUrl = env.databaseUrl;

const { resolveCompanyContext, normalizeCompanyId, slugifyCompanyName } = createCompanyContextHelpers(
  DEFAULT_COMPANY_ID
);

const authenticateToken = createAuthenticateToken({
  jwtSecret: JWT_SECRET,
  defaultCompanyId: DEFAULT_COMPANY_ID,
});

// Database migrations on startup
async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    
    // Add customerType column if it doesn't exist
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'evaluations' 
          AND column_name = 'customerType'
        ) THEN
          ALTER TABLE evaluations ADD COLUMN "customerType" VARCHAR(50) DEFAULT 'LOW_SHARE';
          CREATE INDEX IF NOT EXISTS idx_evaluations_customer_type ON evaluations ("customerType");
          RAISE NOTICE 'Added customerType column to evaluations table';
        END IF;
      END $$;
    `);
    
        // Update existing evaluations with default customerType if they don't have one
        await pool.query(`
          UPDATE evaluations 
          SET "customerType" = 'LOW_SHARE' 
          WHERE "customerType" IS NULL
        `);
        
        // Add isActive column to users table if it doesn't exist
        await pool.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'users' 
              AND column_name = 'isActive'
            ) THEN
              ALTER TABLE users ADD COLUMN "isActive" BOOLEAN DEFAULT true;
              CREATE INDEX IF NOT EXISTS idx_users_is_active ON users ("isActive");
              RAISE NOTICE 'Added isActive column to users table';
            END IF;
          END $$;
        `);
        
        // Update existing users with default isActive = true if they don't have one
        await pool.query(`
          UPDATE users 
          SET "isActive" = true 
          WHERE "isActive" IS NULL
        `);

        // Company-level feature flags (defaults keep legacy behavior)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_feature_flags (
            "companyId" TEXT PRIMARY KEY,
            "enableCompanyCustomization" BOOLEAN NOT NULL DEFAULT false,
            "useLegacyEvaluationFlow" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        // Company-level scoring profile
        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_scoring_profiles (
            "companyId" TEXT PRIMARY KEY,
            mode TEXT NOT NULL DEFAULT 'legacy_average',
            settings JSONB NOT NULL DEFAULT '{}'::jsonb,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        // Company-level hierarchy template
        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_hierarchy_templates (
            "companyId" TEXT PRIMARY KEY,
            template JSONB NOT NULL DEFAULT '{"rules":[]}'::jsonb,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);

        // Backfill defaults for existing companies (safe legacy behavior)
        await pool.query(`
          INSERT INTO company_feature_flags ("companyId", "enableCompanyCustomization", "useLegacyEvaluationFlow", "createdAt", "updatedAt")
          SELECT c.id, false, true, NOW(), NOW()
          FROM companies c
          ON CONFLICT ("companyId") DO NOTHING
        `);

        await pool.query(`
          INSERT INTO company_scoring_profiles ("companyId", mode, settings, "createdAt", "updatedAt")
          SELECT c.id, 'legacy_average', '{}'::jsonb, NOW(), NOW()
          FROM companies c
          ON CONFLICT ("companyId") DO NOTHING
        `);

        await pool.query(`
          INSERT INTO company_hierarchy_templates ("companyId", template, "createdAt", "updatedAt")
          SELECT c.id,
                 '{
                   "rules": [
                     {"evaluatorRole":"REGIONAL_MANAGER","targetRoles":["SALES_LEAD"]},
                     {"evaluatorRole":"REGIONAL_SALES_MANAGER","targetRoles":["SALES_LEAD"]},
                     {"evaluatorRole":"SALES_LEAD","targetRoles":["SALESPERSON"]},
                     {"evaluatorRole":"SALES_DIRECTOR","targetRoles":["REGIONAL_MANAGER","REGIONAL_SALES_MANAGER","SALES_LEAD","SALESPERSON"]},
                     {"evaluatorRole":"ADMIN","targetRoles":["SALESPERSON","SALES_LEAD"]},
                     {"evaluatorRole":"SUPER_ADMIN","targetRoles":["SALESPERSON","SALES_LEAD","REGIONAL_MANAGER","REGIONAL_SALES_MANAGER","SALES_DIRECTOR","ADMIN"]}
                   ]
                 }'::jsonb,
                 NOW(), NOW()
          FROM companies c
          ON CONFLICT ("companyId") DO NOTHING
        `);

        // Milestone 1 — versioned per-company evaluation metadata (optional fields)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_evaluation_config_versions (
            id TEXT PRIMARY KEY,
            "companyId" TEXT NOT NULL,
            version INTEGER NOT NULL,
            "metadataSchema" JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
            "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "publishedBy" TEXT,
            CONSTRAINT cecv_version_check CHECK (version >= 1),
            CONSTRAINT cecv_unique_company_version UNIQUE ("companyId", version)
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_cecv_company ON company_evaluation_config_versions ("companyId")
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_evaluation_config_current (
            "companyId" TEXT PRIMARY KEY,
            "currentPublishedVersionId" TEXT NOT NULL,
            CONSTRAINT cecc_fk_version FOREIGN KEY ("currentPublishedVersionId")
              REFERENCES company_evaluation_config_versions(id) ON DELETE RESTRICT
          )
        `);
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'evaluations' AND column_name = 'metadata'
            ) THEN
              ALTER TABLE evaluations ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
            END IF;
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'evaluations' AND column_name = 'configVersionId'
            ) THEN
              ALTER TABLE evaluations ADD COLUMN "configVersionId" TEXT
                REFERENCES company_evaluation_config_versions(id) ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'evaluations' AND column_name = 'evaluationStructureVersionId'
            ) THEN
              ALTER TABLE evaluations ADD COLUMN "evaluationStructureVersionId" TEXT;
            END IF;
          END $$;
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_evaluation_structure_versions (
            id TEXT PRIMARY KEY,
            "companyId" TEXT NOT NULL,
            version INTEGER NOT NULL,
            "evaluationStructure" JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
            "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "publishedBy" TEXT,
            CONSTRAINT cesv_version_check CHECK (version >= 1),
            CONSTRAINT cesv_unique_company_version UNIQUE ("companyId", version)
          )
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_cesv_company ON company_evaluation_structure_versions ("companyId")
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS company_evaluation_structure_current (
            "companyId" TEXT PRIMARY KEY,
            "currentPublishedVersionId" TEXT NOT NULL,
            CONSTRAINT cesc_fk_version FOREIGN KEY ("currentPublishedVersionId")
              REFERENCES company_evaluation_structure_versions(id) ON DELETE RESTRICT
          )
        `);
        await pool.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'evaluations' AND column_name = 'evaluationStructureVersionId'
            ) AND NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'evaluations_evaluation_structure_version_fk'
            ) THEN
              ALTER TABLE evaluations
                ADD CONSTRAINT evaluations_evaluation_structure_version_fk
                FOREIGN KEY ("evaluationStructureVersionId")
                REFERENCES company_evaluation_structure_versions(id) ON DELETE SET NULL;
            END IF;
          END $$;
        `);
        
        console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    // Don't crash the server if migrations fail
  }
}

// Migrations run in startServer() before app.listen (see end of file).

// Temporary endpoint to manually run migrations
app.post('/admin/run-migrations', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    
    await runMigrations();
    res.json({ message: 'Migrations completed successfully' });
  } catch (error) {
    console.error('Error running migrations:', error);
    res.status(500).json({ message: 'Failed to run migrations', error: error.message });
  }
});

function getDefaultHierarchyTemplate() {
  return {
    rules: [
      { evaluatorRole: 'REGIONAL_MANAGER', targetRoles: ['SALES_LEAD'] },
      { evaluatorRole: 'REGIONAL_SALES_MANAGER', targetRoles: ['SALES_LEAD'] },
      { evaluatorRole: 'SALES_LEAD', targetRoles: ['SALESPERSON'] },
      { evaluatorRole: 'SALES_DIRECTOR', targetRoles: ['REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER', 'SALES_LEAD', 'SALESPERSON'] },
      { evaluatorRole: 'ADMIN', targetRoles: ['SALESPERSON', 'SALES_LEAD'] },
      { evaluatorRole: 'SUPER_ADMIN', targetRoles: ['SALESPERSON', 'SALES_LEAD', 'REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER', 'SALES_DIRECTOR', 'ADMIN'] }
    ]
  };
}

function getTargetRolesForEvaluator(hierarchyTemplate, evaluatorRole) {
  const template = hierarchyTemplate && Array.isArray(hierarchyTemplate.rules)
    ? hierarchyTemplate
    : getDefaultHierarchyTemplate();
  const row = template.rules.find(rule => rule.evaluatorRole === evaluatorRole);
  return Array.isArray(row?.targetRoles) ? row.targetRoles : [];
}

async function getCompanyFeatureFlags(companyId) {
  const safeCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { rows } = await pool.query(
      `SELECT "enableCompanyCustomization", "useLegacyEvaluationFlow"
       FROM company_feature_flags
       WHERE "companyId" = $1`,
      [safeCompanyId]
    );
    const row = rows[0] || {};
    const dbEnabled = row.enableCompanyCustomization === true;
    const allowlisted = CUSTOMIZATION_ALLOWLIST.size === 0 || CUSTOMIZATION_ALLOWLIST.has(safeCompanyId);
    return {
      companyId: safeCompanyId,
      enableCompanyCustomization: dbEnabled && allowlisted,
      useLegacyEvaluationFlow: row.useLegacyEvaluationFlow !== false
    };
  } catch (error) {
    return {
      companyId: safeCompanyId,
      enableCompanyCustomization: false,
      useLegacyEvaluationFlow: true
    };
  }
}

async function getCompanyScoringProfile(companyId) {
  const safeCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { rows } = await pool.query(
      `SELECT mode, settings
       FROM company_scoring_profiles
       WHERE "companyId" = $1`,
      [safeCompanyId]
    );
    if (rows.length === 0) {
      return { companyId: safeCompanyId, mode: 'legacy_average', settings: {} };
    }
    return {
      companyId: safeCompanyId,
      mode: rows[0].mode || 'legacy_average',
      settings: rows[0].settings && typeof rows[0].settings === 'object' ? rows[0].settings : {}
    };
  } catch (error) {
    return { companyId: safeCompanyId, mode: 'legacy_average', settings: {} };
  }
}

async function getCompanyHierarchyTemplate(companyId) {
  const safeCompanyId = companyId || DEFAULT_COMPANY_ID;
  try {
    const { rows } = await pool.query(
      `SELECT template
       FROM company_hierarchy_templates
       WHERE "companyId" = $1`,
      [safeCompanyId]
    );
    const raw = rows[0]?.template;
    if (raw && Array.isArray(raw.rules)) {
      return raw;
    }
    return getDefaultHierarchyTemplate();
  } catch (error) {
    return getDefaultHierarchyTemplate();
  }
}

async function getBehaviorSchemaInfo() {
  const categoryColumnsResult = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'behavior_categories'
  `);
  const itemColumnsResult = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'behavior_items'
  `);
  const categoryColumns = new Set(categoryColumnsResult.rows.map(r => r.column_name));
  const itemColumns = new Set(itemColumnsResult.rows.map(r => r.column_name));
  const categoryCompanyColumn = categoryColumns.has('companyId') ? '"companyId"' : (categoryColumns.has('company_id') ? 'company_id' : null);
  const itemCompanyColumn = itemColumns.has('companyId') ? '"companyId"' : (itemColumns.has('company_id') ? 'company_id' : null);
  const categoryIdColumn = itemColumns.has('categoryId') ? '"categoryId"' : (itemColumns.has('category_id') ? 'category_id' : '"categoryId"');
  const hasItemWeight = itemColumns.has('weight');
  const hasItemIsActive = itemColumns.has('isActive') || itemColumns.has('is_active');
  const itemIsActiveColumn = itemColumns.has('isActive') ? '"isActive"' : (itemColumns.has('is_active') ? 'is_active' : null);
  return { categoryCompanyColumn, itemCompanyColumn, categoryIdColumn, hasItemWeight, hasItemIsActive, itemIsActiveColumn };
}

async function loadCompanyBehaviorTemplate(companyId) {
  const { categoryCompanyColumn, categoryIdColumn, hasItemWeight, hasItemIsActive, itemIsActiveColumn } = await getBehaviorSchemaInfo();
  let categoriesQuery = `
    SELECT bc.id, bc.name, bc."order", bc.weight
    FROM behavior_categories bc
  `;
  const params = [];
  if (categoryCompanyColumn) {
    params.push(companyId || DEFAULT_COMPANY_ID);
    categoriesQuery += ` WHERE bc.${categoryCompanyColumn} = $1`;
  }
  categoriesQuery += ' ORDER BY bc."order"';
  const categoriesResult = await pool.query(categoriesQuery, params);
  const categories = [];
  for (const cat of categoriesResult.rows) {
    const itemsResult = await pool.query(
      `SELECT bi.id, bi.name, bi."order",
              ${hasItemWeight ? 'COALESCE(bi.weight, 1.0)' : '1.0'} as weight,
              ${hasItemIsActive && itemIsActiveColumn ? `COALESCE(bi.${itemIsActiveColumn}, true)` : 'true'} as "isActive"
       FROM behavior_items bi
       WHERE bi.${categoryIdColumn} = $1
       ORDER BY bi."order"`,
      [cat.id]
    );
    categories.push({
      ...cat,
      items: itemsResult.rows
    });
  }
  return categories;
}

// CORS supports strict override via ALLOWED_ORIGINS and safe defaults otherwise.
app.use(createCorsMiddleware());

// React Admin SPA: register HTML routes BEFORE express.static so index.html is not served
// from static middleware (which would ignore Cache-Control below and ship stale script tags).
const adminIndexPath = path.join(__dirname, 'public', 'react-admin', 'index.html');
const adminStaticRoot = path.join(__dirname, 'public', 'react-admin');

function sendAdminIndexHtml(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(adminIndexPath);
}

['/public-admin/react-admin', '/public-admin/react-admin/', '/public-admin/react-admin/index.html'].forEach((adminIndexRoute) => {
  app.get(adminIndexRoute, (req, res) => {
    sendAdminIndexHtml(res);
  });
});

app.use(
  '/public-admin/react-admin',
  express.static(adminStaticRoot, { index: false })
);

// Client-side routes (same index.html; not for missing .js/.css — those 404 after static)
app.get('/public-admin/react-admin/*', (req, res) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send('Not found');
  }
  sendAdminIndexHtml(res);
});

// NOTE: Admin JSON APIs live under /public-admin/... and are registered as routes; they are not
// shadowed by this static mount because they do not match /public-admin/react-admin/ file paths.

// Serve admin-with-delete.html
app.get('/admin-with-delete.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-with-delete.html'));
});

// Serve test-delete.html
app.get('/test-delete.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-delete.html'));
});

// Expose token/tools helpers at root for convenience
app.get('/clear-tokens.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clear-tokens.html'));
});

app.get('/clear-offline-data.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clear-offline-data.html'));
});

// Global JSON limit must accommodate larger audio base64 payloads for /dev/ai/transcribe.
app.use(bodyParser.json({ limit: '100mb' }));

// In-memory storage for evaluations (in production, use database)
let storedEvaluations = [];

// In-memory storage for Web Push subscriptions
// Keyed by subscription.endpoint for idempotency
const pushSubscriptions = new Map();

// Attempt to load web-push for server-initiated notifications (optional)
try {
  // Lazy require so the server still runs if dependency is missing
  // To enable sending, ensure 'web-push' is installed in the environment
  // and VAPID keys are configured via env vars
  // npm i web-push
  // export VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
  // export VAPID_SUBJECT="mailto:admin@instorm.io"
  // Then restart the server
  // eslint-disable-next-line global-require
  webpush = require('web-push');
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@instorm.io';

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('✅ Web Push configured with provided VAPID keys');
  } else {
    console.log('ℹ️ VAPID keys not provided; /api/notifications/test will be a no-op');
  }
} catch (e) {
  console.log('ℹ️ web-push not installed; push send endpoint will be disabled');
}

// Utility: detect user_teams column naming (camelCase vs snake_case)
async function getUserTeamsColumns(client) {
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'user_teams'
  `);
  const names = new Set(cols.rows.map(r => r.column_name));

  console.log('[COLUMN DETECTION] user_teams columns found:', Array.from(names));

  const resolveColumnName = (preferred) => {
    for (const name of preferred) {
      if (names.has(name.lookup)) {
        return name.output;
      }
    }
    return preferred[0].output;
  };

  const userCol = resolveColumnName([
    { lookup: 'userId', output: '"userId"' },
    { lookup: 'user_id', output: 'user_id' },
    { lookup: 'userid', output: '"userid"' }
  ]);

  const teamCol = resolveColumnName([
    { lookup: 'teamId', output: '"teamId"' },
    { lookup: 'team_id', output: 'team_id' },
    { lookup: 'teamid', output: '"teamid"' }
  ]);

  const hasCompanyIdCamel = names.has('companyId');
  const hasCompanyIdSnake = names.has('company_id');
  const hasCompanyIdLower = names.has('companyid');

  let companyCol = null;
  if (hasCompanyIdCamel) {
    companyCol = '"companyId"';
  } else if (hasCompanyIdSnake) {
    companyCol = 'company_id';
  } else if (hasCompanyIdLower) {
    companyCol = '"companyid"';
  }

  const createdCol = null;
  const updatedCol = null;

  console.log('[COLUMN DETECTION] Detected:', { userCol, teamCol, createdCol, updatedCol, companyCol });

  return { userCol, teamCol, createdCol, updatedCol, companyCol };
}

// Utility: detect teams column naming for timestamp columns
async function getTeamsColumns(client) {
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'teams'
  `);
  const names = new Set(cols.rows.map(r => r.column_name));
  
  const createdCol = names.has('created_at') ? 'created_at' : (names.has('createdAt') ? '"createdAt"' : 'created_at');
  const updatedCol = names.has('updated_at') ? 'updated_at' : (names.has('updatedAt') ? '"updatedAt"' : 'updated_at');
  const regionCol = names.has('region_id') ? 'region_id' : (names.has('regionId') ? '"regionId"' : 'region_id');
  const managerCol = names.has('manager_id') ? 'manager_id' : (names.has('managerId') ? '"managerId"' : 'manager_id');
  
  return { createdCol, updatedCol, regionCol, managerCol };
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Sales Scorecard API',
    version: '1.4.0',
    endpoints: [
      'POST /auth/login',
      'POST /auth/refresh',
      'POST /auth/logout',
      'POST /evaluations',
      'GET /evaluations/my',
      'GET /organizations/teams',
      'GET /organizations/salespeople',
      'GET /public-admin/teams',
      'GET /public-admin/users',
      'GET /users',
      'GET /scoring/categories',
      'GET /scoring/rating-scale',
      'GET /analytics/dashboard',
      'GET /analytics/team',
      'GET /analytics/director-dashboard',
      'GET /public-admin/regions',
      'POST /public-admin/regions',
      'PUT /public-admin/regions/:id',
      'DELETE /public-admin/regions/:id',
      'GET /public-admin/companies/:companyId/evaluation-metadata-config',
      'GET /public-admin/companies/:companyId/evaluation-metadata-schema/preview',
      'POST /public-admin/companies/:companyId/evaluation-metadata-schema/publish',
      'GET /health'
    ]
  });
});

// Health check endpoint (includes DB — login fails with 500 if database is disconnected)
app.get('/health', async (req, res) => {
  let database = 'unknown';
  try {
    await pool.query('SELECT 1');
    database = 'connected';
  } catch (e) {
    database = 'disconnected';
  }
  res.json({
    status: database === 'connected' ? 'ok' : 'degraded',
    database,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Temporary endpoint to list all users (for debugging)
app.get('/debug/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, "displayName", role, "isActive" FROM users ORDER BY email');
    res.json({
      message: 'All users in database',
      count: result.rows.length,
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive
      }))
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      message: 'Database error', 
      error: error.message 
    });
  }
});

// Temporary endpoint to check for ADMIN users specifically
app.get('/debug/admin-users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, "displayName", role, "isActive" FROM users WHERE role = \'ADMIN\' ORDER BY email');
    res.json({
      message: 'Admin users in database',
      count: result.rows.length,
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive
      }))
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ 
      message: 'Database error', 
      error: error.message 
    });
  }
});

// Temporary endpoint to create an admin user
app.post('/debug/create-admin', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    if (!email || !password || !displayName) {
      return res.status(400).json({ 
        message: 'Email, password, and displayName are required' 
      });
    }

    // Hash the password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const result = await pool.query(
      'INSERT INTO users (id, email, password, "displayName", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id, email, "displayName", role, "isActive"',
      [crypto.randomUUID(), email, hashedPassword, displayName, 'ADMIN', true]
    );

    res.json({
      message: 'Admin user created successfully',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        displayName: result.rows[0].displayName,
        role: result.rows[0].role,
        isActive: result.rows[0].isActive
      }
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ 
      message: 'Database error', 
      error: error.message 
    });
  }
});

// Simple endpoint to add admin user directly
app.get('/debug/add-admin', async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    // Insert admin user directly
    const result = await pool.query(
      'INSERT INTO users (id, email, password, "displayName", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id, email, "displayName", role, "isActive"',
      ['cmfn0fwjb0001qpwtbk5fqnf2', 'vassilev.zahari@gmail.com', hashedPassword, 'Zahari Vassilev', 'ADMIN', true]
    );

    res.json({
      message: 'Admin user added successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding admin user:', error);
    res.status(500).json({ 
      message: 'Database error', 
      error: error.message 
    });
  }
});

// Endpoint to list files in container
app.get('/debug/list-files', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const listFiles = (dir, prefix = '') => {
      const files = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(prefix + item + '/');
          files.push(...listFiles(fullPath, prefix + item + '/'));
        } else {
          files.push(prefix + item);
        }
      }
      
      return files;
    };
    
    const files = listFiles('/app');
    res.json({ files: files.filter(f => f.includes('backup') || f.includes('.json')) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to setup database tables
app.get('/debug/setup-database', async (req, res) => {
  try {
    const results = {
      tables: 0,
      errors: []
    };
    
    // Create regions table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS regions (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);
      results.tables++;
    } catch (error) {
      results.errors.push(`Regions table: ${error.message}`);
    }
    
    // Create teams table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          "regionId" VARCHAR(255),
          "managerId" VARCHAR(255),
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY ("regionId") REFERENCES regions(id),
          FOREIGN KEY ("managerId") REFERENCES users(id)
        )
      `);
      results.tables++;
    } catch (error) {
      results.errors.push(`Teams table: ${error.message}`);
    }
    
    // Create user_teams table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_teams (
          id VARCHAR(255) PRIMARY KEY,
          "userId" VARCHAR(255) NOT NULL,
          "teamId" VARCHAR(255) NOT NULL,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY ("userId") REFERENCES users(id),
          FOREIGN KEY ("teamId") REFERENCES teams(id),
          UNIQUE("userId", "teamId")
        )
      `);
      results.tables++;
    } catch (error) {
      results.errors.push(`User_teams table: ${error.message}`);
    }
    
    res.json({
      message: 'Database setup completed',
      results: results
    });
  } catch (error) {
    console.error('Error setting up database:', error);
    res.status(500).json({ 
      message: 'Database setup error', 
      error: error.message 
    });
  }
});

// Endpoint to restore data manually
app.get('/debug/restore-data', async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const results = {
      regions: 0,
      teams: 0,
      users: 0,
      errors: []
    };
    
    // Create sample regions
    try {
      const regions = [
        { id: 'region-1', name: 'North America' },
        { id: 'region-2', name: 'Europe' },
        { id: 'region-3', name: 'Asia Pacific' }
      ];
      
      for (const region of regions) {
        await pool.query(
          'INSERT INTO regions (id, name, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING',
          [region.id, region.name]
        );
        results.regions++;
      }
    } catch (error) {
      results.errors.push(`Regions: ${error.message}`);
    }
    
    // Create sample teams
    try {
      const teams = [
        { id: 'team-1', name: 'Enterprise Sales', regionId: 'region-1' },
        { id: 'team-2', name: 'SMB Sales', regionId: 'region-1' },
        { id: 'team-3', name: 'European Sales', regionId: 'region-2' },
        { id: 'team-4', name: 'APAC Sales', regionId: 'region-3' }
      ];
      
      for (const team of teams) {
        await pool.query(
          'INSERT INTO teams (id, name, "regionId", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (id) DO NOTHING',
          [team.id, team.name, team.regionId]
        );
        results.teams++;
      }
    } catch (error) {
      results.errors.push(`Teams: ${error.message}`);
    }
    
    // Create sample users
    try {
      const users = [
        { id: 'user-1', email: 'john.doe@company.com', displayName: 'John Doe', role: 'SALESPERSON', password: 'password123' },
        { id: 'user-2', email: 'jane.smith@company.com', displayName: 'Jane Smith', role: 'SALES_LEAD', password: 'password123' },
        { id: 'user-3', email: 'mike.johnson@company.com', displayName: 'Mike Johnson', role: 'REGIONAL_SALES_MANAGER', password: 'password123' },
        { id: 'user-4', email: 'sarah.wilson@company.com', displayName: 'Sarah Wilson', role: 'SALES_DIRECTOR', password: 'password123' },
        { id: 'user-5', email: 'david.brown@company.com', displayName: 'David Brown', role: 'SALESPERSON', password: 'password123' }
      ];
      
      for (const user of users) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        await pool.query(
          'INSERT INTO users (id, email, password, "displayName", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) ON CONFLICT (id) DO NOTHING',
          [user.id, user.email, hashedPassword, user.displayName, user.role, true]
        );
        results.users++;
      }
    } catch (error) {
      results.errors.push(`Users: ${error.message}`);
    }
    
    res.json({
      message: 'Sample data created successfully',
      results: results
    });
  } catch (error) {
    console.error('Error creating sample data:', error);
    res.status(500).json({ 
      message: 'Database error', 
      error: error.message 
    });
  }
});

app.use(
  '/auth',
  createAuthRouter({
    pool,
    jwt,
    JWT_SECRET,
    REFRESH_SECRET,
    DEFAULT_COMPANY_ID,
  })
);

// Push notification endpoints
// Store a push subscription for the authenticated user
app.post('/api/notifications/subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription, userId } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }

    const ownerUserId = userId || req.user?.id;
    pushSubscriptions.set(subscription.endpoint, { subscription, userId: ownerUserId, createdAt: Date.now() });
    console.log(`🔔 Stored push subscription for user ${ownerUserId} (${subscription.endpoint.slice(0, 32)}...)`);
    return res.json({ message: 'Subscribed', endpoint: subscription.endpoint });
  } catch (error) {
    console.error('Error storing subscription:', error);
    return res.status(500).json({ message: 'Failed to store subscription' });
  }
});

// Remove a push subscription
app.post('/api/notifications/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription, endpoint } = req.body || {};
    const key = endpoint || subscription?.endpoint;
    if (!key) {
      return res.status(400).json({ message: 'Endpoint required' });
    }
    pushSubscriptions.delete(key);
    console.log(`🔕 Removed push subscription (${String(key).slice(0, 32)}...)`);
    return res.json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('Error removing subscription:', error);
    return res.status(500).json({ message: 'Failed to remove subscription' });
  }
});

// List subscriptions (admin only)
app.get('/api/notifications/list', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const all = Array.from(pushSubscriptions.values()).map(s => ({
      userId: s.userId,
      endpoint: s.subscription.endpoint,
      createdAt: s.createdAt
    }));
    return res.json({ count: all.length, subscriptions: all });
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    return res.status(500).json({ message: 'Failed to list subscriptions' });
  }
});

// Send a test notification to the current user's first subscription
app.post('/api/notifications/test', authenticateToken, async (req, res) => {
  try {
    const sub = Array.from(pushSubscriptions.values()).find(s => s.userId === req.user?.id) || Array.from(pushSubscriptions.values())[0];
    if (!sub) {
      return res.status(404).json({ message: 'No subscriptions available' });
    }
    if (!webpush) {
      console.log('web-push not available; simulating success');
      return res.json({ message: 'Simulated push (web-push not installed)' });
    }
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.log('VAPID keys missing; simulating success');
      return res.json({ message: 'Simulated push (VAPID not configured)' });
    }

    const payload = JSON.stringify({
      title: '🔔 Sales Scorecard',
      body: 'This is a test push notification',
      icon: '/logo192.png',
      data: { url: '/#dashboard' }
    });

    await webpush.sendNotification(sub.subscription, payload).catch(err => {
      console.error('web-push error:', err?.body || err?.message || err);
      throw err;
    });
    return res.json({ message: 'Push sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send push' });
  }
});

// Evaluation routes
app.use(
  '/evaluations',
  createEvaluationsRouter({
    pool,
    authenticateToken,
    authorizeEvaluationCreation,
    resolveCompanyContext,
    DEFAULT_COMPANY_ID,
    getUserTeamsColumns,
    getCompanyHierarchyTemplate,
    getCompanyFeatureFlags,
    getCompanyScoringProfile,
  })
);

// Organization routes
app.get('/organizations/teams', authenticateToken, async (req, res) => {
  console.log('Organizations teams request from user:', req.user.email, 'role:', req.user.role);

  try {
    const { userCol, teamCol } = await getUserTeamsColumns(pool);
    const { companyId, includeAllCompanies } = resolveCompanyContext(req);
    const hierarchyTemplate = await getCompanyHierarchyTemplate(companyId);
    const targetRoles = getTargetRolesForEvaluator(hierarchyTemplate, req.user.role);

    let teamsQuery = `
      SELECT
        t.id,
        t.name,
        t."regionId",
        t."managerId",
        t."companyId",
        t."createdAt",
        t."updatedAt",
        r.id AS region_id,
        r.name AS region_name,
        m.id AS manager_id,
        m.email AS manager_email,
        m."displayName" AS manager_name,
        m.role AS manager_role,
        COALESCE(m."isActive", true) AS manager_active
      FROM teams t
      LEFT JOIN regions r ON r.id = t."regionId"
      LEFT JOIN users m ON m.id = t."managerId"
    `;
    const teamParams = [];
    if (!includeAllCompanies) {
      teamParams.push(companyId);
      teamsQuery += ` WHERE t."companyId" = $${teamParams.length}`;
    }
    teamsQuery += '\nORDER BY t.name';

    const teamsResult = await pool.query(teamsQuery, teamParams);
    const teamIds = teamsResult.rows.map(row => row.id);

    let memberships = [];
    if (teamIds.length > 0) {
      const membershipsQuery = await pool.query(`
        SELECT
          ut.${teamCol} AS team_id,
          u.id AS user_id,
          u.email,
          u."displayName",
          u.role,
          u."isActive"
        FROM user_teams ut
        JOIN users u ON u.id = ut.${userCol}
        WHERE ut.${teamCol} = ANY($1)
      `, [teamIds]);
      memberships = membershipsQuery.rows;
    }

    const teamIdToMembers = new Map();
    for (const row of memberships) {
      if (!teamIdToMembers.has(row.team_id)) {
        teamIdToMembers.set(row.team_id, []);
      }
      teamIdToMembers.get(row.team_id).push({
        user: {
          id: row.user_id,
          email: row.email,
          displayName: row.displayName,
          role: row.role,
          isActive: row.isActive
        }
      });
    }

    const teams = teamsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      companyId: row.companyId,
      region: row.region_id ? { id: row.region_id, name: row.region_name } : null,
      manager: row.manager_id ? {
        id: row.manager_id,
        email: row.manager_email,
        displayName: row.manager_name,
        role: row.manager_role,
        isActive: row.manager_active
      } : null,
      userTeams: teamIdToMembers.get(row.id) || []
    }));

    console.log(`✅ Returning ${teams.length} organizations teams`);
    res.json(teams);
  } catch (error) {
    console.error('❌ Error fetching organizations teams:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'DatabaseError',
      statusCode: 500
    });
  }
});

app.get('/organizations/salespeople', authenticateToken, async (req, res) => {
  console.log('Organizations salespeople request from user:', req.user.email, 'role:', req.user.role);
  
  try {
    const { userCol, teamCol } = await getUserTeamsColumns(pool);
    const { companyId, includeAllCompanies } = resolveCompanyContext(req);
    const hierarchyTemplate = await getCompanyHierarchyTemplate(companyId);
    const targetRoles = getTargetRolesForEvaluator(hierarchyTemplate, req.user.role);
    
    // Hierarchical filtering based on role
    // REGIONAL_MANAGER sees SALES_LEADs in their teams
    // SALES_LEAD sees SALESPEOPLEs in their teams
    
           let query = `
      SELECT 
        u.id, u.email, u."displayName", u.role, u."isActive",
        t.id AS team_id, t.name AS team_name,
        ut.${userCol} AS user_id, ut.${teamCol} AS team_id_joined
             FROM users u
      LEFT JOIN user_teams ut ON u.id = ut.${userCol}
      LEFT JOIN teams t ON ut.${teamCol} = t.id
      WHERE u."isActive" = true
    `;

    const params = [];

    if (req.user.role === 'REGIONAL_MANAGER' || req.user.role === 'REGIONAL_SALES_MANAGER') {
      // Regional Managers can evaluate Sales Leads in their teams
      params.push(req.user.id);
      query += ` AND t."managerId" = $1`;
      if (targetRoles.length > 0) {
        params.push(targetRoles);
        query += ` AND u.role = ANY($${params.length}::text[])`;
      } else {
        query += ` AND u.role = 'SALES_LEAD'`;
      }
      console.log('🔍 Regional Manager filtering: Only showing SALES_LEADs in their teams');
    } else if (req.user.role === 'SALES_LEAD') {
      // Sales Leads can evaluate Salespeople in their teams
      // Include teams where the Sales Lead is either a member OR the manager.
      params.push(req.user.id);
      if (targetRoles.length > 0) {
        params.push(targetRoles);
        query += ` AND u.role = ANY($${params.length}::text[])`;
      } else {
        query += ` AND u.role = 'SALESPERSON'`;
      }
      query += ` AND t.id IN (
        SELECT ut2.${teamCol}
        FROM user_teams ut2
        WHERE ut2.${userCol} = $1
        UNION
        SELECT t2.id
        FROM teams t2
        WHERE t2."managerId" = $1
      )`;
      console.log('🔍 Sales Lead filtering: Only showing SALESPEOPLEs in their teams');
    } else if (req.user.role === 'SALESPERSON') {
      // A salesperson should only see themself
      params.push(req.user.id);
      query += ` AND u.id = $1`;
      console.log('🔍 Salesperson filtering: Only showing self');
    } else if (req.user.role === 'ADMIN' || req.user.role === 'SALES_DIRECTOR' || req.user.role === 'SUPER_ADMIN') {
      // Admins and Sales Directors can see everyone
      if (targetRoles.length > 0) {
        params.push(targetRoles);
        query += ` AND u.role = ANY($${params.length}::text[])`;
      } else {
        query += ` AND u.role IN ('SALESPERSON', 'SALES_LEAD')`;
      }
      console.log('🔍 Admin/Director filtering: Showing all salespeople and leads');
    } else {
      // Unknown role - return empty
      query += ` AND 1=0`;
      console.log('⚠️ Unknown role - returning empty list');
    }

    if (!includeAllCompanies) {
      params.push(companyId);
      query += ` AND u."companyId" = $${params.length}`;
    }
    
    console.log('📊 Query:', query);
    console.log('📊 Params:', params);
    
    const result = await pool.query(query, params);
    
    const salespeople = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      isActive: row.isActive,
      teamId: row.team_id,
      teamName: row.team_name
    }));
    
    console.log(`✅ Returning ${salespeople.length} evaluatable users for ${req.user.role} ${req.user.email}:`);
    salespeople.forEach(sp => console.log(`  - ${sp.displayName} (${sp.role}) from team ${sp.teamName}`));
    
    res.json(salespeople);
  } catch (error) {
    console.error('❌ Database error fetching salespeople:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: 'DatabaseError', 
      statusCode: 500 
    });
  }
});

// Get current user profile
app.get('/users/profile/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[PROFILE] Getting profile for user:', userId);

    const user = await pool.query(
      'SELECT id, email, "displayName", role, "isActive" FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.rows[0]);
  } catch (error) {
    console.error('[PROFILE] Error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Get user's own team with all members
app.get('/users/my-team', authenticateToken, async (req, res) => {
  console.log('My team request from user:', req.user.email, 'role:', req.user.role);
  
  try {
    const { companyId, includeAllCompanies } = resolveCompanyContext(req);
    const { userCol, teamCol } = await getUserTeamsColumns(pool);
    
    // Find the user's team(s): teams they belong to OR teams they manage.
    let userTeamsQuery = `
      SELECT t.id, t.name, t."managerId", t."regionId",
        r.name AS region_name,
        m.id AS manager_id, m.email AS manager_email, 
        m."displayName" AS manager_name, m.role AS manager_role
      FROM teams t
      LEFT JOIN user_teams ut ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      LEFT JOIN users m ON m.id = t."managerId"
      WHERE (ut.${userCol} = $1 OR t."managerId" = $1)
    `;
    const userTeamsParams = [req.user.id];
    if (!includeAllCompanies) {
      userTeamsQuery += ` AND t."companyId" = $${userTeamsParams.length + 1}`;
      userTeamsParams.push(companyId);
    }
    userTeamsQuery += `
      ORDER BY CASE WHEN t."managerId" = $1 THEN 0 ELSE 1 END, t."updatedAt" DESC
    `;
    
    const userTeamsResult = await pool.query(userTeamsQuery, userTeamsParams);
    
    if (userTeamsResult.rows.length === 0) {
      console.log('⚠️ User has no team membership');
      return res.json(null);
    }
    
    const managedTeam = userTeamsResult.rows.find(row => row.managerId === req.user.id);
    const teamRow = managedTeam || userTeamsResult.rows[0];
    const teamId = teamRow.id;
    
    console.log(`✅ Found team: ${teamRow.name} (${teamId})`);
    
    // Get all active members of this team for My Team screen.
    
    let membersQuery = `
      SELECT u.id, u.email, u."displayName", u.role, u."isActive"
      FROM users u
      INNER JOIN user_teams ut ON ut.${userCol} = u.id
      WHERE ut.${teamCol} = $1
        AND u."isActive" = true
    `;
    const memberParams = [teamId];
    // Do not restrict by subordinate roles here; My Team should show full team composition.
    membersQuery += `
      ORDER BY 
        CASE u.role
          WHEN 'REGIONAL_MANAGER' THEN 1
          WHEN 'REGIONAL_SALES_MANAGER' THEN 1
          WHEN 'SALES_LEAD' THEN 2
          WHEN 'SALESPERSON' THEN 3
          ELSE 4
        END,
        u."displayName"
    `;
    
    const membersResult = await pool.query(membersQuery, memberParams);
    
    console.log(`✅ Found ${membersResult.rows.length} team members`);
    
    const team = {
      id: teamRow.id,
      name: teamRow.name,
      managerId: teamRow.managerId,
      region: teamRow.region_name ? {
        id: teamRow.regionId,
        name: teamRow.region_name
      } : null,
      manager: teamRow.manager_id ? {
        id: teamRow.manager_id,
        email: teamRow.manager_email,
        displayName: teamRow.manager_name,
        role: teamRow.manager_role,
        isActive: true
      } : null,
      members: membersResult.rows.map(row => ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        role: row.role,
        isActive: row.isActive
      }))
    };
    
    console.log(`✅ Returning team ${team.name} with ${team.members.length} members`);
    res.json(team);
  } catch (error) {
    console.error('❌ Database error fetching my team:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: 'DatabaseError', 
      statusCode: 500 
    });
  }
});

// Public admin routes (fallback)
app.get('/public-admin/teams', authenticateToken, async (req, res) => {
  console.log('Public admin teams request from user:', req.user.email);
  
  try {
    // Ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "regionId" VARCHAR(255),
        "managerId" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_teams (
        id VARCHAR(255) PRIMARY KEY,
        "userId" VARCHAR(255) NOT NULL,
        "teamId" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "teamId")
      )
    `);

    // Fetch teams
    const { companyId, includeAllCompanies } = resolveCompanyContext(req);
    let teamsQuery = `
      SELECT 
        t.id, 
        t.name, 
        t."regionId", 
        t."managerId", 
        t."companyId",
        t."createdAt", 
        t."updatedAt",
        mu.id as mgr_id, 
        mu.email as mgr_email, 
        mu."displayName" as mgr_name, 
        mu.role as mgr_role,
        COALESCE(mu."isActive", true) as mgr_active
      FROM teams t
      LEFT JOIN users mu ON mu.id = t."managerId"
    `;
    const teamParams = [];
    if (!includeAllCompanies) {
      teamParams.push(companyId);
      teamsQuery += `WHERE t."companyId" = $${teamParams.length}\n`;
    }
    teamsQuery += 'ORDER BY t.name';

    const teamsResult = await pool.query(teamsQuery, teamParams);

    const teamIds = teamsResult.rows.map(r => r.id);

    // Fetch user-team memberships (supports both camelCase and snake_case schemas)
    let memberships = [];
    if (teamIds.length > 0) {
      const { userCol, teamCol } = await getUserTeamsColumns(pool);
      const mt = await pool.query(`
        SELECT ut.${teamCol} as team_id, u.id as user_id, u.email, u."displayName", u.role, u."isActive"
        FROM user_teams ut
        JOIN users u ON u.id = ut.${userCol}
        WHERE ut.${teamCol} = ANY($1)
      `, [teamIds]);
      memberships = mt.rows;
    }

    // Group memberships by team
    const teamIdToMembers = new Map();
    for (const row of memberships) {
      if (!teamIdToMembers.has(row.team_id)) teamIdToMembers.set(row.team_id, []);
      teamIdToMembers.get(row.team_id).push({
        user: {
          id: row.user_id,
          email: row.email,
          displayName: row.displayName,
          role: row.role,
          isActive: row.isActive
        }
      });
    }

    const teams = teamsResult.rows.map(row => {
      const userTeams = teamIdToMembers.get(row.id) || [];
      const members = userTeams.map(m => ({
        id: m.user.id,
        email: m.user.email,
        displayName: m.user.displayName,
        role: m.user.role,
        isActive: m.user.isActive
      }));

      return {
        id: row.id,
        name: row.name,
        companyId: row.companyId,
        region: row.regionId ? { id: row.regionId, name: row.regionId } : null,
        manager: row.managerId && row.mgr_id ? {
          id: row.mgr_id,
          email: row.mgr_email,
          displayName: row.mgr_name,
          role: row.mgr_role,
          isActive: row.mgr_active
        } : null,
        managerId: row.managerId,
        // Keep legacy field for compatibility
        userTeams,
        // New field expected by frontend Team interface
        members
      };
    });

    console.log(`Returning ${teams.length} teams with members for admin panel`);
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Assign members to a team
app.post('/public-admin/teams/:id/members', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body || {};

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    // Ensure team exists
    const teamExists = await pool.query('SELECT id FROM teams WHERE id = $1', [id]);
    if (teamExists.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Validate that users exist to avoid FK violations
    const usersResult = await pool.query(
      'SELECT id FROM users WHERE id = ANY($1::text[]) AND "isActive" = true',
      [userIds]
    );
    const existingUserIds = new Set(usersResult.rows.map(r => r.id));
    const missingUserIds = userIds.filter(u => !existingUserIds.has(u));
    if (missingUserIds.length > 0) {
      return res.status(400).json({ error: 'Some users do not exist', missingUserIds });
    }

    // Ensure membership table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_teams (
        id VARCHAR(255) PRIMARY KEY,
        "userId" VARCHAR(255) NOT NULL,
        "teamId" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "teamId")
      )
    `);

    // Detect schema style (camelCase vs snake_case)
    const { userCol, teamCol, createdCol, updatedCol } = await getUserTeamsColumns(pool);
    console.log('[UPDATE TEAM] Using columns:', { userCol, teamCol, createdCol, updatedCol });

    // Upsert memberships (one by one to surface specific failures)
    for (const userId of userIds) {
      // Build INSERT query based on available columns
      const columns = ['id', userCol, teamCol];
      const values = ['$1', '$2', '$3'];
      const params = [crypto.randomUUID(), userId, id];
      
      if (createdCol) {
        columns.push(createdCol);
        values.push('NOW()');
      }
      if (updatedCol) {
        columns.push(updatedCol);
        values.push('NOW()');
      }
      
      const updateClause = updatedCol ? ` DO UPDATE SET ${updatedCol} = NOW()` : ' DO NOTHING';
      const insertSql = `INSERT INTO user_teams (${columns.join(', ')})
                         VALUES (${values.join(', ')})
                         ON CONFLICT (${userCol}, ${teamCol})${updateClause}`;
      
      await pool.query(insertSql, params);
    }

    // Return updated team with members
    const teamRow = await pool.query(`
      SELECT 
        t.id, t.name, t."regionId", t."managerId",
        mu.id as mgr_id, mu.email as mgr_email, mu."displayName" as mgr_name, mu.role as mgr_role,
        COALESCE(mu."isActive", true) as mgr_active
      FROM teams t
      LEFT JOIN users mu ON mu.id = t."managerId"
      WHERE t.id = $1
    `, [id]);

    const members = await pool.query(`
      SELECT ut."teamId", u.id as user_id, u.email, u."displayName", u.role, u."isActive"
      FROM user_teams ut
      JOIN users u ON u.id = ut."userId"
      WHERE ut."teamId" = $1
    `, [id]);

    const row = teamRow.rows[0];
    const userTeams = members.rows.map(m => ({
      user: {
        id: m.user_id,
        email: m.email,
        displayName: m.displayName,
        role: m.role,
        isActive: m.isActive
      }
    }));

    const team = {
      id: row.id,
      name: row.name,
      region: row.regionId ? { id: row.regionId, name: row.regionId } : null,
      manager: row.managerId && row.mgr_id ? {
        id: row.mgr_id,
        email: row.mgr_email,
        displayName: row.mgr_name,
        role: row.mgr_role,
        isActive: row.mgr_active
      } : null,
      managerId: row.managerId,
      // Legacy field
      userTeams,
      // New field
      members: userTeams.map(m => ({
        id: m.user.id,
        email: m.user.email,
        displayName: m.user.displayName,
        role: m.user.role,
        isActive: m.user.isActive
      }))
    };

    res.json(team);
  } catch (error) {
    console.error('Error assigning team members:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Compatibility endpoint for admin panel: assign a single user to a team
app.post('/public-admin/assign-user-to-team', authenticateToken, async (req, res) => {
  console.log('[ASSIGN USER TO TEAM] Request body:', req.body);
  
  try {
    const { teamId, userId, userIds } = req.body || {};
    const finalTeamId = teamId;
    const finalUserIds = Array.isArray(userIds) && userIds.length > 0 
      ? userIds 
      : (userId ? [userId] : []);

    console.log('[ASSIGN USER TO TEAM] Team ID:', finalTeamId);
    console.log('[ASSIGN USER TO TEAM] User IDs:', finalUserIds);

    if (!finalTeamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    if (!Array.isArray(finalUserIds) || finalUserIds.length === 0) {
      return res.status(400).json({ error: 'userId or userIds is required' });
    }

    // Ensure team exists
    const teamExists = await pool.query('SELECT id FROM teams WHERE id = $1', [finalTeamId]);
    if (teamExists.rows.length === 0) {
      console.log('[ASSIGN USER TO TEAM] Team not found:', finalTeamId);
      return res.status(404).json({ error: 'Team not found' });
    }

    // Validate that users exist to avoid FK violations
    const usersResult = await pool.query(
      'SELECT id FROM users WHERE id = ANY($1::text[]) AND "isActive" = true',
      [finalUserIds]
    );
    const existingUserIds = new Set(usersResult.rows.map(r => r.id));
    const missingUserIds = finalUserIds.filter(u => !existingUserIds.has(u));
    if (missingUserIds.length > 0) {
      console.log('[ASSIGN USER TO TEAM] Missing users:', missingUserIds);
      return res.status(400).json({ error: 'Some users do not exist', missingUserIds });
    }

    // Ensure membership table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_teams (
        id VARCHAR(255) PRIMARY KEY,
        "userId" VARCHAR(255) NOT NULL,
        "teamId" VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("userId", "teamId")
      )
    `);

    // Detect schema style (camelCase vs snake_case)
    const { userCol, teamCol, createdCol, updatedCol } = await getUserTeamsColumns(pool);
    console.log('[ASSIGN USER TO TEAM] Using columns:', { userCol, teamCol, createdCol, updatedCol });

    // Upsert memberships
    for (const uid of finalUserIds) {
      // Build INSERT query based on available columns
      const columns = ['id', userCol, teamCol];
      const values = ['$1', '$2', '$3'];
      const params = [crypto.randomUUID(), uid, finalTeamId];
      
      if (createdCol) {
        columns.push(createdCol);
        values.push('NOW()');
      }
      if (updatedCol) {
        columns.push(updatedCol);
        values.push('NOW()');
      }
      
      const updateClause = updatedCol ? ` DO UPDATE SET ${updatedCol} = NOW()` : ' DO NOTHING';
      const insertSql = `INSERT INTO user_teams (${columns.join(', ')})
                         VALUES (${values.join(', ')})
                         ON CONFLICT (${userCol}, ${teamCol})${updateClause}`;
      
      console.log('[ASSIGN USER TO TEAM] Inserting membership:', { uid, finalTeamId });
      await pool.query(insertSql, params);
    }

    console.log('[ASSIGN USER TO TEAM] Successfully assigned users to team');
    return res.json({ message: 'Users assigned to team successfully', teamId: finalTeamId, userIds: finalUserIds });
  } catch (error) {
    console.error('[ASSIGN USER TO TEAM] Error:', error);
    console.error('[ASSIGN USER TO TEAM] Error stack:', error.stack);
    console.error('[ASSIGN USER TO TEAM] Error code:', error.code);
    console.error('[ASSIGN USER TO TEAM] Error detail:', error.detail);
    
    // Provide specific error messages
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'User is already a member of this team',
        detail: error.detail 
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Foreign key constraint violation',
        detail: error.detail 
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to assign user to team', 
      message: error.message,
      code: error.code
    });
  }
});

// Remove user from team (admin-only) - Support both POST and DELETE methods
const removeUserFromTeamHandler = async (req, res) => {
  // Require ADMIN
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { teamId, userId } = req.body || {};

    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log(`[REMOVE USER FROM TEAM] Removing user ${userId} from team ${teamId}`);

    // Detect schema style
    const { userCol, teamCol } = await getUserTeamsColumns(pool);

    // Remove membership
    const result = await pool.query(
      `DELETE FROM user_teams WHERE ${userCol} = $1 AND ${teamCol} = $2`,
      [userId, teamId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User is not a member of this team' });
    }

    console.log(`[REMOVE USER FROM TEAM] Successfully removed user from team`);

    res.json({
      message: 'User removed from team successfully',
      teamId,
      userId
    });
  } catch (error) {
    console.error('[REMOVE USER FROM TEAM] Error:', error);
    res.status(500).json({ 
      error: 'Failed to remove user from team', 
      message: error.message 
    });
  }
};

// Support both POST and DELETE methods for backward compatibility
app.post('/public-admin/remove-user-from-team', authenticateToken, removeUserFromTeamHandler);
app.delete('/public-admin/remove-user-from-team', authenticateToken, removeUserFromTeamHandler);

app.get('/public-admin/users', authenticateToken, async (req, res) => {
  console.log('Public admin users request from user:', req.user.email);
  
  try {
    const { companyId, includeAllCompanies } = resolveCompanyContext(req);

    let usersQuery = `
      SELECT id, email, "displayName", role, "isActive", "companyId", "createdAt", "updatedAt"
      FROM users
      WHERE "isActive" = true
    `;
    const params = [];
    if (!includeAllCompanies) {
      params.push(companyId);
      usersQuery += ` AND "companyId" = $${params.length}`;
    }
    usersQuery += ' ORDER BY "displayName", email';

    const result = await pool.query(usersQuery, params);
    
    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      isActive: row.isActive,
      companyId: row.companyId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      teamId: null,
      teamName: null,
      teamRole: null
    }));
    
    console.log(`Returning ${users.length} users for admin panel`);
    res.json(users);
  } catch (error) {
    console.error('Database error fetching users:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: 'DatabaseError', 
      statusCode: 500 
    });
  }
});

// User routes
app.get('/users', authenticateToken, (req, res) => {
  console.log('Users request from user:', req.user.email);
  // TODO: Connect to your real admin panel to get users data
  res.json([]);
});

// Scoring categories
app.get('/scoring/categories', authenticateToken, async (req, res) => {
  const customerType = req.query.customerType || req.query.customer_type || null;
  const includeMeta = req.query.meta === '1' || req.query.includeMeta === 'true';
  const { companyId } = resolveCompanyContext(req);
  console.log('🔍 [CATEGORIES] Request from:', req.user.email, 'role:', req.user.role);
  console.log('🔍 [CATEGORIES] Query params:', req.query);
  console.log('🔍 [CATEGORIES] customerType:', customerType, 'type:', typeof customerType);
  
  try {
    const featureFlags = await getCompanyFeatureFlags(companyId);
    const hierarchyTemplate = await getCompanyHierarchyTemplate(companyId);

    // Determine which form to return based on user role.
    // RM/RSM coaching must always evaluate SALES_LEAD, regardless of hierarchy rule order.
    let targetRole = null;
    let customerTypeFilter = null;

    if (req.user.role === 'REGIONAL_MANAGER' || req.user.role === 'REGIONAL_SALES_MANAGER') {
      targetRole = 'SALES_LEAD';
      console.log('🔍 Regional Manager - returning Sales Lead Coaching Evaluation');
    } else {
      const hierarchyTargetRoles = getTargetRolesForEvaluator(hierarchyTemplate, req.user.role);
      if (hierarchyTargetRoles.length > 0) {
        targetRole = hierarchyTargetRoles[0];
      }
    }

    if (!targetRole) {
      // SALES_LEAD and others evaluate SALESPERSON
      targetRole = 'SALESPERSON';
      // Check customerType for SALESPERSON evaluations
      if (customerType === 'high-share' || customerType === 'HIGH_SHARE' || customerType === 'high_share') {
        customerTypeFilter = 'HIGH_SHARE';
        console.log('🔍 Returning High Share Salesperson Evaluation for customerType:', customerType);
      } else {
        console.log('🔍 Returning Standard Salesperson Evaluation');
      }
    }
    
    // Build query based on customerType
    let categoriesQuery;
    let queryParams;

    const categoryColumnsResult = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'behavior_categories'
    `);
    const categoryColumns = new Set(categoryColumnsResult.rows.map(row => row.column_name));
    const categoryCompanyColumn = categoryColumns.has('companyId')
      ? '"companyId"'
      : (categoryColumns.has('company_id') ? 'company_id' : null);
    
    if (customerTypeFilter === 'HIGH_SHARE') {
      // For high-share, look for categories with HIGH_SHARE in name or a specific marker
      categoriesQuery = `
        SELECT bc.id, bc.name, bc."order", bc.weight
        FROM behavior_categories bc
        WHERE (
          (bc.name LIKE '%' || $1 || '%' AND bc.name LIKE '%HIGH_SHARE%')
          OR (bc.name LIKE '%' || $1 || '%' AND bc.name LIKE '%High Share%')
        )
      `;
      queryParams = [targetRole];
    } else {
      // Standard form - exclude high-share categories
      categoriesQuery = `
        SELECT bc.id, bc.name, bc."order", bc.weight
        FROM behavior_categories bc
        WHERE bc.name LIKE '%' || $1 || '%'
          AND (bc.name NOT LIKE '%HIGH_SHARE%' AND bc.name NOT LIKE '%High Share%')
      `;
      queryParams = [targetRole];
    }

    if (
      featureFlags.enableCompanyCustomization &&
      featureFlags.useLegacyEvaluationFlow === false &&
      categoryCompanyColumn
    ) {
      categoriesQuery += ` AND bc.${categoryCompanyColumn} = $${queryParams.length + 1}`;
      queryParams.push(companyId || DEFAULT_COMPANY_ID);
    }
    categoriesQuery += ' ORDER BY bc."order"';
    
    const categoriesResult = await pool.query(categoriesQuery, queryParams);
    console.log('🔍 [CATEGORIES] Query returned', categoriesResult.rows.length, 'categories');
    if (categoriesResult.rows.length > 0) {
      console.log('🔍 [CATEGORIES] First category:', categoriesResult.rows[0].name);
    }
    
    if (categoriesResult.rows.length === 0) {
      console.log('⚠️ No categories found, returning empty array');
      if (includeMeta) {
        const scoringProfileEmpty = await getCompanyScoringProfile(companyId);
        const ratingScaleEmpty =
          scoringProfileEmpty?.settings?.ratingScale === 'zero_to_four_na'
            ? 'zero_to_four_na'
            : 'legacy_1_4';
        return res.json({ categories: [], ratingScale: ratingScaleEmpty });
      }
      return res.json([]);
    }
    
    // Get items for each category
    const categories = [];
    for (const cat of categoriesResult.rows) {
      const itemsQuery = `
        SELECT bi.id, bi.name, bi."order", 1.0 as weight
        FROM behavior_items bi
        WHERE bi."categoryId" = $1 AND bi."isActive" = true
        ORDER BY bi."order"
      `;
      
      const itemsResult = await pool.query(itemsQuery, [cat.id]);
      
      categories.push({
        id: cat.id,
        name: cat.name,
        order: cat.order,
        weight: cat.weight,
        items: itemsResult.rows
      });
    }
    
    console.log(`✅ Returning ${categories.length} categories with ${categories.reduce((sum, c) => sum + c.items.length, 0)} items`);
    if (includeMeta) {
      const scoringProfile = await getCompanyScoringProfile(companyId);
      const ratingScale =
        scoringProfile?.settings?.ratingScale === 'zero_to_four_na' ? 'zero_to_four_na' : 'legacy_1_4';
      return res.json({ categories, ratingScale });
    }
    res.json(categories);
    
  } catch (error) {
    console.error('❌ Error fetching scoring categories:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: 'DatabaseError', 
      statusCode: 500 
    });
  }
});

/** Milestone 3 — active evaluation structure for PWA (legacy when none or legacy flow). */
app.get('/scoring/evaluation-structure', authenticateToken, async (req, res) => {
  try {
    const { companyId } = resolveCompanyContext(req);
    const customerType = req.query.customerType || req.query.customer_type || null;
    const featureFlags = await getCompanyFeatureFlags(companyId);
    if (featureFlags.useLegacyEvaluationFlow !== false) {
      return res.json({
        legacy: true,
        useLegacyEvaluationFlow: true,
        customerType: customerType || null,
      });
    }
    const cfg = await getCurrentPublishedEvaluationStructure(pool, companyId);
    if (!cfg) {
      return res.json({
        legacy: true,
        customerType: customerType || null,
      });
    }
    return res.json({
      legacy: false,
      customerType: customerType || null,
      structureVersionId: cfg.versionId,
      version: cfg.version,
      evaluationStructure: cfg.evaluationStructure,
      publishedAt: cfg.publishedAt,
      publishedBy: cfg.publishedBy,
      publishedByEmail: cfg.publishedByEmail || null,
    });
  } catch (error) {
    console.error('❌ Error fetching evaluation structure:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'DatabaseError',
      statusCode: 500,
    });
  }
});

/** PWA: company-scoped score range (1–4 vs 0–4 with 0 = N/A). */
app.get('/scoring/rating-scale', authenticateToken, async (req, res) => {
  try {
    const { companyId } = resolveCompanyContext(req);
    const scoringProfile = await getCompanyScoringProfile(companyId);
    const raw = scoringProfile?.settings?.ratingScale;
    const ratingScale = raw === 'zero_to_four_na' ? 'zero_to_four_na' : 'legacy_1_4';
    res.json({ ratingScale });
  } catch (error) {
    console.error('❌ Error fetching rating scale:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: 'DatabaseError',
      statusCode: 500,
    });
  }
});

// Analytics routes
app.use(
  '/analytics',
  createAnalyticsRouter({
    pool,
    authenticateToken,
    resolveCompanyContext,
    getUserTeamsColumns,
    getStoredEvaluations: () => storedEvaluations,
  })
);

// Helper functions
function getBehaviorItemName(itemId) {
  const items = {
    'coaching-1': 'Active Listening',
    'coaching-2': 'Questioning Skills',
    'coaching-3': 'Feedback Delivery',
    'coaching-4': 'Goal Setting',
    'coaching-5': 'Follow-up'
  };
  return items[itemId] || 'Unknown Item';
}

// Admin endpoint to get ALL evaluations (for analytics)
app.get('/public-admin/evaluations', authenticateToken, async (req, res) => {
  try {
    // Only allow ADMIN users to see all evaluations
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only ADMIN users can view all evaluations' });
    }

    console.log('Admin requesting all evaluations');

    // Get all evaluations with full details
    const evaluationsResult = await pool.query(`
      SELECT 
        e.id, e."salespersonId", e."managerId", e."visitDate",
        e."customerName", e.location, e."overallComment", e."overallScore",
        e.version, e."createdAt", e."updatedAt", e."companyId", e."evaluationStructureVersionId",
        e.metadata, e."configVersionId",
        sp."displayName" as salesperson_name, sp.email as salesperson_email, sp.role as salesperson_role,
        mg."displayName" as manager_name, mg.email as manager_email, mg.role as manager_role
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      ORDER BY e."createdAt" DESC
    `);

    // Get evaluation items for each evaluation
    const evaluations = [];
    for (const evalRow of evaluationsResult.rows) {
      const itemsResult = await pool.query(`
        SELECT 
          ei.id, ei."behaviorItemId", ei.rating, ei.comment,
          bi.name as behavior_item_name,
          bc.name as category_name
        FROM evaluation_items ei
        LEFT JOIN behavior_items bi ON bi.id = ei."behaviorItemId"
        LEFT JOIN behavior_categories bc ON bc.id = bi."categoryId"
        WHERE ei."evaluationId" = $1
        ORDER BY ei."createdAt"
      `, [evalRow.id]);
      
      const pinnedVersionId = evalRow.evaluationStructureVersionId || null;
      let pinnedStructureRow = null;
      if (pinnedVersionId) {
        pinnedStructureRow = await getEvaluationStructureVersionForCompany(
          pool,
          pinnedVersionId,
          evalRow.companyId || null
        );
      }

      evaluations.push({
        id: evalRow.id,
        salespersonId: evalRow.salespersonId,
        salesperson: {
          id: evalRow.salespersonId,
          displayName: evalRow.salesperson_name,
          email: evalRow.salesperson_email,
          role: evalRow.salesperson_role
        },
        managerId: evalRow.managerId,
        manager: {
          id: evalRow.managerId,
          displayName: evalRow.manager_name,
          email: evalRow.manager_email,
          role: evalRow.manager_role
        },
        visitDate: evalRow.visitDate,
        customerName: evalRow.customerName,
        location: evalRow.location,
        overallComment: evalRow.overallComment,
        overallScore: evalRow.overallScore,
        version: evalRow.version,
        createdAt: evalRow.createdAt,
        updatedAt: evalRow.updatedAt,
        configVersionId: evalRow.configVersionId ?? null,
        metadata:
          evalRow.metadata && typeof evalRow.metadata === 'object' ? evalRow.metadata : {},
        evaluationStructureVersionId: pinnedVersionId,
        resultView: buildResultView({
          evalRow,
          itemRows: itemsResult.rows,
          pinnedStructureRow,
        }),
        items: itemsResult.rows
      });
    }

    console.log(`✅ Returning ${evaluations.length} total evaluations to admin`);
    res.json(evaluations);
  } catch (error) {
    console.error('❌ Error fetching all evaluations:', error);
    res.status(500).json({ 
      message: 'Failed to fetch evaluations', 
      error: error.message 
    });
  }
});

// Endpoint to permanently delete a user
app.delete('/public-admin/users/:id', authenticateToken, async (req, res) => {
  try {
    // Only allow ADMIN users to delete users
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only ADMIN users can delete users' });
    }

    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Simple delete - just remove the user
    const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User permanently deleted',
      deletedUserId: userId
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Temporary endpoint to reset all user passwords to 'test123'
app.post('/admin/reset-passwords', authenticateToken, async (req, res) => {
  try {
    // Only allow ADMIN users to reset passwords
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only ADMIN users can reset passwords' });
    }

    const bcrypt = require('bcrypt');
    const newPassword = 'test123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update all active users with the new password
    const result = await pool.query(
      'UPDATE users SET password = $1, "updatedAt" = NOW() WHERE "isActive" = true',
      [hashedPassword]
    );

    // Get list of updated users
    const users = await pool.query(
      'SELECT id, email, "displayName", role FROM users WHERE "isActive" = true ORDER BY "displayName"'
    );

    res.json({
      message: 'All user passwords have been reset to: test123',
      updatedCount: result.rowCount,
      users: users.rows
    });

  } catch (error) {
    console.error('Error resetting passwords:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Dev-only AI playground: call OpenAI from local/staging to experiment with prompts.
 * Not for production traffic unless you explicitly enable and secure it.
 *
 * Env:
 *   AI_DEV_ENABLED=true
 *   OPENAI_API_KEY=sk-...
 * Optional: AI_DEV_BEARER_TOKEN=secret  → require Authorization: Bearer <secret> on /dev/ai/*
 *
 * This does NOT "train" a model — it sends chat requests. Fine-tuning is a separate OpenAI workflow.
 */
function devAiGate(req, res, next) {
  const token = process.env.AI_DEV_BEARER_TOKEN;
  if (!token) {
    return next();
  }
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Dev AI: missing or invalid Authorization Bearer token' });
  }
  return next();
}

/**
 * Whisper transcription for PWA evaluation comment dictation.
 * Registered always (not behind AI_DEV_ENABLED) so production works with OPENAI_API_KEY only.
 * PWA limits pasted/dictated text per field to 2000 chars client-side (MAX_DICTATION_COMMENT_CHARS).
 */
app.post('/dev/ai/transcribe', devAiGate, bodyParser.json({ limit: '100mb' }), async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not set' });
  }
  const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : 'audio/webm';
  const language = typeof req.body?.language === 'string' && req.body.language.trim() ? req.body.language.trim() : 'bg';
  const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : 'whisper-1';
  if (!audioBase64) {
    return res.status(400).json({ error: 'body.audioBase64 is required' });
  }

  try {
    const b64 = audioBase64.includes(',') ? audioBase64.split(',').pop() : audioBase64;
    const bytes = Buffer.from(b64 || '', 'base64');
    if (!bytes || bytes.length < 256) {
      return res.status(400).json({ error: 'Audio payload is too small' });
    }
    const ext =
      mimeType.includes('mp4') ? 'm4a' :
      mimeType.includes('wav') ? 'wav' :
      mimeType.includes('ogg') ? 'ogg' :
      mimeType.includes('mpeg') ? 'mp3' : 'webm';

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), `speech.${ext}`);
    form.append('model', model);
    form.append('language', language);

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json(data);
    }
    return res.json({ text: typeof data?.text === 'string' ? data.text : '', openai: data });
  } catch (error) {
    console.error('Transcribe error:', error);
    return res.status(500).json({ error: 'Transcribe failed', details: error.message });
  }
});

/**
 * Product context for Dev AI (chat / command / analyze-debrief). Keeps the model aligned with what the PWA is.
 * Optional: append AI_DEV_EXTRA_CONTEXT (plain text) for company- or env-specific notes.
 */
function getDevAiPwaContext() {
  const base = `You are assisting users inside the Sales Scorecard PWA (Progressive Web App): a web app for field sales organizations to record structured performance evaluations, view history and analytics, and collaborate with managers and teams.

What "PWA" means here: a browser-based app that can be installed on a device, focused on sales scorecards—not a generic "AI app."

How the app works at a high level:
- Users sign in against the backend API (JWT). Roles (e.g. salesperson, manager, director) control which screens and data they see.
- Evaluations use company-specific behavior categories and items from GET /scoring/categories (scorecard rows, typically rated 1–4).
- The Evaluation flow is the main scorecard submission; other areas include dashboard, history, analytics, teams, notifications, and role-specific views.
- Voice debrief (pilot) lets reps narrate a meeting in steps keyed to live scorecard items; answers can be analyzed in Dev AI with an optional rubric. That pilot data is local to the device unless submitted elsewhere by design.

Your role in Dev AI:
- Help users understand features, navigation, and how evaluation/debrief relate to the scorecard.
- You do not have direct access to the user's database, live scores, or secrets—only what the request includes.
- You are not "the product" making policy; stay accurate and say when something is unknown or environment-specific.
- Dev AI calls are stateless unless the client sends prior messages; there is no separate persistent ChatGPT memory for this app.`;

  const extra = process.env.AI_DEV_EXTRA_CONTEXT && String(process.env.AI_DEV_EXTRA_CONTEXT).trim();
  return extra ? `${base}\n\nAdditional context (from environment):\n${extra}` : base;
}

if (process.env.AI_DEV_ENABLED === 'true') {
  app.get('/dev/ai/status', devAiGate, (req, res) => {
    res.json({
      ok: true,
      hasApiKey: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()),
      bearerRequired: Boolean(process.env.AI_DEV_BEARER_TOKEN),
      nodeEnv: process.env.NODE_ENV || 'development',
      hint: 'POST /dev/ai/chat with JSON { "messages": [{ "role": "user", "content": "..." }], "model": "gpt-4o-mini" }'
    });
  });

  app.post('/dev/ai/chat', devAiGate, bodyParser.json({ limit: '512kb' }), async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
    if (!apiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not set' });
    }
    const messages = req.body && req.body.messages;
    const model =
      typeof req.body.model === 'string' && req.body.model.trim()
        ? req.body.model.trim()
        : 'gpt-4o-mini';
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Request body must include a non-empty "messages" array' });
    }
    const ctx = getDevAiPwaContext();
    const messagesWithContext =
      messages[0]?.role === 'system'
        ? [{ role: 'system', content: `${ctx}\n\n${messages[0].content}` }, ...messages.slice(1)]
        : [{ role: 'system', content: ctx }, ...messages];
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: messagesWithContext,
          temperature: typeof req.body.temperature === 'number' ? req.body.temperature : 0.3
        })
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json(data);
      }
      return res.json(data);
    } catch (error) {
      console.error('Dev AI chat error:', error);
      return res.status(500).json({ error: 'Dev AI request failed', details: error.message });
    }
  });

  const DEV_AI_ALLOWED_TABS = new Set([
    'dashboard',
    'history',
    'evaluation',
    'analytics',
    'export',
    'team',
    'teams',
    'notifications',
    'director-dashboard',
    'voice-debrief-pilot',
    'dev-ai-playground'
  ]);

  /** Natural-language command → JSON with optional in-app navigation (allowlist only). */
  app.post('/dev/ai/command', devAiGate, bodyParser.json({ limit: '32kb' }), async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
    if (!apiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not set' });
    }
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'body.text is required' });
    }
    const model =
      typeof req.body?.model === 'string' && req.body.model.trim()
        ? req.body.model.trim()
        : 'gpt-4o-mini';
    const system = `${getDevAiPwaContext()}

You are also the in-app dev assistant: users speak in natural language. Answer briefly using the product context above when relevant.

Return a single JSON object only (no markdown), with exactly these keys:
- "reply": string — short friendly confirmation or answer (you may explain what a screen is for using the context above).
- "navigate": string or null — ONLY if the user clearly wants to switch app screen. Must be one of these exact values or null:
  "dashboard","history","evaluation","analytics","export","team","teams","notifications","director-dashboard","voice-debrief-pilot","dev-ai-playground"
  Examples: "go to history" → navigate "history"; "open voice debrief" → "voice-debrief-pilot"; "dev ai" → "dev-ai-playground".
  If the request is not navigation, set navigate to null.`;

    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: text }
          ]
        })
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json(data);
      }
      const raw = data?.choices?.[0]?.message?.content;
      let parsed;
      try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : null;
      } catch {
        return res.status(502).json({ error: 'Model did not return valid JSON', raw });
      }
      let navigate = parsed && typeof parsed.navigate === 'string' ? parsed.navigate.trim() : null;
      if (navigate && !DEV_AI_ALLOWED_TABS.has(navigate)) {
        navigate = null;
      }
      return res.json({
        reply: typeof parsed?.reply === 'string' ? parsed.reply : '',
        navigate,
        openai: data
      });
    } catch (error) {
      console.error('Dev AI command error:', error);
      return res.status(500).json({ error: 'Dev AI command failed', details: error.message });
    }
  });

  /** Analyze voice-debrief Q&A → structured coaching outcome (JSON). */
  app.post('/dev/ai/analyze-debrief', devAiGate, bodyParser.json({ limit: '256kb' }), async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
    if (!apiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not set' });
    }
    const answers = req.body && req.body.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'body.answers must be an object (behaviorItemId -> answer text)' });
    }
    const rubric = req.body && req.body.rubric;
    const hasRubric =
      rubric &&
      typeof rubric === 'object' &&
      !Array.isArray(rubric) &&
      Array.isArray(rubric.categories);
    const model =
      typeof req.body?.model === 'string' && req.body.model.trim()
        ? req.body.model.trim()
        : 'gpt-4o-mini';
    const system = `${getDevAiPwaContext()}

You are a sales scorecard analyst for the Sales Scorecard PWA. The answers come from a self-service voice/text debrief aligned to the same behavior items as the formal evaluation form (pilot data is user-reported unless stated otherwise).

You receive:
(1) ANSWERS: object mapping behavior item id (UUID strings) to the salesperson's free-text answer for that behavior.
(2) Optional RUBRIC: company scorecard with categories (name, weight) and items (id, name, optional descriptions[] for levels 1–4).

When RUBRIC is provided, each key in ANSWERS must correspond to an item id in the rubric. Score each answered item on the SAME 1–4 scale as the scorecard (1 = poor, 4 = excellent). Use item descriptions when present to calibrate levels; otherwise use professional judgment from the behavior name.

When RUBRIC is missing, infer scores from behavior ids only if you can; otherwise focus on qualitative feedback.

Return a single JSON object only (no markdown) with these keys:
- "criterion_scores": array of objects, each: { "behavior_item_id": string, "name": string, "score": integer 1-4, "rationale": string (one sentence, evidence-based) }. Include one entry per answered item you can score; omit items with empty or non-informative answers and explain in "gaps".
- "overall_score": number between 1 and 4 (weighted by category weight when rubric provides weights; otherwise unweighted mean of criterion scores returned)
- "summary": string (2-4 sentences)
- "strengths": array of 1-4 short strings (evidence-based)
- "gaps": array of 1-4 short strings
- "suggested_actions": array of 1-4 concrete next steps
- "quality_score": integer 1-5 (how specific and useful the raw answers are for scoring)
- "quality_note": one short sentence

Base scores ONLY on evidence in each item's answer. Do not invent observed behaviors that were not described.`;

    const userPayload = hasRubric
      ? `RUBRIC_JSON:\n${JSON.stringify(rubric)}\n\nANSWERS_JSON:\n${JSON.stringify(answers, null, 2)}`
      : `ANSWERS_JSON:\n${JSON.stringify(answers, null, 2)}`;

    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.25,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPayload }
          ]
        })
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json(data);
      }
      const raw = data?.choices?.[0]?.message?.content;
      let outcome;
      try {
        outcome = typeof raw === 'string' ? JSON.parse(raw) : null;
      } catch {
        return res.status(502).json({ error: 'Model did not return valid JSON', raw });
      }
      return res.json({ outcome, openai: data });
    } catch (error) {
      console.error('Dev AI analyze-debrief error:', error);
      return res.status(500).json({ error: 'Dev AI analyze-debrief failed', details: error.message });
    }
  });

  console.log(
    '🤖 Dev AI routes: GET /dev/ai/status, POST /dev/ai/chat, POST /dev/ai/command, POST /dev/ai/analyze-debrief'
  );
}

if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
  console.log('🎤 POST /dev/ai/transcribe — Whisper (evaluation comment dictation; client caps text at 2000 chars/field)');
}

registerDirectorDashboardRoute(app, {
  pool,
  authenticateToken,
  resolveCompanyContext,
  getUserTeamsColumns,
  getStoredEvaluations: () => storedEvaluations,
});

// Additional admin panel endpoints
app.get('/public-admin/companies', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role === 'SUPER_ADMIN') {
      const result = await pool.query(`
        SELECT id, name, slug, "isActive", "createdAt", "updatedAt"
        FROM companies
        ORDER BY name
      `);
      return res.json(result.rows);
    }

    const companyId = req.user?.companyId || DEFAULT_COMPANY_ID;
    const result = await pool.query(`
      SELECT id, name, slug, "isActive", "createdAt", "updatedAt"
      FROM companies
      WHERE id = $1
    `, [companyId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/public-admin/companies', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only super administrators can create companies' });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const rawId = typeof body.id === 'string' ? body.id : '';
    const rawName = typeof body.name === 'string' ? body.name : '';
    const rawSlug = typeof body.slug === 'string' ? body.slug : '';
    const companyId = normalizeCompanyId(rawId);
    const name = rawName.trim();

    if (!companyId) {
      return res.status(400).json({ error: 'Invalid company id. Use letters, numbers, hyphens, or underscores.' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const slug =
      slugifyCompanyName(rawSlug) ||
      slugifyCompanyName(name) ||
      companyId.replace(/_/g, '-');

    if (!slug) {
      return res.status(400).json({ error: 'Unable to derive a slug for the company.' });
    }

    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;

    const result = await pool.query(
      `
        INSERT INTO companies (id, name, slug, "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id, name, slug, "isActive", "createdAt", "updatedAt"
      `,
      [companyId, name, slug, isActive]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'A company with this id or slug already exists.' });
    }
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company', details: error.message });
  }
});

app.post('/public-admin/companies/:companyId/seed-defaults', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only super administrators can seed company defaults' });
  }

  const rawCompanyId = typeof req.params.companyId === 'string' ? req.params.companyId.trim() : '';
  if (!rawCompanyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  try {
    const companyCheck = await pool.query('SELECT id FROM companies WHERE id = $1', [rawCompanyId]);
    if (companyCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
  } catch (error) {
    console.error('Error verifying company before seeding:', error);
    return res.status(500).json({ error: 'Failed to verify company', details: error.message });
  }

  const client = await pool.connect();
  const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
  const getTableColumns = async (tableName) => {
    const { rows } = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `,
      [tableName]
    );
    return rows.map((row) => row.column_name);
  };
  const detectColumn = (columns, candidates) => {
    for (const candidate of candidates) {
      if (columns.includes(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  let transactionStarted = false;

  try {
    const categoryColumns = await getTableColumns('behavior_categories');
    const itemColumns = await getTableColumns('behavior_items');

    const categoryCompanyColumn = detectColumn(categoryColumns, ['companyId', 'company_id']);
    const itemCompanyColumn = detectColumn(itemColumns, ['companyId', 'company_id']);
    const itemCategoryColumn = detectColumn(itemColumns, ['categoryId', 'category_id']);

    if (!categoryCompanyColumn || !itemCategoryColumn) {
      return res.status(200).json({
        message: 'Behavior templates are global in the current schema. No seeding required.'
      });
    }

    const existingCategoriesResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM behavior_categories WHERE ${quoteIdentifier(categoryCompanyColumn)} = $1`,
      [rawCompanyId]
    );

    if (existingCategoriesResult.rows[0].count > 0) {
      const existingItemsResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM behavior_items
          WHERE ${quoteIdentifier(itemCategoryColumn)} IN (
            SELECT id FROM behavior_categories WHERE ${quoteIdentifier(categoryCompanyColumn)} = $1
          )
        `,
        [rawCompanyId]
      );

      return res.json({
        message: 'Company already has behavior templates; no action taken.',
        categories: existingCategoriesResult.rows[0].count,
        items: existingItemsResult.rows[0].count
      });
    }

    const templateCategoriesResult = await client.query(
      `
        SELECT *
        FROM behavior_categories
        WHERE ${quoteIdentifier(categoryCompanyColumn)} = $1
        ORDER BY "order"
      `,
      [DEFAULT_COMPANY_ID]
    );

    if (templateCategoriesResult.rowCount === 0) {
      return res.status(400).json({
        error: 'No template categories available to seed from the default company.'
      });
    }

    await client.query('BEGIN');
    transactionStarted = true;

    const idMap = new Map();
    let categoriesInserted = 0;
    let itemsInserted = 0;

    for (const category of templateCategoriesResult.rows) {
      const newCategoryId = crypto.randomUUID();
      idMap.set(category.id, newCategoryId);

      const insertColumns = [];
      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      const pushValue = (column, value) => {
        insertColumns.push(quoteIdentifier(column));
        values.push(value);
        placeholders.push(`$${paramIndex++}`);
      };

      pushValue('id', newCategoryId);
      for (const columnName of categoryColumns) {
        if (
          columnName === 'id' ||
          columnName === categoryCompanyColumn ||
          columnName === 'createdAt' ||
          columnName === 'updatedAt'
        ) {
          continue;
        }

        if (!Object.prototype.hasOwnProperty.call(category, columnName)) {
          continue;
        }

        pushValue(columnName, category[columnName]);
      }

      if (categoryColumns.includes('createdAt')) {
        pushValue('createdAt', new Date());
      }
      if (categoryColumns.includes('updatedAt')) {
        pushValue('updatedAt', new Date());
      }
      pushValue(categoryCompanyColumn, rawCompanyId);

      const insertSql = `INSERT INTO behavior_categories (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`;
      await client.query(insertSql, values);
      categoriesInserted += 1;
    }

    for (const [sourceCategoryId, targetCategoryId] of idMap.entries()) {
      const itemsResult = await client.query(
        `SELECT * FROM behavior_items WHERE ${quoteIdentifier(itemCategoryColumn)} = $1`,
        [sourceCategoryId]
      );

      for (const item of itemsResult.rows) {
        const newItemId = crypto.randomUUID();

        const insertColumns = [];
        const values = [];
        const placeholders = [];
        let paramIndex = 1;

        const pushValue = (column, value) => {
          insertColumns.push(quoteIdentifier(column));
          values.push(value);
          placeholders.push(`$${paramIndex++}`);
        };

        pushValue('id', newItemId);
        for (const columnName of itemColumns) {
          if (
            columnName === 'id' ||
            columnName === itemCategoryColumn ||
            columnName === itemCompanyColumn ||
            columnName === 'createdAt' ||
            columnName === 'updatedAt'
          ) {
            continue;
          }

          if (!Object.prototype.hasOwnProperty.call(item, columnName)) {
            continue;
          }

          pushValue(columnName, item[columnName]);
        }

        pushValue(itemCategoryColumn, targetCategoryId);
        if (itemColumns.includes('createdAt')) {
          pushValue('createdAt', new Date());
        }
        if (itemColumns.includes('updatedAt')) {
          pushValue('updatedAt', new Date());
        }
        if (itemCompanyColumn) {
          pushValue(itemCompanyColumn, rawCompanyId);
        }

        const insertSql = `INSERT INTO behavior_items (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`;
        await client.query(insertSql, values);
        itemsInserted += 1;
      }
    }

    await client.query('COMMIT');
    transactionStarted = false;

    return res.json({
      message: 'Default behavior templates seeded successfully.',
      categories: categoriesInserted,
      items: itemsInserted
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch((rollbackError) => {
        console.error('Error rolling back seed transaction:', rollbackError);
      });
    }
    console.error('Error seeding company defaults:', error);
    return res.status(500).json({ error: 'Failed to seed company defaults', details: error.message });
  } finally {
    client.release();
  }
});

app.get('/public-admin/companies/:companyId/config', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can view company configuration' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  try {
    const [flags, scoringProfile, hierarchyTemplate, metaCfg] = await Promise.all([
      getCompanyFeatureFlags(companyId),
      getCompanyScoringProfile(companyId),
      getCompanyHierarchyTemplate(companyId),
      getCurrentPublishedMetadataConfig(pool, companyId)
    ]);
    const evaluationMetadataActive =
      metaCfg == null
        ? {
            legacy: true,
            hasPublishedSchema: false,
            currentVersionSummary: null,
            evaluationMetadataPreview: null,
          }
        : {
            legacy: false,
            hasPublishedSchema: true,
            currentVersionSummary: buildCurrentVersionSummary({
              versionId: metaCfg.versionId,
              version: metaCfg.version,
              metadataSchema: metaCfg.metadataSchema,
              publishedAt: metaCfg.publishedAt,
              publishedBy: metaCfg.publishedBy,
              publishedByEmail: metaCfg.publishedByEmail,
            }),
            evaluationMetadataPreview: buildMetadataPreviewForUsers(metaCfg.metadataSchema),
          };
    res.json({
      companyId,
      featureFlags: flags,
      scoringProfile,
      hierarchyTemplate,
      evaluationMetadataActive,
    });
  } catch (error) {
    console.error('Error getting company config:', error);
    res.status(500).json({ error: 'Failed to load company configuration' });
  }
});

/** Milestone 1 — current published evaluation metadata schema (optional fields per company). */
app.get('/public-admin/companies/:companyId/evaluation-metadata-config', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can view evaluation metadata configuration' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  try {
    const cfg = await getCurrentPublishedMetadataConfig(pool, companyId);
    if (!cfg) {
      return res.json({
        companyId,
        legacy: true,
        currentPublishedVersionId: null,
        version: null,
        publishedAt: null,
        publishedBy: null,
        publishedByEmail: null,
        metadataSchema: null,
        currentVersionSummary: null,
        evaluationMetadataPreview: null,
      });
    }
    const rowForSummary = {
      versionId: cfg.versionId,
      version: cfg.version,
      metadataSchema: cfg.metadataSchema,
      publishedAt: cfg.publishedAt,
      publishedBy: cfg.publishedBy,
      publishedByEmail: cfg.publishedByEmail,
    };
    return res.json({
      companyId,
      legacy: false,
      currentPublishedVersionId: cfg.versionId,
      version: cfg.version,
      publishedAt: cfg.publishedAt,
      publishedBy: cfg.publishedBy,
      publishedByEmail: cfg.publishedByEmail || null,
      metadataSchema: cfg.metadataSchema,
      currentVersionSummary: buildCurrentVersionSummary(rowForSummary),
      evaluationMetadataPreview: buildMetadataPreviewForUsers(cfg.metadataSchema),
    });
  } catch (error) {
    console.error('Error getting evaluation metadata config:', error);
    res.status(500).json({ error: 'Failed to load evaluation metadata configuration' });
  }
});

/**
 * Read-only preview: how evaluation metadata fields appear to end users (ordered, visible fields only).
 */
app.get('/public-admin/companies/:companyId/evaluation-metadata-schema/preview', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can preview evaluation metadata schema' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  try {
    const cfg = await getCurrentPublishedMetadataConfig(pool, companyId);
    if (!cfg) {
      return res.json({
        companyId,
        legacy: true,
        preview: null,
        currentVersionSummary: null,
      });
    }
    const rowForSummary = {
      versionId: cfg.versionId,
      version: cfg.version,
      metadataSchema: cfg.metadataSchema,
      publishedAt: cfg.publishedAt,
      publishedBy: cfg.publishedBy,
      publishedByEmail: cfg.publishedByEmail,
    };
    return res.json({
      companyId,
      legacy: false,
      preview: buildMetadataPreviewForUsers(cfg.metadataSchema),
      currentVersionSummary: buildCurrentVersionSummary(rowForSummary),
    });
  } catch (error) {
    console.error('Error previewing evaluation metadata schema:', error);
    res.status(500).json({ error: 'Failed to load evaluation metadata preview' });
  }
});

/** Milestone 1 — publish a new metadata schema version (creates version row + sets current). */
app.post('/public-admin/companies/:companyId/evaluation-metadata-schema/publish', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can publish evaluation metadata schema' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  const metadataSchema = req.body?.metadataSchema;
  if (!metadataSchema || typeof metadataSchema !== 'object' || Array.isArray(metadataSchema)) {
    return res.status(400).json({ error: 'Body must include metadataSchema object.' });
  }
  const confirmReplace = req.body?.confirmReplace === true;
  try {
    const result = await publishEvaluationMetadataSchema(
      pool,
      companyId,
      metadataSchema,
      req.user?.id || null,
      { confirmReplace }
    );
    return res.status(201).json({
      message: 'Evaluation metadata schema published.',
      companyId,
      currentPublishedVersionId: result.versionId,
      version: result.version,
      publishedAt: result.publishedAt,
      publishedBy: result.publishedBy,
      replacedVersion: result.replacedVersion,
      replacedVersionId: result.replacedVersionId,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: error.message,
        code: error.code || 'INVALID_METADATA_SCHEMA',
        validationErrors: error.validationErrors || undefined,
      });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: error.message,
        code: error.code || 'METADATA_REPLACE_CONFIRMATION_REQUIRED',
        details: error.details,
      });
    }
    console.error('Error publishing evaluation metadata schema:', error);
    res.status(500).json({ error: 'Failed to publish evaluation metadata schema', details: error.message });
  }
});

/** Milestone 3 — current published evaluation structure (read-only for admin). */
app.get('/public-admin/companies/:companyId/evaluation-structure-config', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can view evaluation structure configuration' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  try {
    const flags = await getCompanyFeatureFlags(companyId);
    const cfg = await getCurrentPublishedEvaluationStructure(pool, companyId);
    if (flags.useLegacyEvaluationFlow !== false || !cfg) {
      return res.json({
        companyId,
        legacy: true,
        currentPublishedVersionId: null,
        version: null,
        publishedAt: null,
        publishedBy: null,
        publishedByEmail: null,
        evaluationStructure: null,
        currentVersionSummary: null,
        evaluationStructurePreview: null,
      });
    }
    const rowForSummary = {
      versionId: cfg.versionId,
      version: cfg.version,
      evaluationStructure: cfg.evaluationStructure,
      publishedAt: cfg.publishedAt,
      publishedBy: cfg.publishedBy,
      publishedByEmail: cfg.publishedByEmail,
    };
    return res.json({
      companyId,
      legacy: false,
      currentPublishedVersionId: cfg.versionId,
      version: cfg.version,
      publishedAt: cfg.publishedAt,
      publishedBy: cfg.publishedBy,
      publishedByEmail: cfg.publishedByEmail || null,
      evaluationStructure: cfg.evaluationStructure,
      currentVersionSummary: buildStructureSummaryRow(rowForSummary),
      evaluationStructurePreview: buildStructurePreviewPayload(cfg.evaluationStructure),
    });
  } catch (error) {
    console.error('Error getting evaluation structure config:', error);
    res.status(500).json({ error: 'Failed to load evaluation structure configuration' });
  }
});

app.get('/public-admin/companies/:companyId/evaluation-structure/preview', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can preview evaluation structure' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  try {
    const flags = await getCompanyFeatureFlags(companyId);
    const cfg = await getCurrentPublishedEvaluationStructure(pool, companyId);
    if (flags.useLegacyEvaluationFlow !== false || !cfg) {
      return res.json({
        companyId,
        legacy: true,
        preview: null,
        currentVersionSummary: null,
      });
    }
    const rowForSummary = {
      versionId: cfg.versionId,
      version: cfg.version,
      evaluationStructure: cfg.evaluationStructure,
      publishedAt: cfg.publishedAt,
      publishedBy: cfg.publishedBy,
      publishedByEmail: cfg.publishedByEmail,
    };
    return res.json({
      companyId,
      legacy: false,
      preview: buildStructurePreviewPayload(cfg.evaluationStructure),
      currentVersionSummary: buildStructureSummaryRow(rowForSummary),
    });
  } catch (error) {
    console.error('Error previewing evaluation structure:', error);
    res.status(500).json({ error: 'Failed to load evaluation structure preview' });
  }
});

app.post('/public-admin/companies/:companyId/evaluation-structure/publish', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can publish evaluation structure' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  const evaluationStructure = req.body?.evaluationStructure;
  if (!evaluationStructure || typeof evaluationStructure !== 'object' || Array.isArray(evaluationStructure)) {
    return res.status(400).json({ error: 'Body must include evaluationStructure object.' });
  }
  const confirmReplace = req.body?.confirmReplace === true;
  try {
    const result = await publishEvaluationStructure(
      pool,
      companyId,
      evaluationStructure,
      req.user?.id || null,
      { confirmReplace }
    );
    return res.status(201).json({
      message: 'Evaluation structure published.',
      companyId,
      currentPublishedVersionId: result.versionId,
      version: result.version,
      publishedAt: result.publishedAt,
      publishedBy: result.publishedBy,
      replacedVersion: result.replacedVersion,
      replacedVersionId: result.replacedVersionId,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: error.message,
        code: error.code || 'INVALID_EVALUATION_STRUCTURE',
        validationErrors: error.validationErrors || undefined,
      });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: error.message,
        code: error.code || 'STRUCTURE_REPLACE_CONFIRMATION_REQUIRED',
        details: error.details,
      });
    }
    console.error('Error publishing evaluation structure:', error);
    res.status(500).json({ error: 'Failed to publish evaluation structure', details: error.message });
  }
});

app.put('/public-admin/companies/:companyId/config', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can update company configuration' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  const featureFlags = req.body?.featureFlags || {};
  const scoringProfile = req.body?.scoringProfile || {};
  const hierarchyTemplate = req.body?.hierarchyTemplate || {};

  const normalizedRules = Array.isArray(hierarchyTemplate.rules)
    ? hierarchyTemplate.rules
        .filter(rule => typeof rule?.evaluatorRole === 'string' && Array.isArray(rule?.targetRoles))
        .map(rule => ({
          evaluatorRole: rule.evaluatorRole,
          targetRoles: rule.targetRoles.filter(role => typeof role === 'string')
        }))
    : getDefaultHierarchyTemplate().rules;

  const mode = typeof scoringProfile.mode === 'string' ? scoringProfile.mode : 'legacy_average';
  const settings = scoringProfile.settings && typeof scoringProfile.settings === 'object'
    ? scoringProfile.settings
    : {};

  try {
    await pool.query(
      `
        INSERT INTO company_feature_flags ("companyId", "enableCompanyCustomization", "useLegacyEvaluationFlow", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT ("companyId")
        DO UPDATE SET
          "enableCompanyCustomization" = EXCLUDED."enableCompanyCustomization",
          "useLegacyEvaluationFlow" = EXCLUDED."useLegacyEvaluationFlow",
          "updatedAt" = NOW()
      `,
      [
        companyId,
        featureFlags.enableCompanyCustomization === true,
        featureFlags.useLegacyEvaluationFlow !== false
      ]
    );

    await pool.query(
      `
        INSERT INTO company_scoring_profiles ("companyId", mode, settings, "createdAt", "updatedAt")
        VALUES ($1, $2, $3::jsonb, NOW(), NOW())
        ON CONFLICT ("companyId")
        DO UPDATE SET
          mode = EXCLUDED.mode,
          settings = EXCLUDED.settings,
          "updatedAt" = NOW()
      `,
      [companyId, mode, JSON.stringify(settings)]
    );

    await pool.query(
      `
        INSERT INTO company_hierarchy_templates ("companyId", template, "createdAt", "updatedAt")
        VALUES ($1, $2::jsonb, NOW(), NOW())
        ON CONFLICT ("companyId")
        DO UPDATE SET
          template = EXCLUDED.template,
          "updatedAt" = NOW()
      `,
      [companyId, JSON.stringify({ rules: normalizedRules })]
    );

    const result = await Promise.all([
      getCompanyFeatureFlags(companyId),
      getCompanyScoringProfile(companyId),
      getCompanyHierarchyTemplate(companyId)
    ]);

    res.json({
      message: 'Company configuration updated successfully',
      companyId,
      featureFlags: result[0],
      scoringProfile: result[1],
      hierarchyTemplate: result[2]
    });
  } catch (error) {
    console.error('Error updating company config:', error);
    res.status(500).json({ error: 'Failed to update company configuration', details: error.message });
  }
});

app.get('/public-admin/companies/:companyId/form-template', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can view form templates' });
  }
  const companyId = (req.params.companyId || '').trim();
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  try {
    const template = await loadCompanyBehaviorTemplate(companyId);
    res.json({ companyId, categories: template });
  } catch (error) {
    console.error('Error loading company form template:', error);
    res.status(500).json({ error: 'Failed to load form template', details: error.message });
  }
});

app.put('/public-admin/companies/:companyId/form-template', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can update form templates' });
  }
  const companyId = (req.params.companyId || '').trim();
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }
  if (categories.length === 0) {
    return res.status(400).json({ error: 'At least one category is required.' });
  }

  const client = await pool.connect();
  try {
    const {
      categoryCompanyColumn,
      itemCompanyColumn,
      categoryIdColumn,
      hasItemWeight,
      hasItemIsActive,
      itemIsActiveColumn
    } = await getBehaviorSchemaInfo();
    if (!categoryCompanyColumn) {
      return res.status(400).json({ error: 'Current schema does not support company-scoped form templates.' });
    }

    await client.query('BEGIN');

    // Remove existing company template rows and replace atomically.
    const existingCategoriesResult = await client.query(
      `SELECT id FROM behavior_categories WHERE ${categoryCompanyColumn} = $1`,
      [companyId]
    );
    const existingCategoryIds = existingCategoriesResult.rows.map(row => row.id);
    if (existingCategoryIds.length > 0) {
      await client.query(
        `DELETE FROM behavior_items WHERE ${categoryIdColumn} = ANY($1::text[])`,
        [existingCategoryIds]
      );
    }
    await client.query(
      `DELETE FROM behavior_categories WHERE ${categoryCompanyColumn} = $1`,
      [companyId]
    );

    for (const [catIndex, category] of categories.entries()) {
      const categoryId = category.id && typeof category.id === 'string' ? category.id : crypto.randomUUID();
      await client.query(
        `INSERT INTO behavior_categories (id, name, "order", weight, ${categoryCompanyColumn}, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          categoryId,
          category.name || `Category ${catIndex + 1}`,
          Number.isFinite(Number(category.order)) ? Number(category.order) : catIndex + 1,
          Number.isFinite(Number(category.weight)) ? Number(category.weight) : 1,
          companyId
        ]
      );

      const items = Array.isArray(category.items) ? category.items : [];
      for (const [itemIndex, item] of items.entries()) {
        const itemId = item.id && typeof item.id === 'string' ? item.id : crypto.randomUUID();
        const insertColumns = ['id', categoryIdColumn, 'name', '"order"', '"createdAt"', '"updatedAt"'];
        const insertValues = [
          itemId,
          categoryId,
          item.name || `Item ${itemIndex + 1}`,
          Number.isFinite(Number(item.order)) ? Number(item.order) : itemIndex + 1,
          new Date(),
          new Date()
        ];
        if (hasItemWeight) {
          insertColumns.splice(4, 0, 'weight');
          insertValues.splice(4, 0, Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1);
        }
        if (hasItemIsActive && itemIsActiveColumn) {
          insertColumns.splice(hasItemWeight ? 5 : 4, 0, itemIsActiveColumn);
          insertValues.splice(hasItemWeight ? 5 : 4, 0, item.isActive !== false);
        }
        if (itemCompanyColumn) {
          insertColumns.splice(2, 0, itemCompanyColumn);
          insertValues.splice(2, 0, companyId);
        }
        const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
        await client.query(
          `INSERT INTO behavior_items (${insertColumns.join(', ')}) VALUES (${placeholders})`,
          insertValues
        );
      }
    }

    await client.query('COMMIT');
    const saved = await loadCompanyBehaviorTemplate(companyId);
    res.json({
      message: 'Company form template updated successfully',
      companyId,
      categories: saved
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating company form template:', error);
    res.status(500).json({ error: 'Failed to update form template', details: error.message });
  } finally {
    client.release();
  }
});

app.get('/public-admin/regions', authenticateToken, async (req, res) => {
  try {
    const { companyId, includeAllCompanies } = resolveCompanyContext(req);
    let query = `
      SELECT id, name, "companyId", "createdAt", "updatedAt"
      FROM regions
    `;
    const params = [];
    if (!includeAllCompanies) {
      params.push(companyId);
      query += `WHERE "companyId" = $${params.length}\n`;
    }
    query += 'ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update region name
app.put('/public-admin/regions/:id', authenticateToken, async (req, res) => {
  try {
    // Only allow ADMIN users to update regions
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can update regions' });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Region name is required' });
    }

    const result = await pool.query(`
      UPDATE regions
      SET name = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING id, name, "createdAt", "updatedAt"
    `, [name.trim(), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    console.log(`✅ Region updated: ${id} -> ${name}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating region:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create new region
app.post('/public-admin/regions', authenticateToken, async (req, res) => {
  try {
    // Only allow ADMIN users to create regions
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can create regions' });
    }

    const { id, name } = req.body;

    if (!id || !name || id.trim() === '' || name.trim() === '') {
      return res.status(400).json({ error: 'Region ID and name are required' });
    }

    const result = await pool.query(`
      INSERT INTO regions (id, name, "createdAt", "updatedAt")
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id, name, "createdAt", "updatedAt"
    `, [id.trim(), name.trim()]);

    console.log(`✅ Region created: ${id} -> ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Region with this ID already exists' });
    }
    console.error('Error creating region:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete region
app.delete('/public-admin/regions/:id', authenticateToken, async (req, res) => {
  try {
    // Only allow ADMIN users to delete regions
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can delete regions' });
    }

    const { id } = req.params;

    // Check if region is in use
    const teamsUsingRegion = await pool.query(`
      SELECT COUNT(*) as count FROM teams WHERE "regionId" = $1
    `, [id]);

    if (parseInt(teamsUsingRegion.rows[0].count) > 0) {
      return res.status(409).json({ 
        error: 'Cannot delete region that is assigned to teams',
        teamsCount: parseInt(teamsUsingRegion.rows[0].count)
      });
    }

    const result = await pool.query(`
      DELETE FROM regions WHERE id = $1
      RETURNING id, name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    console.log(`✅ Region deleted: ${id}`);
    res.json({ message: 'Region deleted successfully', region: result.rows[0] });
  } catch (error) {
    console.error('Error deleting region:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Setup teams table endpoint
app.get('/debug/setup-teams-table', authenticateToken, async (req, res) => {
  try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS teams (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            "regionId" VARCHAR(255),
            "managerId" VARCHAR(255),
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
          )
        `);
    
    res.json({ message: 'Teams table created successfully' });
  } catch (error) {
    console.error('Error creating teams table:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// User management endpoints
app.post('/public-admin/users', authenticateToken, async (req, res) => {
  try {
    const { displayName, email, password, role } = req.body;
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    const { companyId: contextCompanyId } = resolveCompanyContext(req);
    const requestedCompanyId = typeof req.body?.companyId === 'string' ? req.body.companyId.trim() : '';
    const targetCompanyId = requestedCompanyId || contextCompanyId || DEFAULT_COMPANY_ID;
    
    const result = await pool.query(
      'INSERT INTO users (id, email, password, "displayName", role, "companyId", "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id, email, "displayName", role, "isActive", "companyId"',
      [crypto.randomUUID(), email, hashedPassword, displayName, role, targetCompanyId, true]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/public-admin/users/:id', authenticateToken, async (req, res) => {
  console.log('🚨 [UPDATE USER] ENDPOINT CALLED - Line 3363');
  try {
    const { id } = req.params;
    const { displayName, email, role, isActive } = req.body;
    
    console.log('🔵 [UPDATE USER] Request received:', { 
      id, 
      displayName, 
      email, 
      role, 
      isActive,
      isActiveType: typeof isActive,
      bodyKeys: Object.keys(req.body || {})
    });
    
    // Validate required fields
    if (!displayName || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields: displayName, email, role' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user exists and get companyId
    // Try to get companyId, but handle if column doesn't exist
    let userCheck;
    let existingUser;
    let companyId = DEFAULT_COMPANY_ID;
    
    try {
      userCheck = await pool.query('SELECT id, email, "isActive", "companyId" FROM users WHERE id = $1', [id]);
    } catch (colError) {
      // If companyId column doesn't exist, try without it
      if (colError.code === '42703') { // undefined_column
        userCheck = await pool.query('SELECT id, email, "isActive" FROM users WHERE id = $1', [id]);
      } else {
        throw colError;
      }
    }
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    existingUser = userCheck.rows[0];
    companyId = existingUser.companyId || DEFAULT_COMPANY_ID;
    
    // Check if email is being changed and if it's already taken by another user
    if (email && email !== existingUser.email) {
      let emailCheck;
      try {
        // Try with companyId check first
        emailCheck = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2 AND "companyId" = $3',
          [email, id, companyId]
        );
      } catch (colError) {
        // If companyId column doesn't exist, check without it
        if (colError.code === '42703') {
          emailCheck = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, id]
          );
        } else {
          throw colError;
        }
      }
      
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already taken by another user' });
      }
    }
    
    // Determine isActive value - use existing value if not provided, default to true if null/undefined
    let activeValue;
    if (isActive !== undefined && isActive !== null) {
      activeValue = isActive === true || isActive === 'true' || isActive === 1;
    } else {
      // Use existing value, but default to true if it's null/undefined
      // Handle case where existingUser.isActive might be null in database
      const existingIsActive = existingUser.isActive;
      if (existingIsActive === null || existingIsActive === undefined) {
        activeValue = true; // Default to true if null/undefined
      } else {
        activeValue = existingIsActive;
      }
    }
    // Ensure it's a boolean, not null - this is critical!
    // Convert to boolean explicitly, defaulting to true if null/undefined/false
    if (activeValue === null || activeValue === undefined) {
      activeValue = true;
    } else {
      activeValue = Boolean(activeValue);
    }
    
    console.log('🟢 [UPDATE USER] isActive processing:', { 
      provided: isActive, 
      providedType: typeof isActive,
      existing: existingUser.isActive,
      existingType: typeof existingUser.isActive,
      final: activeValue,
      finalType: typeof activeValue,
      isBoolean: activeValue === true || activeValue === false
    });
    
    // Update user - DO NOT change companyId, only update the fields that can be changed
    let result;
    try {
      // Try to include companyId in RETURNING clause, but don't SET it (preserve existing value)
      result = await pool.query(
        'UPDATE users SET "displayName" = $1, email = $2, role = $3, "isActive" = $4, "updatedAt" = NOW() WHERE id = $5 RETURNING id, email, "displayName", role, "isActive", "companyId"',
        [displayName, email, role, activeValue, id]
      );
    } catch (updateError) {
      // If companyId column doesn't exist in RETURNING, try without it
      if (updateError.code === '42703') {
        result = await pool.query(
          'UPDATE users SET "displayName" = $1, email = $2, role = $3, "isActive" = $4, "updatedAt" = NOW() WHERE id = $5 RETURNING id, email, "displayName", role, "isActive"',
          [displayName, email, role, activeValue, id]
        );
      } else {
        throw updateError;
      }
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error detail:', error.detail);
    console.error('Error constraint:', error.constraint);
    
    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Email already exists' });
    }
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({ error: 'Invalid reference data' });
    }
    if (error.code === '23502') { // Not null constraint violation
      return res.status(400).json({ error: 'Required field is missing', field: error.column });
    }
    
    // Always return error details for debugging
    res.status(500).json({ 
      error: 'Database error', 
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
  }
});

app.post('/public-admin/users/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE users SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1 RETURNING id, email, "displayName", role, "isActive"',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/public-admin/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if user exists
    const checkResult = await pool.query('SELECT id, email, "displayName" FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = checkResult.rows[0];
    
    // Clean up references to avoid FK violations
    // 1) Remove memberships in user_teams (support both schema variants)
    await pool.query('DELETE FROM user_teams WHERE "userId" = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM user_teams WHERE user_id = $1', [id]).catch(() => {});

    // 2) If the user manages any teams, clear managerId
    await pool.query('UPDATE teams SET "managerId" = NULL, "updatedAt" = NOW() WHERE "managerId" = $1', [id]).catch(() => {});

    // 3) Clean up push subscriptions
    await pool.query('DELETE FROM push_subscriptions WHERE "userId" = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [id]).catch(() => {});

    // 4) Best-effort cleanup of other potential references if such tables exist
    const candidates = [
      { table: 'evaluations', cols: ['managerId', 'salespersonId', 'manager_id', 'salesperson_id'] },
      { table: 'refresh_tokens', cols: ['userId', 'user_id'] },
      { table: 'user_roles', cols: ['userId', 'user_id'] },
      { table: 'audit_logs', cols: ['userId', 'user_id'] }
    ];
    for (const c of candidates) {
      try {
        const exists = await pool.query('SELECT 1 FROM information_schema.tables WHERE table_name = $1', [c.table]);
        if (exists.rowCount > 0) {
          for (const col of c.cols) {
            await pool.query(`DELETE FROM ${c.table} WHERE "${col}" = $1`, [id]).catch(() => {});
          }
        }
      } catch (_) { /* ignore */ }
    }
    
    // Delete the user
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    // If FK violation, fallback to anonymize (force-delete behavior) so UI keeps working
    if (error && (error.code === '23503' || /foreign key/i.test(String(error.detail||error.message)))) {
      try {
        const anonEmail = `deleted+${req.params.id}@instorm.io`;
        await pool.query('UPDATE users SET email = $1, "displayName" = $2, "isActive" = false, role = $3, "updatedAt" = NOW() WHERE id = $4',
          [anonEmail, 'Deleted User', 'SALESPERSON', req.params.id]);
        return res.status(200).json({ message: 'User anonymized due to FK constraints', forced: true });
      } catch (e2) {
        console.error('Fallback anonymize failed:', e2);
      }
    }
    res.status(500).json({ error: 'Database error', detail: error?.detail || error?.message });
  }
});

// Debug helper: attempt deletion and always return detailed error message
app.post('/public-admin/debug-delete/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Reuse logic by invoking the same cleanup and delete sequence inline
    const checkResult = await pool.query('SELECT id, email, "displayName" FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check all possible FK references before attempting deletion
    const fkChecks = [];
    
    // Check user_teams table
    const userTeamsCheck = await pool.query('SELECT COUNT(*) as count FROM user_teams WHERE "userId" = $1 OR user_id = $1', [id]);
    fkChecks.push({ table: 'user_teams', count: userTeamsCheck.rows[0].count });
    
    // Check teams table (as manager)
    const teamsCheck = await pool.query('SELECT COUNT(*) as count FROM teams WHERE "managerId" = $1', [id]);
    fkChecks.push({ table: 'teams', count: teamsCheck.rows[0].count });
    
    // Check evaluations table
    const evaluationsCheck = await pool.query('SELECT COUNT(*) as count FROM evaluations WHERE "managerId" = $1 OR "salespersonId" = $1 OR manager_id = $1 OR salesperson_id = $1', [id]);
    fkChecks.push({ table: 'evaluations', count: evaluationsCheck.rows[0].count });
    
    // Check refresh_tokens table
    const refreshTokensCheck = await pool.query('SELECT COUNT(*) as count FROM refresh_tokens WHERE "userId" = $1 OR user_id = $1', [id]);
    fkChecks.push({ table: 'refresh_tokens', count: refreshTokensCheck.rows[0].count });
    
    // Check push_subscriptions table
    const pushSubsCheck = await pool.query('SELECT COUNT(*) as count FROM push_subscriptions WHERE "userId" = $1 OR user_id = $1', [id]);
    fkChecks.push({ table: 'push_subscriptions', count: pushSubsCheck.rows[0].count });

    await pool.query('DELETE FROM user_teams WHERE "userId" = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM user_teams WHERE user_id = $1', [id]).catch(() => {});
    await pool.query('UPDATE teams SET "managerId" = NULL, "updatedAt" = NOW() WHERE "managerId" = $1', [id]).catch(() => {});

    const candidates = [
      { table: 'evaluations', cols: ['managerId', 'salespersonId', 'manager_id', 'salesperson_id'] },
      { table: 'refresh_tokens', cols: ['userId', 'user_id'] },
      { table: 'user_roles', cols: ['userId', 'user_id'] },
      { table: 'audit_logs', cols: ['userId', 'user_id'] }
    ];
    for (const c of candidates) {
      try {
        const exists = await pool.query('SELECT 1 FROM information_schema.tables WHERE table_name = $1', [c.table]);
        if (exists.rowCount > 0) {
          for (const col of c.cols) {
            await pool.query(`DELETE FROM ${c.table} WHERE "${col}" = $1`, [id]).catch(() => {});
          }
        }
      } catch (_) { /* ignore */ }
    }

    const del = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ 
      message: 'User deleted (debug endpoint)', 
      id,
      fkChecks: fkChecks,
      success: true 
    });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Database error', 
      detail: error?.detail || error?.message,
      fkChecks: fkChecks,
      constraint: error?.constraint,
      code: error?.code
    });
  }
});

// Force-delete (anonymize) user to satisfy foreign keys while removing access
app.post('/public-admin/users/:id/force-delete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userRes = await pool.query('SELECT id, email, "displayName" FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove from memberships and manager links
    await pool.query('DELETE FROM user_teams WHERE "userId" = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM user_teams WHERE user_id = $1', [id]).catch(() => {});
    await pool.query('UPDATE teams SET "managerId" = NULL, "updatedAt" = NOW() WHERE "managerId" = $1', [id]).catch(() => {});

    // Anonymize user row (preserve for FKs), revoke access
    const anonEmail = `deleted+${id}@instorm.io`;
    const updated = await pool.query(
      'UPDATE users SET email = $1, "displayName" = $2, "isActive" = false, role = $3, "updatedAt" = NOW() WHERE id = $4 RETURNING id, email, "displayName", role, "isActive"',
      [anonEmail, 'Deleted User', 'SALESPERSON', id]
    );

    return res.json({ message: 'User anonymized (force-deleted)', user: updated.rows[0] });
  } catch (error) {
    console.error('Force delete error:', error);
    return res.status(500).json({ error: 'Database error', detail: error?.detail || error?.message });
  }
});

// Team management endpoints
app.post('/public-admin/teams', authenticateToken, async (req, res) => {
  console.log('[CREATE TEAM] Request body:', req.body);
  
  try {
    const { name, region, managerId } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    
    console.log('[CREATE TEAM] Creating team:', { name, region, managerId });
    
    // Based on restore-users-teams.sql, teams table uses quoted camelCase columns
    // "managerId", "regionId", "createdAt", "updatedAt"
    
    // regionId is NOT NULL - must have a valid region
    if (!region) {
      return res.status(400).json({ error: 'Region is required. Please select a region.' });
    }
    
    // Accept BOTH region ID and region name (for backward compatibility with admin panel)
    let validRegionId = null;
    
    // Try as ID first
    let regionCheck = await pool.query('SELECT id, name FROM regions WHERE id = $1', [region]);
    
    if (regionCheck.rows.length > 0) {
      validRegionId = regionCheck.rows[0].id;
      console.log('[CREATE TEAM] Found region by ID:', validRegionId);
    } else {
      // Try as name
      regionCheck = await pool.query('SELECT id, name FROM regions WHERE name = $1', [region]);
      if (regionCheck.rows.length > 0) {
        validRegionId = regionCheck.rows[0].id;
        console.log('[CREATE TEAM] Found region by name:', region, '-> ID:', validRegionId);
      } else {
        // Get available regions to help user
        const allRegions = await pool.query('SELECT id, name FROM regions ORDER BY name');
        console.log('[CREATE TEAM] Region not found:', region);
        console.log('[CREATE TEAM] Available regions:', allRegions.rows);
        
        return res.status(400).json({ 
          error: `Region "${region}" not found. Please select a valid region.`,
          availableRegions: allRegions.rows.map(r => ({ id: r.id, name: r.name }))
        });
      }
    }

    const insert = await pool.query(
      'INSERT INTO teams (id, name, "regionId", "managerId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, name, "regionId", "managerId"',
      [crypto.randomUUID(), name, validRegionId, managerId || null]
    );

    console.log('[CREATE TEAM] Team created successfully:', insert.rows[0]);
    res.json(insert.rows[0]);
  } catch (error) {
    console.error('[CREATE TEAM] Error:', error);
    console.error('[CREATE TEAM] Error code:', error.code);
    console.error('[CREATE TEAM] Error detail:', error.detail);
    
    // Handle foreign key violations gracefully
    if (error.code === '23503') {
      // Foreign key violation - likely invalid region or manager
      return res.status(400).json({ 
        error: 'Invalid region or manager ID', 
        message: error.detail || error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create team', 
      message: error.message,
      code: error.code
    });
  }
});

// Update team (admin-only)
app.put('/public-admin/teams/:id', authenticateToken, async (req, res) => {
  // Require ADMIN
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  console.log('[UPDATE TEAM] Request:', req.params.id, req.body);

  try {
    const { id } = req.params;
    const { name, region, managerId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Check if team exists
    const teamExists = await pool.query('SELECT id FROM teams WHERE id = $1', [id]);
    if (teamExists.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Accept BOTH region ID and region name (backward compatible)
    let validRegionId = null;
    if (region) {
      // Try as ID first
      let regionCheck = await pool.query('SELECT id FROM regions WHERE id = $1', [region]);
      if (regionCheck.rows.length > 0) {
        validRegionId = regionCheck.rows[0].id;
      } else {
        // Try as name
        regionCheck = await pool.query('SELECT id FROM regions WHERE name = $1', [region]);
        if (regionCheck.rows.length > 0) {
          validRegionId = regionCheck.rows[0].id;
          console.log('[UPDATE TEAM] Converted region name to ID:', region, '->', validRegionId);
        }
      }
    }

    // Update team
    const update = await pool.query(
      'UPDATE teams SET name = $1, "regionId" = $2, "managerId" = $3, "updatedAt" = NOW() WHERE id = $4 RETURNING id, name, "regionId", "managerId"',
      [name, validRegionId, managerId || null, id]
    );

    console.log('[UPDATE TEAM] Team updated successfully');
    res.json(update.rows[0]);
  } catch (error) {
    console.error('[UPDATE TEAM] Error:', error);
    res.status(500).json({
      error: 'Failed to update team',
      message: error.message,
      code: error.code
    });
  }
});

// Delete team (admin-only): removes memberships, then team - SIMPLIFIED
app.delete('/public-admin/teams/:id', authenticateToken, async (req, res) => {
  // Require ADMIN
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const client = await pool.connect();
  try {
    const { id } = req.params;
    console.log(`[DELETE TEAM] Starting delete for team ID: ${id}`);

    await client.query('BEGIN');

    // Step 1: Ensure team exists
    const team = await client.query('SELECT id, name FROM teams WHERE id = $1', [id]);
    if (team.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Team not found' });
    }

    console.log(`[DELETE TEAM] Deleting team: ${team.rows[0].name}`);

    // Step 2: Delete user_teams memberships using detected column names
    const { teamCol } = await getUserTeamsColumns(client);
    const deleteMemberships = await client.query(`DELETE FROM user_teams WHERE ${teamCol} = $1`, [id]);
    console.log(`[DELETE TEAM] Deleted ${deleteMemberships.rowCount} memberships`);

    // Step 3: Delete the team
    const deleteResult = await client.query('DELETE FROM teams WHERE id = $1', [id]);
    console.log(`[DELETE TEAM] Deleted ${deleteResult.rowCount} team(s)`);

    await client.query('COMMIT');
    console.log(`[DELETE TEAM] Success!`);
    
    return res.json({ 
      message: 'Team deleted successfully', 
      id,
      deletedMemberships: deleteMemberships.rowCount
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[DELETE TEAM] Rollback error:', rollbackError);
    }
    
    console.error('[DELETE TEAM] Error:', error);
    console.error('[DELETE TEAM] Error code:', error.code);
    console.error('[DELETE TEAM] Error message:', error.message);
    
    // Provide specific error messages
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Cannot delete team - it is referenced by other data',
        detail: error.detail
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to delete team',
      message: error.message,
      code: error.code
    });
  } finally {
    client.release();
  }
});

// Serve entire public directory under /public-admin for auxiliary pages (must be after API routes
// so dynamic paths such as /public-admin/companies/:companyId/config reach the handlers above).
app.use('/public-admin', express.static('public'));

app.use(forwardErrorToExpressDefault);

async function startServer() {
  await runMigrations();
  app.listen(PORT, async () => {
    console.log(`🚀 Production backend server running on port ${PORT}`);
    console.log('📋 Available endpoints:');
    console.log('  POST /auth/login - Login with email/password');
    console.log('  POST /auth/refresh - Refresh access token');
    console.log('  POST /auth/logout - Logout and invalidate refresh token');
    console.log('  POST /evaluations - Create evaluation (requires auth)');
    console.log('  GET /evaluations/my - Get my evaluations (requires auth)');
    console.log('  GET /organizations/teams - Get teams (requires auth)');
    console.log('  GET /organizations/salespeople - Get salespeople (requires auth)');
    console.log('  GET /public-admin/teams - Get all teams (requires auth)');
    console.log('  GET /public-admin/users - Get all users (requires auth)');
    console.log('  POST /public-admin/users - Create user (requires auth)');
    console.log('  PUT /public-admin/users/:id - Update user (requires auth)');
    console.log('  POST /public-admin/users/:id/deactivate - Deactivate user (requires auth)');
    console.log('  DELETE /public-admin/users/:id - Delete user (requires auth)');
    console.log('  GET /users - Get all users (requires auth)');
    console.log('  GET /scoring/categories - Get scoring categories (requires auth)');
    console.log('  GET /scoring/evaluation-structure - Active evaluation structure or legacy (requires auth)');
    console.log('  GET /scoring/rating-scale - Get company rating scale (1–4 vs 0–4 N/A) (requires auth)');
    console.log('  GET /analytics/dashboard - Get dashboard analytics (requires auth)');
    console.log('  GET /analytics/team - Get team analytics (requires auth)');
    console.log('  GET /analytics/director-dashboard - Get Sales Director dashboard analytics (requires auth)');
    console.log('  GET /public-admin/companies - Get companies (requires auth)');
    console.log('  GET /public-admin/companies/:companyId/evaluation-metadata-config - Published metadata schema (requires auth)');
    console.log('  GET /public-admin/companies/:companyId/evaluation-metadata-schema/preview - User-facing metadata preview (read-only, requires auth)');
    console.log('  POST /public-admin/companies/:companyId/evaluation-metadata-schema/publish - Publish metadata schema (requires auth)');
    console.log('  GET /public-admin/companies/:companyId/evaluation-structure-config - Published evaluation structure (requires auth)');
    console.log('  GET /public-admin/companies/:companyId/evaluation-structure/preview - Evaluation structure preview (read-only, requires auth)');
    console.log('  POST /public-admin/companies/:companyId/evaluation-structure/publish - Publish evaluation structure (requires auth)');
    console.log('  GET /public-admin/regions - Get all regions (requires auth)');
    console.log('  POST /public-admin/regions - Create new region (requires ADMIN)');
    console.log('  PUT /public-admin/regions/:id - Update region name (requires ADMIN)');
    console.log('  DELETE /public-admin/regions/:id - Delete region (requires ADMIN)');
    console.log('  GET /health - Health check');
    console.log('  GET /public-admin/react-admin - React Admin panel');
    console.log('🔑 Using real database authentication');
    console.log(`  DATABASE_URL: ${databaseUrl ? databaseUrl.replace(/:[^:@]+@/, ':****@') : '(missing)'}`);
    console.log('  All endpoints now return real data from your database');
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connection: OK');
    } catch (dbErr) {
      console.error('❌ Database connection FAILED — /auth/login and data routes will return 500 until PostgreSQL is up.');
      console.error('   Fix: start Postgres (e.g. docker compose -f docker-compose.dev.yml up -d), then node seed-dev-data.js from repo root.');
      console.error('   Error:', dbErr.message || dbErr);
    }
  });
}

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
