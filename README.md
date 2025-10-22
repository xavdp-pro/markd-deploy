# MarkD - Document & Password Management Platform

A modern, secure platform for collaborative document management and password storage with workspace-based organization.

## 🌟 Features

### Document Management
- **Hierarchical Organization**: Organize documents in folders and subfolders
- **Markdown Support**: Write and preview Markdown documents in real-time
- **Collaborative Editing**: Multiple users can work on documents with lock management
- **Drag & Drop**: Intuitive interface for moving documents and folders
- **Search**: Full-text search across all documents
- **Version Control**: Track document changes over time
- **Workspace Permissions**: Fine-grained access control (Read, Write, Admin)

### Password Vault
- **Secure Storage**: AES-256 encryption for all passwords
- **Hierarchical Organization**: Organize passwords in folders
- **Quick Search**: Find passwords instantly
- **Auto-fill Ready**: Copy usernames and passwords with one click
- **Category Tags**: Organize by SSH, API, Database, Service, or Other
- **Workspace Isolation**: Each workspace has its own password vault

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Password Encryption**: Industry-standard AES-256 encryption
- **Role-Based Access Control**: Admin, Write, and Read permissions
- **Group Management**: Organize users into groups with shared permissions
- **Session Management**: Automatic session timeout and refresh

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **MySQL/MariaDB** 8.0+
- **PM2** (optional, for production)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/markd.git
cd markd
```

#### 2. Database Setup

```bash
# Create database and user
mysql -u root -p

# In MySQL prompt:
CREATE DATABASE markd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'markd_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON markd.* TO 'markd_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import database schema
mysql -u root -p markd < database/install.sql
```

#### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Important**: Generate secure keys for `.env`:
```bash
# Generate JWT secret
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32
```

#### 4. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment (if needed)
cp .env.example .env
```

#### 5. Create Document Storage

```bash
# Create directory for documents
mkdir -p documents
chmod 755 documents
```

### Running the Application

#### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Access the application at: `http://localhost:5173`

#### Production Mode with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit

# Restart services
pm2 restart all

# Stop services
pm2 stop all
```

## 📁 Project Structure

```
markd/
├── backend/                 # Python FastAPI backend
│   ├── main.py             # Main application entry
│   ├── vault.py            # Password vault API
│   ├── documents.py        # Document management API
│   ├── auth.py             # Authentication
│   ├── database.py         # Database connection
│   ├── encryption_service.py  # Encryption utilities
│   ├── migrations/         # Database migrations
│   └── requirements.txt    # Python dependencies
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── services/       # API services
│   ├── package.json
│   └── vite.config.ts
├── database/
│   └── install.sql         # Database schema
├── ecosystem.config.js     # PM2 configuration
└── README.md
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `MYSQL_HOST` | Database host | `localhost` |
| `MYSQL_PORT` | Database port | `3306` |
| `MYSQL_DATABASE` | Database name | `markd` |
| `MYSQL_USER` | Database user | `markd_user` |
| `MYSQL_PASSWORD` | Database password | `secure_password` |
| `JWT_SECRET` | JWT signing key | `generated_secret` |
| `ENCRYPTION_KEY` | Password encryption key | `generated_key` |
| `API_PORT` | Backend API port | `8000` |

### Default Credentials

**⚠️ SECURITY WARNING**: Change these immediately after first login!

- **Username**: `admin`
- **Password**: `admin`

## 🔐 Security Best Practices

1. **Change Default Password**: Immediately change the admin password after installation
2. **Use Strong Keys**: Generate cryptographically secure keys for JWT_SECRET and ENCRYPTION_KEY
3. **HTTPS Only**: Use HTTPS in production (configure reverse proxy like Nginx)
4. **Regular Backups**: Backup both database and document storage regularly
5. **Keep Updated**: Regularly update dependencies and apply security patches
6. **Firewall**: Restrict database access to localhost only
7. **File Permissions**: Ensure document storage has proper permissions

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📚 API Documentation

Once the backend is running, visit:
- **Interactive API Docs**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🛠️ Troubleshooting

### Database Connection Issues

```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u markd_user -p markd
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000
# or
netstat -tulpn | grep 8000

# Kill process
kill -9 <PID>
```

### Permission Errors

```bash
# Fix document storage permissions
sudo chown -R $USER:$USER documents/
chmod -R 755 documents/
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@markd.local (if applicable)

## 🗺️ Roadmap

- [ ] Two-factor authentication
- [ ] Email notifications
- [ ] Document versioning/history
- [ ] Export/Import functionality
- [ ] Mobile app
- [ ] API webhooks
- [ ] LDAP/AD integration

---

Made with ❤️ by the MarkD Team
