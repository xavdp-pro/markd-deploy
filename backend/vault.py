from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, Dict
from database import db
from encryption_service import encryption
import uuid
import json

router = APIRouter()

# Import get_current_user from main
from main import get_current_user

class PasswordCreate(BaseModel):
    workspace_id: str
    title: str
    username: Optional[str] = None
    password: str
    url: Optional[str] = None
    notes: Optional[str] = None

class PasswordUpdate(BaseModel):
    title: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None

# Helper: Check workspace permission (same logic as documents)
def get_workspace_permission(user_id: int, workspace_id: str) -> str:
    """Get user permission for workspace"""
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

# CREATE
@router.post("/api/vault/passwords")
async def create_password(data: PasswordCreate, current_user: Dict = Depends(get_current_user)):
    """Create password (requires write or admin)"""
    user_id = current_user['id']
    permission = get_workspace_permission(user_id, data.workspace_id)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    password_id = str(uuid.uuid4())
    encrypted_password = encryption.encrypt(data.password)
    
    query = """
        INSERT INTO password_vault 
        (id, workspace_id, title, username, password_encrypted, url, notes, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        password_id, data.workspace_id, data.title, data.username,
        encrypted_password, data.url, data.notes, user_id
    ))
    
    return {"success": True, "id": password_id}

# LIST
@router.get("/api/vault/passwords")
async def list_passwords(workspace_id: str, current_user: Dict = Depends(get_current_user)):
    """List passwords (requires read, write or admin)"""
    user_id = current_user['id']
    permission = get_workspace_permission(user_id, workspace_id)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = """
        SELECT id, title, username, url, created_at, updated_at
        FROM password_vault
        WHERE workspace_id = %s
        ORDER BY title
    """
    passwords = db.execute_query(query, (workspace_id,))
    
    return {"success": True, "passwords": passwords}

# GET (with decrypted password)
@router.get("/api/vault/passwords/{password_id}")
async def get_password(password_id: str, current_user: Dict = Depends(get_current_user)):
    """Get password with decrypted value (requires read, write or admin)"""
    user_id = current_user['id']
    
    # Get password and check permission
    query = """
        SELECT pv.*
        FROM password_vault pv
        WHERE pv.id = %s
    """
    result = db.execute_query(query, (password_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="Password not found")
    
    password = result[0]
    permission = get_workspace_permission(user_id, password['workspace_id'])
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Decrypt password
    password['password'] = encryption.decrypt(password['password_encrypted'])
    del password['password_encrypted']
    
    return {"success": True, "password": password}

# UPDATE
@router.put("/api/vault/passwords/{password_id}")
async def update_password(password_id: str, data: PasswordUpdate, current_user: Dict = Depends(get_current_user)):
    """Update password (requires write or admin)"""
    user_id = current_user['id']
    
    # Get workspace_id
    query = "SELECT workspace_id FROM password_vault WHERE id = %s"
    result = db.execute_query(query, (password_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="Password not found")
    
    workspace_id = result[0]['workspace_id']
    permission = get_workspace_permission(user_id, workspace_id)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Build update query
    updates = []
    params = []
    
    if data.title is not None:
        updates.append("title = %s")
        params.append(data.title)
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
    permission = get_workspace_permission(user_id, workspace_id)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write or admin permission required")
    
    db.execute_update("DELETE FROM password_vault WHERE id = %s", (password_id,))
    
    return {"success": True}
