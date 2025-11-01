-- Simple MarkD Documentation Tree
-- Clean structure without duplicates

-- Root folder
INSERT INTO documents (id, name, type, parent_id, content, workspace_id) VALUES
('root', 'Documents', 'folder', NULL, NULL, 'default');

-- Main folders at root level
INSERT INTO documents (id, name, type, parent_id, content, workspace_id) VALUES
('folder-guides', 'Guides', 'folder', 'root', NULL, 'default'),
('folder-api', 'API Reference', 'folder', 'root', NULL, 'default'),
('folder-examples', 'Examples', 'folder', 'root', NULL, 'default');

-- Guides folder content
INSERT INTO documents (id, name, type, parent_id, content, workspace_id) VALUES
('doc-getting-started', 'Getting Started.md', 'file', 'folder-guides', 
'# Getting Started with MarkD

## Welcome!

MarkD is a collaborative documentation management system.

## Quick Start

1. **Create a folder** - Click the "+" button and select "New Folder"
2. **Add documents** - Click "+" inside a folder to create a document
3. **Edit content** - Click on any document to edit it
4. **Organize** - Drag and drop to reorganize your structure

## Features

- 📁 Hierarchical folder structure
- ✏️ Markdown editing with live preview
- 🔒 Document locking for collaboration
- 🔍 Full-text search
- 👥 Multi-user workspaces
', 'default'),

('doc-markdown-guide', 'Markdown Guide.md', 'file', 'folder-guides',
'# Markdown Syntax Guide

## Headers

```markdown
# H1 Header
## H2 Header
### H3 Header
```

## Emphasis

- **Bold text** with `**bold**`
- *Italic text* with `*italic*`
- ~~Strikethrough~~ with `~~text~~`

## Lists

Unordered:
- Item 1
- Item 2
  - Nested item

Ordered:
1. First
2. Second
3. Third

## Code

Inline code: `const x = 10;`

Code block:
```javascript
function hello() {
  console.log("Hello World!");
}
```

## Links & Images

- Link: `[text](url)`
- Image: `![alt](image-url)`

## Tables

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
', 'default'),

('doc-collaboration', 'Collaboration.md', 'file', 'folder-guides',
'# Collaboration Features

## Document Locking

When you edit a document, it is automatically locked to prevent conflicts.

- 🔒 **Locked**: Document is being edited by someone
- 🔓 **Unlocked**: Available for editing

## Workspaces

Organize your team with workspaces:

- **Default Workspace**: Available to all users
- **Custom Workspaces**: Create dedicated spaces for projects
- **Permissions**: Control who can read/write/admin

## Real-time Updates

Changes are synchronized in real-time via WebSocket:
- See when others are editing
- Get notified of new documents
- Tree updates automatically
', 'default');

-- API Reference folder content
INSERT INTO documents (id, name, type, parent_id, content, workspace_id) VALUES
('doc-api-overview', 'API Overview.md', 'file', 'folder-api',
'# MarkD API Reference

## Base URL

```
http://localhost:8200/api
```

## Authentication

MarkD uses JWT tokens stored in HTTP-only cookies.

### Login
```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "password"
}
```

### Check Auth
```bash
GET /api/auth/me
```

### Logout
```bash
POST /api/auth/logout
```

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:

```json
{
  "detail": "Error message"
}
```
', 'default'),

('doc-api-documents', 'Documents API.md', 'file', 'folder-api',
'# Documents API

## Get Document Tree

```bash
GET /api/documents/tree?workspace_id=default
```

Response:
```json
{
  "success": true,
  "tree": [
    {
      "id": "doc-1",
      "name": "My Document.md",
      "type": "file",
      "content": "# Content",
      "parent_id": "root",
      "locked_by": null,
      "children": []
    }
  ],
  "workspace_name": "Default Workspace"
}
```

## Get Single Document

```bash
GET /api/documents/{document_id}
```

## Create Document

```bash
POST /api/documents
{
  "name": "New Document.md",
  "type": "file",
  "parent_id": "root",
  "content": "# My Document",
  "workspace_id": "default"
}
```

## Update Document

```bash
PUT /api/documents/{document_id}
{
  "name": "Updated Name.md",
  "content": "# Updated content"
}
```

## Delete Document

```bash
DELETE /api/documents/{document_id}
```

## Lock Document

```bash
POST /api/documents/{document_id}/lock
{
  "user_id": "1",
  "user_name": "John Doe"
}
```

## Unlock Document

```bash
DELETE /api/documents/{document_id}/lock?user_id=1
```
', 'default'),

('doc-api-workspaces', 'Workspaces API.md', 'file', 'folder-api',
'# Workspaces API

## List Workspaces

```bash
GET /api/workspaces
```

Response:
```json
{
  "success": true,
  "workspaces": [
    {
      "id": "default",
      "name": "Default Workspace",
      "description": "Main workspace",
      "user_permission": "admin"
    }
  ]
}
```

## Create Workspace (Admin only)

```bash
POST /api/workspaces
{
  "name": "Project X",
  "description": "Documentation for Project X"
}
```

## Update Workspace (Admin only)

```bash
PUT /api/workspaces/{workspace_id}
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

## Delete Workspace (Admin only)

```bash
DELETE /api/workspaces/{workspace_id}
```
', 'default');

-- Examples folder content
INSERT INTO documents (id, name, type, parent_id, content, workspace_id) VALUES
('doc-example-api', 'API Usage Example.md', 'file', 'folder-examples',
'# API Usage Example

## Complete Workflow

### 1. Login

```bash
curl -X POST http://localhost:8200/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d ''{"username":"admin","password":"admin"}'' \\
  -c cookies.txt
```

### 2. Get Document Tree

```bash
curl -X GET http://localhost:8200/api/documents/tree \\
  -b cookies.txt
```

### 3. Create a Document

```bash
curl -X POST http://localhost:8200/api/documents \\
  -H "Content-Type: application/json" \\
  -b cookies.txt \\
  -d ''{
    "name": "My API Doc.md",
    "type": "file",
    "parent_id": "root",
    "content": "# My API Documentation\\n\\nContent here..."
  }''
```

### 4. Update the Document

```bash
curl -X PUT http://localhost:8200/api/documents/doc-123 \\
  -H "Content-Type: application/json" \\
  -b cookies.txt \\
  -d ''{
    "content": "# Updated Content\\n\\nNew information..."
  }''
```

### 5. Logout

```bash
curl -X POST http://localhost:8200/api/auth/logout \\
  -b cookies.txt
```
', 'default'),

('doc-example-structure', 'Folder Structure Example.md', 'file', 'folder-examples',
'# Recommended Folder Structure

## For Software Projects

```
📁 Project Documentation
├── 📁 Getting Started
│   ├── 📄 Installation.md
│   ├── 📄 Quick Start.md
│   └── 📄 Configuration.md
├── 📁 Architecture
│   ├── 📄 Overview.md
│   ├── 📄 Database Schema.md
│   └── 📄 API Design.md
├── 📁 User Guides
│   ├── 📄 User Manual.md
│   ├── 📄 Admin Guide.md
│   └── 📄 FAQ.md
└── 📁 API Reference
    ├── 📄 Authentication.md
    ├── 📄 Endpoints.md
    └── 📄 Examples.md
```

## For Team Knowledge Base

```
📁 Company Knowledge Base
├── 📁 Onboarding
│   ├── 📄 Welcome.md
│   ├── 📄 Tools Setup.md
│   └── 📄 Team Structure.md
├── 📁 Processes
│   ├── 📄 Development Workflow.md
│   ├── 📄 Code Review.md
│   └── 📄 Deployment.md
├── 📁 Best Practices
│   ├── 📄 Coding Standards.md
│   ├── 📄 Security Guidelines.md
│   └── 📄 Testing Strategy.md
└── 📁 Resources
    ├── 📄 Useful Links.md
    ├── 📄 Learning Materials.md
    └── 📄 Tools & Services.md
```
', 'default');

-- Welcome document at root
INSERT INTO documents (id, name, type, parent_id, content, workspace_id) VALUES
('doc-welcome', 'Welcome.md', 'file', 'root',
'# Welcome to MarkD! 👋

MarkD is your collaborative documentation management system.

## 🚀 Quick Actions

- **Browse** the folders on the left to explore documentation
- **Search** using the search bar to find specific content
- **Create** new documents and folders with the "+" button
- **Edit** any document by clicking on it

## 📚 Documentation Structure

- **Guides** - Learn how to use MarkD effectively
- **API Reference** - Complete API documentation
- **Examples** - Practical examples and templates

## 💡 Tips

- Use **Markdown** for rich text formatting
- Documents are **automatically locked** when you edit them
- Changes are **saved automatically**
- Use **workspaces** to organize different projects

Happy documenting! ✨
', 'default');
