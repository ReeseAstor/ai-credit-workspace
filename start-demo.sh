#!/bin/bash

# HBUS AI Credit Manager - Demo Server Setup
echo "🚀 Starting HBUS AI Credit Manager Demo..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ to continue."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm to continue."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo "✅ npm $(npm -v) detected"

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating environment configuration..."
    cp .env.example .env
    echo "✅ Environment file created (.env)"
else
    echo "✅ Environment file exists"
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
else
    echo "✅ Backend dependencies already installed"
fi

# Check if client dependencies are installed
if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd client && npm install --legacy-peer-deps
    cd ..
else
    echo "✅ Frontend dependencies already installed"
fi

# Check if MongoDB is running (optional for demo)
if command -v mongod &> /dev/null; then
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is not running. Starting demo without database connection."
        echo "   To enable full functionality, start MongoDB on port 27017"
    fi
else
    echo "⚠️  MongoDB not found. Running in demo mode without database."
fi

echo ""
echo "🎯 Demo Configuration:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000/api"
echo "   Health Check: http://localhost:5000/api/health"
echo ""
echo "🔐 Demo Credentials:"
echo "   Admin: admin / admin123"
echo "   Underwriter: underwriter / under123"
echo "   Analyst: analyst / analyst123"
echo ""
echo "🚀 Starting servers..."
echo ""

# Start the development server
npm run dev