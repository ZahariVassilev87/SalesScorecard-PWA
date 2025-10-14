const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
let webpush = null;

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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
        
        console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    // Don't crash the server if migrations fail
  }
}

// Run migrations on startup
runMigrations();

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

// JWT Secrets (use environment variables in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_for_access_tokens';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your_refresh_secret_key_for_refresh_tokens';

// CORS configuration for production
app.use(cors({
  origin: [
    'https://d2tuhgmig1r5ut.cloudfront.net', // CloudFront domain
    'https://scorecard.instorm.io', // Scorecard domain
    'https://instorm.io', // Main domain
    'https://www.instorm.io', // WWW domain
    'http://localhost:3000' // Development
  ],
  credentials: true
}));

// Serve React Admin panel static files
app.use('/public-admin/react-admin', express.static('public/react-admin'));

// Force fresh index.html for admin (avoid stale cached UI)
app.get('/public-admin/react-admin/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'react-admin', 'index.html'));
});

app.get('/public-admin/react-admin/index.html', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'react-admin', 'index.html'));
});

// Handle deep links inside React Admin by serving index.html for page routes (not static files)
app.get('/public-admin/react-admin/*', (req, res) => {
  // Skip static files (js, css, images, etc.)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send('Not found');
  }
  
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'react-admin', 'index.html'));
});

// Serve entire public directory under /public-admin for auxiliary pages
app.use('/public-admin', express.static('public'));

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

app.use(bodyParser.json());

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

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided', error: 'Unauthorized', statusCode: 401 });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ message: 'Forbidden', statusCode: 403 });
    }
    req.user = user;
    next();
  });
};

// Authorization middleware for evaluation creation
const authorizeEvaluationCreation = (req, res, next) => {
  const userRole = req.user.role;
  const allowedRoles = ['ADMIN', 'SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER', 'SALES_LEAD'];
  
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ 
      message: 'Insufficient permissions to create evaluations', 
      statusCode: 403 
    });
  }
  
  next();
};

// Utility: detect user_teams column naming (camelCase vs snake_case)
async function getUserTeamsColumns(client) {
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'user_teams'
  `);
  const names = new Set(cols.rows.map(r => r.column_name));
  
  console.log('[COLUMN DETECTION] user_teams columns found:', Array.from(names));
  
  // PostgreSQL information_schema returns lowercase names for unquoted columns
  // But when querying, we need to use quoted names if the table was created with quotes
  // The restore SQL shows: "userId", "teamId" (quoted camelCase)
  // So we always use quoted camelCase for this table
  const userCol = '"userId"';
  const teamCol = '"teamId"';
  
  // Check if timestamp columns exist at all
  const hasCreatedAt = names.has('created_at') || names.has('createdAt') || names.has('createdat');
  const hasUpdatedAt = names.has('updated_at') || names.has('updatedAt') || names.has('updatedat');
  
  const createdCol = null; // user_teams doesn't have timestamp columns based on restore SQL
  const updatedCol = null;
  
  console.log('[COLUMN DETECTION] Detected:', { userCol, teamCol, createdCol, updatedCol });
  
  return { userCol, teamCol, createdCol, updatedCol };
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
      'GET /analytics/dashboard',
      'GET /analytics/team',
      'GET /analytics/director-dashboard',
      'GET /public-admin/regions',
      'POST /public-admin/regions',
      'PUT /public-admin/regions/:id',
      'DELETE /public-admin/regions/:id',
      'GET /health'
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
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

// Authentication routes
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email, password: '***' });

  try {
    const result = await pool.query(
      'SELECT id, email, password, role, "displayName", "isActive" FROM users WHERE email = $1 AND "isActive" = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        message: 'Invalid email or password', 
        error: 'Unauthorized', 
        statusCode: 401 
      });
    }

    const user = result.rows[0];
    
    // Use bcrypt to compare hashed password
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid email or password', 
        error: 'Unauthorized', 
        statusCode: 401 
      });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        displayName: user.displayName 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Login successful for user:', user.email);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Database error during login:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: 'DatabaseError', 
      statusCode: 500 
    });
  }
});

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  console.log('Refresh token request');

  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  jwt.verify(refreshToken, REFRESH_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: 'REGIONAL_SALES_MANAGER',
        displayName: 'User' 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token: newToken });
  });
});

app.post('/auth/logout', (req, res) => {
  console.log('Logout request');
  res.json({ message: 'Logged out successfully' });
});

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
app.post('/evaluations', authenticateToken, authorizeEvaluationCreation, async (req, res) => {
  console.log('Evaluation creation request from user:', req.user.email);
  console.log('Evaluation data:', req.body);
  console.log('🔍 SalespersonId being submitted:', req.body.salespersonId);
  
  try {
    // Verify the salespersonId exists in database
    const userCheck = await pool.query('SELECT id, "displayName", role FROM users WHERE id = $1', [req.body.salespersonId]);
    if (userCheck.rows.length === 0) {
      console.error('❌ Invalid salespersonId:', req.body.salespersonId);
      return res.status(400).json({ 
        message: 'Invalid salesperson ID', 
        error: `User with ID ${req.body.salespersonId} not found` 
      });
    }
    console.log('✅ Valid salesperson found:', userCheck.rows[0]);
  
  const evaluationId = `eval_${Date.now()}`;
    const overallScore = calculateOverallScore(req.body.items);
    
    // Insert into evaluations table
    await pool.query(`
      INSERT INTO evaluations (
        id, "salespersonId", "managerId", "visitDate", 
        "customerName", "customerType", location, "overallComment", "overallScore",
        version, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    `, [
      evaluationId,
      req.body.salespersonId,
      req.user.id,
      req.body.visitDate,
      req.body.customerName || null,
      req.body.customerType || 'LOW_SHARE',
      req.body.location || null,
      req.body.overallComment || null,
      overallScore,
      1
    ]);
    
    // Insert evaluation items
    for (let i = 0; i < req.body.items.length; i++) {
      const item = req.body.items[i];
      
      await pool.query(`
        INSERT INTO evaluation_items (
          id, "evaluationId", "behaviorItemId", rating, comment,
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [
        `item_${evaluationId}_${i}`,
        evaluationId,
        item.behaviorItemId,
        item.rating || item.score || 0, // Support both 'rating' and 'score' for backward compatibility
        item.comment || '' // Store the actual user's comment text
      ]);
    }
    
    console.log(`✅ Saved evaluation ${evaluationId} to database for user ${req.user.email}`);
  
  res.status(201).json({ 
    message: 'Evaluation created successfully', 
    id: evaluationId,
    data: req.body
  });
  } catch (error) {
    console.error('❌ Error creating evaluation:', error);
    res.status(500).json({ 
      message: 'Failed to create evaluation', 
      error: error.message 
    });
  }
});

app.get('/evaluations/my', authenticateToken, async (req, res) => {
  console.log('My evaluations request from user:', req.user.email);
  
  try {
    // Get evaluations created by this user OR evaluations about this user
    const evaluationsResult = await pool.query(`
      SELECT 
        e.id, e."salespersonId", e."managerId", e."visitDate",
        e."customerName", e.location, e."overallComment", e."overallScore",
        e.version, e."createdAt", e."updatedAt",
        sp."displayName" as salesperson_name, sp.email as salesperson_email,
        mg."displayName" as manager_name, mg.email as manager_email
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."managerId" = $1 OR e."salespersonId" = $1
      ORDER BY e."createdAt" DESC
    `, [req.user.id]);
    
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
      
      evaluations.push({
        id: evalRow.id,
        salespersonId: evalRow.salespersonId,
        salesperson: {
          id: evalRow.salespersonId,
          displayName: evalRow.salesperson_name,
          firstName: evalRow.salesperson_name?.split(' ')[0] || '',
          lastName: evalRow.salesperson_name?.split(' ').slice(1).join(' ') || '',
          email: evalRow.salesperson_email
        },
        managerId: evalRow.managerId,
        manager: {
          id: evalRow.managerId,
          displayName: evalRow.manager_name,
          email: evalRow.manager_email
        },
        visitDate: evalRow.visitDate,
        customerName: evalRow.customerName,
        location: evalRow.location,
        overallComment: evalRow.overallComment,
        overallScore: evalRow.overallScore,
        version: evalRow.version,
        createdAt: evalRow.createdAt,
        updatedAt: evalRow.updatedAt,
        items: itemsResult.rows.map(item => {
          // Handle both old format (custom IDs) and new format (database IDs)
          let behaviorItemName = item.behavior_item_name;
          let categoryName = item.category_name;
          
          // If no database match found, try to extract from comment metadata
          if (!behaviorItemName && item.comment) {
            try {
              const metadata = JSON.parse(item.comment);
              if (metadata.itemName) behaviorItemName = metadata.itemName;
              if (metadata.categoryName) categoryName = metadata.categoryName;
            } catch (e) {
              // Comment is not JSON, continue to check mappings
            }
          }
          
          // Fallback mapping for evaluation IDs (check if name is still null or is just the ID)
          if (!behaviorItemName || behaviorItemName === item.behaviorItemId || !categoryName) {
            const oldIdMappings = {
              // New Regional Manager to Sales Lead Coaching Evaluation items
              'coaching_communication': { name: 'Effective Communication', category: 'Coaching Skills' },
              'coaching_development': { name: 'Team Development', category: 'Leadership' },
              'coaching_performance': { name: 'Performance Management', category: 'Management' },
              'coaching_strategy': { name: 'Strategic Planning', category: 'Strategy' },
              
              // New Sales Lead to Salesperson Evaluation items (Low Share)
              'sales_prospecting': { name: 'Prospecting Skills', category: 'Sales Process' },
              'sales_presentation': { name: 'Presentation Skills', category: 'Sales Process' },
              'sales_negotiation': { name: 'Negotiation Skills', category: 'Sales Process' },
              'sales_relationship': { name: 'Relationship Building', category: 'Customer Management' },
              'sales_productivity': { name: 'Productivity & Organization', category: 'Performance' },
              'sales_adaptability': { name: 'Adaptability & Learning', category: 'Growth' },
              
              // Coaching evaluation form mappings
              'obs1': { name: 'Let salesperson lead the conversation', category: 'Observation & Intervention During Client Meeting' },
              'obs2': { name: 'Provided support when needed', category: 'Observation & Intervention During Client Meeting' },
              'obs3': { name: 'Stepped in with added value at right time', category: 'Observation & Intervention During Client Meeting' },
              'obs4': { name: 'Actively listened to client and salesperson', category: 'Observation & Intervention During Client Meeting' },
              'env1': { name: 'Ensured calm and safe atmosphere', category: 'Creating Coaching Environment' },
              'env2': { name: 'Asked salesperson for self-assessment / feelings', category: 'Creating Coaching Environment' },
              'env3': { name: 'Listened attentively without interrupting', category: 'Creating Coaching Environment' },
              'fb1': { name: 'Started with positive practices', category: 'Quality of Analysis & Feedback' },
              'fb2': { name: 'Gave concrete examples from client meeting', category: 'Quality of Analysis & Feedback' },
              'fb3': { name: 'Identified areas for improvement with examples', category: 'Quality of Analysis & Feedback' },
              'act1': { name: 'Set clear tasks for a specific period', category: 'Translating Into Action' },
              'act2': { name: 'Reached agreement on evaluation and next steps', category: 'Translating Into Action' },
              'act3': { name: 'Encouraged salesperson to set a personal goal/commitment', category: 'Translating Into Action' }
            };
            
            const mapping = oldIdMappings[item.behaviorItemId];
            if (mapping) {
              if (!behaviorItemName) behaviorItemName = mapping.name;
              if (!categoryName) categoryName = mapping.category;
            }
          }
          
          return {
            id: item.id,
            behaviorItemId: item.behaviorItemId,
            behaviorItem: {
              id: item.behaviorItemId,
              name: behaviorItemName || item.behaviorItemId,
              category: { name: categoryName || 'Unknown Category' }
            },
            rating: item.rating,
            comment: item.comment
          };
        })
      });
    }
    
    console.log(`✅ Found ${evaluations.length} evaluations for user ${req.user.email}`);
    res.json(evaluations);
  } catch (error) {
    console.error('❌ Error fetching evaluations:', error);
    res.status(500).json({ 
      message: 'Failed to fetch evaluations', 
      error: error.message 
    });
  }
});

// Organization routes
app.get('/organizations/teams', authenticateToken, (req, res) => {
  console.log('Organizations teams request from user:', req.user.email, 'role:', req.user.role);
  
  // Return empty array for now - this should be handled by your existing admin panel
  // The frontend should be calling the original /public-admin/teams endpoint
  res.json([]);
});

app.get('/organizations/salespeople', authenticateToken, async (req, res) => {
  console.log('Organizations salespeople request from user:', req.user.email, 'role:', req.user.role);
  
  try {
    const { userCol, teamCol } = await getUserTeamsColumns(pool);
    
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
      query += ` AND u.role = 'SALES_LEAD' AND t."managerId" = $1`;
      console.log('🔍 Regional Manager filtering: Only showing SALES_LEADs in their teams');
    } else if (req.user.role === 'SALES_LEAD') {
      // Sales Leads can evaluate Salespeople in their teams
      // First, find which teams the Sales Lead is in
      params.push(req.user.id);
      query += ` AND u.role = 'SALESPERSON' AND t.id IN (
        SELECT ut2.${teamCol} 
        FROM user_teams ut2 
        WHERE ut2.${userCol} = $1
      )`;
      console.log('🔍 Sales Lead filtering: Only showing SALESPEOPLEs in their teams');
    } else if (req.user.role === 'SALESPERSON') {
      // A salesperson should only see themself
      params.push(req.user.id);
      query += ` AND u.id = $1`;
      console.log('🔍 Salesperson filtering: Only showing self');
    } else if (req.user.role === 'ADMIN' || req.user.role === 'SALES_DIRECTOR') {
      // Admins and Sales Directors can see everyone
      query += ` AND u.role IN ('SALESPERSON', 'SALES_LEAD')`;
      console.log('🔍 Admin/Director filtering: Showing all salespeople and leads');
    } else {
      // Unknown role - return empty
      query += ` AND 1=0`;
      console.log('⚠️ Unknown role - returning empty list');
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
    const { userCol, teamCol } = await getUserTeamsColumns(pool);
    
    // Find the user's team(s)
    const userTeamsQuery = `
      SELECT DISTINCT t.id, t.name, t."managerId", t."regionId",
        r.name AS region_name,
        m.id AS manager_id, m.email AS manager_email, 
        m."displayName" AS manager_name, m.role AS manager_role
      FROM teams t
      INNER JOIN user_teams ut ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      LEFT JOIN users m ON m.id = t."managerId"
      WHERE ut.${userCol} = $1
      LIMIT 1
    `;
    
    const userTeamsResult = await pool.query(userTeamsQuery, [req.user.id]);
    
    if (userTeamsResult.rows.length === 0) {
      console.log('⚠️ User has no team membership');
      return res.json(null);
    }
    
    const teamRow = userTeamsResult.rows[0];
    const teamId = teamRow.id;
    
    console.log(`✅ Found team: ${teamRow.name} (${teamId})`);
    
    // Get all members of this team
    const membersQuery = `
      SELECT u.id, u.email, u."displayName", u.role, u."isActive"
      FROM users u
      INNER JOIN user_teams ut ON ut.${userCol} = u.id
      WHERE ut.${teamCol} = $1
        AND u."isActive" = true
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
    
    const membersResult = await pool.query(membersQuery, [teamId]);
    
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
    const teamsResult = await pool.query(`
      SELECT 
        t.id, 
        t.name, 
        t."regionId", 
        t."managerId", 
        t."createdAt", 
        t."updatedAt",
        mu.id as mgr_id, 
        mu.email as mgr_email, 
        mu."displayName" as mgr_name, 
        mu.role as mgr_role,
        COALESCE(mu."isActive", true) as mgr_active
      FROM teams t
      LEFT JOIN users mu ON mu.id = t."managerId"
      ORDER BY t.name
    `);

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
    // Simple query that works with current database schema
    const result = await pool.query(`
      SELECT id, email, "displayName", role, "isActive", "createdAt", "updatedAt"
      FROM users
      WHERE "isActive" = true
      ORDER BY "displayName", email
    `);
    
    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      isActive: row.isActive,
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
  console.log('Scoring categories request from user:', req.user.email, 'role:', req.user.role);
  
  try {
    // Determine which form to return based on user role
    // REGIONAL_MANAGER evaluates SALES_LEADs -> return SALES_LEAD forms
    // SALES_LEAD evaluates SALESPEOPLEs -> return SALESPERSON forms
    
    let targetRole = null;
    
    if (req.user.role === 'REGIONAL_MANAGER' || req.user.role === 'REGIONAL_SALES_MANAGER') {
      targetRole = 'SALES_LEAD';
      console.log('🔍 Regional Manager - returning Sales Lead Coaching Evaluation');
    } else if (req.user.role === 'SALES_LEAD') {
      targetRole = 'SALESPERSON';
      console.log('🔍 Sales Lead - returning Salesperson Evaluation');
    } else {
      // Default to SALESPERSON form for others
      targetRole = 'SALESPERSON';
      console.log('🔍 Default - returning Salesperson Evaluation');
    }
    
    // Get categories with their items from database
    const categoriesQuery = `
      SELECT bc.id, bc.name, bc."order", bc.weight
      FROM behavior_categories bc
      WHERE bc.name LIKE '%' || $1 || '%'
      ORDER BY bc."order"
    `;
    
    const categoriesResult = await pool.query(categoriesQuery, [targetRole]);
    
    if (categoriesResult.rows.length === 0) {
      console.log('⚠️ No categories found, returning empty array');
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

// Analytics routes
app.get('/analytics/dashboard', authenticateToken, async (req, res) => {
  try {
  console.log('Dashboard analytics request from user:', req.user.email);
    
    // Get comprehensive dashboard data for Sales Directors
    if (req.user.role === 'SALES_DIRECTOR') {
      // Get total regions
      const regionsResult = await pool.query('SELECT COUNT(*) as count FROM regions WHERE "isActive" = true');
      const totalRegions = parseInt(regionsResult.rows[0].count) || 0;
      
      // Get total team members (all active users)
      const usersResult = await pool.query('SELECT COUNT(*) as count FROM users WHERE "isActive" = true');
      const totalTeamMembers = parseInt(usersResult.rows[0].count) || 0;
      
      // Get total evaluations
      const evaluationsResult = await pool.query('SELECT COUNT(*) as count FROM evaluations');
      const totalEvaluations = parseInt(evaluationsResult.rows[0].count) || 0;
      
      // Get average performance (average of all evaluation scores)
      const avgScoreResult = await pool.query('SELECT AVG("overallScore") as avg_score FROM evaluations WHERE "overallScore" IS NOT NULL');
      const averagePerformance = avgScoreResult.rows[0].avg_score ? 
        Math.round((parseFloat(avgScoreResult.rows[0].avg_score) / 4) * 100) : 0;
      
      // Get evaluations completed this month
      const thisMonthResult = await pool.query(`
        SELECT COUNT(*) as count FROM evaluations 
        WHERE DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)
      `);
      const evaluationsCompleted = parseInt(thisMonthResult.rows[0].count) || 0;
      
      // Get average score (1-4 scale)
      const averageScore = avgScoreResult.rows[0].avg_score ? 
        parseFloat(avgScoreResult.rows[0].avg_score).toFixed(1) : 0;
      
  res.json({
        totalRegions,
        totalTeamMembers,
        averagePerformance,
        totalEvaluations,
        evaluationsCompleted,
        averageScore
      });
    } else {
      // For other roles, return basic evaluation data
      const userEvaluationsResult = await pool.query(`
        SELECT COUNT(*) as count FROM evaluations 
        WHERE "managerId" = $1 OR "salespersonId" = $1
      `, [req.user.id]);
      const totalEvaluations = parseInt(userEvaluationsResult.rows[0].count) || 0;
      
      const avgScoreResult = await pool.query(`
        SELECT AVG("overallScore") as avg_score FROM evaluations 
        WHERE ("managerId" = $1 OR "salespersonId" = $1) AND "overallScore" IS NOT NULL
      `, [req.user.id]);
      const averageScore = avgScoreResult.rows[0].avg_score ? 
        parseFloat(avgScoreResult.rows[0].avg_score).toFixed(1) : 0;
      
      const thisMonthResult = await pool.query(`
        SELECT COUNT(*) as count FROM evaluations 
        WHERE ("managerId" = $1 OR "salespersonId" = $1) 
        AND DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)
      `, [req.user.id]);
      const evaluationsCompleted = parseInt(thisMonthResult.rows[0].count) || 0;
      
      res.json({
        totalRegions: 0,
        totalTeamMembers: 0,
        averagePerformance: avgScoreResult.rows[0].avg_score ? 
          Math.round((parseFloat(avgScoreResult.rows[0].avg_score) / 4) * 100) : 0,
        totalEvaluations,
        evaluationsCompleted,
        averageScore
      });
    }
  } catch (error) {
    console.error('Error in /analytics/dashboard:', error);
    res.status(500).json({ 
      message: 'Failed to fetch dashboard data', 
      error: error.message 
    });
  }
});

app.get('/analytics/team', authenticateToken, (req, res) => {
  console.log('Team analytics request from user:', req.user.email);
  res.json({
    teamEvaluations: storedEvaluations.filter(eval => eval.managerId === req.user.id),
    teamAverageScore: 0 // Calculate based on team evaluations
  });
});

// Helper functions
function calculateOverallScore(items) {
  if (!items || items.length === 0) return 0;
  const totalScore = items.reduce((sum, item) => sum + (item.rating || item.score || 0), 0);
  return Math.round((totalScore / items.length) * 100) / 100;
}

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
        e.version, e."createdAt", e."updatedAt",
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

// Start server
app.listen(PORT, () => {
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
  console.log('  GET /analytics/dashboard - Get dashboard analytics (requires auth)');
  console.log('  GET /analytics/team - Get team analytics (requires auth)');
  console.log('  GET /analytics/director-dashboard - Get Sales Director dashboard analytics (requires auth)');
  console.log('  GET /public-admin/regions - Get all regions (requires auth)');
  console.log('  POST /public-admin/regions - Create new region (requires ADMIN)');
  console.log('  PUT /public-admin/regions/:id - Update region name (requires ADMIN)');
  console.log('  DELETE /public-admin/regions/:id - Delete region (requires ADMIN)');
  console.log('  GET /health - Health check');
  console.log('  GET /public-admin/react-admin - React Admin panel');
  console.log('🔑 Using real database authentication');
  console.log('  Connect to your PostgreSQL database using DATABASE_URL');
  console.log('  All endpoints now return real data from your database');
});

// Sales Director Analytics Dashboard
app.get('/analytics/director-dashboard', authenticateToken, async (req, res) => {
  try {
    // Only allow Sales Directors to access this endpoint
    if (req.user.role !== 'SALES_DIRECTOR' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Sales Directors can access this dashboard' });
    }

    console.log('📊 Sales Director dashboard request from:', req.user.email);

    const { userCol, teamCol } = await getUserTeamsColumns(pool);

    // Get regional execution performance (salespeople evaluations by sales leads)
    const regionalExecutionQuery = `
      SELECT 
        t."regionId",
        r.name as region_name,
        COUNT(DISTINCT e.id) as execution_evaluations,
        AVG(e."overallScore") as avg_execution_score,
        COUNT(DISTINCT e."salespersonId") as unique_salespeople_evaluated,
        COUNT(DISTINCT e."managerId") as unique_sales_leads_evaluating
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      LEFT JOIN user_teams ut ON ut.${userCol} = sp.id
      LEFT JOIN teams t ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      WHERE e."overallScore" IS NOT NULL
        AND sp.role = 'SALESPERSON'
        AND mg.role = 'SALES_LEAD'
      GROUP BY t."regionId", r.name
      ORDER BY avg_execution_score DESC
    `;

    // Get regional coaching performance (sales leads evaluations by regional managers)
    const regionalCoachingQuery = `
      SELECT 
        t."regionId",
        r.name as region_name,
        COUNT(DISTINCT e.id) as coaching_evaluations,
        AVG(e."overallScore") as avg_coaching_score,
        COUNT(DISTINCT e."salespersonId") as unique_sales_leads_evaluated,
        COUNT(DISTINCT e."managerId") as unique_regional_managers_evaluating
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      LEFT JOIN user_teams ut ON ut.${userCol} = sp.id
      LEFT JOIN teams t ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      WHERE e."overallScore" IS NOT NULL
        AND sp.role = 'SALES_LEAD'
        AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
      GROUP BY t."regionId", r.name
      ORDER BY avg_coaching_score DESC
    `;

    const regionalExecutionResult = await pool.query(regionalExecutionQuery);
    const regionalCoachingResult = await pool.query(regionalCoachingQuery);
    
    // Get salespeople execution performance (evaluations OF salespeople BY sales leads)
    const salespeopleExecutionQuery = `
      SELECT 
        mg.id as sales_lead_id,
        mg."displayName" as sales_lead_name,
        mg.email as sales_lead_email,
        COUNT(e.id) as evaluations_created,
        AVG(e."overallScore") as avg_execution_score,
        t."regionId",
        r.name as region_name
      FROM evaluations e
      LEFT JOIN users mg ON mg.id = e."managerId"
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN user_teams ut ON ut.${userCol} = mg.id
      LEFT JOIN teams t ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      WHERE mg.role = 'SALES_LEAD' 
        AND sp.role = 'SALESPERSON'
        AND e."overallScore" IS NOT NULL
      GROUP BY mg.id, mg."displayName", mg.email, t."regionId", r.name
      ORDER BY avg_execution_score DESC
    `;

    const salespeopleExecutionResult = await pool.query(salespeopleExecutionQuery);

    // Get sales lead coaching performance (evaluations OF sales leads by regional managers)
    const salesLeadCoachingQuery = `
      SELECT 
        sp.id as sales_lead_id,
        sp."displayName" as sales_lead_name,
        sp.email as sales_lead_email,
        mg.id as regional_manager_id,
        mg."displayName" as regional_manager_name,
        COUNT(e.id) as coaching_evaluations_received,
        AVG(e."overallScore") as avg_coaching_score,
        t."regionId",
        r.name as region_name
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      LEFT JOIN user_teams ut ON ut.${userCol} = sp.id
      LEFT JOIN teams t ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      WHERE sp.role = 'SALES_LEAD' 
        AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
        AND e."overallScore" IS NOT NULL
      GROUP BY sp.id, sp."displayName", sp.email, mg.id, mg."displayName", t."regionId", r.name
      ORDER BY avg_coaching_score DESC
    `;

    const salesLeadCoachingResult = await pool.query(salesLeadCoachingQuery);

    // Get overall company execution metrics (salespeople evaluations)
    const companyExecutionMetricsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_execution_evaluations,
        AVG(e."overallScore") as avg_execution_score,
        COUNT(DISTINCT e."salespersonId") as total_salespeople_evaluated,
        COUNT(DISTINCT e."managerId") as total_sales_leads_evaluating
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."overallScore" IS NOT NULL
        AND sp.role = 'SALESPERSON'
        AND mg.role = 'SALES_LEAD'
    `;

    // Get overall company coaching metrics (sales leads evaluations)
    const companyCoachingMetricsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_coaching_evaluations,
        AVG(e."overallScore") as avg_coaching_score,
        COUNT(DISTINCT e."salespersonId") as total_sales_leads_evaluated,
        COUNT(DISTINCT e."managerId") as total_regional_managers_evaluating
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."overallScore" IS NOT NULL
        AND sp.role = 'SALES_LEAD'
        AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
    `;

    // Get Share of Wallet distribution for sales behaviours evaluations (exclude COACHING type)
    const shareOfWalletQuery = `
      SELECT 
        COALESCE("customerType", 'LOW_SHARE') as customer_type,
        COUNT(DISTINCT e.id) as evaluation_count,
        AVG(e."overallScore") as avg_score,
        ROUND(COUNT(DISTINCT e.id) * 100.0 / SUM(COUNT(DISTINCT e.id)) OVER (), 1) as percentage
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."overallScore" IS NOT NULL
        AND sp.role = 'SALESPERSON'
        AND mg.role = 'SALES_LEAD'
        AND COALESCE("customerType", 'LOW_SHARE') != 'COACHING'
      GROUP BY COALESCE("customerType", 'LOW_SHARE')
      ORDER BY 
        CASE COALESCE("customerType", 'LOW_SHARE')
          WHEN 'HIGH_SHARE' THEN 1
          WHEN 'MID_SHARE' THEN 2
          WHEN 'LOW_SHARE' THEN 3
          ELSE 4
        END
    `;

    // Get overall user counts
    const userCountsQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN role = 'SALES_LEAD' THEN id END) as total_sales_leads,
        COUNT(DISTINCT CASE WHEN role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER') THEN id END) as total_regional_managers,
        COUNT(DISTINCT CASE WHEN role = 'SALESPERSON' THEN id END) as total_salespeople
      FROM users
      WHERE "isActive" = true
    `;

    const companyExecutionResult = await pool.query(companyExecutionMetricsQuery);
    const companyCoachingResult = await pool.query(companyCoachingMetricsQuery);
    const shareOfWalletResult = await pool.query(shareOfWalletQuery);
    const userCountsResult = await pool.query(userCountsQuery);

    // Get recent execution trends (last 30 days)
    const executionTrendsQuery = `
      SELECT 
        DATE(e."createdAt") as evaluation_date,
        COUNT(e.id) as evaluations_count,
        AVG(e."overallScore") as avg_score
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."createdAt" >= NOW() - INTERVAL '30 days'
        AND e."overallScore" IS NOT NULL
        AND sp.role = 'SALESPERSON'
        AND mg.role = 'SALES_LEAD'
      GROUP BY DATE(e."createdAt")
      ORDER BY evaluation_date DESC
      LIMIT 30
    `;

    // Get recent coaching trends (last 30 days)
    const coachingTrendsQuery = `
      SELECT 
        DATE(e."createdAt") as evaluation_date,
        COUNT(e.id) as evaluations_count,
        AVG(e."overallScore") as avg_score
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."createdAt" >= NOW() - INTERVAL '30 days'
        AND e."overallScore" IS NOT NULL
        AND sp.role = 'SALES_LEAD'
        AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
      GROUP BY DATE(e."createdAt")
      ORDER BY evaluation_date DESC
      LIMIT 30
    `;

    const executionTrendsResult = await pool.query(executionTrendsQuery);
    const coachingTrendsResult = await pool.query(coachingTrendsQuery);

    // Get regional managers execution metrics (sales behaviours performance by regional manager)
    // This aggregates all sales behaviours evaluations done by sales leads under each regional manager
    const regionalExecutionMetricsQuery = `
      SELECT 
        rm.id as regional_manager_id,
        rm."displayName" as regional_manager_name,
        rm.email as regional_manager_email,
        t."regionId",
        r.name as region_name,
        COUNT(DISTINCT e.id) as execution_evaluations,
        AVG(e."overallScore") as avg_execution_score,
        COUNT(DISTINCT e."salespersonId") as unique_salespeople_evaluated,
        COUNT(DISTINCT e."managerId") as unique_sales_leads_evaluating
      FROM users rm
      LEFT JOIN user_teams ut ON ut.${userCol} = rm.id
      LEFT JOIN teams t ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      LEFT JOIN teams sl_team ON sl_team."managerId" = rm.id
      LEFT JOIN user_teams sl_ut ON sl_ut.${teamCol} = sl_team.id
      LEFT JOIN users sl ON sl.id = sl_ut.${userCol} AND sl.role = 'SALES_LEAD'
      LEFT JOIN evaluations e ON e."managerId" = sl.id
      LEFT JOIN users sp ON sp.id = e."salespersonId" AND sp.role = 'SALESPERSON'
      WHERE rm.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
        AND rm."isActive" = true
        AND e."overallScore" IS NOT NULL
      GROUP BY rm.id, rm."displayName", rm.email, t."regionId", r.name
      ORDER BY avg_execution_score DESC
    `;

    // Get regional managers coaching metrics (coaching performance by regional manager)
    const regionalCoachingMetricsQuery = `
      SELECT 
        mg.id as regional_manager_id,
        mg."displayName" as regional_manager_name,
        mg.email as regional_manager_email,
        t."regionId",
        r.name as region_name,
        COUNT(DISTINCT e.id) as coaching_evaluations,
        AVG(e."overallScore") as avg_coaching_score,
        COUNT(DISTINCT e."salespersonId") as unique_sales_leads_evaluated
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      LEFT JOIN user_teams ut ON ut.${userCol} = mg.id
      LEFT JOIN teams t ON ut.${teamCol} = t.id
      LEFT JOIN regions r ON r.id = t."regionId"
      WHERE e."overallScore" IS NOT NULL
        AND sp.role = 'SALES_LEAD'
        AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
      GROUP BY mg.id, mg."displayName", mg.email, t."regionId", r.name
      ORDER BY avg_coaching_score DESC
    `;

    const regionalExecutionMetricsResult = await pool.query(regionalExecutionMetricsQuery);
    const regionalCoachingMetricsResult = await pool.query(regionalCoachingMetricsQuery);

    const dashboardData = {
      // Regional execution performance (salespeople evaluations by sales leads)
      regionalExecutionPerformance: regionalExecutionResult.rows.map(row => ({
        regionId: row.regionId,
        regionName: row.region_name,
        executionEvaluations: parseInt(row.execution_evaluations),
        avgExecutionScore: parseFloat(row.avg_execution_score) || 0,
        uniqueSalespeopleEvaluated: parseInt(row.unique_salespeople_evaluated),
        uniqueSalesLeadsEvaluating: parseInt(row.unique_sales_leads_evaluating)
      })),
      
      // Regional coaching performance (sales leads evaluations by regional managers)
      regionalCoachingPerformance: regionalCoachingResult.rows.map(row => ({
        regionId: row.regionId,
        regionName: row.region_name,
        coachingEvaluations: parseInt(row.coaching_evaluations),
        avgCoachingScore: parseFloat(row.avg_coaching_score) || 0,
        uniqueSalesLeadsEvaluated: parseInt(row.unique_sales_leads_evaluated),
        uniqueRegionalManagersEvaluating: parseInt(row.unique_regional_managers_evaluating)
      })),
      
      // Salespeople execution performance (by sales lead)
      salespeopleExecutionPerformance: salespeopleExecutionResult.rows.map(row => ({
        salesLeadId: row.sales_lead_id,
        salesLeadName: row.sales_lead_name,
        salesLeadEmail: row.sales_lead_email,
        executionEvaluationsCreated: parseInt(row.evaluations_created),
        avgExecutionScore: parseFloat(row.avg_execution_score) || 0,
        regionId: row.regionId,
        regionName: row.region_name
      })),
      
      // Sales lead coaching performance (of sales leads by regional managers)
      salesLeadCoachingPerformance: salesLeadCoachingResult.rows.map(row => ({
        salesLeadId: row.sales_lead_id,
        salesLeadName: row.sales_lead_name,
        salesLeadEmail: row.sales_lead_email,
        regionalManagerId: row.regional_manager_id,
        regionalManagerName: row.regional_manager_name,
        coachingEvaluationsReceived: parseInt(row.coaching_evaluations_received),
        avgCoachingScore: parseFloat(row.avg_coaching_score) || 0,
        regionId: row.regionId,
        regionName: row.region_name
      })),
      
      // Company execution metrics (salespeople evaluations)
      companyExecutionMetrics: companyExecutionResult.rows[0] ? {
        totalExecutionEvaluations: parseInt(companyExecutionResult.rows[0].total_execution_evaluations),
        avgExecutionScore: parseFloat(companyExecutionResult.rows[0].avg_execution_score) || 0,
        totalSalespeopleEvaluated: parseInt(companyExecutionResult.rows[0].total_salespeople_evaluated),
        totalSalesLeadsEvaluating: parseInt(companyExecutionResult.rows[0].total_sales_leads_evaluating)
      } : null,
      
      // Company coaching metrics (sales leads evaluations)
      companyCoachingMetrics: companyCoachingResult.rows[0] ? {
        totalCoachingEvaluations: parseInt(companyCoachingResult.rows[0].total_coaching_evaluations),
        avgCoachingScore: parseFloat(companyCoachingResult.rows[0].avg_coaching_score) || 0,
        totalSalesLeadsEvaluated: parseInt(companyCoachingResult.rows[0].total_sales_leads_evaluated),
        totalRegionalManagersEvaluating: parseInt(companyCoachingResult.rows[0].total_regional_managers_evaluating)
      } : null,
      
      // User counts
      userCounts: userCountsResult.rows[0] ? {
        totalSalesLeads: parseInt(userCountsResult.rows[0].total_sales_leads),
        totalRegionalManagers: parseInt(userCountsResult.rows[0].total_regional_managers),
        totalSalespeople: parseInt(userCountsResult.rows[0].total_salespeople)
      } : null,
      
      // Share of Wallet distribution
      shareOfWalletDistribution: shareOfWalletResult.rows.map(row => ({
        customerType: row.customer_type,
        evaluationCount: parseInt(row.evaluation_count),
        avgScore: parseFloat(row.avg_score) || 0,
        percentage: parseFloat(row.percentage) || 0
      })),
      
      // Execution trends (salespeople evaluations)
      executionTrends: executionTrendsResult.rows.map(row => ({
        date: row.evaluation_date,
        evaluationsCount: parseInt(row.evaluations_count),
        avgScore: parseFloat(row.avg_score) || 0
      })),
      
      // Coaching trends (sales leads evaluations)
      coachingTrends: coachingTrendsResult.rows.map(row => ({
        date: row.evaluation_date,
        evaluationsCount: parseInt(row.evaluations_count),
        avgScore: parseFloat(row.avg_score) || 0
      })),

      // Regional execution metrics (regional managers performance in sales behaviours)
      regionalExecutionMetrics: regionalExecutionMetricsResult.rows.map(row => ({
        regionalManagerId: row.regional_manager_id,
        regionalManagerName: row.regional_manager_name,
        regionalManagerEmail: row.regional_manager_email,
        regionId: row.regionId,
        regionName: row.region_name,
        executionEvaluations: parseInt(row.execution_evaluations),
        avgExecutionScore: parseFloat(row.avg_execution_score) || 0,
        uniqueSalespeopleEvaluated: parseInt(row.unique_salespeople_evaluated),
        uniqueSalesLeadsEvaluating: parseInt(row.unique_sales_leads_evaluating)
      })),

      // Regional coaching metrics (regional managers performance in coaching)
      regionalCoachingMetrics: regionalCoachingMetricsResult.rows.map(row => ({
        regionalManagerId: row.regional_manager_id,
        regionalManagerName: row.regional_manager_name,
        regionalManagerEmail: row.regional_manager_email,
        regionId: row.regionId,
        regionName: row.region_name,
        coachingEvaluations: parseInt(row.coaching_evaluations),
        avgCoachingScore: parseFloat(row.avg_coaching_score) || 0,
        uniqueSalesLeadsEvaluated: parseInt(row.unique_sales_leads_evaluated)
      }))
    };

    console.log(`✅ Returning dashboard data: ${dashboardData.regionalExecutionPerformance.length} execution regions, ${dashboardData.regionalCoachingPerformance.length} coaching regions, ${dashboardData.salespeopleExecutionPerformance.length} execution sales leads, ${dashboardData.salesLeadCoachingPerformance.length} coaching sales leads`);
    res.json(dashboardData);

  } catch (error) {
    console.error('❌ Error fetching director dashboard data:', error);
    res.status(500).json({ 
      message: 'Failed to fetch dashboard data', 
      error: error.message 
    });
  }
});

// Additional admin panel endpoints
app.get('/public-admin/regions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, "createdAt", "updatedAt"
      FROM regions
      ORDER BY name
    `);
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
    
    const result = await pool.query(
      'INSERT INTO users (id, email, password, "displayName", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id, email, "displayName", role, "isActive"',
      [crypto.randomUUID(), email, hashedPassword, displayName, role, true]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/public-admin/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, email, role, isActive } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET "displayName" = $1, email = $2, role = $3, "isActive" = $4, "updatedAt" = NOW() WHERE id = $5 RETURNING id, email, "displayName", role, "isActive"',
      [displayName, email, role, isActive, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Database error' });
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

    // Step 2: Delete user_teams memberships using quoted camelCase (from restore SQL)
    const deleteMemberships = await client.query('DELETE FROM user_teams WHERE "teamId" = $1', [id]);
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

module.exports = app;
