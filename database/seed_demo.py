#!/usr/bin/env python3
"""
MarkD Demo Seed Script
======================
Populates the 'demo' workspace with realistic enterprise data across all modules:
- Documents: IT documentation with cross-module links
- Tasks: Project management tasks with checklists, comments, assignments
- Passwords: Enterprise credentials (servers, emails, APIs, databases) — encrypted
- Files: Sample files (created as placeholders, replace with real files)
- Tags: Shared across modules

Run from the backend directory:
    cd /path/to/backend && python ../database/seed_demo.py

Requires: backend/.env with VAULT_ENCRYPTION_KEY set
"""

import sys
import os
import uuid
from datetime import datetime, timedelta

# Add backend to path so we can import its modules
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'backend')
sys.path.insert(0, BACKEND_DIR)

# Load .env
from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, '.env'))

from database import db
from encryption_service import encryption

# ============================================================
# Configuration
# ============================================================
WORKSPACE_ID = 'demo'
ADMIN_USER_NAME = 'admin'

# Dynamically get admin user ID
admin_row = db.execute_query("SELECT id FROM users WHERE username = %s", (ADMIN_USER_NAME,))
if not admin_row:
    print("ERROR: admin user not found in database. Run install.sql first.")
    sys.exit(1)
ADMIN_USER_ID = admin_row[0]['id']
print(f"Admin user ID: {ADMIN_USER_ID}")

# Ensure the demo workspace exists
existing_ws = db.execute_query("SELECT id FROM workspaces WHERE id = %s", (WORKSPACE_ID,))
if not existing_ws:
    db.execute_update(
        "INSERT INTO workspaces (id, name, description, created_by) VALUES (%s, %s, %s, %s)",
        (WORKSPACE_ID, 'Demo Workspace', 'Enterprise demo workspace with sample data', ADMIN_USER_ID)
    )
    print(f"Created workspace: {WORKSPACE_ID}")
    # Grant ALL group admin access to demo workspace
    all_grp = db.execute_query("SELECT id FROM user_groups_table WHERE name = 'ALL' LIMIT 1")
    if all_grp:
        db.execute_update(
            "INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level) VALUES (%s, %s, 'admin') ON DUPLICATE KEY UPDATE permission_level='admin'",
            (all_grp[0]['id'], WORKSPACE_ID)
        )
else:
    print(f"Workspace '{WORKSPACE_ID}' already exists")

import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def uid():
    return str(uuid.uuid4())

# ============================================================
# DEMO USERS — Realistic team (admin + members)
# ============================================================
print("Creating demo users...")

DEMO_USERS = [
    # (username, email, password, role)
    ('alice',  'alice@demo.markd.io',  'Demo1234!@', 'admin'),
    ('bob',    'bob@demo.markd.io',    'Demo1234!@', 'user'),
    ('carol',  'carol@demo.markd.io',  'Demo1234!@', 'user'),
    ('david',  'david@demo.markd.io',  'Demo1234!@', 'user'),
]

demo_user_ids = {}
for uname, email, pwd, role in DEMO_USERS:
    existing = db.execute_query("SELECT id FROM users WHERE username = %s", (uname,))
    if existing:
        demo_user_ids[uname] = existing[0]['id']
    else:
        pw_hash = hash_password(pwd)
        db.execute_update(
            "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (uname, email, pw_hash, role)
        )
        new_row = db.execute_query("SELECT id FROM users WHERE username = %s", (uname,))
        demo_user_ids[uname] = new_row[0]['id']

# Ensure demo users have access to the demo workspace
# Find or create the workspace access group
all_group = db.execute_query("SELECT id FROM user_groups_table WHERE name = 'ALL' LIMIT 1")
if all_group:
    all_group_id = all_group[0]['id']
    for uname, uid_val in demo_user_ids.items():
        existing = db.execute_query(
            "SELECT 1 FROM user_groups WHERE user_id = %s AND group_id = %s",
            (uid_val, all_group_id)
        )
        if not existing:
            db.execute_update(
                "INSERT INTO user_groups (user_id, group_id) VALUES (%s, %s)",
                (uid_val, all_group_id)
            )

print(f"  {len(DEMO_USERS)} demo users ready: {', '.join(demo_user_ids.keys())}")

# Enable demo mode in system_settings
try:
    existing_demo = db.execute_query("SELECT 1 FROM system_settings WHERE setting_key = 'demo_mode'")
    if not existing_demo:
        db.execute_update("INSERT INTO system_settings (setting_key, setting_value) VALUES ('demo_mode', 'true')")
    else:
        db.execute_update("UPDATE system_settings SET setting_value = 'true' WHERE setting_key = 'demo_mode'")
    print("  Demo mode enabled in system_settings")
except Exception as e:
    print(f"  Warning: Could not set demo_mode setting: {e}")

ALICE_ID = demo_user_ids.get('alice', ADMIN_USER_ID)
BOB_ID = demo_user_ids.get('bob', ADMIN_USER_ID)
CAROL_ID = demo_user_ids.get('carol', ADMIN_USER_ID)
DAVID_ID = demo_user_ids.get('david', ADMIN_USER_ID)

now = datetime.now()
yesterday = now - timedelta(days=1)
last_week = now - timedelta(days=7)
two_weeks_ago = now - timedelta(days=14)
next_week = now + timedelta(days=7)
next_month = now + timedelta(days=30)

# ============================================================
# TAGS (shared across all modules)
# ============================================================
print("Creating tags...")

tag_ids = {}
tag_names = [
    'Infrastructure', 'Security', 'DevOps', 'Frontend', 'Backend',
    'Database', 'Urgent', 'Documentation', 'API', 'Monitoring',
    'Email', 'Cloud', 'Network', 'Backup', 'Production',
    'Staging', 'Development', 'CI/CD', 'SSL', 'DNS'
]

for name in tag_names:
    existing = db.execute_query("SELECT id FROM tags WHERE LOWER(name) = LOWER(%s)", (name,))
    if existing:
        tag_ids[name] = existing[0]['id']
    else:
        tid = uid()
        db.execute_update("INSERT INTO tags (id, name) VALUES (%s, %s)", (tid, name))
        tag_ids[name] = tid

print(f"  {len(tag_ids)} tags ready")

# ============================================================
# DOCUMENTS — IT Documentation with cross-module links
# ============================================================
print("Creating documents...")

# Folders
doc_folder_infra = uid()
doc_folder_dev = uid()
doc_folder_ops = uid()
doc_folder_onboarding = uid()

doc_folders = [
    (doc_folder_infra, 'Infrastructure', 'folder', 'root'),
    (doc_folder_dev, 'Development', 'folder', 'root'),
    (doc_folder_ops, 'Operations', 'folder', 'root'),
    (doc_folder_onboarding, 'Onboarding', 'folder', 'root'),
]

# Documents
doc_arch = uid()
doc_servers = uid()
doc_deploy = uid()
doc_api_guide = uid()
doc_db_guide = uid()
doc_security = uid()
doc_monitoring = uid()
doc_onboard_dev = uid()
doc_runbook = uid()
doc_changelog = uid()

doc_files = [
    # Infrastructure docs
    (doc_arch, 'Architecture Overview.md', 'file', doc_folder_infra, '''# Architecture Overview

## System Architecture

Our platform runs on a **microservices architecture** deployed on cloud infrastructure.

### Components

| Service | Technology | Port | Status |
|---------|-----------|------|--------|
| Frontend | React + Vite | 5373 | Production |
| Backend API | FastAPI + Socket.IO | 8300 | Production |
| Database | MySQL 8.0 | 3306 | Production |
| Cache | Redis | 6379 | Staging |
| Queue | RabbitMQ | 5672 | Planned |

### Infrastructure Diagram

```
[Client Browser]
       |
   [Nginx Reverse Proxy]
       |
  +---------+---------+
  |                   |
[Frontend:5373]  [Backend:8300]
                      |
              +-------+-------+
              |               |
         [MySQL:3306]    [Redis:6379]
```

### Related Resources

- **Server credentials**: See Password Vault > Servers
- **Deployment guide**: See [Deployment Procedures](link-to-deploy-doc)
- **Monitoring setup**: See [Monitoring & Alerting](link-to-monitoring)

> **Task**: [Migrate to Kubernetes](#task-k8s) is planned for Q2 2026
'''),

    (doc_servers, 'Server Inventory.md', 'file', doc_folder_infra, '''# Server Inventory

## Production Servers

| Hostname | IP | Role | OS | RAM | CPU |
|----------|-----|------|-----|-----|-----|
| prod-web-01 | 10.0.1.10 | Web Server | Ubuntu 22.04 | 16GB | 4 vCPU |
| prod-web-02 | 10.0.1.11 | Web Server | Ubuntu 22.04 | 16GB | 4 vCPU |
| prod-db-01 | 10.0.2.10 | MySQL Primary | Ubuntu 22.04 | 32GB | 8 vCPU |
| prod-db-02 | 10.0.2.11 | MySQL Replica | Ubuntu 22.04 | 32GB | 8 vCPU |
| prod-redis-01 | 10.0.3.10 | Redis Cache | Ubuntu 22.04 | 8GB | 2 vCPU |

## Staging Servers

| Hostname | IP | Role | OS |
|----------|-----|------|-----|
| staging-01 | 10.1.1.10 | All-in-one | Ubuntu 22.04 |

## Access

- SSH keys are managed via **Password Vault > Servers > SSH Keys**
- VPN access required for all servers
- Root access restricted to DevOps team

> **Security Note**: All passwords are stored encrypted in the Password Vault module.
> Never share credentials via email or chat.
'''),

    # Development docs
    (doc_api_guide, 'API Reference.md', 'file', doc_folder_dev, '''# API Reference

## Authentication

All API endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "********"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "username": "admin", "role": "admin" }
}
```

## Documents API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents/tree` | Get document tree |
| POST | `/api/documents` | Create document |
| PUT | `/api/documents/:id` | Update document |
| DELETE | `/api/documents/:id` | Delete document |

## Tasks API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/tree` | Get task tree |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

## Password Vault API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vault/tree` | Get vault tree |
| POST | `/api/vault/passwords` | Create entry |
| GET | `/api/vault/passwords/:id` | Get (decrypted) |

> **Note**: Password data is encrypted at rest using Fernet (AES-128-CBC).
> The encryption key is stored in `.env` as `VAULT_ENCRYPTION_KEY`.
'''),

    (doc_db_guide, 'Database Guide.md', 'file', doc_folder_dev, '''# Database Guide

## Connection

```bash
mysql -h localhost -P 3306 -u markd -p markd_db
```

> Credentials stored in **Password Vault > Databases > MySQL Production**

## Schema Overview

### Core Tables

- `users` — User accounts and roles
- `workspaces` — Multi-tenant workspaces
- `documents` — Markdown documents (tree structure)
- `tasks` — Task management (tree + kanban)
- `password_vault` — Encrypted credentials
- `files` — File storage metadata
- `schemas` — Network/device diagrams
- `tags` — Unified tagging system

### Key Relationships

```
users ──< user_groups >── groups
groups ──< group_workspace_permissions >── workspaces
workspaces ──< documents, tasks, password_vault, files, schemas
```

## Migrations

Migrations are in `backend/migrations/` and numbered sequentially:

```bash
# Apply all migrations
for f in backend/migrations/*.sql; do mysql markd_db < "$f"; done
```

## Backup

Daily backups run at 02:00 UTC via cron:

```bash
mysqldump markd_db | gzip > /backups/markd_$(date +%Y%m%d).sql.gz
```

> **Task**: See [Setup automated backups](#task-backup) for implementation details.
'''),

    (doc_deploy, 'Deployment Procedures.md', 'file', doc_folder_ops, '''# Deployment Procedures

## Pre-deployment Checklist

- [ ] All tests passing on staging
- [ ] Database migrations reviewed
- [ ] Changelog updated
- [ ] Team notified in #deployments channel

## Deployment Steps

### 1. Backend

```bash
cd /opt/markd/backend
source venv/bin/activate
git pull origin main
pip install -r requirements.txt
# Apply new migrations if any
for f in migrations/*.sql; do mysql markd_db < "$f" 2>/dev/null; done
# Restart (MUST use socket_app for WebSocket support)
supervisorctl restart markd-backend
```

### 2. Frontend

```bash
cd /opt/markd/frontend
git pull origin main
npm install
npm run build
# Nginx serves static files from dist/
```

### 3. Verify

```bash
curl -s https://markd.example.com/api/health | jq .
curl -s https://markd.example.com/ | head -1
```

## Rollback

```bash
git log --oneline -5
git revert HEAD
# Re-deploy
```

## Environment Variables

See **Password Vault > API Keys > Production .env** for all required variables.

> **Important**: Never use `uvicorn main:app` — always use `main:socket_app` for Socket.IO support.
'''),

    (doc_security, 'Security Policy.md', 'file', doc_folder_ops, '''# Security Policy

## Authentication

- JWT tokens with 1-hour expiry
- Passwords hashed with bcrypt (12 rounds)
- Session timeout: 3600 seconds

## Encryption

- Password vault: **Fernet (AES-128-CBC)** encryption at rest
- SSL/TLS for all connections (Let\'s Encrypt)
- Database connections over localhost only

## Access Control

| Role | Documents | Tasks | Passwords | Files | Admin |
|------|-----------|-------|-----------|-------|-------|
| Admin | Full | Full | Full | Full | Yes |
| Write | Create/Edit | Create/Edit | Create/Edit | Upload | No |
| Read | View only | View only | View only | Download | No |

## Security Checklist

- [ ] Rotate JWT secret every 90 days
- [ ] Rotate vault encryption key annually
- [ ] Review user access quarterly
- [ ] Update SSL certificates (auto-renewed by Certbot)
- [ ] Audit login attempts monthly

## Incident Response

1. Identify the breach scope
2. Rotate all affected credentials in **Password Vault**
3. Review audit logs
4. Notify affected users
5. Document in **Tasks > Security Incidents**

> All credentials MUST be stored in the Password Vault module. Never in code, configs, or chat.
'''),

    (doc_monitoring, 'Monitoring & Alerting.md', 'file', doc_folder_ops, '''# Monitoring & Alerting

## Health Endpoints

| Service | URL | Expected |
|---------|-----|----------|
| Backend | `https://markd.example.com/api/health` | `{"status": "ok"}` |
| Frontend | `https://markd.example.com/` | HTTP 200 |
| Nginx | `https://markd.example.com/health` | "healthy" |

## Logs

| Service | Log Path |
|---------|----------|
| Backend | `/opt/markd/logs/backend.log` |
| Frontend | `/opt/markd/logs/frontend.log` |
| Nginx | `/var/log/nginx/markd-access.log` |

## Alerts

Configure monitoring for:
- **CPU** > 80% for 5 minutes
- **Memory** > 90%
- **Disk** > 85%
- **HTTP 5xx** > 10/minute
- **WebSocket disconnections** > 50/minute

## Uptime Monitoring

Use external monitoring (UptimeRobot, Pingdom) to check:
- HTTPS endpoint every 60 seconds
- SSL certificate expiry (alert 30 days before)

> **Task**: See [Setup monitoring stack](#task-monitoring) for Prometheus + Grafana setup.
'''),

    (doc_onboard_dev, 'Developer Onboarding.md', 'file', doc_folder_onboarding, '''# Developer Onboarding

Welcome to the team! Follow these steps to get started.

## Day 1: Access

1. Get your account created by an admin
2. Request access to the **Demo Workspace**
3. Set up VPN access (credentials in **Password Vault > VPN**)
4. Clone the repository:
   ```bash
   git clone git@github.com:company/markd.git
   ```

## Day 2: Local Setup

1. Follow the [Deployment Procedures](link-to-deploy) for local setup
2. Copy `backend/.env.example` to `backend/.env`
3. Get database credentials from **Password Vault > Databases > Dev MySQL**
4. Run migrations and seed data:
   ```bash
   cd backend && python ../database/seed_demo.py
   ```

## Day 3: Architecture

1. Read [Architecture Overview](link-to-arch)
2. Read [API Reference](link-to-api)
3. Read [Database Guide](link-to-db)

## Key Contacts

| Role | Name | Email |
|------|------|-------|
| Tech Lead | Alice Martin | alice@company.com |
| DevOps | Bob Chen | bob@company.com |
| Product | Carol Dupont | carol@company.com |

## Tools We Use

- **MarkD** — Documentation, tasks, passwords, files
- **Git** — Version control
- **MySQL** — Database
- **Nginx** — Reverse proxy
- **Let\'s Encrypt** — SSL certificates
'''),

    (doc_runbook, 'Incident Runbook.md', 'file', doc_folder_ops, '''# Incident Runbook

## P1: Service Down

### Symptoms
- Users cannot access the application
- Health check returns non-200

### Steps

1. **Check Nginx**: `systemctl status nginx`
2. **Check Backend**: `supervisorctl status markd-backend`
3. **Check Frontend**: `supervisorctl status markd-frontend`
4. **Check MySQL**: `systemctl status mysql`
5. **Check logs**: `tail -100 /opt/markd/logs/backend.log`

### Common Fixes

| Issue | Fix |
|-------|-----|
| Backend crash | `supervisorctl restart markd-backend` |
| MySQL down | `systemctl restart mysql` |
| Nginx 502 | Check backend port, restart backend |
| Disk full | Clean old logs: `find /opt/markd/logs -mtime +30 -delete` |
| SSL expired | `certbot renew && nginx -s reload` |

## P2: Performance Degradation

1. Check server resources: `htop`, `df -h`, `free -m`
2. Check slow queries: `mysqladmin processlist`
3. Check WebSocket connections: Backend logs
4. Scale if needed (see **Tasks > Infrastructure**)

## P3: Feature Bug

1. Reproduce on staging
2. Create task in **Tasks > Bugs**
3. Assign to relevant developer
4. Link related documents
'''),

    (doc_changelog, 'Changelog.md', 'file', doc_folder_dev, '''# Changelog

## v2.5.0 — 2026-02-08

### New Features
- **Collaborative editing** in Tasks module with real-time cursors
- **Save indicator** (glassy lamp) in Documents and Tasks editors
- **File move to root** fix in Files module

### Improvements
- Unified Save/Close behavior across Documents and Tasks
- WebSocket heartbeat for robust connection management
- Distinct cursor colors per collaborator

### Bug Fixes
- Fixed file not appearing after drag-to-root (#142)
- Fixed parent_id null handling in backend (#143)

## v2.4.0 — 2026-01-25

### New Features
- Password vault with Fernet encryption
- File upload module with drag & drop
- Schema/diagram module

### Improvements
- Multi-workspace support
- Role-based access control
- Real-time WebSocket notifications

## v2.3.0 — 2026-01-10

### New Features
- Task management with Kanban view
- Checklist support in tasks
- Task comments and timeline

---

> Full history available in Git: `git log --oneline`
'''),
]

# Insert document folders
for did, name, dtype, parent_id in doc_folders:
    existing = db.execute_query("SELECT id FROM documents WHERE id = %s", (did,))
    if not existing:
        db.execute_update(
            "INSERT INTO documents (id, name, type, parent_id, workspace_id, user_id) VALUES (%s, %s, %s, %s, %s, %s)",
            (did, name, dtype, parent_id, WORKSPACE_ID, ADMIN_USER_ID)
        )

# Insert document files
for did, name, dtype, parent_id, content in doc_files:
    existing = db.execute_query("SELECT id FROM documents WHERE id = %s", (did,))
    if not existing:
        db.execute_update(
            "INSERT INTO documents (id, name, type, content, parent_id, workspace_id, user_id) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (did, name, dtype, content, parent_id, WORKSPACE_ID, ADMIN_USER_ID)
        )

# Tag documents
doc_tag_map = {
    doc_arch: ['Infrastructure', 'Documentation'],
    doc_servers: ['Infrastructure', 'Production'],
    doc_api_guide: ['API', 'Backend', 'Documentation'],
    doc_db_guide: ['Database', 'Backend', 'Documentation'],
    doc_deploy: ['DevOps', 'Production', 'CI/CD'],
    doc_security: ['Security', 'Documentation'],
    doc_monitoring: ['Monitoring', 'DevOps', 'Production'],
    doc_onboard_dev: ['Documentation', 'Development'],
    doc_runbook: ['DevOps', 'Production', 'Monitoring'],
    doc_changelog: ['Development', 'Documentation'],
}

for doc_id, tags in doc_tag_map.items():
    for tag_name in tags:
        tid = tag_ids[tag_name]
        existing = db.execute_query(
            "SELECT * FROM document_tag_links WHERE document_id = %s AND tag_id = %s",
            (doc_id, tid)
        )
        if not existing:
            db.execute_update(
                "INSERT INTO document_tag_links (document_id, tag_id) VALUES (%s, %s)",
                (doc_id, tid)
            )

print(f"  {len(doc_folders)} folders + {len(doc_files)} documents created")

# ============================================================
# PASSWORDS — Enterprise credentials (encrypted)
# ============================================================
print("Creating passwords...")

# Password folders
pw_folder_servers = uid()
pw_folder_databases = uid()
pw_folder_email = uid()
pw_folder_api = uid()
pw_folder_cloud = uid()
pw_folder_vpn = uid()

pw_folders = [
    (pw_folder_servers, 'Servers', None),
    (pw_folder_databases, 'Databases', None),
    (pw_folder_email, 'Email Accounts', None),
    (pw_folder_api, 'API Keys', None),
    (pw_folder_cloud, 'Cloud Services', None),
    (pw_folder_vpn, 'VPN & Network', None),
]

# Password entries: (id, parent_id, title, username, password, url, notes, category)
pw_entries = [
    # Servers
    (uid(), pw_folder_servers, 'prod-web-01 (SSH)', 'deploy', 'Xk9$mP2!vL7@nQ4w', 'ssh://10.0.1.10', 'Production web server 1\nPort: 22\nKey-based auth preferred', 'ssh'),
    (uid(), pw_folder_servers, 'prod-web-02 (SSH)', 'deploy', 'Rj5#hN8&cY1*bF3e', 'ssh://10.0.1.11', 'Production web server 2\nPort: 22', 'ssh'),
    (uid(), pw_folder_servers, 'prod-db-01 (SSH)', 'dbadmin', 'Wm4@pK7!tS9#xL2v', 'ssh://10.0.2.10', 'MySQL primary server\nPort: 22\nRestricted access — DevOps only', 'ssh'),
    (uid(), pw_folder_servers, 'staging-01 (SSH)', 'deploy', 'Qn6$jH3&fD8*aG5r', 'ssh://10.1.1.10', 'Staging all-in-one server\nPort: 22', 'ssh'),

    # Databases
    (uid(), pw_folder_databases, 'MySQL Production', 'markd_prod', 'Zt8!wE5@kP2#mN7v', 'mysql://10.0.2.10:3306/markd_prod', 'Production database\nMax connections: 100\nBackup: daily at 02:00 UTC', 'database'),
    (uid(), pw_folder_databases, 'MySQL Staging', 'markd_staging', 'Bx3#cV9&hJ6*tR1w', 'mysql://10.1.1.10:3306/markd_staging', 'Staging database\nReset weekly from prod snapshot', 'database'),
    (uid(), pw_folder_databases, 'MySQL Dev (local)', 'markd_dev', 'devpass123', 'mysql://localhost:3306/markd_dev', 'Local development database', 'database'),
    (uid(), pw_folder_databases, 'Redis Production', '', 'Fy7@nL4!pQ9#sK2m', 'redis://10.0.3.10:6379', 'Redis cache server\nNo username required\nDatabase: 0', 'database'),

    # Email
    (uid(), pw_folder_email, 'Admin Email (Google)', 'admin@company.com', 'Gm8$kW5!rT3@yH6n', 'https://mail.google.com', 'Main admin email\n2FA enabled\nRecovery: +33 6 XX XX XX XX', 'service'),
    (uid(), pw_folder_email, 'SMTP Relay (SendGrid)', 'apikey', 'SG.REPLACE_WITH_REAL_SENDGRID_KEY', 'https://app.sendgrid.com', 'Transactional emails\nPlan: Pro (100k/month)\nDomain: company.com', 'api'),
    (uid(), pw_folder_email, 'Support Email', 'support@company.com', 'Dn2#fJ8&wL5*cP4v', 'https://mail.google.com', 'Customer support inbox\nShared access with support team', 'service'),

    # API Keys
    (uid(), pw_folder_api, 'GitHub Token (CI/CD)', 'xavdp-pro', 'ghp_REPLACE_WITH_REAL_TOKEN', 'https://github.com/settings/tokens', 'Personal access token\nScopes: repo, workflow\nExpires: 2026-12-31', 'api'),
    (uid(), pw_folder_api, 'Stripe API (Production)', 'sk_live', 'sk_live_REPLACE_WITH_REAL_KEY', 'https://dashboard.stripe.com', 'Production Stripe key\nDO NOT use in staging!', 'api'),
    (uid(), pw_folder_api, 'Stripe API (Test)', 'sk_test', 'sk_test_REPLACE_WITH_REAL_KEY', 'https://dashboard.stripe.com', 'Test Stripe key\nSafe for staging/dev', 'api'),
    (uid(), pw_folder_api, 'Production .env', 'N/A', 'See notes', '', 'SECRET_KEY=<rotated quarterly>\nVAULT_ENCRYPTION_KEY=<never rotate without migration>\nCORS_ORIGINS=https://markd.company.com', 'other'),

    # Cloud
    (uid(), pw_folder_cloud, 'AWS Console', 'admin@company.com', 'Aw5$nR8!kT3@jM6p', 'https://console.aws.amazon.com', 'Root account — use IAM users for daily work\n2FA enabled\nRegion: eu-west-3 (Paris)', 'service'),
    (uid(), pw_folder_cloud, 'Cloudflare', 'admin@company.com', 'Cf7#mK2&wP9*bL4s', 'https://dash.cloudflare.com', 'DNS management\nDomains: company.com, markd.io\nPlan: Pro', 'service'),
    (uid(), pw_folder_cloud, 'Let\'s Encrypt (Certbot)', 'admin@company.com', 'N/A', 'https://letsencrypt.org', 'Auto-renewal via certbot\nCerts in /etc/letsencrypt/\nRenewal cron: twice daily', 'service'),

    # VPN
    (uid(), pw_folder_vpn, 'WireGuard VPN', 'dev-team', 'Wg4@hN7!cF2#tK9m', 'vpn://vpn.company.com:51820', 'WireGuard VPN for server access\nConfig file: /etc/wireguard/wg0.conf\nAllowed IPs: 10.0.0.0/8', 'service'),
    (uid(), pw_folder_vpn, 'Office WiFi', '', 'CompanyWifi2026!', '', 'SSID: Company-Secure\nProtocol: WPA3\nGuest: Company-Guest / Guest2026', 'other'),
]

# Insert password folders
for pid, title, parent_id in pw_folders:
    existing = db.execute_query("SELECT id FROM password_vault WHERE id = %s", (pid,))
    if not existing:
        db.execute_update(
            "INSERT INTO password_vault (id, workspace_id, parent_id, type, title, username, password_encrypted, url, notes, created_by) VALUES (%s, %s, %s, 'folder', %s, '', '', '', '', %s)",
            (pid, WORKSPACE_ID, parent_id, title, ADMIN_USER_ID)
        )

# Insert password entries
for pid, parent_id, title, username, password, url, notes, category in pw_entries:
    existing = db.execute_query("SELECT id FROM password_vault WHERE id = %s", (pid,))
    if not existing:
        encrypted_pw = encryption.encrypt(password)
        db.execute_update(
            "INSERT INTO password_vault (id, workspace_id, parent_id, type, title, username, password_encrypted, url, notes, category, created_by) VALUES (%s, %s, %s, 'password', %s, %s, %s, %s, %s, %s, %s)",
            (pid, WORKSPACE_ID, parent_id, title, username, encrypted_pw, url, notes, category, ADMIN_USER_ID)
        )

# Tag passwords
pw_tag_map = {}
for pid, parent_id, title, *_ in pw_entries:
    tags = []
    if parent_id == pw_folder_servers:
        tags = ['Infrastructure', 'Security']
    elif parent_id == pw_folder_databases:
        tags = ['Database', 'Infrastructure']
    elif parent_id == pw_folder_email:
        tags = ['Email', 'Security']
    elif parent_id == pw_folder_api:
        tags = ['API', 'Security']
    elif parent_id == pw_folder_cloud:
        tags = ['Cloud', 'Infrastructure']
    elif parent_id == pw_folder_vpn:
        tags = ['Network', 'Security']
    pw_tag_map[pid] = tags

for pw_id, tags in pw_tag_map.items():
    for tag_name in tags:
        tid = tag_ids[tag_name]
        existing = db.execute_query(
            "SELECT * FROM password_tag_links WHERE password_id = %s AND tag_id = %s",
            (pw_id, tid)
        )
        if not existing:
            db.execute_update(
                "INSERT INTO password_tag_links (password_id, tag_id) VALUES (%s, %s)",
                (pw_id, tid)
            )

print(f"  {len(pw_folders)} folders + {len(pw_entries)} passwords created (encrypted)")

# ============================================================
# TASKS — Project management with cross-module links
# ============================================================
print("Creating tasks...")

# Get workflow step slugs
wf_steps = db.execute_query(
    "SELECT id, slug FROM workflow_steps WHERE workspace_id = %s ORDER BY sort_order",
    (WORKSPACE_ID,)
)
if not wf_steps:
    # Create default workflow steps
    wf_todo = uid()
    wf_progress = uid()
    wf_done = uid()
    db.execute_update("INSERT INTO workflow_steps (id, workspace_id, name, slug, color, sort_order) VALUES (%s, %s, 'To do', 'todo', 'gray', 0)", (wf_todo, WORKSPACE_ID))
    db.execute_update("INSERT INTO workflow_steps (id, workspace_id, name, slug, color, sort_order) VALUES (%s, %s, 'In progress', 'in-progress', 'blue', 1)", (wf_progress, WORKSPACE_ID))
    db.execute_update("INSERT INTO workflow_steps (id, workspace_id, name, slug, color, sort_order) VALUES (%s, %s, 'Done', 'done', 'green', 2)", (wf_done, WORKSPACE_ID))
    slug_todo = 'todo'
    slug_progress = 'in-progress'
    slug_done = 'done'
else:
    slug_todo = wf_steps[0]['slug']
    slug_progress = wf_steps[1]['slug'] if len(wf_steps) > 1 else slug_todo
    slug_done = wf_steps[2]['slug'] if len(wf_steps) > 2 else slug_progress

# Task folders
task_folder_infra = uid()
task_folder_dev = uid()
task_folder_bugs = uid()
task_folder_security = uid()

task_folders = [
    (task_folder_infra, 'Infrastructure', 'root'),
    (task_folder_dev, 'Development', 'root'),
    (task_folder_bugs, 'Bugs', 'root'),
    (task_folder_security, 'Security', 'root'),
]

# Tasks: (id, name, parent_id, content, status, priority, due_date)
task_k8s = uid()
task_backup = uid()
task_monitoring = uid()
task_ssl = uid()
task_collab = uid()
task_export = uid()
task_bug_file = uid()
task_bug_ws = uid()
task_audit = uid()
task_rotate = uid()

task_items = [
    # Infrastructure tasks
    (task_k8s, 'Migrate to Kubernetes', task_folder_infra, '''# Migrate to Kubernetes

## Objective
Migrate our current VM-based deployment to Kubernetes for better scalability and reliability.

## Current State
- 2 web servers (prod-web-01, prod-web-02) — see [Server Inventory](doc-link)
- Manual deployment via SSH — see [Deployment Procedures](doc-link)
- No auto-scaling

## Target Architecture
- **GKE** cluster (3 nodes, n2-standard-4)
- Helm charts for all services
- Horizontal Pod Autoscaler
- Ingress with cert-manager for SSL

## Steps
1. Create GKE cluster — credentials in **Password Vault > Cloud > AWS Console**
2. Dockerize backend and frontend
3. Create Helm charts
4. Setup CI/CD pipeline with GitHub Actions
5. Migrate database to Cloud SQL
6. DNS cutover via **Cloudflare** (see Password Vault)

## Estimated Effort
- **Backend containerization**: 2 days
- **Frontend containerization**: 1 day
- **Helm charts**: 3 days
- **CI/CD**: 2 days
- **Testing & migration**: 3 days

> Total: ~2 weeks
''', slug_todo, 'high', next_month),

    (task_backup, 'Setup automated backups', task_folder_infra, '''# Setup Automated Backups

## Requirements
- Daily MySQL backups at 02:00 UTC
- 30-day retention
- Encrypted backup files
- Off-site storage (S3)

## Implementation

### MySQL Backup Script
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/mysql
mysqldump markd_prod | gzip > $BACKUP_DIR/markd_$TIMESTAMP.sql.gz
# Upload to S3
aws s3 cp $BACKUP_DIR/markd_$TIMESTAMP.sql.gz s3://company-backups/mysql/
# Cleanup old local backups (keep 7 days)
find $BACKUP_DIR -mtime +7 -delete
```

### Cron Entry
```
0 2 * * * /opt/scripts/backup_mysql.sh >> /var/log/backup.log 2>&1
```

## Verification
- Check backup size daily (should be > 10MB)
- Monthly restore test on staging
- Alert if backup fails

> **Related**: Database credentials in **Password Vault > Databases > MySQL Production**
''', slug_progress, 'high', next_week),

    (task_monitoring, 'Setup monitoring stack', task_folder_infra, '''# Setup Monitoring Stack

## Goal
Deploy Prometheus + Grafana for infrastructure and application monitoring.

## Components
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and alerting
- **Node Exporter**: Server metrics
- **MySQL Exporter**: Database metrics

## Dashboards Needed
1. Server overview (CPU, RAM, disk, network)
2. Application metrics (requests/sec, latency, errors)
3. Database metrics (connections, slow queries, replication lag)
4. WebSocket connections (active, disconnections)

## Alerts
See [Monitoring & Alerting](doc-link) documentation for alert thresholds.

## Access
Grafana will be at `https://grafana.company.com`
Credentials to be stored in **Password Vault > Cloud Services**
''', slug_todo, 'medium', next_month),

    (task_ssl, 'Renew SSL certificates', task_folder_infra, '''# Renew SSL Certificates

Auto-renewal is configured via Certbot, but we need to verify it works.

## Check
```bash
certbot certificates
certbot renew --dry-run
```

## Domains
- markd.company.com
- api.markd.company.com
- grafana.company.com

> Certbot credentials in **Password Vault > Cloud > Let\'s Encrypt**
''', slug_done, 'medium', yesterday),

    # Development tasks
    (task_collab, 'Collaborative editing improvements', task_folder_dev, '''# Collaborative Editing Improvements

## Completed
- [x] Real-time cursors in Documents module
- [x] Real-time cursors in Tasks module
- [x] Save indicator (glassy lamp)
- [x] Presence avatars with typing indicators
- [x] WebSocket heartbeat for connection stability

## Remaining
- [ ] Conflict resolution for simultaneous edits
- [ ] Offline mode with sync on reconnect
- [ ] Version history / diff view
- [ ] @mentions in collaborative editing

## Technical Notes
- Using custom `useCollab` hook (not Yjs for now)
- Socket.IO rooms per document: `doc-{id}` or `task-{id}`
- Cursor positions synced via WebSocket events
''', slug_progress, 'medium', next_week),

    (task_export, 'Export/Import per module', task_folder_dev, '''# Export/Import Feature

## Requirements
- Export data per module (Documents, Tasks, Passwords, Files)
- Export per workspace
- Import into another instance
- **Passwords must remain encrypted** during export

## Design

### Export Format
```json
{
  "version": "1.0",
  "module": "documents",
  "workspace_id": "demo",
  "exported_at": "2026-02-08T18:00:00Z",
  "data": {
    "items": [...],
    "tags": [...],
    "tag_links": [...]
  }
}
```

### Password Export (special handling)
- Export `password_encrypted` as-is (Fernet encrypted)
- Include a flag: `encryption_key_required: true`
- On import, user must provide the same `VAULT_ENCRYPTION_KEY`
- Or re-encrypt with new key during import

### API Endpoints
- `GET /api/export/{module}?workspace_id=demo` → JSON download
- `POST /api/import/{module}` → JSON upload + merge

## Feasibility: YES
- Passwords stay encrypted (Fernet blob is portable)
- Same key = direct import
- Different key = decrypt with old key, re-encrypt with new key
- Files module: export metadata + zip of actual files
''', slug_todo, 'high', next_month),

    # Bugs
    (task_bug_file, 'Fix: file disappears after drag to root', task_folder_bugs, '''# Bug: File Disappears After Drag to Root

## Status: FIXED

## Description
When dragging a file from a folder to the root level, the file disappears from the tree.

## Root Cause
Backend `files.py` used `if data.parent_id is not None:` to check if parent_id was provided.
When frontend sends `parent_id: null` (move to root), Pydantic default `None` made the condition `False`, skipping the update.

## Fix
Changed to `if \'parent_id\' in data.model_fields_set:` to detect when `parent_id` is explicitly provided, even as `null`.

```python
# Before (broken)
if data.parent_id is not None:
    ...

# After (fixed)
if \'parent_id\' in data.model_fields_set:
    ...
```

## Files Changed
- `backend/files.py` line 462
''', slug_done, 'high', yesterday),

    (task_bug_ws, 'Fix: WebSocket reconnection loop', task_folder_bugs, '''# Bug: WebSocket Reconnection Loop

## Status: FIXED

## Description
After network interruption, Socket.IO client enters a rapid reconnection loop, causing high CPU usage.

## Fix
Added heartbeat mechanism with exponential backoff in `useCollab` hook.

## Related
- See [Architecture Overview](doc-link) for WebSocket architecture
- Backend Socket.IO config in `main.py`
''', slug_done, 'medium', last_week),

    # Security tasks
    (task_audit, 'Quarterly access review', task_folder_security, '''# Quarterly Access Review — Q1 2026

## Checklist
- [ ] Review all user accounts
- [ ] Remove inactive users (no login > 90 days)
- [ ] Verify group memberships
- [ ] Check workspace permissions
- [ ] Review Password Vault access logs
- [ ] Rotate service account passwords

## Users to Review
Check admin panel: `/admin/users`

## Password Rotation
Rotate credentials in **Password Vault** for:
- All SSH keys (Servers folder)
- Database passwords
- API keys approaching expiry

See [Security Policy](doc-link) for full procedure.
''', slug_todo, 'high', next_week),

    (task_rotate, 'Rotate JWT secret key', task_folder_security, '''# Rotate JWT Secret Key

## Procedure
1. Generate new key: `openssl rand -hex 32`
2. Update `SECRET_KEY` in `backend/.env`
3. Restart backend: `supervisorctl restart markd-backend`
4. All users will need to re-login (tokens invalidated)

## Schedule
- Notify team 24h before rotation
- Perform during low-traffic window (Sunday 02:00 UTC)
- Verify login works after rotation

> Store new key in **Password Vault > API Keys > Production .env**
''', slug_done, 'medium', last_week),
]

# Insert task folders
for tid, name, parent_id in task_folders:
    existing = db.execute_query("SELECT id FROM tasks WHERE id = %s", (tid,))
    if not existing:
        db.execute_update(
            "INSERT INTO tasks (id, name, type, parent_id, workspace_id, user_id, status, priority, sort_order) VALUES (%s, %s, 'folder', %s, %s, %s, 'todo', 'medium', 0)",
            (tid, name, parent_id, WORKSPACE_ID, ADMIN_USER_ID)
        )

# Insert tasks
for tid, name, parent_id, content, status, priority, due_date in task_items:
    existing = db.execute_query("SELECT id FROM tasks WHERE id = %s", (tid,))
    if not existing:
        db.execute_update(
            "INSERT INTO tasks (id, name, type, content, parent_id, workspace_id, user_id, status, priority, due_date, sort_order) VALUES (%s, %s, 'task', %s, %s, %s, %s, %s, %s, %s, 0)",
            (tid, name, content, parent_id, WORKSPACE_ID, ADMIN_USER_ID, status, priority, due_date)
        )

# Tag tasks
task_tag_map = {
    task_k8s: ['Infrastructure', 'Cloud', 'DevOps'],
    task_backup: ['Infrastructure', 'Backup', 'Database'],
    task_monitoring: ['Monitoring', 'DevOps', 'Infrastructure'],
    task_ssl: ['SSL', 'Security', 'Infrastructure'],
    task_collab: ['Frontend', 'Backend', 'Development'],
    task_export: ['Backend', 'API', 'Development'],
    task_bug_file: ['Backend', 'Urgent'],
    task_bug_ws: ['Frontend', 'Backend'],
    task_audit: ['Security', 'Urgent'],
    task_rotate: ['Security', 'DevOps'],
}

for task_id, tags in task_tag_map.items():
    for tag_name in tags:
        tid = tag_ids[tag_name]
        existing = db.execute_query(
            "SELECT * FROM task_tag_links WHERE task_id = %s AND tag_id = %s",
            (task_id, tid)
        )
        if not existing:
            db.execute_update(
                "INSERT INTO task_tag_links (task_id, tag_id) VALUES (%s, %s)",
                (task_id, tid)
            )

# Add checklists to some tasks
print("  Adding checklists...")
checklists = {
    task_k8s: [
        ('Create GKE cluster', False),
        ('Dockerize backend', False),
        ('Dockerize frontend', False),
        ('Create Helm charts', False),
        ('Setup CI/CD pipeline', False),
        ('Migrate database', False),
        ('DNS cutover', False),
        ('Load testing', False),
    ],
    task_backup: [
        ('Write backup script', True),
        ('Setup cron job', True),
        ('Configure S3 upload', False),
        ('Test restore procedure', False),
        ('Setup monitoring alert', False),
    ],
    task_audit: [
        ('Review user accounts', False),
        ('Remove inactive users', False),
        ('Verify group memberships', False),
        ('Check workspace permissions', False),
        ('Review vault access logs', False),
        ('Rotate service passwords', False),
    ],
}

for task_id, items in checklists.items():
    for order, (text, completed) in enumerate(items):
        cl_id = uid()
        existing = db.execute_query(
            "SELECT id FROM task_checklist WHERE task_id = %s AND text = %s",
            (task_id, text)
        )
        if not existing:
            db.execute_update(
                "INSERT INTO task_checklist (id, task_id, text, completed, `order`) VALUES (%s, %s, %s, %s, %s)",
                (cl_id, task_id, text, 1 if completed else 0, order)
            )

# Add comments to some tasks
print("  Adding comments...")
comments = [
    (task_k8s, ALICE_ID, 'alice', 'Started evaluating GKE vs EKS. GKE seems better for our use case given the team\'s experience with GCP.'),
    (task_k8s, BOB_ID, 'bob', 'I agree with Alice. GKE pricing is also more competitive for our expected workload.'),
    (task_k8s, ADMIN_USER_ID, ADMIN_USER_NAME, 'Meeting scheduled with DevOps team next Monday to finalize the migration plan.'),
    (task_backup, BOB_ID, 'bob', 'Backup script is working. Need to add S3 upload and monitoring.'),
    (task_backup, CAROL_ID, 'carol', 'I can help with the S3 integration — I have experience with boto3.'),
    (task_bug_file, DAVID_ID, 'david', 'Root cause identified: Pydantic model_fields_set needed for null detection. Fix deployed.'),
    (task_collab, ALICE_ID, 'alice', 'Collaborative editing is now live in both Documents and Tasks modules. Next: conflict resolution.'),
    (task_collab, CAROL_ID, 'carol', 'Great work! I noticed a minor lag on large documents — should we look into debouncing?'),
    (task_audit, ADMIN_USER_ID, ADMIN_USER_NAME, 'Quarterly review is due next week. @alice please prepare the user access report.'),
    (task_monitoring, DAVID_ID, 'david', 'I\'ve set up a test Grafana instance on staging. Let me know when you want a walkthrough.'),
]

for task_id, user_id, user_name, content in comments:
    c_id = uid()
    existing = db.execute_query(
        "SELECT id FROM task_comments WHERE task_id = %s AND content = %s",
        (task_id, content)
    )
    if not existing:
        db.execute_update(
            "INSERT INTO task_comments (id, task_id, user_id, user_name, content) VALUES (%s, %s, %s, %s, %s)",
            (c_id, task_id, user_id, user_name, content)
        )

print(f"  {len(task_folders)} folders + {len(task_items)} tasks created")

# ============================================================
# FILES — Sample files (placeholders)
# ============================================================
print("Creating file entries...")

file_folder_docs = uid()
file_folder_images = uid()
file_folder_configs = uid()

file_folders = [
    (file_folder_docs, 'Documentation'),
    (file_folder_images, 'Images'),
    (file_folder_configs, 'Config Templates'),
]

for fid, name in file_folders:
    existing = db.execute_query("SELECT id FROM files WHERE id = %s", (fid,))
    if not existing:
        db.execute_update(
            "INSERT INTO files (id, workspace_id, parent_id, type, name, original_name, file_path, mime_type, file_size, created_by) VALUES (%s, %s, NULL, 'folder', %s, %s, NULL, NULL, 0, %s)",
            (fid, WORKSPACE_ID, name, name, ADMIN_USER_ID)
        )

print(f"  {len(file_folders)} file folders created")
print("  Note: Upload actual files via the UI or API for the Files module")

# ============================================================
# Summary
# ============================================================
print("\n" + "=" * 60)
print("SEED COMPLETE")
print("=" * 60)
print(f"  Workspace: {WORKSPACE_ID}")
print(f"  Tags: {len(tag_ids)}")
print(f"  Documents: {len(doc_folders)} folders + {len(doc_files)} files")
print(f"  Passwords: {len(pw_folders)} folders + {len(pw_entries)} entries (encrypted)")
print(f"  Tasks: {len(task_folders)} folders + {len(task_items)} tasks")
print(f"  Files: {len(file_folders)} folders")
print(f"\nCross-module links:")
print(f"  - Documents reference Password Vault entries")
print(f"  - Tasks reference Documents and Password Vault")
print(f"  - Security tasks link to credential rotation")
print(f"  - Deployment docs link to API keys and server credentials")
print(f"  Demo users: {len(DEMO_USERS)} team members")
print(f"\nDemo accounts (password: Demo1234!@):")
print(f"  admin  / admin         (admin)")
print(f"  alice  / Demo1234!@    (admin)")
print(f"  bob    / Demo1234!@    (user)")
print(f"  carol  / Demo1234!@    (user)")
print(f"  david  / Demo1234!@    (user)")
print(f"Workspace: Demo Workspace")
