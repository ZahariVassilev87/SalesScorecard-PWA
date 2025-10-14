// Simple Backend Server for Testing Sales Scorecard PWA
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock JWT Secret (use a real secret in production)
const JWT_SECRET = 'your-secret-key';

// Mock Users Database
const users = [
  {
    id: 'user1',
    email: 'manager@company.com',
    role: 'REGIONAL_SALES_MANAGER',
    isActive: true
  },
  {
    id: 'user2', 
    email: 'director@company.com',
    role: 'SALES_DIRECTOR',
    isActive: true
  }
];

// Mock Evaluations Database
let evaluations = [];

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
  }
};

// Authorization Middleware for Evaluations
const authorizeEvaluationCreation = (req, res, next) => {
  const allowedRoles = [
    'ADMIN',
    'SALES_DIRECTOR',
    'REGIONAL_SALES_MANAGER', // ← This should allow the user to create evaluations
    'REGIONAL_MANAGER'
  ];

  console.log('🔍 User role:', req.user.role);
  console.log('🔍 Allowed roles:', allowedRoles);

  if (allowedRoles.includes(req.user.role)) {
    console.log('✅ User authorized to create evaluations');
    next();
  } else {
    console.log('❌ User not authorized to create evaluations');
    return res.status(401).json({
      message: 'Unauthorized',
      statusCode: 401
    });
  }
};

// Routes

// Login endpoint
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Create JWT token
  const token = jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      isActive: user.isActive 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    }
  });
});

// Get salespeople (mock data)
app.get('/organizations/salespeople', authenticateToken, (req, res) => {
  console.log('🔍 GET /organizations/salespeople - User:', req.user.role);
  
  const salespeople = [
    {
      id: 'sales1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@company.com',
      role: 'SALES_LEAD',
      teamId: 'team1'
    },
    {
      id: 'sales2',
      firstName: 'Jane',
      lastName: 'Smith', 
      email: 'jane@company.com',
      role: 'SALES_LEAD',
      teamId: 'team1'
    }
  ];

  res.json(salespeople);
});

// Get scoring categories (mock data)
app.get('/scoring/categories', authenticateToken, (req, res) => {
  console.log('🔍 GET /scoring/categories - User:', req.user.role);
  
  const categories = [
    {
      id: 'cat1',
      name: 'Discovery',
      order: 1,
      weight: 0.25,
      items: [
        {
          id: 'item1',
          name: 'Asks open-ended questions',
          order: 1,
          isActive: true
        }
      ]
    }
  ];

  res.json(categories);
});

// Create evaluation endpoint
app.post('/evaluations', authenticateToken, authorizeEvaluationCreation, (req, res) => {
  console.log('🔍 POST /evaluations - User:', req.user.role);
  console.log('🔍 Evaluation data:', JSON.stringify(req.body, null, 2));
  
  const evaluation = {
    id: `eval_${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id
  };

  evaluations.push(evaluation);
  
  console.log('✅ Evaluation created successfully:', evaluation.id);
  res.status(201).json(evaluation);
});

// Get evaluations
app.get('/evaluations', authenticateToken, (req, res) => {
  console.log('🔍 GET /evaluations - User:', req.user.role);
  res.json(evaluations);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /auth/login - Login`);
  console.log(`   GET  /organizations/salespeople - Get salespeople`);
  console.log(`   GET  /scoring/categories - Get categories`);
  console.log(`   POST /evaluations - Create evaluation`);
  console.log(`   GET  /evaluations - Get evaluations`);
  console.log(`   GET  /health - Health check`);
});

module.exports = app;


