#!/bin/bash

# Sales Scorecard PWA - Local Development Startup Script

echo "🚀 Starting Sales Scorecard PWA Local Development Environment"
echo "=============================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Start the backend server
echo ""
echo "🔧 Starting Backend Server..."
cd local-backend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start backend in background
npm start &
BACKEND_PID=$!
echo "✅ Backend server started (PID: $BACKEND_PID)"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Test backend health
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server is healthy"
else
    echo "❌ Backend server failed to start"
    kill $BACKEND_PID
    exit 1
fi

# Go back to root directory
cd ..

# Start the frontend
echo ""
echo "🎨 Starting Frontend Development Server..."
echo "📋 Frontend will be available at: http://localhost:3000"
echo "📋 Backend API is available at: http://localhost:3001"
echo ""
echo "🔑 Test Credentials:"
echo "   Email: manager@company.com"
echo "   Password: password"
echo "   Role: REGIONAL_SALES_MANAGER"
echo ""
echo "🛑 Press Ctrl+C to stop both servers"
echo ""

# Start frontend
npm start

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    echo "✅ All servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for frontend to finish
wait


