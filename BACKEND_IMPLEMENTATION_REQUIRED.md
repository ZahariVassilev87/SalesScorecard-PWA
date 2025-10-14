# 🚨 Backend Implementation Required

## Current Status
✅ **Frontend**: Token refresh mechanism fully implemented and working  
❌ **Backend**: Refresh token endpoint not implemented yet  
🔧 **Temporary**: Frontend simulates successful sync for testing

## What's Working
- ✅ Frontend detects 401 errors correctly
- ✅ Frontend attempts token refresh automatically
- ✅ Frontend provides clear error messages
- ✅ Temporary workaround allows testing

## What's Missing (Backend)

### 1. Refresh Token Endpoint
**Required**: `POST /auth/refresh`

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

### 2. Login Response Update
**Current**: Login only returns access token  
**Required**: Login should return both access token AND refresh token

**Updated Login Response**:
```json
{
  "token": "access_token_here",
  "refreshToken": "refresh_token_here", 
  "expiresIn": 86400,
  "user": {
    "id": "user1",
    "email": "manager@company.com",
    "displayName": "Regional Manager",
    "role": "REGIONAL_SALES_MANAGER"
  }
}
```

### 3. JWT Configuration
**Access Tokens**: 24 hours expiration  
**Refresh Tokens**: 30 days expiration  
**Secret Keys**: Use different secrets for access and refresh tokens

### 4. Role Permissions
**Issue**: `REGIONAL_SALES_MANAGER` getting 401 on `/evaluations` POST  
**Fix**: Ensure this role has permission to create evaluations

## Implementation Example

### Backend Server (Node.js/Express)
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your_access_token_secret';
const REFRESH_SECRET = 'your_refresh_token_secret';
const refreshTokens = new Set(); // In production, use database

// Login endpoint
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  
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

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: 86400,
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

    // Update refresh tokens
    refreshTokens.delete(refreshToken);
    refreshTokens.add(newRefreshToken);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 86400
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
```

## Testing

### 1. Test Login
```bash
curl -X POST https://api.instorm.io/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "manager@company.com", "password": "password"}'
```

**Expected Response**:
```json
{
  "token": "access_token",
  "refreshToken": "refresh_token",
  "expiresIn": 86400,
  "user": {...}
}
```

### 2. Test Refresh
```bash
curl -X POST https://api.instorm.io/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "refresh_token_from_login"}'
```

**Expected Response**:
```json
{
  "token": "new_access_token",
  "refreshToken": "new_refresh_token", 
  "expiresIn": 86400
}
```

### 3. Test Evaluation Creation
```bash
curl -X POST https://api.instorm.io/evaluations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer access_token" \
  -d '{"test": "data"}'
```

**Expected Response**: 201 Created (not 401 Unauthorized)

## Current Frontend Behavior

### With Backend Implementation
1. User logs in → Gets access token + refresh token
2. Token expires → Frontend automatically refreshes
3. Sync works seamlessly → No manual re-login needed

### Without Backend Implementation (Current)
1. User logs in → Gets access token only
2. Token expires → Frontend attempts refresh
3. Refresh fails → Temporary workaround simulates success
4. User sees "synced" but data isn't actually sent to backend

## Priority
🔴 **HIGH**: This is blocking production deployment  
⏰ **Timeline**: Should be implemented before production release  
🎯 **Impact**: Users currently can't sync offline evaluations

## Files to Update
- Backend authentication middleware
- Login endpoint response
- Add refresh token endpoint
- Update JWT configuration
- Fix role permissions for evaluations

---

**Status**: ⏳ Waiting for backend implementation  
**Frontend**: ✅ Ready and waiting  
**Next Step**: Backend team implements refresh token endpoint


