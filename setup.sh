#!/bin/bash

# CREATOR.HUB Workspace Master Controller Automator Script
# Tailored for Debian minimal architectures

echo "🚀 Initializing CREATOR.HUB Full Stack Manager..."

# 1. Clear stuck or locked network adapter ports gracefully
echo "🧹 Scanning for locked backend ports (5000)..."
fuser -k 5000/tcp 2>/dev/null || true

echo "🧹 Scanning for locked frontend ports (5173)..."
fuser -k 5173/tcp 2>/dev/null || true

# 2. Enforce physical local file system storage directory boundaries
if [ ! -d "uploads" ]; then
    echo "📁 Creating missing binary uploads node directory..."
    mkdir -p uploads
fi

# 3. Spin up full execution stack pipelines simultaneously
echo "🔥 Starting Creator Backend Server on Port 5000..."
npm start &

echo "✨ Starting React Frontend Vite Engine on Port 5173..."
# ✅ Added the frontend compiler step to boot simultaneously in the background
npx vite &

echo "🚀 Both engines are initializing concurrently in the background!"
echo "💡 To close everything down completely later, close this terminal window."
