#!/bin/bash

# MarkD Yjs Collaborative Server Launcher
# Starts the Yjs WebSocket server for real-time collaborative editing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YJS_DIR="$SCRIPT_DIR/yjs-server"
YJS_PORT="${YJS_PORT:-1234}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[YJS]${NC} Starting Yjs Collaborative Server..."

cd "$YJS_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}[YJS]${NC} Installing dependencies..."
    npm install
fi

# Copy .env if not exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
    fi
fi

# Start the server
echo -e "${GREEN}[YJS]${NC} Server starting on port $YJS_PORT..."
exec node server.js
