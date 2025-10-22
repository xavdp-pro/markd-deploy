# Contributing to MarkD

Thank you for your interest in contributing to MarkD! This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism gracefully
- Focus on what is best for the community

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue tracker to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Screenshots** (if applicable)
- **Environment details** (OS, Node version, Python version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the proposed feature
- **Explain why this enhancement would be useful**
- **Include mockups or examples** if possible

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the code style guidelines
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Commit your changes** with clear messages
6. **Push to your fork** and submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- MySQL 8.0+

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/markd.git
cd markd

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings

# Frontend setup
cd ../frontend
npm install
```

## Code Style Guidelines

### Python (Backend)

- Follow **PEP 8** style guide
- Use **type hints** where appropriate
- Write **docstrings** for functions and classes
- Maximum line length: **100 characters**

```python
def example_function(param: str) -> dict:
    """
    Brief description of function.
    
    Args:
        param: Description of parameter
        
    Returns:
        Description of return value
    """
    return {"result": param}
```

### JavaScript/TypeScript (Frontend)

- Use **TypeScript** for type safety
- Follow **ESLint** configuration
- Use **functional components** with hooks
- Use **camelCase** for variables and functions
- Use **PascalCase** for components

```typescript
interface Props {
    title: string;
    onClick: () => void;
}

const ExampleComponent: React.FC<Props> = ({ title, onClick }) => {
    return (
        <button onClick={onClick}>
            {title}
        </button>
    );
};
```

### SQL

- Use **UPPERCASE** for SQL keywords
- Use **snake_case** for table and column names
- Always use meaningful names
- Include comments for complex queries

```sql
-- Get all active users with their groups
SELECT 
    u.id,
    u.username,
    g.name AS group_name
FROM users u
LEFT JOIN user_groups ug ON u.id = ug.user_id
LEFT JOIN user_groups_table g ON ug.group_id = g.id
WHERE u.is_active = TRUE;
```

## Git Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat(vault): add password strength indicator

Added a real-time password strength meter that shows
weak/medium/strong levels based on complexity.

Closes #123
```

```
fix(auth): resolve token refresh issue

Fixed bug where JWT tokens weren't refreshing properly
causing users to be logged out prematurely.

Fixes #456
```

## Testing

### Backend Tests

```bash
cd backend
source venv/bin/activate
pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Manual Testing Checklist

- [ ] Authentication (login, logout, token refresh)
- [ ] Document CRUD operations
- [ ] Password vault CRUD operations
- [ ] Workspace permissions
- [ ] Search functionality
- [ ] Drag and drop
- [ ] Dark mode
- [ ] Responsive design

## Documentation

- Update **README.md** for major features
- Update **INSTALL.md** for installation changes
- Add **inline comments** for complex logic
- Update **API documentation** (docstrings)
- Update **JSDoc comments** for TypeScript

## Database Migrations

When adding database changes:

1. Create a new migration file in `backend/migrations/`
2. Use sequential numbering: `NNN_description.sql`
3. Include both UP and DOWN migrations
4. Test thoroughly before committing

## Pull Request Process

1. **Update documentation** for any changed functionality
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG** (if applicable)
5. **Request review** from maintainers
6. **Address feedback** promptly

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] Commit messages follow guidelines
- [ ] No merge conflicts
- [ ] Branch is up to date with main

## Review Process

- Maintainers will review your PR within 1-2 weeks
- Address any requested changes
- Once approved, a maintainer will merge your PR

## Questions?

- Create an issue for questions
- Join our community discussions
- Check existing documentation

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Invited to maintainer team (for significant contributions)

---

Thank you for contributing to MarkD! 🎉
