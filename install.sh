#!/bin/bash
# ============================================================
# MarkD — Raw Install Script
# ============================================================
# This script sets up a fresh MarkD instance from scratch.
# It handles: dependencies, database, migrations, seed data,
# frontend build, and optionally starts the services.
#
# Usage:
#   ./install.sh              # Full install with demo data
#   ./install.sh --no-demo    # Install without demo data
#   ./install.sh --reset      # Drop and recreate database, then install
#
# Prerequisites:
#   - MySQL server running
#   - Node.js 18+ installed
#   - Python 3.9+ installed
#   - backend/.env configured (DB credentials, secrets, etc.)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
DATABASE_DIR="$SCRIPT_DIR/database"
YJS_DIR="$SCRIPT_DIR/yjs-server"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
SKIP_DEMO=false
RESET_DB=false
for arg in "$@"; do
    case $arg in
        --no-demo) SKIP_DEMO=true ;;
        --reset)   RESET_DB=true ;;
    esac
done

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  MarkD — Raw Install${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# ============================================================
# 1. Check prerequisites
# ============================================================
echo -e "${YELLOW}[1/8] Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found. Install Node.js 18+ first.${NC}"
    exit 1
fi

if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo -e "${RED}ERROR: Python not found. Install Python 3.9+ first.${NC}"
    exit 1
fi

PYTHON_CMD=$(command -v python3 || command -v python)

if ! command -v mysql &> /dev/null; then
    echo -e "${RED}ERROR: MySQL client not found.${NC}"
    exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${RED}ERROR: backend/.env not found. Copy .env.example and configure it.${NC}"
    exit 1
fi

# Read DB config from .env
DB_NAME=$(grep '^MYSQL_DATABASE=' "$BACKEND_DIR/.env" | cut -d= -f2)
DB_HOST=$(grep '^MYSQL_HOST=' "$BACKEND_DIR/.env" | cut -d= -f2)
DB_PORT=$(grep '^MYSQL_PORT=' "$BACKEND_DIR/.env" | cut -d= -f2)

# Use root access (no password needed on this server)
MYSQL_CMD="mysql -h ${DB_HOST:-localhost} -P ${DB_PORT:-3306} $DB_NAME"

echo -e "  Node.js: $(node --version)"
echo -e "  Python:  $($PYTHON_CMD --version 2>&1)"
echo -e "  MySQL:   $(mysql --version | head -1)"
echo -e "  DB:      $DB_NAME@${DB_HOST:-localhost}:${DB_PORT:-3306}"
echo -e "${GREEN}  ✓ All prerequisites met${NC}"
echo ""

# ============================================================
# 2. Reset database (optional)
# ============================================================
if [ "$RESET_DB" = true ]; then
    echo -e "${YELLOW}[2/8] Resetting database...${NC}"
    echo -e "  Dropping and recreating $DB_NAME..."
    mysql -h ${DB_HOST:-localhost} -P ${DB_PORT:-3306} -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    echo -e "${GREEN}  ✓ Database reset${NC}"
else
    echo -e "${YELLOW}[2/8] Skipping database reset (use --reset to drop all tables)${NC}"
fi
echo ""

# ============================================================
# 3. Install backend dependencies
# ============================================================
echo -e "${YELLOW}[3/8] Installing backend dependencies...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    $PYTHON_CMD -m venv venv
    echo -e "  Created virtual environment"
fi

source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo -e "${GREEN}  ✓ Backend dependencies installed${NC}"
echo ""

# ============================================================
# 4. Run database schema + migrations
# ============================================================
echo -e "${YELLOW}[4/8] Setting up database schema...${NC}"

# Run install.sql (creates base tables + admin user)
if [ -f "$DATABASE_DIR/install.sql" ]; then
    $MYSQL_CMD < "$DATABASE_DIR/install.sql" 2>/dev/null || true
    echo -e "  Applied install.sql"
fi

# Run schema.sql (creates documents, session_states, mcp tables)
if [ -f "$DATABASE_DIR/schema.sql" ]; then
    $MYSQL_CMD < "$DATABASE_DIR/schema.sql" 2>/dev/null || true
    echo -e "  Applied schema.sql"
fi

# Create tables that may be missing from install/schema/migrations
$MYSQL_CMD -e "
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_steps (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    color VARCHAR(50) DEFAULT 'gray',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_tag_links (
    document_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (document_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
" 2>/dev/null || true
echo -e "  Applied supplementary tables"

# Run all migrations in order
MIGRATION_COUNT=0
for migration in "$BACKEND_DIR/migrations/"*.sql; do
    if [ -f "$migration" ]; then
        $MYSQL_CMD < "$migration" 2>/dev/null || true
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
    fi
done

# Ensure sort_order column exists on tasks (may be missing from older migrations)
$MYSQL_CMD -e "ALTER TABLE tasks ADD COLUMN sort_order INT DEFAULT 0;" 2>/dev/null || true

echo -e "${GREEN}  ✓ Schema ready ($MIGRATION_COUNT migrations applied)${NC}"
echo ""

# ============================================================
# 5. Seed demo data (optional)
# ============================================================
if [ "$SKIP_DEMO" = true ]; then
    echo -e "${YELLOW}[5/8] Skipping demo data (--no-demo flag)${NC}"
else
    echo -e "${YELLOW}[5/8] Seeding demo data...${NC}"
    cd "$BACKEND_DIR"
    source venv/bin/activate
    $PYTHON_CMD "$DATABASE_DIR/seed_demo.py" 2>&1 | while IFS= read -r line; do
        echo -e "  $line"
    done
    echo -e "${GREEN}  ✓ Demo data seeded${NC}"
fi
echo ""

# ============================================================
# 6. Install frontend dependencies
# ============================================================
echo -e "${YELLOW}[6/8] Installing frontend dependencies...${NC}"
cd "$FRONTEND_DIR"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}  ✓ Frontend dependencies installed${NC}"
echo ""

# ============================================================
# 7. Install yjs-server dependencies
# ============================================================
echo -e "${YELLOW}[7/8] Installing yjs-server dependencies...${NC}"
if [ -d "$YJS_DIR" ] && [ -f "$YJS_DIR/package.json" ]; then
    cd "$YJS_DIR"
    npm install --silent 2>&1 | tail -1
    echo -e "${GREEN}  ✓ YJS server dependencies installed${NC}"
else
    echo -e "  Skipped (no yjs-server directory)"
fi
echo ""

# ============================================================
# 8. Summary
# ============================================================
API_PORT=$(grep '^API_PORT=' "$BACKEND_DIR/.env" | cut -d= -f2)
FRONTEND_PORT=$(grep '^FRONTEND_PORT=' "$BACKEND_DIR/.env" | cut -d= -f2)

echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}  MarkD installation complete!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "  ${BLUE}Ports:${NC}"
echo -e "    Backend:  ${API_PORT:-8300}"
echo -e "    Frontend: ${FRONTEND_PORT:-5373}"
echo -e "    YJS:      $(grep 'const PORT' "$YJS_DIR/server.js" 2>/dev/null | grep -o '[0-9]*' || echo '1235')"
echo ""

if [ "$SKIP_DEMO" = false ]; then
    echo -e "  ${BLUE}Demo accounts (password: Demo1234!@):${NC}"
    echo -e "    admin  / admin         (admin)"
    echo -e "    alice  / Demo1234!@    (admin)"
    echo -e "    bob    / Demo1234!@    (user)"
    echo -e "    carol  / Demo1234!@    (user)"
    echo -e "    david  / Demo1234!@    (user)"
    echo ""
fi

echo -e "  ${BLUE}To start:${NC}"
echo -e "    Backend:  cd backend && source venv/bin/activate && python main.py"
echo -e "    Frontend: cd frontend && npm run dev"
echo -e "    YJS:      cd yjs-server && node server.js"
echo ""
