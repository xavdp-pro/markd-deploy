#!/bin/bash

# MarkD Service Launcher
# Simple script to start backend and frontend services
# 
# Usage:
#   Interactive mode: ./start.sh
#   Automatic mode:   ./start.sh --auto --db-host localhost --db-name markd --db-user markd_user --db-password secret
#
# Options:
#   --auto                    Enable automatic mode (no prompts)
#   --db-host HOST            Database host (default: localhost)
#   --db-port PORT            Database port (default: 3306)
#   --db-name NAME            Database name (required in auto mode)
#   --db-user USER            Database user (required in auto mode)
#   --db-password PASS        Database password (required in auto mode)
#   --backend-port PORT       Backend port (default: 8000)
#   --frontend-port PORT      Frontend port (default: 5173)
#   --skip-db-import          Skip database import
#   --skip-deps               Skip dependency installation
#   --help                    Show this help message

set -e

# Default values
AUTO_MODE=false
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME=""
DB_USER=""
DB_PASSWORD=""
BACKEND_PORT="8000"
FRONTEND_PORT="5173"
SKIP_DB_IMPORT=false
SKIP_DEPS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto)
            AUTO_MODE=true
            shift
            ;;
        --db-host)
            DB_HOST="$2"
            shift 2
            ;;
        --db-port)
            DB_PORT="$2"
            shift 2
            ;;
        --db-name)
            DB_NAME="$2"
            shift 2
            ;;
        --db-user)
            DB_USER="$2"
            shift 2
            ;;
        --db-password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        --skip-db-import)
            SKIP_DB_IMPORT=true
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --help)
            echo "MarkD Service Launcher"
            echo ""
            echo "Usage:"
            echo "  Interactive mode: ./start.sh"
            echo "  Automatic mode:   ./start.sh --auto --db-name markd --db-user markd_user --db-password secret"
            echo ""
            echo "Options:"
            echo "  --auto                    Enable automatic mode (no prompts)"
            echo "  --db-host HOST            Database host (default: localhost)"
            echo "  --db-port PORT            Database port (default: 3306)"
            echo "  --db-name NAME            Database name (required in auto mode)"
            echo "  --db-user USER            Database user (required in auto mode)"
            echo "  --db-password PASS        Database password (required in auto mode)"
            echo "  --backend-port PORT       Backend port (default: 8000)"
            echo "  --frontend-port PORT      Frontend port (default: 5173)"
            echo "  --skip-db-import          Skip database import"
            echo "  --skip-deps               Skip dependency installation"
            echo "  --help                    Show this help message"
            echo ""
            echo "Example:"
            echo "  ./start.sh --auto --db-name markd-v2 --db-user markd-v2 --db-password 'mypassword'"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate auto mode requirements
if [ "$AUTO_MODE" = true ]; then
    if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
        echo "Error: In automatic mode, --db-name, --db-user, and --db-password are required"
        echo "Use --help for usage information"
        exit 1
    fi
fi

echo "🚀 Starting MarkD Service..."
if [ "$AUTO_MODE" = true ]; then
    echo "📋 Mode: AUTOMATIC"
else
    echo "📋 Mode: INTERACTIVE"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "backend/main.py" ] || [ ! -f "frontend/package.json" ]; then
    print_error "Please run this script from the MarkD root directory"
    exit 1
fi

# Step 1: Check Python
print_step "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
print_status "Python version: $PYTHON_VERSION"

# Step 2: Check Node.js
print_step "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    exit 1
fi

NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Step 3: Check MySQL
print_step "Checking MySQL connection..."
if ! command -v mysql &> /dev/null; then
    print_warning "MySQL client not found, but server might be running"
fi

# Step 4: Backend setup
print_step "Setting up backend..."
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
if [ "$SKIP_DEPS" = false ]; then
    print_status "Installing Python dependencies..."
    pip install --upgrade pip > /dev/null 2>&1
    pip install -r requirements.txt > /dev/null 2>&1
else
    print_status "Skipping Python dependencies installation (--skip-deps)"
fi

# Check .env file
if [ ! -f ".env" ]; then
    if [ "$AUTO_MODE" = true ]; then
        print_status "Creating .env file with provided configuration..."
        # Generate keys
        JWT_KEY=$(openssl rand -hex 32)
        VAULT_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
        
        cat > .env << EOF
# Database Configuration
MYSQL_HOST=$DB_HOST
MYSQL_PORT=$DB_PORT
MYSQL_DATABASE=$DB_NAME
MYSQL_USER=$DB_USER
MYSQL_PASSWORD=$DB_PASSWORD

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=$JWT_KEY

# Encryption Key for password vault
VAULT_ENCRYPTION_KEY=$VAULT_KEY

# API Configuration
API_HOST=0.0.0.0
API_PORT=$BACKEND_PORT

# Frontend Configuration
FRONTEND_PORT=$FRONTEND_PORT

# Application Settings
APP_ENV=production
DEBUG=false

# CORS Origins
CORS_ORIGINS=http://localhost:$FRONTEND_PORT

# Session Configuration
SESSION_TIMEOUT=3600

# Logging
LOG_LEVEL=INFO
EOF
        print_status "✅ .env file created successfully"
    else
        print_warning ".env file not found, creating from template..."
        cp .env.example .env
        print_warning "Please edit backend/.env with your database configuration"
    fi
fi

# Step 5: Frontend setup
print_step "Setting up frontend..."
cd ../frontend

# Install Node dependencies
if [ ! -d "node_modules" ]; then
    if [ "$SKIP_DEPS" = false ]; then
        print_status "Installing Node.js dependencies..."
        npm install
    else
        print_status "Skipping Node.js dependencies installation (--skip-deps)"
    fi
fi

# Step 6: Database setup (optional)
print_step "Checking database..."
cd ..

if [ -f "backend/.env" ]; then
    # Try to check database connection
    source backend/.env 2>/dev/null || true
    
    if [ ! -z "$MYSQL_DATABASE" ] && [ ! -z "$MYSQL_USER" ]; then
        print_status "Database: $MYSQL_DATABASE, User: $MYSQL_USER"
        
        if [ "$SKIP_DB_IMPORT" = false ]; then
            if [ "$AUTO_MODE" = true ]; then
                print_status "Importing database schema (automatic mode)..."
                sed 's/USE markd;/USE `'"$MYSQL_DATABASE"'`;/g; s/CREATE DATABASE IF NOT EXISTS markd/-- CREATE DATABASE IF NOT EXISTS markd/g' database/install.sql | mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null || print_warning "Database install.sql import failed"
                print_status "Importing documents schema..."
                mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < database/schema.sql 2>/dev/null || print_warning "Database schema.sql import failed"
                print_status "Importing documentation seed data..."
                mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < database/seed_documentation.sql 2>/dev/null || print_warning "Database seed_documentation.sql import failed"
            else
                # Ask if user wants to setup database
                read -p "Do you want to setup/import the database now? (y/n): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    print_status "Importing database schema..."
                    sed 's/USE markd;/USE `'"$MYSQL_DATABASE"'`;/g; s/CREATE DATABASE IF NOT EXISTS markd/-- CREATE DATABASE IF NOT EXISTS markd/g' database/install.sql | mysql -u "$MYSQL_USER" -p "$MYSQL_DATABASE" 2>/dev/null || print_warning "Database install.sql import failed"
                    print_status "Importing documents schema..."
                    mysql -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < database/schema.sql 2>/dev/null || print_warning "Database schema.sql import failed"
                    print_status "Importing documentation seed data..."
                    mysql -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < database/seed_documentation.sql 2>/dev/null || print_warning "Database seed_documentation.sql import failed"
                fi
            fi
        else
            print_status "Skipping database import (--skip-db-import)"
        fi
    fi
fi

# Step 7: Start services
print_step "Starting services..."

# Use ports from backend/.env if present (e.g. API_PORT=8200 for markd-v2)
if [ -f "backend/.env" ]; then
  source backend/.env 2>/dev/null || true
  [ -n "${API_PORT:-}" ] && BACKEND_PORT="$API_PORT"
  [ -n "${FRONTEND_PORT:-}" ] && FRONTEND_PORT="$FRONTEND_PORT"
fi

# Create logs directory
mkdir -p logs

# Start backend in background
print_status "Starting backend on port $BACKEND_PORT..."
cd backend
source venv/bin/activate
nohup uvicorn main:socket_app --host 0.0.0.0 --port $BACKEND_PORT > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid

# Wait a moment for backend to start
sleep 3

# Start frontend in background
print_status "Starting frontend on port $FRONTEND_PORT..."
cd ../frontend
nohup npm run dev -- --port $FRONTEND_PORT --host 0.0.0.0 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid

# Step 8: Wait and verify
print_step "Verifying services..."
sleep 5

# Check backend
if curl -s http://localhost:$BACKEND_PORT/ > /dev/null; then
    print_status "✅ Backend is running on http://localhost:$BACKEND_PORT"
else
    print_error "❌ Backend failed to start"
    tail -10 ../logs/backend.log
fi

# Check frontend
if curl -s http://localhost:$FRONTEND_PORT/ > /dev/null; then
    print_status "✅ Frontend is running on http://localhost:$FRONTEND_PORT"
else
    print_error "❌ Frontend failed to start"
    tail -10 ../logs/frontend.log
fi

# Step 9: Final instructions
echo ""
echo -e "${GREEN}🎉 MarkD is starting up!${NC}"
echo ""
echo "📍 Access URLs:"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend API: http://localhost:$BACKEND_PORT"
echo "   API Documentation: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "📝 Logs:"
echo "   Backend: logs/backend.log"
echo "   Frontend: logs/frontend.log"
echo ""
echo "🛑 To stop services:"
echo "   ./stop.sh"
echo ""
echo "🔐 Default credentials:"
echo "   Username: admin"
echo "   Password: admin"
echo "   ⚠️  Change immediately after first login!"
echo ""
echo -e "${BLUE}Happy documenting! 📚${NC}"
