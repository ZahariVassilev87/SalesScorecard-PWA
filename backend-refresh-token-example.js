const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your_jwt_secret_key';
const REFRESH_SECRET = 'your_refresh_secret_key';

app.use(cors());
app.use(bodyParser.json());

// Mock database
const users = [
  { id: 'user1', email: 'manager@company.com', role: 'REGIONAL_SALES_MANAGER', displayName: 'Regional Manager' },
  { id: 'user2', email: 'saleslead@example.com', role: 'SALES_LEAD', displayName: 'Sales Lead' },
  { id: 'user3', email: 'admin@example.com', role: 'ADMIN', displayName: 'Admin User' },
];

// Store refresh tokens (in production, use a database)
const refreshTokens = new Set();

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Invalid token
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
  const user = users.find(u => u.email === email);

  if (user) {
    // Create access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' } // 24 hours
    );

    // Create refresh token (long-lived)
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      REFRESH_SECRET,
      { expiresIn: '30d' } // 30 days
    );

    // Store refresh token
    refreshTokens.add(refreshToken);

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: 86400, // 24 hours in seconds
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      }
    });
  } else {
    res.status(400).json({ message: 'Invalid credentials' });
  }
});

// Refresh token endpoint
app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken || !refreshTokens.has(refreshToken)) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  jwt.verify(refreshToken, REFRESH_SECRET, (err, user) => {
    if (err) {
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
  
  res.json({ message: 'Logged out successfully' });
});

// Mock evaluations endpoint
app.post('/evaluations', authenticateToken, authorizeEvaluationCreation, (req, res) => {
  console.log('Backend: Received evaluation:', req.body);
  // Simulate successful creation
  res.status(201).json({ 
    message: 'Evaluation created successfully', 
    id: `eval_${Date.now()}`,
    data: req.body
  });
});

// Mock /organizations/salespeople endpoint
app.get('/organizations/salespeople', authenticateToken, (req, res) => {
  res.json([
    { id: 'salesperson1', displayName: 'John Doe', role: 'SALES_LEAD' },
    { id: 'salesperson2', displayName: 'Jane Smith', role: 'SALES_LEAD' },
  ]);
});

// Mock /organizations/teams endpoint
app.get('/organizations/teams', authenticateToken, (req, res) => {
  res.json([
    { id: 'team1', name: 'Sales Team 1', members: 5 },
    { id: 'team2', name: 'Sales Team 2', members: 3 },
  ]);
});

// Mock /scoring/categories endpoint
app.get('/scoring/categories', authenticateToken, (req, res) => {
  res.json([
    { id: 'cat1', name: 'Discovery', order: 1, weight: 0.25 },
    { id: 'cat2', name: 'Presentation', order: 2, weight: 0.25 },
    { id: 'cat3', name: 'Objection Handling', order: 3, weight: 0.25 },
    { id: 'cat4', name: 'Closing', order: 4, weight: 0.25 },
  ]);
});

app.listen(PORT, () => {
  console.log(`Backend server with refresh tokens running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /auth/login - Login with email/password');
  console.log('  POST /auth/refresh - Refresh access token');
  console.log('  POST /auth/logout - Logout and invalidate refresh token');
  console.log('  POST /evaluations - Create evaluation (requires auth)');
  console.log('  GET /organizations/salespeople - Get salespeople (requires auth)');
  console.log('  GET /organizations/teams - Get teams (requires auth)');
  console.log('  GET /scoring/categories - Get scoring categories (requires auth)');
});


