from fastapi import APIRouter, HTTPException, Depends, Query, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from database import db
from websocket_broadcasts import broadcast_file_tree_update, broadcast_file_lock_update, broadcast_file_content_updated
import uuid
import os
import hashlib
import shutil
from pathlib import Path
from datetime import datetime, timedelta
import mimetypes

router = APIRouter()

# Constants
LOCK_TIMEOUT_MINUTES = 30
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
FILES_UPLOAD_DIR = Path("uploads/files")

# Create upload directory if it doesn't exist
FILES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Import get_current_user from auth
from auth import get_current_user

# Note: check_workspace_permission is async, but we need sync version
# We'll use get_workspace_permission_sync defined below

# ===== Helper Functions =====

def get_workspace_permission_sync(user_id: int, workspace_id: str, user_role: str = None) -> str:
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

def build_files_tree(parent_id: Optional[str] = None, workspace_id: str = 'demo', depth: int = 0) -> List[Dict]:
    """Build files tree recursively with depth limit"""
    # Prevent infinite recursion
    if depth > 20:
        return []
    
    # For root level, get all files/folders with parent_id = NULL in the specified workspace
    # Order: folders first (type='folder'), then files (type='file')
    if parent_id is None:
        query = """
            SELECT f.id, f.name, f.type, f.parent_id, f.original_name, f.file_path, 
                   f.mime_type, f.file_size, f.file_hash, f.created_at, f.updated_at, f.workspace_id,
                   fl.user_id as locked_user_id, fl.user_name as locked_user_name, fl.locked_at as locked_at
            FROM files f
            LEFT JOIN file_locks fl ON f.id = fl.file_id
            WHERE f.parent_id IS NULL AND f.workspace_id = %s
            ORDER BY CASE WHEN f.type = 'folder' THEN 0 ELSE 1 END, f.name ASC
        """
        params = (workspace_id,)
    else:
        query = """
            SELECT f.id, f.name, f.type, f.parent_id, f.original_name, f.file_path, 
                   f.mime_type, f.file_size, f.file_hash, f.created_at, f.updated_at, f.workspace_id,
                   fl.user_id as locked_user_id, fl.user_name as locked_user_name, fl.locked_at as locked_at
            FROM files f
            LEFT JOIN file_locks fl ON f.id = fl.file_id
            WHERE f.parent_id = %s AND f.workspace_id = %s
            ORDER BY CASE WHEN f.type = 'folder' THEN 0 ELSE 1 END, f.name ASC
        """
        params = (parent_id, workspace_id)
    
    items = db.execute_query(query, params)
    
    result = []
    for item in items:
        item_dict = dict(item)
        
        # Format lock info
        if item_dict.get('locked_user_id'):
            # Check if lock is expired
            locked_at = item_dict.get('locked_at')
            if locked_at and (datetime.now() - locked_at) > timedelta(minutes=LOCK_TIMEOUT_MINUTES):
                # Lock expired, ignore it
                item_dict['locked_by'] = None
            else:
                item_dict['locked_by'] = {
                    'user_id': str(item_dict['locked_user_id']),
                    'user_name': item_dict['locked_user_name'],
                    'locked_at': locked_at.isoformat() if locked_at else None
                }
        else:
            item_dict['locked_by'] = None
            
        # Remove flattened columns
        item_dict.pop('locked_user_id', None)
        item_dict.pop('locked_user_name', None)
        item_dict.pop('locked_at', None)

        # Convert datetime objects to ISO format strings
        if item_dict.get('created_at'):
            item_dict['created_at'] = item_dict['created_at'].isoformat()
        if item_dict.get('updated_at'):
            item_dict['updated_at'] = item_dict['updated_at'].isoformat()
        
        # If folder, get children recursively with depth tracking
        if item_dict.get('type') == 'folder':
            item_dict['children'] = build_files_tree(item['id'], workspace_id, depth + 1)
        
        result.append(item_dict)
    
    return result

def log_file_activity(user_id: int, workspace_id: str, file_id: str, action: str, item_path: str, item_name: str):
    """Log file activity"""
    activity_id = str(uuid.uuid4())
    query = """
        INSERT INTO file_activity_log (id, user_id, workspace_id, file_id, action, item_path, item_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (activity_id, user_id, workspace_id, file_id, action, item_path, item_name))

def fetch_file_tags(file_id: str) -> List[Dict[str, Any]]:
    """Fetch tags for a file"""
    query = """
        SELECT t.id, t.name
        FROM file_tag_links ftl
        JOIN tags t ON ftl.tag_id = t.id
        WHERE ftl.file_id = %s
        ORDER BY t.name
    """
    results = db.execute_query(query, (file_id,))
    return [dict(row) for row in results]

def upsert_file_tag(name: str) -> Dict[str, Any]:
    """Create or get file tag (uses unified tags table)"""
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

def update_file_tags(file_id: str, tag_names: List[str]) -> List[Dict[str, Any]]:
    """Update tags for a file"""
    current_tags = fetch_file_tags(file_id)
    normalized = normalize_tag_names(tag_names)
    desired_tags: List[Dict[str, Any]] = [upsert_file_tag(name) for name in normalized]

    current_ids = {tag['id'] for tag in current_tags}
    desired_ids = {tag['id'] for tag in desired_tags}

    # Remove links no longer needed
    to_remove = list(current_ids - desired_ids)
    if to_remove:
        placeholders = ','.join(['%s'] * len(to_remove))
        params = tuple([file_id, *to_remove])
        db.execute_update(
            f"DELETE FROM file_tag_links WHERE file_id = %s AND tag_id IN ({placeholders})",
            params
        )

    # Insert new links
    for tag in desired_tags:
        if tag['id'] not in current_ids:
            db.execute_update(
                "INSERT INTO file_tag_links (file_id, tag_id) VALUES (%s, %s)",
                (file_id, tag['id'])
            )

    return desired_tags

def calculate_file_hash(file_path: Path) -> str:
    """Calculate SHA-256 hash of a file"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def detect_mime_type(filename: str, content_type: Optional[str] = None) -> str:
    """Detect MIME type from filename and content type"""
    if content_type:
        return content_type
    
    mime_type, _ = mimetypes.guess_type(filename)
    if mime_type:
        return mime_type
    
    return 'application/octet-stream'

def build_file_path(file_id: str, original_name: str) -> Path:
    """Build file path for storage"""
    file_dir = FILES_UPLOAD_DIR / file_id
    file_dir.mkdir(parents=True, exist_ok=True)
    return file_dir / original_name

def get_file_path_from_db(file_id: str) -> Optional[Path]:
    """Get file path from database"""
    query = "SELECT file_path FROM files WHERE id = %s"
    result = db.execute_query(query, (file_id,))
    if not result or not result[0].get('file_path'):
        return None
    return Path(result[0]['file_path'])

# ===== Pydantic Models =====

class FileCreate(BaseModel):
    workspace_id: str
    parent_id: Optional[str] = None
    name: str
    type: str  # 'file' or 'folder'

class FileUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None

class LockRequest(BaseModel):
    user_id: int
    user_name: str

class TagsUpdate(BaseModel):
    tags: List[str] = []

# ===== Endpoints =====

# GET TREE
@router.get("/api/files/tree")
async def get_files_tree(workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Get files tree for a workspace (requires read permission)"""
    try:
        user_id = current_user['id']
        user_role = current_user.get('role')
        permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
        
        if permission == 'none':
            raise HTTPException(status_code=403, detail="Access denied")
        
        tree = build_files_tree(None, workspace_id)
        
        # Get workspace info
        ws_query = "SELECT name FROM workspaces WHERE id = %s"
        ws = db.execute_query(ws_query, (workspace_id,))
        workspace_name = ws[0]['name'] if ws else 'Files'
        
        return {"success": True, "tree": tree or [], "workspace_name": workspace_name}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# CREATE
@router.post("/api/files")
async def create_file(data: FileCreate, current_user: Dict = Depends(get_current_user)):
    """Create file or folder (requires write or admin)"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, data.workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Validate name
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Validate type
    if data.type not in ['file', 'folder']:
        raise HTTPException(status_code=400, detail="Type must be 'file' or 'folder'")
    
    # Validate parent if provided
    if data.parent_id:
        parent_query = "SELECT id, type, workspace_id FROM files WHERE id = %s"
        parent_result = db.execute_query(parent_query, (data.parent_id,))
        if not parent_result:
            raise HTTPException(status_code=404, detail="Parent not found")
        if parent_result[0]['type'] != 'folder':
            raise HTTPException(status_code=400, detail="Parent must be a folder")
        if parent_result[0]['workspace_id'] != data.workspace_id:
            raise HTTPException(status_code=400, detail="Parent must be in the same workspace")
    
    file_id = str(uuid.uuid4())
    original_name = data.name.strip()
    
    query = """
        INSERT INTO files 
        (id, workspace_id, parent_id, type, name, original_name, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        file_id, data.workspace_id, data.parent_id, data.type, original_name, original_name, user_id
    ))
    
    # Build item path for activity log
    item_path = original_name
    if data.parent_id:
        # Could build full path, but for now just use name
        item_path = original_name
    
    # Log activity
    log_file_activity(user_id, data.workspace_id, file_id, 'create', item_path, original_name)
    
    # Broadcast tree update to all clients
    await broadcast_file_tree_update()
    
    # Get created file
    get_query = """
        SELECT id, name, type, parent_id, original_name, file_path, mime_type, 
               file_size, file_hash, created_at, updated_at, workspace_id
        FROM files WHERE id = %s
    """
    file_result = db.execute_query(get_query, (file_id,))
    file_item = dict(file_result[0]) if file_result else {}
    
    # Convert datetime objects
    if file_item.get('created_at'):
        file_item['created_at'] = file_item['created_at'].isoformat()
    if file_item.get('updated_at'):
        file_item['updated_at'] = file_item['updated_at'].isoformat()
    
    return {"success": True, "file": file_item}

# GET
@router.get("/api/files/{file_id}")
async def get_file(file_id: str, current_user: Dict = Depends(get_current_user)):
    """Get file details (requires read permission)"""
    try:
        query = """
            SELECT id, name, type, parent_id, original_name, file_path, mime_type, 
                   file_size, file_hash, created_at, updated_at, workspace_id, created_by
            FROM files WHERE id = %s
        """
        result = db.execute_query(query, (file_id,))
        
        if not result:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_item = dict(result[0])
        user_id = current_user['id']
        user_role = current_user.get('role')
        permission = get_workspace_permission_sync(user_id, file_item['workspace_id'], user_role)
        
        if permission == 'none':
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Convert datetime objects
        if file_item.get('created_at'):
            file_item['created_at'] = file_item['created_at'].isoformat()
        if file_item.get('updated_at'):
            file_item['updated_at'] = file_item['updated_at'].isoformat()
        
        # Add URLs
        file_item['download_url'] = f"/api/files/{file_id}/download"
        file_item['content_url'] = f"/api/files/{file_id}/content"
        
        return {"success": True, "file": file_item}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# UPDATE
@router.put("/api/files/{file_id}")
async def update_file(file_id: str, data: FileUpdate, current_user: Dict = Depends(get_current_user)):
    """Update file (rename or move) (requires write or admin)"""
    user_id = current_user['id']
    
    # Get current file
    get_query = "SELECT workspace_id, type, name FROM files WHERE id = %s"
    file_result = db.execute_query(get_query, (file_id,))
    
    if not file_result:
        raise HTTPException(status_code=404, detail="File not found")
    
    workspace_id = file_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Build update query
    updates = []
    params = []
    action = None
    
    if data.name is not None:
        if not data.name.strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        updates.append("name = %s")
        updates.append("original_name = %s")
        params.append(data.name.strip())
        params.append(data.name.strip())
        action = 'rename'
    
    if data.parent_id is not None:
        # Validate parent
        if data.parent_id:
            parent_query = "SELECT id, type, workspace_id FROM files WHERE id = %s"
            parent_result = db.execute_query(parent_query, (data.parent_id,))
            if not parent_result:
                raise HTTPException(status_code=404, detail="Parent not found")
            if parent_result[0]['type'] != 'folder':
                raise HTTPException(status_code=400, detail="Parent must be a folder")
            if parent_result[0]['workspace_id'] != workspace_id:
                raise HTTPException(status_code=400, detail="Parent must be in the same workspace")
        
        updates.append("parent_id = %s")
        params.append(data.parent_id)
        if action != 'rename':
            action = 'move'
    
    if not updates:
        return {"success": True, "message": "No changes"}
    
    params.append(file_id)
    update_query = f"""
        UPDATE files 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    db.execute_update(update_query, tuple(params))
    
    # Log activity
    if action:
        log_file_activity(user_id, workspace_id, file_id, action, file_result[0]['name'], data.name or file_result[0]['name'])
    
    # Broadcast tree update
    await broadcast_file_tree_update()
    
    return {"success": True, "message": f"File {action} successful"}

# DELETE
@router.delete("/api/files/{file_id}")
async def delete_file(file_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete file or folder (recursive) (requires write or admin)"""
    user_id = current_user['id']
    
    # Get file info
    query = "SELECT id, workspace_id, type, name, file_path FROM files WHERE id = %s"
    result = db.execute_query(query, (file_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_info = result[0]
    workspace_id = file_info['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Get file path for deletion
    file_path = file_info.get('file_path')
    
    # Delete from database (CASCADE will handle children)
    db.execute_update("DELETE FROM files WHERE id = %s", (file_id,))
    
    # Delete physical file if exists
    if file_path:
        physical_path = Path(file_path)
        if physical_path.exists() and physical_path.is_file():
            try:
                physical_path.unlink()
                # Also try to remove parent directory if empty
                parent_dir = physical_path.parent
                if parent_dir.exists() and not any(parent_dir.iterdir()):
                    parent_dir.rmdir()
            except Exception as e:
                print(f"Warning: Could not delete physical file {physical_path}: {e}")
    
    # Log activity
    log_file_activity(user_id, workspace_id, file_id, 'delete', file_info['name'], file_info['name'])
    
    # Broadcast tree update
    await broadcast_file_tree_update()
    
    return {"success": True, "message": "File deleted successfully"}

# UPLOAD
@router.post("/api/files/{file_id}/upload")
async def upload_file_content(
    file_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Upload file content (requires write or admin)"""
    user_id = current_user['id']
    
    # Get file record
    query = "SELECT id, workspace_id, type, name FROM files WHERE id = %s"
    result = db.execute_query(query, (file_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_record = result[0]
    
    if file_record['type'] != 'file':
        raise HTTPException(status_code=400, detail="Can only upload content to files, not folders")
    
    workspace_id = file_record['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")
    
    # Validate file size
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File size exceeds {MAX_FILE_SIZE / (1024*1024)} MB limit")
    
    # Build file path
    original_name = os.path.basename(file.filename)
    file_path = build_file_path(file_id, original_name)
    
    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)
    
    # Calculate hash
    file_hash = calculate_file_hash(file_path)
    
    # Detect MIME type
    mime_type = detect_mime_type(original_name, file.content_type)
    
    # Update database
    update_query = """
        UPDATE files 
        SET file_path = %s, mime_type = %s, file_size = %s, file_hash = %s, 
            original_name = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    db.execute_update(update_query, (
        str(file_path), mime_type, file_size, file_hash, original_name, file_id
    ))
    
    # Log activity
    log_file_activity(user_id, workspace_id, file_id, 'upload', file_record['name'], original_name)
    
    # Broadcast content update
    await broadcast_file_content_updated(file_id, file_record['name'], user_id)
    
    # Get updated file
    get_query = """
        SELECT id, name, type, parent_id, original_name, file_path, mime_type, 
               file_size, file_hash, created_at, updated_at, workspace_id
        FROM files WHERE id = %s
    """
    file_result = db.execute_query(get_query, (file_id,))
    file_item = dict(file_result[0]) if file_result else {}
    
    # Convert datetime objects
    if file_item.get('created_at'):
        file_item['created_at'] = file_item['created_at'].isoformat()
    if file_item.get('updated_at'):
        file_item['updated_at'] = file_item['updated_at'].isoformat()
    
    return {"success": True, "file": file_item}

# GET CONTENT
@router.get("/api/files/{file_id}/content")
async def get_file_content(file_id: str, current_user: Dict = Depends(get_current_user)):
    """Get file content (requires read permission)"""
    user_id = current_user['id']
    
    # Get file record
    query = "SELECT id, workspace_id, file_path, mime_type, original_name FROM files WHERE id = %s"
    result = db.execute_query(query, (file_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_record = result[0]
    workspace_id = file_record['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_path = file_record.get('file_path')
    if not file_path:
        raise HTTPException(status_code=404, detail="File content not found")
    
    physical_path = Path(file_path)
    if not physical_path.exists():
        raise HTTPException(status_code=404, detail="File content not found")
    
    mime_type = file_record.get('mime_type') or 'application/octet-stream'
    original_name = file_record.get('original_name') or 'file'
    
    return FileResponse(
        path=str(physical_path),
        media_type=mime_type,
        filename=original_name
    )

# DOWNLOAD
@router.get("/api/files/{file_id}/download")
async def download_file(file_id: str, current_user: Dict = Depends(get_current_user)):
    """Download file (requires read permission)"""
    user_id = current_user['id']
    
    # Get file record
    query = "SELECT id, workspace_id, file_path, mime_type, original_name FROM files WHERE id = %s"
    result = db.execute_query(query, (file_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_record = result[0]
    workspace_id = file_record['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_path = file_record.get('file_path')
    if not file_path:
        raise HTTPException(status_code=404, detail="File content not found")
    
    physical_path = Path(file_path)
    if not physical_path.exists():
        raise HTTPException(status_code=404, detail="File content not found")
    
    mime_type = file_record.get('mime_type') or 'application/octet-stream'
    original_name = file_record.get('original_name') or 'file'
    
    return FileResponse(
        path=str(physical_path),
        media_type=mime_type,
        filename=original_name,
        headers={"Content-Disposition": f"attachment; filename={original_name}"}
    )

# ===== Tags Endpoints =====

@router.get("/api/files/{file_id}/tags")
async def get_file_tags(file_id: str, current_user: Dict = Depends(get_current_user)):
    """Get tags for a file"""
    try:
        # Check if file exists and get workspace
        check_query = "SELECT workspace_id FROM files WHERE id = %s"
        existing = db.execute_query(check_query, (file_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")
        
        workspace_id = existing[0]['workspace_id']
        user_role = current_user.get('role')
        permission = get_workspace_permission_sync(current_user['id'], workspace_id, user_role)
        
        if permission == 'none':
            raise HTTPException(status_code=403, detail="Access denied")
        
        tags = fetch_file_tags(file_id)
        return {"success": True, "tags": tags}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/files/{file_id}/tags")
async def update_file_tags_endpoint(file_id: str, payload: TagsUpdate, current_user: Dict = Depends(get_current_user)):
    """Update tags for a file"""
    try:
        # Check if file exists and get workspace
        check_query = "SELECT workspace_id FROM files WHERE id = %s"
        existing = db.execute_query(check_query, (file_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")
        
        workspace_id = existing[0]['workspace_id']
        user_role = current_user.get('role')
        permission = get_workspace_permission_sync(current_user['id'], workspace_id, user_role)
        
        if permission not in ['write', 'admin']:
            raise HTTPException(status_code=403, detail="Write permission required")
        
        tags = update_file_tags(file_id, payload.tags)
        
        # Broadcast tree update (tags affect display)
        await broadcast_file_tree_update()
        
        return {"success": True, "tags": tags}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/files/tags/suggestions")
async def get_file_tag_suggestions(query: str = "", limit: int = 20, current_user: Dict = Depends(get_current_user)):
    """Get tag suggestions for files"""
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

# ===== Lock Management =====

@router.post("/api/files/{file_id}/lock")
async def lock_file(file_id: str, lock_req: LockRequest, current_user: Dict = Depends(get_current_user)):
    """Lock file for editing"""
    try:
        # Check if file exists and get workspace
        check_query = "SELECT workspace_id FROM files WHERE id = %s"
        existing = db.execute_query(check_query, (file_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")
        
        workspace_id = existing[0]['workspace_id']
        user_role = current_user.get('role')
        permission = get_workspace_permission_sync(current_user['id'], workspace_id, user_role)
        
        if permission not in ['write', 'admin']:
            raise HTTPException(status_code=403, detail="Write permission required")
        
        # Check if already locked
        check_lock_query = "SELECT user_id, user_name, locked_at FROM file_locks WHERE file_id = %s"
        existing_lock = db.execute_query(check_lock_query, (file_id,))
        
        if existing_lock:
            locked_at = existing_lock[0]['locked_at']
            # Check if lock is expired
            if locked_at and (datetime.now() - locked_at) > timedelta(minutes=LOCK_TIMEOUT_MINUTES):
                # Lock expired, delete it
                delete_query = "DELETE FROM file_locks WHERE file_id = %s"
                db.execute_update(delete_query, (file_id,))
            elif existing_lock[0]['user_id'] != lock_req.user_id:
                # Valid lock by another user
                return {
                    "success": False,
                    "message": "File already locked",
                    "locked_by": {
                        "user_id": str(existing_lock[0]['user_id']),
                        "user_name": existing_lock[0]['user_name'],
                        "locked_at": existing_lock[0]['locked_at'].isoformat() if existing_lock[0]['locked_at'] else None
                    }
                }
            else:
                # Locked by same user, update timestamp
                update_query = "UPDATE file_locks SET locked_at = NOW() WHERE file_id = %s"
                db.execute_update(update_query, (file_id,))
                lock_info = {
                    "user_id": lock_req.user_id,
                    "user_name": lock_req.user_name,
                    "locked_at": datetime.now().isoformat()
                }
                await broadcast_file_lock_update(file_id, lock_info)
                return {"success": True, "message": "Lock refreshed", "locked_by": lock_info}
        
        # Create lock
        query = """
            INSERT INTO file_locks (file_id, user_id, user_name, locked_at)
            VALUES (%s, %s, %s, NOW())
        """
        db.execute_update(query, (file_id, lock_req.user_id, lock_req.user_name))
        
        lock_info = {
            "user_id": str(lock_req.user_id),
            "user_name": lock_req.user_name,
            "locked_at": datetime.now().isoformat()
        }
        await broadcast_file_lock_update(file_id, lock_info)
        
        return {"success": True, "message": "File locked", "locked_by": lock_info}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/files/{file_id}/lock")
async def unlock_file(file_id: str, user_id: int = Query(...), current_user: Dict = Depends(get_current_user)):
    """Unlock file"""
    try:
        # Check if file exists
        check_query = "SELECT workspace_id FROM files WHERE id = %s"
        existing = db.execute_query(check_query, (file_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Check if lock exists and belongs to user
        check_lock_query = "SELECT user_id FROM file_locks WHERE file_id = %s"
        existing_lock = db.execute_query(check_lock_query, (file_id,))
        
        if not existing_lock:
            return {"success": True, "message": "File not locked"}
        
        if existing_lock[0]['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Lock owned by another user")
        
        # Delete lock
        delete_query = "DELETE FROM file_locks WHERE file_id = %s"
        db.execute_update(delete_query, (file_id,))
        
        await broadcast_file_lock_update(file_id, None)
        
        return {"success": True, "message": "File unlocked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/files/{file_id}/force-unlock")
async def force_unlock_file(file_id: str, current_user: Dict = Depends(get_current_user)):
    """Force unlock file (admin only)"""
    try:
        # Check if user is admin
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Check if file exists
        check_query = "SELECT workspace_id FROM files WHERE id = %s"
        existing = db.execute_query(check_query, (file_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete lock
        delete_query = "DELETE FROM file_locks WHERE file_id = %s"
        db.execute_update(delete_query, (file_id,))
        
        await broadcast_file_lock_update(file_id, None)
        
        return {"success": True, "message": "File force unlocked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

