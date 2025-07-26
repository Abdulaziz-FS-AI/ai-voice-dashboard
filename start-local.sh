#!/bin/bash

echo "🚀 Starting Voice Matrix AI Dashboard..."
echo "📍 Project directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🌐 Starting development server..."
echo "📱 Opening at: http://localhost:3000"
echo ""
echo "✨ Features available:"
echo "   - Landing Page with professional design"
echo "   - Backend API architecture ready"
echo "   - Enhanced authentication system"
echo "   - Security & validation utilities"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start the React development server
npm start