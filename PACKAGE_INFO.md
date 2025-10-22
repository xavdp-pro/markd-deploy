# MarkD - Package Information

This is the official GitHub release package for MarkD v1.0.0

## 📦 Package Contents

### Documentation
- `README.md` - Main project documentation
- `INSTALL.md` - Detailed installation instructions
- `QUICKSTART.md` - Quick start guide (5 minutes setup)
- `CONTRIBUTING.md` - Contribution guidelines
- `CHANGELOG.md` - Version history and changes
- `SECURITY.md` - Security policies and best practices
- `LICENSE` - MIT License

### Application Code
- `backend/` - Python FastAPI backend
  - REST API
  - Authentication & authorization
  - Database management
  - Password vault with encryption
  - Document management
- `frontend/` - React + TypeScript frontend
  - Modern UI with Tailwind CSS
  - Real-time Markdown editor
  - Document tree with drag & drop
  - Password vault interface
  - Dark mode support

### Database
- `database/install.sql` - Complete database schema with initial data
- Creates all tables, indexes, and constraints
- Includes default admin user (username: admin, password: admin)
- Ready-to-use structure

### Deployment
- `docker-compose.yml` - Docker Compose configuration
- `backend/Dockerfile` - Backend container image
- `frontend/Dockerfile` - Frontend container image with Nginx
- `frontend/nginx.conf` - Nginx configuration for production
- `ecosystem.config.js` - PM2 configuration for process management
- `env.docker.example` - Docker environment variables template

### Scripts
- `start-backend.sh` - Backend startup script
- `start-frontend.sh` - Frontend startup script
- `start-mcp.sh` - MCP server startup script (optional)

### GitHub Integration
- `.github/workflows/ci.yml` - Continuous Integration pipeline
- `.github/ISSUE_TEMPLATE/` - Issue templates
  - Bug report template
  - Feature request template

### Configuration Files
- `.gitignore` - Git ignore rules
- `.dockerignore` - Docker build ignore rules
- `backend/.env.example` - Backend environment variables template

## 🚀 Quick Deploy Options

### Option 1: Docker Compose (Recommended)
```bash
git clone <repository>
cd markd
cp env.docker.example .env
# Edit .env with secure keys
docker-compose up -d
```

### Option 2: Manual Installation
```bash
# See INSTALL.md for complete instructions
1. Setup MySQL database
2. Install backend dependencies
3. Install frontend dependencies
4. Configure environment
5. Start services
```

### Option 3: PM2 Production
```bash
# See INSTALL.md for complete instructions
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

## 📋 System Requirements

### Minimum
- **CPU**: 2 cores
- **RAM**: 2 GB
- **Storage**: 10 GB
- **OS**: Linux (Ubuntu 20.04+), macOS, Windows with WSL

### Software
- **Node.js**: 18.0.0+
- **Python**: 3.9+
- **MySQL/MariaDB**: 8.0+
- **npm**: 9.0.0+
- **Docker** (optional): 20.10+

## 🔐 Security Notes

**IMPORTANT**: Before deploying to production:

1. ✅ Change default admin password (admin/admin)
2. ✅ Generate secure JWT_SECRET: `openssl rand -hex 32`
3. ✅ Generate secure ENCRYPTION_KEY: `openssl rand -hex 32`
4. ✅ Use HTTPS in production (configure reverse proxy)
5. ✅ Restrict database access to localhost
6. ✅ Review and apply all security best practices in SECURITY.md

## 📚 Documentation Quick Links

- **Getting Started**: [QUICKSTART.md](QUICKSTART.md)
- **Installation**: [INSTALL.md](INSTALL.md)
- **Features**: [README.md](README.md)
- **Security**: [SECURITY.md](SECURITY.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

## 🛠️ Post-Installation

After successful installation:

1. Access application at `http://localhost:5173`
2. Login with admin/admin
3. **Immediately change admin password**
4. Create workspaces
5. Add users
6. Configure permissions
7. Start creating documents and storing passwords

## 💡 Key Features

- ✅ Document management with Markdown support
- ✅ Password vault with AES-256 encryption
- ✅ Hierarchical folder organization
- ✅ Workspace-based multi-tenancy
- ✅ Role-based access control (Admin/Write/Read)
- ✅ Real-time collaborative editing
- ✅ Drag and drop interface
- ✅ Full-text search
- ✅ Dark mode
- ✅ Mobile responsive

## 🐛 Troubleshooting

If you encounter issues:

1. Check [INSTALL.md](INSTALL.md) troubleshooting section
2. Review logs in `backend/logs/`
3. Verify environment configuration
4. Check database connection
5. Create an issue on GitHub with details

## 📞 Support

- **Issues**: Create an issue on GitHub
- **Security**: See [SECURITY.md](SECURITY.md)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

Thank you to all contributors and the open-source community!

---

**Version**: 1.0.0  
**Release Date**: 2025-01-20  
**Package Type**: GitHub Release  

For the latest version, visit: https://github.com/yourusername/markd
