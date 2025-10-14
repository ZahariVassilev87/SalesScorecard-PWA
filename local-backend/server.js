const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;

// JWT Secrets (use strong secrets in production)
const JWT_SECRET = 'your_jwt_secret_key_for_access_tokens';
const REFRESH_SECRET = 'your_refresh_secret_key_for_refresh_tokens';

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'], // React app URL and test server
  credentials: true
}));
app.use(bodyParser.json());

// In-memory storage (use database in production)
let storedEvaluations = []; // Store evaluations in memory

const users = [
  { 
    id: 'user1', 
    email: 'manager@company.com', 
    password: 'password', // In production, use hashed passwords
    role: 'REGIONAL_SALES_MANAGER', 
    displayName: 'Regional Manager',
    firstName: 'Krasimir',
    lastName: 'Manager'
  },
  { 
    id: 'user2', 
    email: 'saleslead@example.com', 
    password: 'password',
    role: 'SALES_LEAD', 
    displayName: 'Sales Lead',
    firstName: 'John',
    lastName: 'Doe'
  },
  { 
    id: 'user3', 
    email: 'admin@example.com', 
    password: 'password',
    role: 'ADMIN', 
    displayName: 'Admin User',
    firstName: 'Admin',
    lastName: 'User'
  },
];

// Store refresh tokens (use database in production)
const refreshTokens = new Set();

// Mock data
const salespeople = [
  { 
    id: 'cmfz2lwck00006sgnaia9galb', 
    firstName: 'Maria', 
    lastName: '', 
    email: 'maria@company.com', 
    teamId: 'cmfo8me9r001ail2udrfjqgbt',
    role: 'SALES_LEAD',
    displayName: 'Maria'
  },
  { 
    id: 'salesperson2', 
    firstName: 'Jane', 
    lastName: 'Smith', 
    email: 'jane@company.com', 
    teamId: 'team1',
    role: 'SALES_LEAD',
    displayName: 'Jane Smith'
  }
];

const teams = [
  { id: 'team1', name: 'Sales Team 1', members: 5 },
  { id: 'team2', name: 'Sales Team 2', members: 3 },
];

const scoringCategories = [
  { 
    id: 'cmfo8m81d0000il2u9b6ymept', 
    name: 'Discovery', 
    order: 1, 
    weight: 0.25, 
    createdAt: '2025-09-17T17:10:07.153Z',
    items: [
      { id: 'cmfo8m81f0002il2uc5w6b8b0', name: 'Asks open-ended questions', order: 1, isActive: true, categoryId: 'cmfo8m81d0000il2u9b6ymept' },
      { id: 'cmfo8m81f0003il2uc5w6b8b1', name: 'Listens actively', order: 2, isActive: true, categoryId: 'cmfo8m81d0000il2u9b6ymept' }
    ]
  },
  { 
    id: 'cat2', 
    name: 'Presentation', 
    order: 2, 
    weight: 0.25, 
    createdAt: '2025-09-17T17:10:07.153Z',
    items: [
      { id: 'item1', name: 'Clear value proposition', order: 1, isActive: true, categoryId: 'cat2' },
      { id: 'item2', name: 'Engaging delivery', order: 2, isActive: true, categoryId: 'cat2' }
    ]
  },
  { 
    id: 'cat3', 
    name: 'Objection Handling', 
    order: 3, 
    weight: 0.25, 
    createdAt: '2025-09-17T17:10:07.153Z',
    items: [
      { id: 'item3', name: 'Addresses concerns', order: 1, isActive: true, categoryId: 'cat3' },
      { id: 'item4', name: 'Provides solutions', order: 2, isActive: true, categoryId: 'cat3' }
    ]
  },
  { 
    id: 'cat4', 
    name: 'Closing', 
    order: 4, 
    weight: 0.25, 
    createdAt: '2025-09-17T17:10:07.153Z',
    items: [
      { id: 'item5', name: 'Asks for commitment', order: 1, isActive: true, categoryId: 'cat4' },
      { id: 'item6', name: 'Follows up', order: 2, isActive: true, categoryId: 'cat4' }
    ]
  }
];

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
  }

  console.log('🔍 Received token preview:', token.substring(0, 50) + '...');
  console.log('🔍 Token length:', token.length);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      console.log('🔍 Full token:', token);
      return res.status(403).json({ message: 'Forbidden', statusCode: 403 });
    }
    req.user = user;
    next();
  });
};

// Middleware to authorize evaluation creation
const authorizeEvaluationCreation = (req, res, next) => {
  const user = req.user;
  const allowedRoles = ['ADMIN', 'SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER'];

  if (allowedRoles.includes(user.role)) {
    next();
  } else {
    return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
  }
};

// Login endpoint
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email, password: '***' });
  
  const user = users.find(u => u.email === email && u.password === password);

  if (user) {
    // Create access token (24h)
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create refresh token (30d)
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Store refresh token
    refreshTokens.add(refreshToken);

    console.log('Login successful for user:', user.email);

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: 86400, // 24 hours in seconds
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } else {
    console.log('Login failed for email:', email);
    res.status(401).json({ 
      message: 'Invalid email or password',
      error: 'Unauthorized',
      statusCode: 401 
    });
  }
});

// Refresh token endpoint
app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  console.log('Refresh token attempt');

  if (!refreshToken || !refreshTokens.has(refreshToken)) {
    console.log('Invalid refresh token');
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  jwt.verify(refreshToken, REFRESH_SECRET, (err, user) => {
    if (err) {
      console.log('Refresh token verification failed:', err.message);
      // Remove invalid refresh token
      refreshTokens.delete(refreshToken);
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // Create new access token
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create new refresh token
    const newRefreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Remove old refresh token and add new one
    refreshTokens.delete(refreshToken);
    refreshTokens.add(newRefreshToken);

    console.log('Token refreshed successfully for user:', user.email);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 86400 // 24 hours in seconds
    });
  });
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
  const { refreshToken } = req.body;
  
  if (refreshToken) {
    refreshTokens.delete(refreshToken);
  }
  
  console.log('User logged out');
  res.json({ message: 'Logged out successfully' });
});

// Evaluations endpoint
app.post('/evaluations', authenticateToken, authorizeEvaluationCreation, (req, res) => {
  console.log('Evaluation creation request:', req.body);
  console.log('User creating evaluation:', req.user);
  
  // Create a proper evaluation object
  const evaluationId = `eval_${Date.now()}`;
  const evaluation = {
    id: evaluationId,
    salespersonId: req.body.salespersonId,
    salesperson: {
      id: req.body.salespersonId,
      name: 'Maria', // This would come from the salespeople data in a real app
      email: 'maria@company.com'
    },
    managerId: req.user.id,
    manager: {
      id: req.user.id,
      name: req.user.displayName || 'Regional Manager',
      email: req.user.email
    },
    visitDate: req.body.visitDate,
    customerName: req.body.customerName || 'Unknown Customer',
    customerType: req.body.customerType || 'unknown',
    location: req.body.location || 'Unknown Location',
    overallComment: req.body.overallComment || '',
    overallScore: calculateOverallScore(req.body.items),
    items: req.body.items.map((item, index) => ({
      id: `item_${evaluationId}_${index}`,
      behaviorItemId: item.behaviorItemId,
      behaviorItem: {
        id: item.behaviorItemId,
        name: getBehaviorItemName(item.behaviorItemId),
        category: { name: 'Coaching' }
      },
      rating: item.score,
      comment: item.comment || ''
    })),
    version: 1,
    createdAt: new Date().toISOString()
  };
  
  // Store the evaluation
  storedEvaluations.push(evaluation);
  console.log(`✅ Stored evaluation ${evaluationId} for user ${req.user.email}`);
  console.log(`📊 Total evaluations stored: ${storedEvaluations.length}`);
  
  res.status(201).json({ 
    message: 'Evaluation created successfully', 
    id: evaluationId,
    data: req.body
  });
});

// Helper function to calculate overall score
function calculateOverallScore(items) {
  if (!items || items.length === 0) return 0;
  const totalScore = items.reduce((sum, item) => sum + (item.score || 0), 0);
  return Math.round((totalScore / items.length) * 10) / 10; // Round to 1 decimal place
}

// Helper function to get behavior item name
function getBehaviorItemName(behaviorItemId) {
  const itemNames = {
    'let-salesperson-lead': 'Let salesperson lead the conversation',
    'provided-support': 'Provided appropriate support',
    'stepped-in-value': 'Stepped in when needed for value',
    'actively-listened': 'Actively listened to the salesperson',
    'calm-atmosphere': 'Maintained a calm atmosphere',
    'asked-self-assessment': 'Asked for self-assessment',
    'listened-attentively': 'Listened attentively to feedback',
    'started-positive': 'Started with positive feedback',
    'concrete-examples': 'Provided concrete examples',
    'identified-improvement': 'Identified areas for improvement',
    'set-clear-tasks': 'Set clear tasks and goals',
    'reached-agreement': 'Reached agreement on next steps',
    'encouraged-goal': 'Encouraged goal setting'
  };
  return itemNames[behaviorItemId] || behaviorItemId;
}

// Get user's evaluations endpoint
app.get('/evaluations/my', authenticateToken, (req, res) => {
  console.log('My evaluations request from user:', req.user.email);
  
  // Return evaluations created by this user
  const userEvaluations = storedEvaluations.filter(eval => eval.managerId === req.user.id);
  console.log(`Found ${userEvaluations.length} evaluations for user ${req.user.email}`);
  
  res.json(userEvaluations);
});

// Organizations/salespeople endpoint
app.get('/organizations/salespeople', authenticateToken, (req, res) => {
  console.log('Salespeople request from user:', req.user.email);
  res.json(salespeople);
});

// Organizations/teams endpoint
app.get('/organizations/teams', authenticateToken, (req, res) => {
  console.log('Teams request from user:', req.user.email);
  res.json(teams);
});

// Scoring/categories endpoint
app.get('/scoring/categories', authenticateToken, (req, res) => {
  console.log('Scoring categories request from user:', req.user.email);
  res.json(scoringCategories);
});

// Analytics endpoints (mock data)
app.get('/analytics/dashboard', authenticateToken, (req, res) => {
  res.json({
    totalRegions: 5,
    totalTeamMembers: 45,
    averagePerformance: 87,
    totalEvaluations: 156,
    evaluationsCompleted: 23,
    averageScore: 4.2
  });
});

app.get('/analytics/team', authenticateToken, (req, res) => {
  res.json({
    teamPerformance: {
      average: 4.2,
      trend: 'improving',
      topPerformers: 3,
      needsImprovement: 1
    },
    evaluationStats: {
      totalEvaluations: 15,
      thisMonth: 5,
      averageScore: 4.1,
      completionRate: 85
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sales Scorecard Backend API',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /auth/login',
      'POST /auth/refresh', 
      'POST /auth/logout',
      'POST /evaluations',
      'GET /organizations/salespeople',
      'GET /organizations/teams',
      'GET /scoring/categories',
      'GET /analytics/dashboard',
      'GET /analytics/team',
      'GET /health'
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Local backend server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  POST /auth/login - Login with email/password');
  console.log('  POST /auth/refresh - Refresh access token');
  console.log('  POST /auth/logout - Logout and invalidate refresh token');
  console.log('  POST /evaluations - Create evaluation (requires auth)');
  console.log('  GET /evaluations/my - Get my evaluations (requires auth)');
  console.log('  GET /organizations/salespeople - Get salespeople (requires auth)');
  console.log('  GET /organizations/teams - Get teams (requires auth)');
  console.log('  GET /scoring/categories - Get scoring categories (requires auth)');
  console.log('  GET /analytics/dashboard - Get dashboard analytics (requires auth)');
  console.log('  GET /analytics/team - Get team analytics (requires auth)');
  console.log('  GET /health - Health check');
  console.log('');
  console.log('🔑 Test credentials:');
  console.log('  Email: manager@company.com, Password: password (REGIONAL_SALES_MANAGER)');
  console.log('  Email: saleslead@example.com, Password: password (SALES_LEAD)');
  console.log('  Email: admin@example.com, Password: password (ADMIN)');
});
