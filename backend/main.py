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
from datetime import datetime
from database import db
import sys
import shutil
from pathlib import Path
import jwt

# Increase recursion limit to prevent RecursionError
sys.setrecursionlimit(10000)

load_dotenv()

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

# Include tasks router
from tasks import router as tasks_router
app.include_router(tasks_router)

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Wrap FastAPI with Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# ===== Upload Configuration =====

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ===== Pydantic Models =====

class DocumentBase(BaseModel):
    name: str
    type: str  # 'file' or 'folder'
    parent_id: Optional[str] = None
    content: Optional[str] = None
    workspace_id: str = 'default'

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

def build_tree(parent_id: Optional[str] = 'root', workspace_id: str = 'default', depth: int = 0) -> List[Dict]:
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
        lock_query = "SELECT user_id, user_name FROM document_locks WHERE document_id = %s"
        locks = db.execute_query(lock_query, (doc['id'],))
        doc_dict['locked_by'] = locks[0] if locks else None
        
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

# ===== REST API Endpoints =====

@app.get("/")
async def root():
    return {"message": "MarkD Documentation Manager API", "version": "1.0.0"}

# ===== Workspace Endpoints =====

@app.get("/api/workspaces")
async def get_workspaces(request: Request, user: Dict = Depends(get_current_user)):
    """Get all workspaces accessible by the user"""
    try:
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
                    perm_level = await check_workspace_permission(ws['id'], user, 'read')
                    ws['user_permission'] = perm_level
                except:
                    ws['user_permission'] = 'read'  # Default to read if no explicit permission
        
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
        if workspace_id == 'default':
            raise HTTPException(status_code=400, detail="Cannot delete default workspace")
        
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
async def get_tree(workspace_id: str = 'default', request: Request = None, user: Dict = Depends(get_current_user)):
    """Get full document tree for a workspace (requires read permission)"""
    try:
        print(f"DEBUG: Checking permission for user {user.get('id')} on workspace {workspace_id}")
        await check_workspace_permission(workspace_id, user, 'read')
        print(f"DEBUG: Permission OK, building tree")
        tree = build_tree('root', workspace_id)
        print(f"DEBUG: Tree built, getting workspace info")
        
        # Get workspace info
        ws_query = "SELECT name FROM workspaces WHERE id = %s"
        ws = db.execute_query(ws_query, (workspace_id,))
        workspace_name = ws[0]['name'] if ws else 'Documents'
        
        return {"success": True, "tree": tree, "workspace_name": workspace_name}
    except Exception as e:
        print(f"DEBUG ERROR: {type(e).__name__}: {str(e)}")
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
        lock_query = "SELECT user_id, user_name FROM document_locks WHERE document_id = %s"
        locks = db.execute_query(lock_query, (document_id,))
        doc['locked_by'] = locks[0] if locks else None
        
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
        
        await broadcast_tree_update()
        
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
        check_query = "SELECT user_id, user_name FROM document_locks WHERE document_id = %s"
        existing = db.execute_query(check_query, (document_id,))
        
        if existing:
            return {
                "success": False,
                "message": "Document already locked",
                "locked_by": existing[0]
            }
        
        # Create lock
        query = """
            INSERT INTO document_locks (document_id, user_id, user_name)
            VALUES (%s, %s, %s)
        """
        db.execute_update(query, (document_id, lock_req.user_id, lock_req.user_name))
        
        lock_info = {"user_id": lock_req.user_id, "user_name": lock_req.user_name}
        await broadcast_lock_update(document_id, lock_info)
        
        return {"success": True, "message": "Document locked"}
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
        print(f"Error uploading image: {str(e)}")
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
    print(f"Client connected: {sid}")
    # Send current tree to new client
    tree = build_tree()
    await sio.emit('tree_updated', {'tree': tree}, room=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    print(f"Client disconnected: {sid}")
    # TODO: Release any locks held by this client

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