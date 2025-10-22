# Security Policy

## Supported Versions

Currently supported versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of MarkD seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please DO NOT:
- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:
1. **Email**: Send details to security@markd.local (if available) or create a private security advisory on GitHub
2. **Include**: 
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Wait**: Allow us reasonable time to respond before public disclosure

### What to Expect:
- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Regular Updates**: Every 7-14 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: 90+ days

## Security Measures

### Current Security Features

#### Authentication & Authorization
- JWT-based authentication with token refresh
- Secure password hashing using bcrypt
- Role-based access control (RBAC)
- Workspace-level permissions
- Session timeout and management

#### Data Protection
- AES-256 encryption for password vault
- SQL injection prevention via parameterized queries
- XSS protection via input sanitization
- CSRF protection
- Secure HTTP headers

#### Infrastructure Security
- Environment variable protection
- Secure database connection
- HTTPS support (via reverse proxy)
- Rate limiting on API endpoints
- Input validation and sanitization

### Best Practices for Users

#### Strong Passwords
- Use passwords with at least 12 characters
- Include uppercase, lowercase, numbers, and symbols
- Don't reuse passwords across services
- Change default admin password immediately

#### Secure Configuration
- Generate cryptographically secure keys for JWT_SECRET and ENCRYPTION_KEY
- Use HTTPS in production
- Restrict database access to localhost only
- Keep software dependencies updated
- Regular security audits

#### Access Control
- Follow principle of least privilege
- Regularly review user permissions
- Remove inactive users
- Monitor access logs

#### Data Backups
- Regular automated backups
- Encrypted backup storage
- Test backup restoration procedures
- Offsite backup copies

## Known Security Considerations

### Database Security
- Database credentials stored in `.env` file
- Ensure `.env` file has proper permissions (600)
- Never commit `.env` to version control

### Password Vault
- Passwords encrypted at rest using AES-256
- Encryption key stored in environment variables
- Key rotation not yet implemented (planned for v2.0)

### Session Management
- JWT tokens stored in browser localStorage
- Token refresh mechanism implemented
- Logout clears tokens from client

## Security Updates

### How We Handle Security Updates

1. **Vulnerability Assessment**: Evaluate severity and impact
2. **Patch Development**: Create and test fix
3. **Security Advisory**: Publish advisory (if applicable)
4. **Release**: Deploy patched version
5. **Notification**: Notify users via:
   - GitHub Security Advisories
   - Release notes
   - Email (if available)

### Staying Informed

- Watch this repository for security advisories
- Subscribe to release notifications
- Check CHANGELOG.md regularly
- Follow security best practices

## Compliance

MarkD is designed with security best practices in mind, following:
- OWASP Top 10 guidelines
- CWE/SANS Top 25 Most Dangerous Software Errors
- General Data Protection Regulation (GDPR) principles

## Security Checklist for Deployment

- [ ] Changed default admin password
- [ ] Generated secure JWT_SECRET
- [ ] Generated secure ENCRYPTION_KEY
- [ ] Configured HTTPS
- [ ] Restricted database access
- [ ] Configured firewall rules
- [ ] Enabled automated backups
- [ ] Reviewed user permissions
- [ ] Updated all dependencies
- [ ] Configured log monitoring
- [ ] Set up intrusion detection (optional)

## Acknowledgments

We appreciate security researchers and users who help keep MarkD secure. Responsible disclosures will be acknowledged in:
- Security advisories
- Release notes
- CONTRIBUTORS.md

## Contact

For security-related inquiries:
- **Email**: security@markd.local (preferred)
- **GitHub**: Private security advisory

For general support:
- GitHub Issues (non-security bugs/features)

---

**Thank you for helping keep MarkD secure!**
