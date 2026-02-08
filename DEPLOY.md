# MarkD — Deployment Guide

## Prerequisites

- **OS**: Linux (Debian/Ubuntu recommended)
- **Python**: 3.10+
- **Node.js**: 18+
- **MySQL**: 8.0+
- **Nginx** (reverse proxy, optional but recommended)

## Architecture

```
markd-package/
├── backend/          # FastAPI + Socket.IO (Python)
├── frontend/         # React + Vite (TypeScript)
├── database/         # SQL schemas
├── start.sh          # Auto-setup & start script
└── stop.sh           # Stop all services
```

| Service  | Default Port | Protocol       |
|----------|-------------|----------------|
| Backend  | 8200        | HTTP + WebSocket |
| Frontend | 5273        | HTTP (Vite dev) |

## Quick Deploy

### 1. Clone the repository

```bash
git clone git@github.com:xavdp-pro/markd.git /opt/markd
cd /opt/markd
```

### 2. Create the MySQL database

```sql
CREATE DATABASE `markd` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'markd'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON `markd`.* TO 'markd'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Import the schema

```bash
mysql markd < database/install.sql
mysql markd < database/schema.sql
```

### 4. Configure the backend

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values:
```

**Required `.env` variables:**

```env
# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=markd
MYSQL_USER=markd
MYSQL_PASSWORD=your_password

# Security (generate unique values!)
SECRET_KEY=<openssl rand -hex 32>
VAULT_ENCRYPTION_KEY=<python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

# Ports
API_PORT=8200
FRONTEND_PORT=5273

# CORS (add your domain)
CORS_ORIGINS=http://localhost:5273,https://your-domain.com

# App
APP_ENV=production
DEBUG=false
LOG_LEVEL=INFO

# Email (optional)
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=noreply@example.com
MAIL_FROM_NAME=MarkD
```

### 5. Install dependencies

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 6. Start services

**Option A — Using start.sh (recommended):**

```bash
./start.sh
```

**Option B — Manual:**

```bash
# Backend (MUST use socket_app for WebSocket support)
cd backend
source venv/bin/activate
uvicorn main:socket_app --host 0.0.0.0 --port 8200 &

# Frontend
cd ../frontend
npm run dev -- --port 5273 --host 0.0.0.0 &
```

> ⚠️ **IMPORTANT**: Always use `main:socket_app`, NOT `main:app`. The latter bypasses Socket.IO middleware and breaks real-time features.

### 7. Verify

```bash
curl http://localhost:8200/docs    # Backend API docs
curl http://localhost:5273         # Frontend
```

### 8. Stop services

```bash
./stop.sh
```

## Production with Nginx

Example reverse proxy config:

```nginx
server {
    listen 443 ssl http2;
    server_name markd.example.com;

    ssl_certificate     /etc/letsencrypt/live/markd.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/markd.example.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:5273;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

## Default Credentials

| Username | Password |
|----------|----------|
| admin    | admin    |

> ⚠️ **Change immediately after first login!**

## Features

- **Documents**: Collaborative Markdown editor with real-time cursors
- **Tasks**: Kanban + tree view, collaborative editing, comments, checklists, file attachments
- **Passwords**: Encrypted vault (Fernet)
- **Files**: Upload, organize in folders, drag & drop
- **Schemas**: Visual device/network diagrams
- **Multi-workspace**: Role-based access (admin/write/read)
- **Real-time**: WebSocket notifications, presence indicators
