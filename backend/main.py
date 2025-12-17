from fastapi import FastAPI, HTTPException, File, UploadFile, Depends, Request, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import socketio
import uvicorn
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta
from database import db
import sys
import shutil
from pathlib import Path
import jwt
from activity_logger import log_activity

# Increase recursion limit to prevent RecursionError
sys.setrecursionlimit(10000)

load_dotenv()

# Constants
LOCK_TIMEOUT_MINUTES = 30

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

# FastAPI app
app = FastAPI(title="MarkD Documentation Manager API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth router
from auth import router as auth_router
app.include_router(auth_router)

# Include groups router
from groups import router as groups_router
app.include_router(groups_router)

# Include vault router
from vault import router as vault_router
app.include_router(vault_router)

# Include files router
from files import router as files_router
app.include_router(files_router)

# Include schemas router
from schemas import router as schemas_router
app.include_router(schemas_router)

# Include tasks router (simple version)
from tasks_simple import router as tasks_router
app.include_router(tasks_router)

# Include settings router
from settings import router as settings_router
app.include_router(settings_router)

# Include admin routes (activity logs)
from admin_routes import router as admin_router
app.include_router(admin_router)


# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Wrap FastAPI with Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# Initialize shared WebSocket broadcasts
from websocket_broadcasts import set_sio
set_sio(sio)

# ===== Upload Configuration =====

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Create files upload directory if it doesn't exist
FILES_UPLOAD_DIR = Path("uploads/files")
FILES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ===== Pydantic Models =====

class DocumentBase(BaseModel):
    name: str
    type: str  # 'file' or 'folder'
    parent_id: Optional[str] = None
    content: Optional[str] = None
    workspace_id: str = 'demo'

class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[str] = None

class DocumentMove(BaseModel):
    parent_id: str

class LockRequest(BaseModel):
    user_id: str
    user_name: str

class MCPAction(BaseModel):
    agent_id: str
    action: str
    document_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class WorkspaceBase(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class PermissionBase(BaseModel):
    user_id: int
    permission_level: str  # 'read', 'write', 'admin'

# ===== Authentication & Permission Helpers =====

# Import get_current_user from auth to avoid circular imports
from auth import get_current_user

async def check_workspace_permission(workspace_id: str, user: Dict, required_level: str = 'read') -> str:
    """Check user permission for a workspace via groups. Returns permission level if authorized."""
    # Admins have full access to everything
    if user.get('role') == 'admin':
        return 'admin'

    # Get all groups the user belongs to and their permissions for this workspace
    query = """
        SELECT MAX(
            CASE gwp.permission_level
                WHEN 'admin' THEN 3
                WHEN 'write' THEN 2
                WHEN 'read' THEN 1
                ELSE 0
            END
        ) as max_level,
        gwp.permission_level
        FROM user_groups ug
        JOIN group_workspace_permissions gwp ON ug.group_id = gwp.group_id
        WHERE ug.user_id = %s AND gwp.workspace_id = %s
        GROUP BY gwp.workspace_id
        ORDER BY max_level DESC
        LIMIT 1
    """
    permissions = db.execute_query(query, (user['id'], workspace_id))
    
    if not permissions or permissions[0]['max_level'] == 0:
        raise HTTPException(status_code=403, detail="Access denied to this workspace")

    user_level = permissions[0]['permission_level']
    
    # Check if user has required permission level
    level_map = {'read': 1, 'write': 2, 'admin': 3}
    if level_map.get(user_level, 0) < level_map.get(required_level, 0):
        raise HTTPException(status_code=403, detail=f"Insufficient permissions. Requires '{required_level}' level.")

    return user_level

async def get_user_workspaces(user: Dict) -> List[str]:
    """Get list of workspace IDs the user has access to via groups"""
    if user.get('role') == 'admin':
        # Admins see all workspaces
        query = "SELECT id FROM workspaces"
        workspaces = db.execute_query(query)
        return [ws['id'] for ws in workspaces]
    
    # Regular users see only workspaces their groups have access to
    query = """
        SELECT DISTINCT gwp.workspace_id
        FROM user_groups ug
        JOIN group_workspace_permissions gwp ON ug.group_id = gwp.group_id
        WHERE ug.user_id = %s
    """
    permissions = db.execute_query(query, (user['id'],))
    return [p['workspace_id'] for p in permissions]

# ===== Helper Functions =====

# Document tags helper functions
def fetch_document_tags(document_id: str) -> List[Dict[str, Any]]:
    """Fetch tags for a document"""
    query = """
        SELECT t.id, t.name
        FROM document_tag_links dtl
        JOIN tags t ON dtl.tag_id = t.id
        WHERE dtl.document_id = %s
        ORDER BY t.name
    """
    results = db.execute_query(query, (document_id,))
    return [dict(row) for row in results]

def upsert_tag(name: str) -> Dict[str, Any]:
    """Create or get tag (unified for documents, tasks, passwords)"""
    trimmed = name.strip()
    if not trimmed:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")

    existing = db.execute_query(
        "SELECT id, name FROM tags WHERE LOWER(name) = LOWER(%s)",
        (trimmed,)
    )
    if existing:
        return dict(existing[0])

    tag_id = str(uuid.uuid4())
    db.execute_update(
        "INSERT INTO tags (id, name) VALUES (%s, %s)",
        (tag_id, trimmed)
    )
    return {"id": tag_id, "name": trimmed}

# Keep for backward compatibility
def upsert_document_tag(name: str) -> Dict[str, Any]:
    """Create or get document tag (uses unified tags table)"""
    return upsert_tag(name)

def normalize_tag_names(names: List[str]) -> List[str]:
    """Normalize tag names (remove duplicates, trim)"""
    unique = []
    seen = set()
    for name in names:
        trimmed = name.strip()
        if not trimmed:
            continue
        key = trimmed.lower()
        if key not in seen:
            seen.add(key)
            unique.append(trimmed)
    return unique

def extract_tags_from_markdown(content: str) -> List[str]:
    """Extract tags from markdown content
    
    Supports multiple formats:
    1. Hashtags: #tag1 #tag2
    2. Frontmatter: ---\ntags: tag1, tag2, tag3\n---
    3. Tags section: Tags: tag1, tag2, tag3
    """
    import re
    tags = []
    
    if not content:
        return tags
    
    # 1. Extract from frontmatter (YAML format)
    frontmatter_pattern = r'^---\s*\n(.*?)\n---\s*\n'
    frontmatter_match = re.search(frontmatter_pattern, content, re.MULTILINE | re.DOTALL)
    if frontmatter_match:
        frontmatter = frontmatter_match.group(1)
        # Look for tags: field
        tags_pattern = r'^tags:\s*(.+)$'
        tags_match = re.search(tags_pattern, frontmatter, re.MULTILINE | re.IGNORECASE)
        if tags_match:
            tags_str = tags_match.group(1).strip()
            # Handle array format: [tag1, tag2] or list format: tag1, tag2
            tags_str = re.sub(r'^\[|\]$', '', tags_str)  # Remove brackets
            tags.extend([t.strip().strip('"\'') for t in re.split(r'[,\n]', tags_str) if t.strip()])
    
    # 2. Extract hashtags (#tag format) - but not in code blocks
    # Remove code blocks first
    content_no_code = re.sub(r'```[\s\S]*?```', '', content)
    content_no_code = re.sub(r'`[^`]+`', '', content_no_code)
    
    hashtag_pattern = r'#(\w+(?:-\w+)*)'
    hashtags = re.findall(hashtag_pattern, content_no_code)
    tags.extend(hashtags)
    
    # 3. Extract from "Tags:" section (case insensitive)
    tags_section_pattern = r'(?:^|\n)(?:Tags?|Étiquettes?):\s*(.+?)(?:\n|$)'
    tags_section_match = re.search(tags_section_pattern, content_no_code, re.MULTILINE | re.IGNORECASE)
    if tags_section_match:
        tags_str = tags_section_match.group(1).strip()
        # Remove any trailing punctuation
        tags_str = re.sub(r'[\.;!?]+$', '', tags_str)
        tags.extend([t.strip().strip('"\'') for t in re.split(r'[,;]', tags_str) if t.strip()])
    
    # Normalize and remove duplicates
    normalized = []
    seen = set()
    for tag in tags:
        tag_lower = tag.lower().strip()
        if tag_lower and tag_lower not in seen and len(tag_lower) > 0:
            seen.add(tag_lower)
            normalized.append(tag.strip())
    
    return normalized

def update_document_tags(document_id: str, tag_names: List[str]) -> List[Dict[str, Any]]:
    """Update tags for a document"""
    current_tags = fetch_document_tags(document_id)
    normalized = normalize_tag_names(tag_names)
    desired_tags: List[Dict[str, Any]] = [upsert_document_tag(name) for name in normalized]

    current_ids = {tag['id'] for tag in current_tags}
    desired_ids = {tag['id'] for tag in desired_tags}

    # Remove links no longer needed
    to_remove = list(current_ids - desired_ids)
    if to_remove:
        placeholders = ','.join(['%s'] * len(to_remove))
        params = tuple([document_id, *to_remove])
        db.execute_update(
            f"DELETE FROM document_tag_links WHERE document_id = %s AND tag_id IN ({placeholders})",
            params
        )

    # Insert new links
    for tag in desired_tags:
        if tag['id'] not in current_ids:
            db.execute_update(
                "INSERT INTO document_tag_links (document_id, tag_id) VALUES (%s, %s)",
                (document_id, tag['id'])
            )

    return desired_tags

def build_tree(parent_id: Optional[str] = 'root', workspace_id: str = 'demo', depth: int = 0) -> List[Dict]:
    """Build document tree recursively with depth limit"""
    # Prevent infinite recursion
    if depth > 20:
        return []
    
    # For root level, get all documents with parent_id = 'root' in the specified workspace
    # Don't include root itself
    query = """
        SELECT id, name, type, content, parent_id, created_at, updated_at, workspace_id
        FROM documents
        WHERE parent_id = %s AND id != 'root' AND workspace_id = %s
        ORDER BY type DESC, name ASC
        LIMIT 200
    """
    documents = db.execute_query(query, (parent_id, workspace_id))
    
    result = []
    for doc in documents:
        doc_dict = dict(doc)
        
        # Convert datetime objects to ISO format strings
        if doc_dict.get('created_at'):
            doc_dict['created_at'] = doc_dict['created_at'].isoformat()
        if doc_dict.get('updated_at'):
            doc_dict['updated_at'] = doc_dict['updated_at'].isoformat()
        
        # Check if document is locked
        lock_query = "SELECT user_id, user_name, locked_at FROM document_locks WHERE document_id = %s"
        locks = db.execute_query(lock_query, (doc['id'],))
        if locks:
            lb = dict(locks[0])
            if lb.get('locked_at'):
                try:
                    lb['locked_at'] = lb['locked_at'].isoformat()
                except Exception:
                    pass
            doc_dict['locked_by'] = lb
        else:
            doc_dict['locked_by'] = None
        
        # If folder, get children recursively with depth tracking
        if doc['type'] == 'folder':
            doc_dict['children'] = build_tree(doc['id'], workspace_id, depth + 1)
        
        result.append(doc_dict)
    
    return result

async def broadcast_tree_update():
    """Broadcast tree update signal to all connected clients - they will reload their current workspace"""
    await sio.emit('tree_changed', {'action': 'reload'})

async def broadcast_lock_update(document_id: str, lock_info: Optional[Dict] = None):
    """Broadcast lock status change"""
    await sio.emit('lock_updated', {
        'document_id': document_id,
        'locked_by': lock_info
    })

# Presence Management
connected_users: Dict[str, Dict] = {} # sid -> user_info
document_presence: Dict[str, Dict[str, Dict]] = {} # document_id -> {sid: user_info}

@sio.event
async def connect(sid, environ):
    # print(f"Client connected: {sid}")
    pass

@sio.event
async def disconnect(sid):
    # print(f"Client disconnected: {sid}")
    # Remove user from presence
    if sid in connected_users:
        del connected_users[sid]
    
    # Remove from all documents
    for doc_id, users in document_presence.items():
        if sid in users:
            del users[sid]
            # Broadcast updated list
            await sio.emit('presence_updated', {
                'document_id': doc_id,
                'users': list(users.values())
            }, room=f"doc_{doc_id}")

@sio.event
async def join_document(sid, data):
    """Join a document room for presence"""
    document_id = data.get('document_id')
    user_info = data.get('user')
    
    if not document_id or not user_info:
        return
        
    sio.enter_room(sid, f"doc_{document_id}")
    
    if document_id not in document_presence:
        document_presence[document_id] = {}
        
    # Store user presence with sid as key to handle multiple tabs/devices
    document_presence[document_id][sid] = user_info
    connected_users[sid] = user_info
    
    # Broadcast to room
    await sio.emit('presence_updated', {
        'document_id': document_id,
        'users': list(document_presence[document_id].values())
    }, room=f"doc_{document_id}")

@sio.event
async def leave_document(sid, data):
    """Leave a document room"""
    document_id = data.get('document_id')
    if not document_id:
        return
        
    sio.leave_room(sid, f"doc_{document_id}")
    
    if document_id in document_presence and sid in document_presence[document_id]:
        del document_presence[document_id][sid]
        
        await sio.emit('presence_updated', {
            'document_id': document_id,
            'users': list(document_presence[document_id].values())
        }, room=f"doc_{document_id}")

@sio.event
async def task_activity_updated(sid, data):
    """Broadcast task activity updates to all clients except sender"""
    await sio.emit('task_activity_updated', data, skip_sid=sid)

# ===== Initialization Functions =====

def ensure_default_setup():
    """Ensure default workspace and group permissions are set up automatically
    This function is called on startup to ensure a working environment even in a fresh install.
    It creates all necessary default groups, workspace, and permissions."""
    try:
        # 1. Ensure "Administrators" group exists (for admin users)
        admin_group_query = "SELECT id FROM user_groups_table WHERE name = 'Administrators' LIMIT 1"
        admin_group = db.execute_query(admin_group_query)
        
        if not admin_group:
            # Create Administrators group if it doesn't exist
            create_admin_group = """
                INSERT INTO user_groups_table (name, description, is_business, is_system)
                VALUES ('Administrators', 'Full access to all workspaces', 1, 1)
            """
            db.execute_update(create_admin_group)
            admin_group = db.execute_query(admin_group_query)
            print("✓ Created 'Administrators' group")
        
        admin_group_id = admin_group[0]['id']
        
        # 2. Ensure "ALL" group exists (business group - all users)
        all_group_query = "SELECT id FROM user_groups_table WHERE name = 'ALL' LIMIT 1"
        all_group = db.execute_query(all_group_query)
        
        if not all_group:
            # Create ALL group if it doesn't exist
            create_all_group = """
                INSERT INTO user_groups_table (name, description, is_business, is_system)
                VALUES ('ALL', 'Tous les utilisateurs - Groupe par défaut', 1, 1)
            """
            db.execute_update(create_all_group)
            all_group = db.execute_query(all_group_query)
            print("✓ Created 'ALL' group")
        
        all_group_id = all_group[0]['id']  # Use numeric ID
        
        # 3. Ensure "Users" group exists
        users_group_query = "SELECT id FROM user_groups_table WHERE name = 'Users' LIMIT 1"
        users_group = db.execute_query(users_group_query)
        
        if not users_group:
            # Create Users group if it doesn't exist
            create_users_group = """
                INSERT INTO user_groups_table (name, description, is_business, is_system)
                VALUES ('Users', 'Default group for all users', 1, 1)
            """
            db.execute_update(create_users_group)
            users_group = db.execute_query(users_group_query)
            print("✓ Created 'Users' group")
        
        users_group_id = users_group[0]['id']
        
        # 4. Ensure "demo" workspace exists (demo workspace for testing)
        demo_ws_query = "SELECT id FROM workspaces WHERE id = 'demo' LIMIT 1"
        demo_ws = db.execute_query(demo_ws_query)
        
        if not demo_ws:
            # Create demo workspace if it doesn't exist
            create_demo_ws = """
                INSERT INTO workspaces (id, name, description, created_by, created_at, updated_at)
                VALUES ('demo', 'Demo Workspace', 'Workspace de démo pour tester - Documents Markdown, Mots de passe et Tâches', 1, NOW(), NOW())
            """
            db.execute_update(create_demo_ws)
            print("✓ Created 'demo' workspace")
        else:
            # Ensure demo workspace has correct name and description
            update_demo_ws = """
                UPDATE workspaces 
                SET name = 'Demo Workspace',
                    description = 'Workspace de démo pour tester - Documents Markdown, Mots de passe et Tâches',
                    created_at = COALESCE(created_at, NOW()),
                    updated_at = COALESCE(updated_at, NOW()),
                    created_by = COALESCE(created_by, 1)
                WHERE id = 'demo'
            """
            db.execute_update(update_demo_ws)
        
        # 5. Ensure "Administrators" group has admin access to "demo" workspace
        check_admin_perm_query = """
            SELECT group_id FROM group_workspace_permissions
            WHERE group_id = %s AND workspace_id = 'demo'
            LIMIT 1
        """
        existing_admin_perm = db.execute_query(check_admin_perm_query, (admin_group_id,))
        
        if not existing_admin_perm:
            # Grant admin access to Administrators group
            grant_admin_perm_query = """
                INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level, granted_at)
                VALUES (%s, 'demo', 'admin', NOW())
            """
            db.execute_update(grant_admin_perm_query, (admin_group_id,))
            print(f"✓ Granted 'admin' access to 'Administrators' group on 'demo' workspace")
        
        # 6. Ensure "ALL" group has write access to "demo" workspace (for testing)
        check_all_perm_query = """
            SELECT group_id FROM group_workspace_permissions
            WHERE group_id = %s AND workspace_id = 'demo'
            LIMIT 1
        """
        existing_all_perm = db.execute_query(check_all_perm_query, (all_group_id,))
        
        if not existing_all_perm:
            # Grant write access to ALL group (users can create documents, passwords, tasks)
            grant_all_perm_query = """
                INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level, granted_at)
                VALUES (%s, 'demo', 'write', NOW())
            """
            db.execute_update(grant_all_perm_query, (all_group_id,))
            print(f"✓ Granted 'write' access to 'ALL' group on 'demo' workspace")
        else:
            # Update existing permission to write if it's only read
            update_all_perm_query = """
                UPDATE group_workspace_permissions
                SET permission_level = 'write'
                WHERE group_id = %s AND workspace_id = 'demo' AND permission_level != 'write'
            """
            db.execute_update(update_all_perm_query, (all_group_id,))
            print(f"✓ Ensured 'write' access for 'ALL' group on 'demo' workspace")
        
        # 7. Ensure "Users" group has write access to "demo" workspace (for testing)
        check_perm_query = """
            SELECT group_id FROM group_workspace_permissions
            WHERE group_id = %s AND workspace_id = 'demo'
            LIMIT 1
        """
        existing_perm = db.execute_query(check_perm_query, (users_group_id,))
        
        if not existing_perm:
            # Grant write access to Users group (users can create documents, passwords, tasks)
            grant_perm_query = """
                INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level, granted_at)
                VALUES (%s, 'demo', 'write', NOW())
            """
            db.execute_update(grant_perm_query, (users_group_id,))
            print(f"✓ Granted 'write' access to 'Users' group (id={users_group_id}) on 'demo' workspace")
        else:
            # Update existing permission to write if it's only read
            update_perm_query = """
                UPDATE group_workspace_permissions
                SET permission_level = 'write'
                WHERE group_id = %s AND workspace_id = 'demo' AND permission_level = 'read'
            """
            db.execute_update(update_perm_query, (users_group_id,))
        
        # 8. Ensure all admin users are in "Administrators" group
        admin_users_not_in_group_query = """
            SELECT u.id FROM users u
            WHERE u.role = 'admin' AND NOT EXISTS (
                SELECT 1 FROM user_groups ug
                WHERE ug.user_id = u.id AND ug.group_id = %s
            )
        """
        admin_users_not_in_group = db.execute_query(admin_users_not_in_group_query, (admin_group_id,))
        
        if admin_users_not_in_group:
            for user in admin_users_not_in_group:
                add_user_query = """
                    INSERT INTO user_groups (user_id, group_id)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE user_id=user_id
                """
                db.execute_update(add_user_query, (user['id'], admin_group_id))
            print(f"✓ Added {len(admin_users_not_in_group)} admin user(s) to 'Administrators' group")
        
        # 9. Ensure all existing users are in "ALL" group
        users_not_in_all_query = """
            SELECT u.id FROM users u
            WHERE NOT EXISTS (
                SELECT 1 FROM user_groups ug
                WHERE ug.user_id = u.id AND ug.group_id = %s
            )
        """
        users_not_in_all = db.execute_query(users_not_in_all_query, (all_group_id,))
        
        if users_not_in_all:
            for user in users_not_in_all:
                add_user_query = """
                    INSERT INTO user_groups (user_id, group_id)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE user_id=user_id
                """
                db.execute_update(add_user_query, (user['id'], all_group_id))
            print(f"✓ Added {len(users_not_in_all)} existing user(s) to 'ALL' group")
        
        # 10. Ensure all existing users are in "Users" group
        users_not_in_group_query = """
            SELECT u.id FROM users u
            WHERE NOT EXISTS (
                SELECT 1 FROM user_groups ug
                WHERE ug.user_id = u.id AND ug.group_id = %s
            )
        """
        users_not_in_group = db.execute_query(users_not_in_group_query, (users_group_id,))
        
        if users_not_in_group:
            for user in users_not_in_group:
                add_user_query = """
                    INSERT INTO user_groups (user_id, group_id)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE user_id=user_id
                """
                db.execute_update(add_user_query, (user['id'], users_group_id))
            print(f"✓ Added {len(users_not_in_group)} existing user(s) to 'Users' group")
        
        # 11. Ensure "system_settings" table exists
        create_settings_table = """
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """
        db.execute_update(create_settings_table)
        print("✓ Verified 'system_settings' table")

        print("✓ Default setup verified: 'demo' workspace, 'Administrators', 'ALL' and 'Users' groups with permissions")
    except Exception as e:
        print(f"⚠ Warning: Could not ensure default setup: {e}")
        import traceback
        traceback.print_exc()

@app.on_event("startup")
async def startup_event():
    """Initialize default workspace and permissions on startup"""
    ensure_default_setup()

# ===== REST API Endpoints =====

@app.get("/")
async def root():
    return {"message": "MarkD Documentation Manager API", "version": "1.0.0"}

# ===== Workspace Endpoints =====

@app.get("/api/workspaces")
async def get_workspaces(request: Request, user: Dict = Depends(get_current_user)):
    """Get all workspaces accessible by the user"""
    try:
        # For admins, return ALL workspaces without filtering
        if user.get('role') == 'admin':
            query = "SELECT id, name, description, created_at, updated_at FROM workspaces ORDER BY name"
            workspaces = db.execute_query(query)
        else:
            # For regular users, filter by group permissions
            workspace_ids = await get_user_workspaces(user)
            
            if not workspace_ids:
                return {"success": True, "workspaces": []}
            
            placeholders = ','.join(['%s'] * len(workspace_ids))
            query = f"SELECT id, name, description, created_at, updated_at FROM workspaces WHERE id IN ({placeholders}) ORDER BY name"
            workspaces = db.execute_query(query, tuple(workspace_ids))
        
        # Add user's permission level for each workspace
        for ws in workspaces:
            if ws.get('created_at'):
                ws['created_at'] = ws['created_at'].isoformat()
            if ws.get('updated_at'):
                ws['updated_at'] = ws['updated_at'].isoformat()
            
            # Get user's permission level
            if user.get('role') == 'admin':
                ws['user_permission'] = 'admin'
            else:
                # Use group-based permissions instead of direct workspace_permissions
                try:
                    # Get the user's actual permission level for this workspace
                    perm_query = """
                        SELECT MAX(
                            CASE gwp.permission_level
                                WHEN 'admin' THEN 3
                                WHEN 'write' THEN 2
                                WHEN 'read' THEN 1
                                ELSE 0
                            END
                        ) as max_level
                        FROM user_groups ug
                        JOIN group_workspace_permissions gwp ON ug.group_id = gwp.group_id
                        WHERE ug.user_id = %s AND gwp.workspace_id = %s
                    """
                    perm_result = db.execute_query(perm_query, (user['id'], ws['id']))
                    if perm_result and perm_result[0]['max_level'] and perm_result[0]['max_level'] > 0:
                        max_level = perm_result[0]['max_level']
                        if max_level >= 3:
                            ws['user_permission'] = 'admin'
                        elif max_level >= 2:
                            ws['user_permission'] = 'write'
                        else:
                            ws['user_permission'] = 'read'
                    else:
                        ws['user_permission'] = 'none'  # No permission if not in any group
                except Exception as e:
                    # Default to read if no explicit permission
                    ws['user_permission'] = 'read'
        
        return {"success": True, "workspaces": workspaces}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspaces")
async def create_workspace(workspace: WorkspaceBase, request: Request, user: Dict = Depends(get_current_user)):
    """Create new workspace (admin only)"""
    try:
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can create workspaces")
        
        workspace_id = str(uuid.uuid4())
        query = "INSERT INTO workspaces (id, name, description) VALUES (%s, %s, %s)"
        db.execute_update(query, (workspace_id, workspace.name, workspace.description))
        
        # Give creator admin rights on the workspace
        perm_query = "INSERT INTO workspace_permissions (workspace_id, user_id, permission_level) VALUES (%s, %s, 'admin')"
        db.execute_update(perm_query, (workspace_id, user['id']))
        
        # Automatically grant "Users" group read access to the new workspace
        try:
            users_group_query = "SELECT id FROM user_groups_table WHERE name = 'Users' LIMIT 1"
            users_group = db.execute_query(users_group_query)
            if users_group:
                users_group_id = users_group[0]['id']
                grant_users_access = """
                    INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level, granted_at)
                    VALUES (%s, %s, 'read', NOW())
                    ON DUPLICATE KEY UPDATE permission_level='read'
                """
                db.execute_update(grant_users_access, (users_group_id, workspace_id))
        except Exception as e:
            print(f"Warning: Could not grant Users group access to new workspace: {e}")
        
        return {"success": True, "id": workspace_id, "message": "Workspace created"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/workspaces/{workspace_id}")
async def update_workspace(workspace_id: str, workspace: WorkspaceUpdate, request: Request, user: Dict = Depends(get_current_user)):
    """Update workspace (requires admin permission on workspace)"""
    try:
        await check_workspace_permission(workspace_id, user, 'admin')
        
        updates = []
        params = []
        if workspace.name is not None:
            updates.append("name = %s")
            params.append(workspace.name)
        if workspace.description is not None:
            updates.append("description = %s")
            params.append(workspace.description)
        
        if not updates:
            return {"success": True, "message": "No changes"}
        
        params.append(workspace_id)
        query = f"UPDATE workspaces SET {', '.join(updates)} WHERE id = %s"
        db.execute_update(query, tuple(params))
        return {"success": True, "message": "Workspace updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Delete workspace and all its documents (requires admin permission)"""
    try:
        if workspace_id == 'demo':
            raise HTTPException(status_code=400, detail="Cannot delete demo workspace")
        
        await check_workspace_permission(workspace_id, user, 'admin')
        
        # Delete all documents in workspace
        db.execute_update("DELETE FROM documents WHERE workspace_id = %s", (workspace_id,))
        
        # Delete workspace (permissions will be deleted automatically due to CASCADE)
        db.execute_update("DELETE FROM workspaces WHERE id = %s", (workspace_id,))
        
        return {"success": True, "message": "Workspace deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Workspace Permission Endpoints =====

@app.get("/api/workspaces/{workspace_id}/users")
async def get_workspace_users(workspace_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Get all users who have access to this workspace"""
    try:
        await check_workspace_permission(workspace_id, user, 'read')
        
        # Get all users who have access via groups
        query = """
            SELECT DISTINCT u.id, u.username, u.email
            FROM users u
            JOIN user_groups ug ON u.id = ug.user_id
            JOIN group_workspace_permissions gwp ON ug.group_id = gwp.group_id
            WHERE gwp.workspace_id = %s AND u.is_active = TRUE
            ORDER BY u.username
        """
        users = db.execute_query(query, (workspace_id,))
        
        return {"success": True, "users": users}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_id}/permissions")
async def get_workspace_permissions(workspace_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Get all permissions for a workspace (requires admin permission)"""
    try:
        await check_workspace_permission(workspace_id, user, 'admin')
        
        query = """
            SELECT wp.user_id, wp.permission_level, u.username, u.email
            FROM workspace_permissions wp
            JOIN users u ON wp.user_id = u.id
            WHERE wp.workspace_id = %s
            ORDER BY u.username
        """
        permissions = db.execute_query(query, (workspace_id,))
        
        return {"success": True, "permissions": permissions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspaces/{workspace_id}/permissions")
async def add_workspace_permission(workspace_id: str, permission: PermissionBase, request: Request, user: Dict = Depends(get_current_user)):
    """Add a user to workspace with specific permission (requires admin permission)"""
    try:
        await check_workspace_permission(workspace_id, user, 'admin')
        
        # Validate permission level
        if permission.permission_level not in ['read', 'write', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid permission level")
        
        # Check if user exists
        user_query = "SELECT id FROM users WHERE id = %s"
        user_exists = db.execute_query(user_query, (permission.user_id,))
        if not user_exists:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Add or update permission
        query = """
            INSERT INTO workspace_permissions (workspace_id, user_id, permission_level)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE permission_level = %s
        """
        db.execute_update(query, (workspace_id, permission.user_id, permission.permission_level, permission.permission_level))
        
        return {"success": True, "message": "Permission added"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/workspaces/{workspace_id}/permissions/{user_id}")
async def update_workspace_permission(workspace_id: str, user_id: int, permission: PermissionBase, request: Request, user: Dict = Depends(get_current_user)):
    """Update user permission for workspace (requires admin permission)"""
    try:
        await check_workspace_permission(workspace_id, user, 'admin')
        
        # Validate permission level
        if permission.permission_level not in ['read', 'write', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid permission level")
        
        query = "UPDATE workspace_permissions SET permission_level = %s WHERE workspace_id = %s AND user_id = %s"
        affected = db.execute_update(query, (permission.permission_level, workspace_id, user_id))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        return {"success": True, "message": "Permission updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/workspaces/{workspace_id}/permissions/{user_id}")
async def delete_workspace_permission(workspace_id: str, user_id: int, request: Request, user: Dict = Depends(get_current_user)):
    """Remove user permission from workspace (requires admin permission)"""
    try:
        await check_workspace_permission(workspace_id, user, 'admin')
        
        query = "DELETE FROM workspace_permissions WHERE workspace_id = %s AND user_id = %s"
        affected = db.execute_update(query, (workspace_id, user_id))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        return {"success": True, "message": "Permission removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users")
async def get_users(request: Request, user: Dict = Depends(get_current_user)):
    """Get all users (for adding to workspaces)"""
    try:
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can list users")
        
        query = "SELECT id, username, email, role FROM users ORDER BY username"
        users = db.execute_query(query)
        
        return {"success": True, "users": users}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Document Endpoints =====

@app.get("/api/documents/tree")
async def get_tree(workspace_id: str = 'demo', request: Request = None, user: Dict = Depends(get_current_user)):
    """Get full document tree for a workspace (requires read permission)"""
    try:
        await check_workspace_permission(workspace_id, user, 'read')
        tree = build_tree('root', workspace_id)
        
        # Get workspace info
        ws_query = "SELECT name FROM workspaces WHERE id = %s"
        ws = db.execute_query(ws_query, (workspace_id,))
        workspace_name = ws[0]['name'] if ws else 'Documents'
        
        return {"success": True, "tree": tree, "workspace_name": workspace_name}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{document_id}")
async def get_document(document_id: str):
    """Get single document by ID"""
    try:
        query = "SELECT * FROM documents WHERE id = %s"
        docs = db.execute_query(query, (document_id,))
        
        if not docs:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc = dict(docs[0])
        
        # Check if locked
        lock_query = "SELECT user_id, user_name, locked_at FROM document_locks WHERE document_id = %s"
        locks = db.execute_query(lock_query, (document_id,))
        if locks:
            lb = dict(locks[0])
            if lb.get('locked_at'):
                try:
                    lb['locked_at'] = lb['locked_at'].isoformat()
                except Exception:
                    pass
            doc['locked_by'] = lb
        else:
            doc['locked_by'] = None
        
        return {"success": True, "document": doc}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents")
async def create_document(document: DocumentBase, request: Request, user: Dict = Depends(get_current_user)):
    """Create new document or folder (requires write permission)"""
    try:
        await check_workspace_permission(document.workspace_id, user, 'write')
        
        doc_id = str(uuid.uuid4())
        query = """
            INSERT INTO documents (id, name, type, parent_id, content, workspace_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            doc_id,
            document.name,
            document.type,
            document.parent_id,
            document.content,
            document.workspace_id
        ))
        
        # Extract tags from markdown content and add them automatically
        if document.type == 'file' and document.content:
            try:
                extracted_tags = extract_tags_from_markdown(document.content)
                if extracted_tags:
                    update_document_tags(doc_id, extracted_tags)
            except Exception as e:
                print(f"Warning: Could not extract tags from document {doc_id}: {e}")
        
        # Log activity
        log_activity(
            user_id=user['id'],
            workspace_id=document.workspace_id,
            item_id=doc_id,
            action='create',
            item_type='document',
            item_name=document.name
        )
        
        await broadcast_tree_update()
        
        return {
            "success": True,
            "document": {
                "id": doc_id,
                "name": document.name,
                "type": document.type,
                "parent_id": document.parent_id
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/documents/{document_id}")
async def update_document(document_id: str, document: DocumentUpdate, request: Request, user: Dict = Depends(get_current_user)):
    """Update document (requires write permission)"""
    try:
        # Check if document exists and get workspace
        check_query = "SELECT workspace_id FROM documents WHERE id = %s"
        existing = db.execute_query(check_query, (document_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Document not found")
        
        await check_workspace_permission(existing[0]['workspace_id'], user, 'write')
        
        # Build update query dynamically
        updates = []
        params = []
        
        if document.name is not None:
            updates.append("name = %s")
            params.append(document.name)
        
        if document.content is not None:
            updates.append("content = %s")
            params.append(document.content)
        
        if document.parent_id is not None:
            updates.append("parent_id = %s")
            params.append(document.parent_id)
        
        if updates:
            params.append(document_id)
            query = f"UPDATE documents SET {', '.join(updates)} WHERE id = %s"
            db.execute_update(query, tuple(params))
        
        # Extract tags from markdown content and update them automatically
        # Only if content was updated and document is a file
        if document.content is not None:
            try:
                # Check if document is a file
                doc_type_query = "SELECT type FROM documents WHERE id = %s"
                doc_type_result = db.execute_query(doc_type_query, (document_id,))
                if doc_type_result and doc_type_result[0]['type'] == 'file':
                    extracted_tags = extract_tags_from_markdown(document.content)
                    if extracted_tags:
                        update_document_tags(document_id, extracted_tags)
            except Exception as e:
                print(f"Warning: Could not extract tags from document {document_id}: {e}")
        
        await broadcast_tree_update()
        # Additionally notify content update to connected clients (others will toast)
        try:
            if document.content is not None:
                name_rows = db.execute_query("SELECT name FROM documents WHERE id = %s", (document_id,))
                doc_name = name_rows[0]['name'] if name_rows else None
                await sio.emit('document_content_updated', {
                    'document_id': document_id,
                    'name': doc_name,
                })
        except Exception:
            pass
        
        return {"success": True, "message": "Document updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Delete document (cascades to children, requires write permission)"""
    try:
        if document_id == 'root':
            raise HTTPException(status_code=400, detail="Cannot delete root folder")
        
        # Get workspace to check permission
        check_query = "SELECT workspace_id FROM documents WHERE id = %s"
        doc = db.execute_query(check_query, (document_id,))
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        await check_workspace_permission(doc[0]['workspace_id'], user, 'write')
        
        query = "DELETE FROM documents WHERE id = %s"
        affected = db.execute_update(query, (document_id,))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Document not found")
        
        await broadcast_tree_update()
        
        return {"success": True, "message": "Document deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/{document_id}/move")
async def move_document(document_id: str, move: DocumentMove):
    """Move document to new parent"""
    try:
        # Check if target parent exists
        parent_check = "SELECT id, type FROM documents WHERE id = %s"
        parents = db.execute_query(parent_check, (move.parent_id,))
        
        if not parents:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        
        if parents[0]['type'] != 'folder':
            raise HTTPException(status_code=400, detail="Parent must be a folder")
        
        # Update parent_id
        query = "UPDATE documents SET parent_id = %s WHERE id = %s"
        db.execute_update(query, (move.parent_id, document_id))
        
        await broadcast_tree_update()
        
        return {"success": True, "message": "Document moved"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/{document_id}/copy")
async def copy_document(document_id: str):
    """Copy document"""
    try:
        # Get original document
        query = "SELECT * FROM documents WHERE id = %s"
        docs = db.execute_query(query, (document_id,))
        
        if not docs:
            raise HTTPException(status_code=404, detail="Document not found")
        
        original = docs[0]
        new_id = str(uuid.uuid4())
        
        insert_query = """
            INSERT INTO documents (id, name, type, parent_id, content)
            VALUES (%s, %s, %s, %s, %s)
        """
        db.execute_update(insert_query, (
            new_id,
            f"{original['name']} (copy)",
            original['type'],
            original['parent_id'],
            original['content']
        ))
        
        await broadcast_tree_update()
        
        return {"success": True, "document_id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Lock Management =====

@app.post("/api/documents/{document_id}/lock")
async def lock_document(document_id: str, lock_req: LockRequest):
    """Lock document for editing"""
    try:
        # Check if already locked
        check_query = "SELECT user_id, user_name, locked_at FROM document_locks WHERE document_id = %s"
        existing = db.execute_query(check_query, (document_id,))
        
        if existing:
            locked_at = existing[0]['locked_at']
            # Check if lock is expired
            if locked_at and (datetime.now() - locked_at) > timedelta(minutes=LOCK_TIMEOUT_MINUTES):
                # Lock expired, delete it
                delete_query = "DELETE FROM document_locks WHERE document_id = %s"
                db.execute_update(delete_query, (document_id,))
            elif existing[0]['user_id'] != lock_req.user_id:
                # Valid lock by another user
                return {
                    "success": False,
                    "message": "Document already locked",
                    "locked_by": existing[0]
                }
            else:
                # Locked by same user, update timestamp
                update_query = "UPDATE document_locks SET locked_at = NOW() WHERE document_id = %s"
                db.execute_update(update_query, (document_id,))
                return {"success": True, "message": "Lock refreshed"}
        
        # Create lock
        query = """
            INSERT INTO document_locks (document_id, user_id, user_name, locked_at)
            VALUES (%s, %s, %s, NOW())
        """
        db.execute_update(query, (document_id, lock_req.user_id, lock_req.user_name))
        
        lock_info = {
            "user_id": lock_req.user_id, 
            "user_name": lock_req.user_name,
            "locked_at": datetime.now().isoformat()
        }
        await broadcast_lock_update(document_id, lock_info)
        
        return {"success": True, "message": "Document locked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/{document_id}/heartbeat")
async def heartbeat_document(document_id: str, user: Dict = Depends(get_current_user)):
    """Update lock timestamp to prevent expiration"""
    try:
        user_id = str(user['id'])
        # Check if user owns the lock
        check_query = "SELECT user_id FROM document_locks WHERE document_id = %s"
        existing = db.execute_query(check_query, (document_id,))
        
        if not existing:
            return {"success": False, "message": "Document not locked"}
            
        if str(existing[0]['user_id']) != user_id:
            return {"success": False, "message": "Lock owned by another user"}
            
        # Update timestamp
        query = "UPDATE document_locks SET locked_at = NOW() WHERE document_id = %s"
        db.execute_update(query, (document_id,))
        
        return {"success": True, "message": "Heartbeat received"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{document_id}/lock")
async def unlock_document(document_id: str, user_id: str):
    """Unlock document"""
    try:
        query = "DELETE FROM document_locks WHERE document_id = %s AND user_id = %s"
        affected = db.execute_update(query, (document_id, user_id))
        
        if affected == 0:
            return {"success": False, "message": "Lock not found or not owned by user"}
        
        await broadcast_lock_update(document_id, None)
        
        return {"success": True, "message": "Document unlocked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Document Tags Endpoints =====

class TagsUpdate(BaseModel):
    tags: List[str] = []

@app.get("/api/documents/{document_id}/tags")
async def get_document_tags(document_id: str, user: Dict = Depends(get_current_user)):
    """Get tags for a document"""
    try:
        tags = fetch_document_tags(document_id)
        return {"success": True, "tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/documents/{document_id}/tags")
async def update_document_tags_endpoint(document_id: str, payload: TagsUpdate, user: Dict = Depends(get_current_user)):
    """Update tags for a document"""
    try:
        # Check if document exists and get workspace
        check_query = "SELECT workspace_id FROM documents WHERE id = %s"
        existing = db.execute_query(check_query, (document_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Document not found")
        
        await check_workspace_permission(existing[0]['workspace_id'], user, 'write')
        
        tags = update_document_tags(document_id, payload.tags)
        return {"success": True, "tags": tags}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/tags/suggestions")
async def get_document_tag_suggestions(query: str = "", limit: int = 20, user: Dict = Depends(get_current_user)):
    """Get tag suggestions for documents"""
    try:
        if query:
            search_query = """
                SELECT id, name FROM tags
                WHERE LOWER(name) LIKE LOWER(%s)
                ORDER BY name
                LIMIT %s
            """
            results = db.execute_query(search_query, (f"%{query}%", limit))
        else:
            results = db.execute_query(
                "SELECT id, name FROM tags ORDER BY name LIMIT %s",
                (limit,)
            )
        return {"success": True, "tags": [dict(row) for row in results]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/{document_id}/force-unlock")
async def force_unlock_document(document_id: str):
    """Force unlock document (admin only)"""
    try:
        # Delete any existing lock regardless of user
        query = "DELETE FROM document_locks WHERE document_id = %s"
        affected = db.execute_update(query, (document_id,))
        
        if affected == 0:
            return {"success": False, "message": "Document was not locked"}
        
        await broadcast_lock_update(document_id, None)
        
        return {"success": True, "message": "Document force unlocked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Image Upload =====

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image and return its URL"""
    try:
        print(f"Upload request received - filename: {file.filename}, content_type: {file.content_type}")
        
        # Validate file type - be more permissive
        if not file.content_type or not file.content_type.startswith('image/'):
            # Also check file extension as fallback
            allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
            file_ext = ('.' + file.filename.split('.')[-1]).lower() if '.' in file.filename else ''
            if file_ext not in allowed_extensions:
                print(f"Invalid file type: {file.content_type}, extension: {file_ext}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid image type: {file.content_type}. Allowed: JPEG, PNG, GIF, WebP, SVG"
                )
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        print(f"Saving file to: {file_path}")
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"File saved successfully: {unique_filename}")
        
        # Return URL
        return {
            "success": True,
            "url": f"/uploads/{unique_filename}",
            "filename": file.filename
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== MCP Server Endpoints =====

@app.post("/api/mcp/log")
async def log_mcp_activity(action: MCPAction):
    """Log MCP agent activity"""
    try:
        query = """
            INSERT INTO mcp_activity_log (agent_id, action, document_id, details)
            VALUES (%s, %s, %s, %s)
        """
        import json
        db.execute_update(query, (
            action.agent_id,
            action.action,
            action.document_id,
            json.dumps(action.details) if action.details else None
        ))
        
        return {"success": True, "message": "Activity logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mcp/activity")
async def get_mcp_activity(limit: int = 100):
    """Get recent MCP activity"""
    try:
        query = """
            SELECT agent_id, action, document_id, details, created_at
            FROM mcp_activity_log
            ORDER BY created_at DESC
            LIMIT %s
        """
        activities = db.execute_query(query, (limit,))
        return {"success": True, "activities": activities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== MCP Configuration Endpoints =====

class MCPConfigBase(BaseModel):
    workspace_id: str
    source_path: str
    destination_path: str = ''
    enabled: bool = True

class MCPConfigUpdate(BaseModel):
    source_path: Optional[str] = None
    destination_path: Optional[str] = None
    enabled: Optional[bool] = None

@app.get("/api/mcp/configs")
async def get_mcp_configs(request: Request, user: Dict = Depends(get_current_user)):
    """Get all MCP configurations for current user"""
    try:
        query = """
            SELECT mc.id, mc.workspace_id, mc.source_path, mc.destination_path, 
                   mc.enabled, mc.created_at, mc.updated_at,
                   w.name as workspace_name
            FROM mcp_configs mc
            LEFT JOIN workspaces w ON mc.workspace_id = w.id
            WHERE mc.user_id = %s
            ORDER BY mc.created_at DESC
        """
        configs = db.execute_query(query, (user['id'],))
        
        # Vérifier les permissions pour chaque workspace
        for config in configs:
            workspace_id = config['workspace_id']
            try:
                # Vérifier que l'utilisateur a au moins 'read' sur le workspace
                permission = await check_workspace_permission(workspace_id, user, 'read')
                config['user_permission'] = permission
                # Autoriser seulement si write ou admin
                config['mcp_allowed'] = permission in ['write', 'admin']
            except HTTPException:
                config['user_permission'] = 'none'
                config['mcp_allowed'] = False
        
        return {"success": True, "configs": configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mcp/configs")
async def create_mcp_config(config: MCPConfigBase, request: Request, user: Dict = Depends(get_current_user)):
    """Create new MCP configuration (requires write permission on workspace)"""
    try:
        # Vérifier que l'utilisateur a au moins 'write' sur le workspace
        permission = await check_workspace_permission(config.workspace_id, user, 'write')
        
        if permission not in ['write', 'admin']:
            raise HTTPException(
                status_code=403, 
                detail="MCP requires 'write' or 'admin' permission on the workspace"
            )
        
        # Vérifier qu'il n'existe pas déjà une config pour ce user/workspace/source_path
        check_query = """
            SELECT id FROM mcp_configs 
            WHERE user_id = %s AND workspace_id = %s AND source_path = %s
        """
        existing = db.execute_query(check_query, (user['id'], config.workspace_id, config.source_path))
        if existing:
            raise HTTPException(
                status_code=400,
                detail="A configuration already exists for this user/workspace/source_path"
            )
        
        config_id = str(uuid.uuid4())
        query = """
            INSERT INTO mcp_configs (id, user_id, workspace_id, source_path, destination_path, enabled)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            config_id,
            user['id'],
            config.workspace_id,
            config.source_path,
            config.destination_path,
            config.enabled
        ))
        
        return {
            "success": True,
            "config": {
                "id": config_id,
                "workspace_id": config.workspace_id,
                "source_path": config.source_path,
                "destination_path": config.destination_path,
                "enabled": config.enabled
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/mcp/configs/{config_id}")
async def update_mcp_config(config_id: str, config: MCPConfigUpdate, request: Request, user: Dict = Depends(get_current_user)):
    """Update MCP configuration (requires write permission on workspace)"""
    try:
        # Vérifier que la config existe et appartient à l'utilisateur
        check_query = "SELECT workspace_id FROM mcp_configs WHERE id = %s AND user_id = %s"
        existing = db.execute_query(check_query, (config_id, user['id']))
        if not existing:
            raise HTTPException(status_code=404, detail="Configuration not found")
        
        workspace_id = existing[0]['workspace_id']
        
        # Vérifier que l'utilisateur a au moins 'write' sur le workspace
        permission = await check_workspace_permission(workspace_id, user, 'write')
        
        if permission not in ['write', 'admin']:
            raise HTTPException(
                status_code=403,
                detail="MCP requires 'write' or 'admin' permission on the workspace"
            )
        
        # Construire la requête de mise à jour
        updates = []
        params = []
        
        if config.source_path is not None:
            updates.append("source_path = %s")
            params.append(config.source_path)
        
        if config.destination_path is not None:
            updates.append("destination_path = %s")
            params.append(config.destination_path)
        
        if config.enabled is not None:
            updates.append("enabled = %s")
            params.append(config.enabled)
        
        if updates:
            params.append(config_id)
            query = f"UPDATE mcp_configs SET {', '.join(updates)} WHERE id = %s"
            db.execute_update(query, tuple(params))
        
        return {"success": True, "message": "Configuration updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/mcp/configs/{config_id}")
async def delete_mcp_config(config_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Delete MCP configuration"""
    try:
        # Vérifier que la config existe et appartient à l'utilisateur
        check_query = "SELECT id FROM mcp_configs WHERE id = %s AND user_id = %s"
        existing = db.execute_query(check_query, (config_id, user['id']))
        if not existing:
            raise HTTPException(status_code=404, detail="Configuration not found")
        
        query = "DELETE FROM mcp_configs WHERE id = %s"
        db.execute_update(query, (config_id,))
        
        return {"success": True, "message": "Configuration deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mcp/configs/check")
async def check_mcp_permission(workspace_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Check if user has permission to use MCP on a workspace (requires write/admin)"""
    try:
        permission = await check_workspace_permission(workspace_id, user, 'write')
        mcp_allowed = permission in ['write', 'admin']
        
        return {
            "success": True,
            "workspace_id": workspace_id,
            "user_permission": permission,
            "mcp_allowed": mcp_allowed
        }
    except HTTPException as e:
        # Si pas de permission, retourner 'none'
        return {
            "success": True,
            "workspace_id": workspace_id,
            "user_permission": "none",
            "mcp_allowed": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        query = """
            SELECT * FROM mcp_activity_log
            ORDER BY created_at DESC
            LIMIT %s
        """
        activities = db.execute_query(query, (limit,))
        return {"success": True, "activities": activities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Socket.IO Events =====

@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    # print(f"Client connected: {sid}")  # Disabled to reduce log verbosity
    # Send current tree to new client
    tree = build_tree()
    await sio.emit('tree_updated', {'tree': tree}, room=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnection - Clean up expired locks"""
    # Clean up locks that are older than LOCK_TIMEOUT_MINUTES
    try:
        timeout = timedelta(minutes=LOCK_TIMEOUT_MINUTES)
        cutoff_time = datetime.utcnow() - timeout
        
        # Clean up expired document locks
        db.execute_update(
            "DELETE FROM document_locks WHERE locked_at < %s",
            (cutoff_time,)
        )
        
        # Clean up expired task locks
        db.execute_update(
            "DELETE FROM task_locks WHERE locked_at < %s",
            (cutoff_time,)
        )
        
        # Clean up expired password locks
        db.execute_update(
            "DELETE FROM password_locks WHERE locked_at < %s",
            (cutoff_time,)
        )
        
        # Clean up expired file locks
        db.execute_update(
            "DELETE FROM file_locks WHERE locked_at < %s",
            (cutoff_time,)
        )
        
        # Clean up expired schema locks
        db.execute_update(
            "DELETE FROM schema_locks WHERE locked_at < %s",
            (cutoff_time,)
        )
    except Exception:
        # Ignore errors in cleanup to avoid breaking disconnection
        pass

@sio.event
async def request_tree(sid):
    """Client requests full tree"""
    tree = build_tree()
    await sio.emit('tree_updated', {'tree': tree}, room=sid)

@sio.event
async def document_editing(sid, data):
    """Broadcast that user is editing"""
    await sio.emit('user_editing', {
        'document_id': data.get('document_id'),
        'user_name': data.get('user_name')
    }, skip_sid=sid)

@sio.event
async def document_content_updated(sid, data):
    """Relay content-updated event from a client to all others"""
    try:
        await sio.emit('document_content_updated', {
            'document_id': data.get('document_id'),
            'name': data.get('name'),
        }, skip_sid=sid)
    except Exception:
        pass

# ===== Task Management WebSocket Events =====

@sio.event
async def task_updated(sid, data):
    """Broadcast task update to all clients"""
    await sio.emit('task_updated', data, skip_sid=sid)

@sio.event
async def task_status_changed(sid, data):
    """Broadcast task status change to all clients"""
    await sio.emit('task_status_changed', data, skip_sid=sid)

@sio.event
async def task_comment_added(sid, data):
    """Broadcast new comment to all clients"""
    await sio.emit('task_comment_added', data, skip_sid=sid)

@sio.event
async def task_assigned(sid, data):
    """Broadcast task assignment to all clients"""
    await sio.emit('task_assigned', data, skip_sid=sid)

@sio.event
async def task_moved(sid, data):
    """Broadcast task move to all clients"""
    await sio.emit('task_moved', data, skip_sid=sid)

# ===== Admin Tags Endpoints =====

@app.get("/api/admin/tags")
async def get_all_tags(request: Request, user: Dict = Depends(get_current_user)):
    """Get all tags (admin only)"""
    try:
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can view all tags")
        
        query = "SELECT id, name, created_at FROM tags ORDER BY name"
        tags = db.execute_query(query)
        
        # Serialize timestamps
        for tag in tags:
            if tag.get('created_at'):
                tag['created_at'] = tag['created_at'].isoformat()
        
        return {"success": True, "tags": tags}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/users")
async def list_admin_users(request: Request, user: Dict = Depends(get_current_user), role: Optional[str] = None):
    """List users by role. Defaults to admins if role not specified."""
    try:
        # Anyone authenticated can query admins list (read-only)
        if role and role not in ['admin', 'write', 'read']:
            raise HTTPException(status_code=400, detail="Invalid role filter")
        if not role:
            role = 'admin'
        query = "SELECT id, username, email FROM users WHERE role = %s ORDER BY username"
        rows = db.execute_query(query, (role,))
        return {"success": True, "users": [dict(r) for r in rows]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/tags")
async def create_tag(request: Request, payload: Dict[str, str], user: Dict = Depends(get_current_user)):
    """Create a new tag (admin only)"""
    try:
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can create tags")
        
        tag_name = payload.get('name', '').strip()
        if not tag_name:
            raise HTTPException(status_code=400, detail="Tag name cannot be empty")
        
        # Check if tag already exists
        existing = db.execute_query(
            "SELECT id FROM tags WHERE LOWER(name) = LOWER(%s)",
            (tag_name,)
        )
        if existing:
            raise HTTPException(status_code=400, detail="Tag already exists")
        
        tag_id = str(uuid.uuid4())
        db.execute_update(
            "INSERT INTO tags (id, name) VALUES (%s, %s)",
            (tag_id, tag_name)
        )
        
        return {"success": True, "id": tag_id, "message": "Tag created"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/tags/{tag_id}")
async def update_tag(tag_id: str, request: Request, payload: Dict[str, str], user: Dict = Depends(get_current_user)):
    """Update a tag (admin only)"""
    try:
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can update tags")
        
        tag_name = payload.get('name', '').strip()
        if not tag_name:
            raise HTTPException(status_code=400, detail="Tag name cannot be empty")
        
        # Check if tag exists
        existing = db.execute_query("SELECT id FROM tags WHERE id = %s", (tag_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        # Check if another tag with the same name exists
        duplicate = db.execute_query(
            "SELECT id FROM tags WHERE LOWER(name) = LOWER(%s) AND id != %s",
            (tag_name, tag_id)
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="A tag with this name already exists")
        
        db.execute_update(
            "UPDATE tags SET name = %s WHERE id = %s",
            (tag_name, tag_id)
        )
        
        return {"success": True, "message": "Tag updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/tags/{tag_id}")
async def delete_tag(tag_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Delete a tag (admin only) - will cascade to all links"""
    try:
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can delete tags")
        
        # Check if tag exists
        existing = db.execute_query("SELECT id, name FROM tags WHERE id = %s", (tag_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        # Delete tag (cascade will remove all links)
        db.execute_update("DELETE FROM tags WHERE id = %s", (tag_id,))
        
        return {"success": True, "message": "Tag deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Static Files =====
# Mount at the end to avoid conflicts with API routes
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ===== Run Server =====

if __name__ == "__main__":
    port = int(os.getenv('API_PORT', 8000))
    uvicorn.run(
        socket_app,
        host="127.0.0.1",
        port=port,
        log_level="info"
    )