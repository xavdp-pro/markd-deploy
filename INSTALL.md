# MarkD - Installation Guide

This guide provides detailed step-by-step instructions for installing MarkD.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-installation](#pre-installation)
3. [Database Setup](#database-setup)
4. [Backend Installation](#backend-installation)
5. [Frontend Installation](#frontend-installation)
6. [First Run](#first-run)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 2 GB
- **Storage**: 10 GB
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+) or macOS

### Software Requirements
- **Node.js**: 18.0.0 or higher
- **Python**: 3.9 or higher
- **MySQL/MariaDB**: 8.0 or higher
- **npm**: 9.0.0 or higher
- **pip**: 21.0.0 or higher

## Pre-installation

### 1. Install System Dependencies

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.9+
sudo apt install -y python3 python3-pip python3-venv

# Install MySQL
sudo apt install -y mysql-server

# Install build tools
sudo apt install -y build-essential
```

#### CentOS/RHEL

```bash
# Install Node.js
sudo dnf module install nodejs:18

# Install Python
sudo dnf install -y python39 python39-pip

# Install MySQL
sudo dnf install -y mysql-server

# Start and enable MySQL
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

#### macOS

```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node python@3.9 mysql
```

### 2. Verify Installations

```bash
# Check Node.js
node --version  # Should be v18.x.x or higher

# Check npm
npm --version   # Should be 9.x.x or higher

# Check Python
python3 --version  # Should be 3.9.x or higher

# Check MySQL
mysql --version
```

## Database Setup

### 1. Secure MySQL Installation

```bash
sudo mysql_secure_installation
```

Follow the prompts to:
- Set root password
- Remove anonymous users
- Disallow root login remotely
- Remove test database
- Reload privilege tables

### 2. Create Database and User

```bash
# Login to MySQL as root
sudo mysql -u root -p
```

Execute the following SQL commands:

```sql
-- Create database
CREATE DATABASE markd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'markd_user'@'localhost' IDENTIFIED BY 'YOUR_SECURE_PASSWORD_HERE';

-- Grant privileges
GRANT ALL PRIVILEGES ON markd.* TO 'markd_user'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;

-- Verify
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'markd_user';

-- Exit
EXIT;
```

**Important**: Replace `YOUR_SECURE_PASSWORD_HERE` with a strong password.

### 3. Import Database Schema

```bash
# Navigate to project directory
cd /path/to/markd

# Import schema
mysql -u markd_user -p markd < database/install.sql
```

Enter the password you set for `markd_user`.

### 4. Verify Database Installation

```bash
mysql -u markd_user -p markd

# In MySQL prompt:
SHOW TABLES;
```

You should see tables like: `users`, `workspaces`, `password_vault`, etc.

## Backend Installation

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Create Python Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate     # Windows
```

### 3. Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

Configure the following variables in `.env`:

```ini
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=markd
MYSQL_USER=markd_user
MYSQL_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# Generate JWT secret (run: openssl rand -hex 32)
JWT_SECRET=your_generated_jwt_secret_here

# Generate encryption key (run: openssl rand -hex 32)
ENCRYPTION_KEY=your_generated_encryption_key_here

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Environment
APP_ENV=production
DEBUG=false
```

### 5. Generate Secure Keys

```bash
# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)"

# Generate encryption key
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Copy these generated values into your `.env` file.

### 6. Create Required Directories

```bash
# Create logs directory
mkdir -p logs

# Set permissions
chmod 755 logs
```

### 7. Test Backend

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Run backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Visit `http://localhost:8000/docs` to verify the API is running.

Press `Ctrl+C` to stop the server.

## Frontend Installation

### 1. Navigate to Frontend Directory

```bash
cd ../frontend
```

### 2. Install npm Dependencies

```bash
# Install dependencies
npm install
```

### 3. Configure Environment (Optional)

If you need to customize the API endpoint:

```bash
# Copy example if it exists
cp .env.example .env

# Edit configuration
nano .env
```

### 4. Test Frontend

```bash
# Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

Press `Ctrl+C` to stop the server.

## First Run

### 1. Start Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Start Frontend (in a new terminal)

```bash
cd frontend
npm run dev
```

### 3. Access Application

Open your browser and navigate to: `http://localhost:5173`

### 4. Login with Default Credentials

- **Username**: `admin`
- **Password**: `admin`

**⚠️ IMPORTANT**: Change the admin password immediately!

### 5. Change Admin Password

1. Login with default credentials
2. Click on your profile icon (top right)
3. Select "Change Password"
4. Enter a strong new password
5. Save changes

## Production Deployment

### 1. Install PM2

```bash
npm install -g pm2
```

### 2. Build Frontend

```bash
cd frontend
npm run build
```

### 3. Configure Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/markd/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4. Start with PM2

```bash
# From project root
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 5. SSL Configuration (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com
```

## Troubleshooting

### Issue: MySQL Connection Refused

**Solution:**

```bash
# Check MySQL service status
sudo systemctl status mysql

# Start MySQL if not running
sudo systemctl start mysql

# Check MySQL is listening
sudo netstat -tulpn | grep 3306
```

### Issue: Port Already in Use

**Solution:**

```bash
# Find process using port
lsof -i :8000  # or :5173

# Kill process
kill -9 <PID>
```

### Issue: Permission Denied on Documents Directory

**Solution:**

```bash
# Create documents directory if it doesn't exist
mkdir -p documents

# Set proper permissions
chmod 755 documents
chown -R $USER:$USER documents
```

### Issue: Python Module Not Found

**Solution:**

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall requirements
pip install -r requirements.txt
```

### Issue: npm Install Fails

**Solution:**

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

## Next Steps

After successful installation:

1. ✅ Change default admin password
2. ✅ Create additional user accounts
3. ✅ Create workspaces
4. ✅ Configure user groups
5. ✅ Set up regular backups
6. ✅ Configure firewall rules
7. ✅ Enable HTTPS in production

## Support

For additional help:
- Check the [README.md](README.md) for general information
- Review logs in `backend/logs/`
- Create an issue on GitHub

---

**Congratulations!** 🎉 MarkD is now installed and running.
