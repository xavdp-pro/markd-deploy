from fastapi import APIRouter, HTTPException, Request, Depends, Query, Request as RequestType
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from database import db
from encryption_service import encryption
from websocket_broadcasts import broadcast_vault_tree_update, broadcast_vault_item_updated
import uuid
import json

router = APIRouter()

# Import get_current_user from auth
from auth import get_current_user

# Password tags helper functions
def fetch_password_tags(password_id: str) -> List[Dict[str, Any]]:
    """Fetch tags for a password"""
    query = """
        SELECT t.id, t.name
        FROM password_tag_links ptl
        JOIN tags t ON ptl.tag_id = t.id
        WHERE ptl.password_id = %s
        ORDER BY t.name
    """
    results = db.execute_query(query, (password_id,))
    return [dict(row) for row in results]

def upsert_password_tag(name: str) -> Dict[str, Any]:
    """Create or get password tag (uses unified tags table)"""
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

def update_password_tags(password_id: str, tag_names: List[str]) -> List[Dict[str, Any]]:
    """Update tags for a password"""
    current_tags = fetch_password_tags(password_id)
    normalized = normalize_tag_names(tag_names)
    desired_tags: List[Dict[str, Any]] = [upsert_password_tag(name) for name in normalized]

    current_ids = {tag['id'] for tag in current_tags}
    desired_ids = {tag['id'] for tag in desired_tags}

    # Remove links no longer needed
    to_remove = list(current_ids - desired_ids)
    if to_remove:
        placeholders = ','.join(['%s'] * len(to_remove))
        params = tuple([password_id, *to_remove])
        db.execute_update(
            f"DELETE FROM password_tag_links WHERE password_id = %s AND tag_id IN ({placeholders})",
            params
        )

    # Insert new links
    for tag in desired_tags:
        if tag['id'] not in current_ids:
            db.execute_update(
                "INSERT INTO password_tag_links (password_id, tag_id) VALUES (%s, %s)",
                (password_id, tag['id'])
            )

    return desired_tags

def build_password_tree(parent_id: Optional[str] = None, workspace_id: str = 'demo', depth: int = 0) -> List[Dict]:
    """Build password vault tree recursively with depth limit"""
    # Prevent infinite recursion
    if depth > 20:
        return []
    
    # For root level, get all passwords/folders with parent_id = NULL in the specified workspace
    # Order: folders first (type='folder'), then files (type='password')
    if parent_id is None:
        query = """
            SELECT id, title as name, type, parent_id, username, url, notes, created_at, updated_at, workspace_id
            FROM password_vault
            WHERE parent_id IS NULL AND workspace_id = %s
            ORDER BY CASE WHEN type = 'folder' THEN 0 ELSE 1 END, title ASC
        """
        params = (workspace_id,)
    else:
        query = """
            SELECT id, title as name, type, parent_id, username, url, notes, created_at, updated_at, workspace_id
            FROM password_vault
            WHERE parent_id = %s AND workspace_id = %s
            ORDER BY CASE WHEN type = 'folder' THEN 0 ELSE 1 END, title ASC
        """
        params = (parent_id, workspace_id)
    
    items = db.execute_query(query, params)
    
    result = []
    for item in items:
        item_dict = dict(item)
        
        # Convert datetime objects to ISO format strings
        if item_dict.get('created_at'):
            item_dict['created_at'] = item_dict['created_at'].isoformat()
        if item_dict.get('updated_at'):
            item_dict['updated_at'] = item_dict['updated_at'].isoformat()
        
        # If folder, get children recursively with depth tracking
        if item_dict.get('type') == 'folder':
            item_dict['children'] = build_password_tree(item['id'], workspace_id, depth + 1)
        
        result.append(item_dict)
    
    return result

class PasswordCreate(BaseModel):
    workspace_id: str
    title: str
    username: Optional[str] = None
    password: Optional[str] = None  # Optional for folders
    url: Optional[str] = None
    notes: Optional[str] = None
    parent_id: Optional[str] = None
    type: Optional[str] = 'password'  # 'password' or 'folder'

class PasswordUpdate(BaseModel):
    title: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    parent_id: Optional[str] = None

# Helper: Check workspace permission (same logic as documents)
def get_workspace_permission(user_id: int, workspace_id: str, user_role: str = None) -> str:
    """Get user permission for workspace. Admins always have 'admin' permission."""
    # Check if user is admin (if role is provided)
    if user_role == 'admin':
        return 'admin'
    
    # Also check in database if role not provided
    user_query = "SELECT role FROM users WHERE id = %s"
    user_result = db.execute_query(user_query, (user_id,))
    if user_result and user_result[0].get('role') == 'admin':
        return 'admin'
    
    # Get permission from groups
    query = """
        SELECT COALESCE(MAX(
            CASE gwp.permission_level
                WHEN 'admin' THEN 3
                WHEN 'write' THEN 2
                WHEN 'read' THEN 1
                ELSE 0
            END
        ), 0) as max_level
        FROM user_groups ug
        LEFT JOIN group_workspace_permissions gwp 
            ON ug.group_id = gwp.group_id AND gwp.workspace_id = %s
        WHERE ug.user_id = %s
    """
    result = db.execute_query(query, (workspace_id, user_id))
    level = result[0]['max_level'] if result else 0
    
    if level >= 3: return 'admin'
    if level >= 2: return 'write'
    if level >= 1: return 'read'
    return 'none'

# GET TREE
@router.get("/api/vault/tree")
async def get_password_tree(workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Get password vault tree for a workspace (requires read permission)"""
    try:
        user_id = current_user['id']
        user_role = current_user.get('role')
        permission = get_workspace_permission(user_id, workspace_id, user_role)
        
        if permission == 'none':
            raise HTTPException(status_code=403, detail="Access denied")
        
        tree = build_password_tree(None, workspace_id)
        
        # Get workspace info
        ws_query = "SELECT name FROM workspaces WHERE id = %s"
        ws = db.execute_query(ws_query, (workspace_id,))
        workspace_name = ws[0]['name'] if ws else 'Passwords'
        
        return {"success": True, "tree": tree or [], "workspace_name": workspace_name}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# CREATE
@router.post("/api/vault/passwords")
async def create_password(data: PasswordCreate, current_user: Dict = Depends(get_current_user)):
    """Create password or folder (requires write or admin)"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission(user_id, data.workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    password_id = str(uuid.uuid4())
    item_type = data.type or 'password'
    
    # For folders, password and username are not required
    if item_type == 'folder':
        encrypted_password = ''
        username = data.username or ''
    else:
        # For passwords, username and password are required
        if not data.username or not data.username.strip():
            raise HTTPException(status_code=400, detail="Username is required for password items")
        if not data.password or not data.password.strip():
            raise HTTPException(status_code=400, detail="Password is required for password items")
        # Encrypt password
        encrypted_password = encryption.encrypt(data.password)
        username = data.username
    
    query = """
        INSERT INTO password_vault 
        (id, workspace_id, parent_id, type, title, username, password_encrypted, url, notes, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        password_id, data.workspace_id, data.parent_id, item_type, data.title, username,
        encrypted_password, data.url, data.notes, user_id
    ))
    
    # Broadcast tree update to all clients
    await broadcast_vault_tree_update()
    
    return {"success": True, "id": password_id}

# LIST (kept for backward compatibility, but tree endpoint is preferred)
@router.get("/api/vault/passwords")
async def list_passwords(workspace_id: str, current_user: Dict = Depends(get_current_user)):
    """List passwords (requires read, write or admin) - DEPRECATED: use /api/vault/tree instead"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission(user_id, workspace_id, user_role)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = """
        SELECT id, title, username, url, created_at, updated_at, type, parent_id
        FROM password_vault
        WHERE workspace_id = %s
        ORDER BY type DESC, title ASC
    """
    passwords = db.execute_query(query, (workspace_id,))
    
    return {"success": True, "passwords": passwords}

# GET (with decrypted password)
@router.get("/api/vault/passwords/{password_id}")
async def get_password(password_id: str, current_user: Dict = Depends(get_current_user)):
    """Get password with decrypted value (requires read, write or admin)"""
    user_id = current_user['id']
    
    # Get password and check permission
    # Use title as name to be consistent with build_password_tree
    query = """
        SELECT id, title as name, type, parent_id, username, url, notes, 
               created_at, updated_at, workspace_id, password_encrypted, created_by
        FROM password_vault
        WHERE id = %s
    """
    result = db.execute_query(query, (password_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="Password not found")
    
    password = dict(result[0])
    user_role = current_user.get('role')
    permission = get_workspace_permission(user_id, password['workspace_id'], user_role)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Decrypt password
    password['password'] = encryption.decrypt(password['password_encrypted'])
    del password['password_encrypted']
    
    # Convert datetime objects to ISO format strings
    if password.get('created_at'):
        password['created_at'] = password['created_at'].isoformat()
    if password.get('updated_at'):
        password['updated_at'] = password['updated_at'].isoformat()
    
    return {"success": True, "password": password}

# UPDATE
@router.put("/api/vault/passwords/{password_id}")
async def update_password(password_id: str, data: PasswordUpdate, current_user: Dict = Depends(get_current_user), request: RequestType = None):
    """Update password (requires write or admin)"""
    user_id = current_user['id']
    
    # Get raw JSON body to check if parent_id was explicitly provided (even if None)
    parent_id_provided = False
    if request:
        try:
            body = await request.body()
            if body:
                import json
                raw_data = json.loads(body)
                parent_id_provided = 'parent_id' in raw_data
        except Exception:
            pass
    
    # Get workspace_id
    query = "SELECT workspace_id FROM password_vault WHERE id = %s"
    result = db.execute_query(query, (password_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="Password not found")
    
    workspace_id = result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Get current item type
    type_query = "SELECT type, username FROM password_vault WHERE id = %s"
    type_result = db.execute_query(type_query, (password_id,))
    if not type_result:
        raise HTTPException(status_code=404, detail="Password not found")
    
    item_type = type_result[0].get('type', 'password')
    current_username = type_result[0].get('username', '')
    
    # Build update query
    updates = []
    params = []
    
    if data.title is not None:
        updates.append("title = %s")
        params.append(data.title)
    
    # Handle parent_id - allow None to move to root
    # parent_id_provided is set from raw JSON body check above
    if parent_id_provided:
        if data.parent_id is not None:
            updates.append("parent_id = %s")
            params.append(data.parent_id)
        else:
            # parent_id was explicitly set to None (move to root)
            updates.append("parent_id = NULL")
    
    # For password items, validate username and password only if they are being updated
    if item_type == 'password':
        # Username validation - only if being updated
        if data.username is not None:
            if not data.username.strip():
                raise HTTPException(status_code=400, detail="Username is required for password items")
            updates.append("username = %s")
            params.append(data.username)
        
        # Password validation - only if being updated (don't require it for move operations)
        if data.password is not None:
            if not data.password.strip():
                raise HTTPException(status_code=400, detail="Password is required for password items")
            encrypted = encryption.encrypt(data.password)
            updates.append("password_encrypted = %s")
            params.append(encrypted)
    else:
        # For folders, username and password are optional
        if data.username is not None:
            updates.append("username = %s")
            params.append(data.username)
        if data.password is not None:
            encrypted = encryption.encrypt(data.password)
            updates.append("password_encrypted = %s")
            params.append(encrypted)
    
    if data.url is not None:
        updates.append("url = %s")
        params.append(data.url)
    if data.notes is not None:
        updates.append("notes = %s")
        params.append(data.notes)
    
    if not updates:
        return {"success": True, "message": "Nothing to update"}
    
    params.append(password_id)
    update_query = f"""
        UPDATE password_vault 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    db.execute_update(update_query, tuple(params))
    
    # Broadcast tree update to all clients
    await broadcast_vault_tree_update()
    
    return {"success": True}

# DELETE
@router.delete("/api/vault/passwords/{password_id}")
async def delete_password(password_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete password (requires write or admin permission)"""
    user_id = current_user['id']
    
    # Get workspace_id
    query = "SELECT workspace_id FROM password_vault WHERE id = %s"
    result = db.execute_query(query, (password_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="Password not found")
    
    workspace_id = result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write or admin permission required")
    
    db.execute_update("DELETE FROM password_vault WHERE id = %s", (password_id,))
    
    # Broadcast tree update to all clients
    await broadcast_vault_tree_update()
    
    return {"success": True}

# RENAME
@router.patch("/api/vault/passwords/{password_id}/rename")
async def rename_password(password_id: str, new_name: str = Query(...), current_user: Dict = Depends(get_current_user)):
    """Rename password or folder (requires write or admin permission)"""
    user_id = current_user['id']
    
    # Get workspace_id
    query = "SELECT workspace_id FROM password_vault WHERE id = %s"
    result = db.execute_query(query, (password_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="Password not found")
    
    workspace_id = result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write or admin permission required")
    
    db.execute_update("UPDATE password_vault SET title = %s WHERE id = %s", (new_name, password_id))
    
    # Broadcast tree update to all clients
    await broadcast_vault_tree_update()
    
    return {"success": True}

# ===== Password Tags Endpoints =====

class TagsUpdate(BaseModel):
    tags: List[str] = []

@router.get("/api/vault/passwords/{password_id}/tags")
async def get_password_tags(password_id: str, current_user: Dict = Depends(get_current_user)):
    """Get tags for a password"""
    try:
        tags = fetch_password_tags(password_id)
        return {"success": True, "tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/vault/passwords/{password_id}/tags")
async def update_password_tags_endpoint(password_id: str, payload: TagsUpdate, current_user: Dict = Depends(get_current_user)):
    """Update tags for a password"""
    try:
        # Check if password exists and get workspace
        check_query = "SELECT workspace_id FROM password_vault WHERE id = %s"
        existing = db.execute_query(check_query, (password_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Password not found")
        
        workspace_id = existing[0]['workspace_id']
        user_role = current_user.get('role')
        permission = get_workspace_permission(current_user['id'], workspace_id, user_role)
        
        if permission not in ['write', 'admin']:
            raise HTTPException(status_code=403, detail="Write permission required")
        
        tags = update_password_tags(password_id, payload.tags)
        
        # Broadcast tree update to all clients (tags affect display)
        await broadcast_vault_tree_update()
        
        return {"success": True, "tags": tags}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/vault/passwords/tags/suggestions")
async def get_password_tag_suggestions(query: str = "", limit: int = 20, current_user: Dict = Depends(get_current_user)):
    """Get tag suggestions for passwords"""
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
