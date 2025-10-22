# MarkD - Quick Start Guide

Get MarkD up and running in 5 minutes!

## Prerequisites

- Docker & Docker Compose (recommended) **OR**
- Node.js 18+, Python 3.9+, MySQL 8.0+

## Option 1: Docker (Recommended)

### 1. Clone & Configure

```bash
git clone https://github.com/yourusername/markd.git
cd markd
cp backend/.env.example backend/.env
```

### 2. Generate Secure Keys

```bash
# Generate and add to backend/.env
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

### 3. Start with Docker Compose

```bash
docker-compose up -d
```

### 4. Access Application

Open: http://localhost:5173

**Login:**
- Username: `admin`
- Password: `admin` (⚠️ Change immediately!)

## Option 2: Manual Installation

### 1. Database Setup

```bash
# Create database
mysql -u root -p

CREATE DATABASE markd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'markd_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON markd.* TO 'markd_user'@'localhost';
EXIT;

# Import schema
mysql -u markd_user -p markd < database/install.sql
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Edit .env with your settings
nano .env

# Start backend
uvicorn main:app --reload
```

### 3. Frontend Setup

```bash
# In new terminal
cd frontend
npm install
npm run dev
```

### 4. Access Application

Open: http://localhost:5173

## First Steps

### 1. Change Admin Password
1. Login with `admin` / `admin`
2. Click profile icon → Change Password

### 2. Create a Workspace
1. Admin Panel → Workspaces
2. Click "New Workspace"
3. Enter name and description

### 3. Add Users
1. Admin Panel → Users
2. Click "Add User"
3. Assign to groups

### 4. Create Your First Document
1. Go to Documents tab
2. Right-click in tree → New Document
3. Start writing!

### 5. Store Your First Password
1. Go to Passwords tab
2. Click "New Password"
3. Enter details and save

## Common Commands

### Backend (Python)
```bash
# Activate venv
source venv/bin/activate

# Run backend
uvicorn main:app --reload

# Run tests
pytest
```

### Frontend (Node)
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Database
```bash
# Backup
mysqldump -u markd_user -p markd > backup.sql

# Restore
mysql -u markd_user -p markd < backup.sql
```

### Docker
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild
docker-compose build --no-cache
```

## Troubleshooting

### Backend won't start
```bash
# Check Python version
python3 --version  # Need 3.9+

# Check dependencies
pip list

# Check database connection
mysql -u markd_user -p markd
```

### Frontend won't start
```bash
# Check Node version
node --version  # Need 18+

# Clear cache
rm -rf node_modules package-lock.json
npm install
```

### Database connection failed
```bash
# Check MySQL is running
sudo systemctl status mysql

# Check connection
mysql -u markd_user -p
```

### Port already in use
```bash
# Find process
lsof -i :8000  # Backend
lsof -i :5173  # Frontend

# Kill process
kill -9 <PID>
```

## Next Steps

1. ✅ Read [INSTALL.md](INSTALL.md) for detailed setup
2. ✅ Check [README.md](README.md) for features
3. ✅ Review [SECURITY.md](SECURITY.md) for best practices
4. ✅ Configure reverse proxy for production
5. ✅ Set up automated backups
6. ✅ Enable HTTPS

## Need Help?

- 📖 Check [INSTALL.md](INSTALL.md) for detailed instructions
- 🐛 Report issues on GitHub
- 💬 Join community discussions

---

**Ready to go?** Start creating documents and storing passwords securely! 🚀
