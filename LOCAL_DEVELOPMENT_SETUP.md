# 🚀 Local Development Setup

## Overview
This guide will help you set up the Sales Scorecard PWA for local development with a complete backend server that includes refresh token functionality.

## Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)

## Quick Start

### Option 1: Automated Setup (Recommended)
```bash
./start-local.sh
```

This script will:
- ✅ Start the backend server on port 3001
- ✅ Start the frontend development server on port 3000
- ✅ Test backend health
- ✅ Display test credentials

### Option 2: Manual Setup

#### 1. Start Backend Server
```bash
cd local-backend
npm install
npm start
```

#### 2. Start Frontend (in new terminal)
```bash
npm start
```

## 🎯 What's Working

### ✅ Backend Features
- **Authentication**: Login with email/password
- **Refresh Tokens**: Automatic token refresh mechanism
- **Role-Based Access**: REGIONAL_SALES_MANAGER can create evaluations
- **All Endpoints**: Complete API matching production structure

### ✅ Frontend Features
- **Token Refresh**: Automatic refresh on 401 errors
- **Offline Sync**: Works with local backend
- **Real Authentication**: No more temporary workarounds
- **Complete Functionality**: All features working locally

## 🔑 Test Credentials

| Email | Password | Role |
|-------|----------|------|
| manager@company.com | password | REGIONAL_SALES_MANAGER |
| saleslead@example.com | password | SALES_LEAD |
| admin@example.com | password | ADMIN |

## 📋 Available Endpoints

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and invalidate refresh token

### Data
- `POST /evaluations` - Create evaluation (requires auth)
- `GET /organizations/salespeople` - Get salespeople (requires auth)
- `GET /organizations/teams` - Get teams (requires auth)
- `GET /scoring/categories` - Get scoring categories (requires auth)
- `GET /analytics/dashboard` - Get dashboard analytics (requires auth)
- `GET /analytics/team` - Get team analytics (requires auth)

### Health
- `GET /health` - Health check

## 🧪 Testing the Setup

### 1. Test Backend Health
```bash
curl http://localhost:3001/health
```

### 2. Test Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "manager@company.com", "password": "password"}'
```

### 3. Test Token Refresh
```bash
# Use the refreshToken from login response
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "your_refresh_token_here"}'
```

### 4. Test Evaluation Creation
```bash
# Use the token from login response
curl -X POST http://localhost:3001/evaluations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_token_here" \
  -d '{"test": "evaluation data"}'
```

## 🔄 How Token Refresh Works

### 1. Login Flow
```
User Login → Access Token (24h) + Refresh Token (30d)
```

### 2. API Request Flow
```
API Request → 401 Unauthorized → Auto Refresh Token → Retry Request
```

### 3. Offline Sync Flow
```
Sync Attempt → 401 Error → Refresh Token → Retry Sync → Success
```

## 🎯 Frontend Testing

### 1. Login to the App
- Go to http://localhost:3000
- Use credentials: manager@company.com / password
- You should see the dashboard

### 2. Test Offline Sync
- Create an evaluation
- Go offline (disable network)
- Submit evaluation (should store offline)
- Go online (enable network)
- Click "Sync Now" button
- Should see: "✅ Token refreshed, retrying evaluation sync..."
- Evaluation should sync successfully

### 3. Test Token Refresh
- Wait for token to expire (or manually expire it)
- Try to sync offline evaluations
- Should see automatic token refresh in console
- Sync should work without manual re-login

## 🚀 Production Deployment

### Frontend
The frontend is ready for production. To deploy:

1. **Update API URL**: Change `.env` to use production URL
2. **Build**: `npm run build`
3. **Deploy**: Upload build folder to your hosting service

### Backend
To deploy the backend to AWS:

1. **Use the code**: Copy from `local-backend-server.js`
2. **Update secrets**: Use strong JWT secrets
3. **Add database**: Replace in-memory storage with DynamoDB
4. **Deploy**: Use AWS Lambda + API Gateway

## 🔧 Configuration

### Environment Variables
- `REACT_APP_API_BASE_URL`: Backend API URL (default: http://localhost:3001)
- `REACT_APP_VAPID_PUBLIC_KEY`: Push notification key

### Backend Configuration
- `JWT_SECRET`: Access token secret
- `REFRESH_SECRET`: Refresh token secret
- `PORT`: Server port (default: 3001)

## 🐛 Troubleshooting

### Backend Won't Start
- Check if port 3001 is available
- Run `npm install` in local-backend directory
- Check Node.js version (v16+)

### Frontend Can't Connect
- Verify backend is running on port 3001
- Check `.env` file has correct API URL
- Clear browser cache

### Token Refresh Not Working
- Check browser console for errors
- Verify refresh token endpoint is working
- Check JWT secrets match

## 📁 File Structure

```
SalesScorecard-PWA/
├── local-backend/           # Backend server
│   ├── server.js           # Main server file
│   ├── package.json        # Backend dependencies
│   └── node_modules/       # Backend dependencies
├── src/                    # Frontend source
├── .env                    # Environment variables
├── start-local.sh          # Startup script
└── LOCAL_DEVELOPMENT_SETUP.md
```

## 🎉 Success!

If everything is working:
- ✅ Backend server running on port 3001
- ✅ Frontend running on port 3000
- ✅ Login works with test credentials
- ✅ Token refresh works automatically
- ✅ Offline sync works with real backend
- ✅ All features functional locally

You're ready to develop and test the complete application locally! 🚀


