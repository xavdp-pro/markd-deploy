from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Tuple
from database import db
from websocket_broadcasts import broadcast_task_tree_update, broadcast_task_activity_update, broadcast_task_lock_update
import uuid
import json
from datetime import datetime
from pathlib import Path
import os
import shutil
from auth import get_current_user

# Helper function to check workspace permissions (duplicated from main.py to avoid circular import)
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

TASK_UPLOAD_DIR = Path("uploads/tasks")
TASK_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

TIMELINE_UPLOAD_DIR = Path("uploads/timeline")
TIMELINE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api")

# Pydantic Models
class TaskBase(BaseModel):
    name: str
    type: str  # 'task' or 'folder'
    parent_id: Optional[str] = None
    content: Optional[str] = None
    workspace_id: str = 'demo'
    status: str = 'todo'
    priority: str = 'medium'
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    parent_id: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None

class TaskMove(BaseModel):
    parent_id: str

class LockRequest(BaseModel):
    user_id: str
    user_name: str

class TimelineEntryCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = 'note'

class TimelineEntryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class TaskCommentCreate(BaseModel):
    content: str

class TaskCommentUpdate(BaseModel):
    content: str

class TagsUpdate(BaseModel):
    tags: List[str] = Field(default_factory=list)

class AssigneesUpdate(BaseModel):
    assignee_ids: List[int] = Field(default_factory=list)
    responsible_id: Optional[int] = None

class ChecklistItemCreate(BaseModel):
    text: str

class ChecklistItemUpdate(BaseModel):
    text: Optional[str] = None
    completed: Optional[bool] = None

# Helper function
def build_task_tree(parent_id: Optional[str] = 'root', workspace_id: str = 'demo', depth: int = 0) -> List[Dict]:
    """Build task tree recursively"""
    if depth > 20:
        return []
    
    query = """
        SELECT id, name, type, content, parent_id, status, priority, assigned_to, responsible_user_id, responsible_user_name,
               sort_order, due_date, created_at, updated_at, workspace_id
        FROM tasks
        WHERE parent_id = %s AND id != 'root' AND workspace_id = %s
        ORDER BY type DESC, sort_order ASC, name ASC
        LIMIT 200
    """
    tasks = db.execute_query(query, (parent_id, workspace_id))
    
    result = []
    for task in tasks:
        task_dict = dict(task)
        
        # Convert datetime to ISO format
        if task_dict.get('created_at'):
            task_dict['created_at'] = task_dict['created_at'].isoformat()
        if task_dict.get('updated_at'):
            task_dict['updated_at'] = task_dict['updated_at'].isoformat()
        if task_dict.get('due_date'):
            task_dict['due_date'] = task_dict['due_date'].isoformat()
        if task_dict.get('responsible_user_id') is not None:
            try:
                task_dict['responsible_user_id'] = int(task_dict['responsible_user_id'])
            except (TypeError, ValueError):
                task_dict['responsible_user_id'] = None
        
        # Check lock
        lock_query = "SELECT user_id, user_name FROM task_locks WHERE task_id = %s"
        locks = db.execute_query(lock_query, (task['id'],))
        task_dict['locked_by'] = locks[0] if locks else None
        
        # Get assignees
        assignee_rows = db.execute_query(
            "SELECT user_id, user_name FROM task_assignees WHERE task_id = %s ORDER BY user_name",
            (task['id'],)
        )
        task_dict['assignees'] = [dict(a) for a in assignee_rows] if assignee_rows else []
        
        # Get children
        if task['type'] == 'folder':
            task_dict['children'] = build_task_tree(task['id'], workspace_id, depth + 1)
        
        result.append(task_dict)
    
    return result

def ensure_task_exists(task_id: str) -> Dict:
    """Ensure task exists and return it"""
    query = "SELECT * FROM tasks WHERE id = %s"
    tasks = db.execute_query(query, (task_id,))
    if not tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    task = dict(tasks[0])
    if task.get('responsible_user_id') is not None:
        try:
            task['responsible_user_id'] = int(task['responsible_user_id'])
        except (TypeError, ValueError):
            task['responsible_user_id'] = None
    return task

def log_task_event(
    task_id: str,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    user: Optional[Dict] = None,
) -> str:
    """Insert a task timeline entry"""
    entry_id = str(uuid.uuid4())
    metadata_json = json.dumps(metadata) if metadata else None
    user_id = user.get('id') if user else None
    user_name = user.get('username') if user and user.get('username') else (user.get('email') if user else None)

    query = """
        INSERT INTO task_timeline (id, task_id, event_type, title, description, metadata, user_id, user_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (entry_id, task_id, event_type, title, description, metadata_json, user_id, user_name))
    return entry_id

def serialize_timestamp(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    return value

def serialize_timeline_entry(row: Dict[str, Any]) -> Dict[str, Any]:
    metadata = row.get('metadata')
    if metadata and isinstance(metadata, str):
        try:
            row['metadata'] = json.loads(metadata)
        except json.JSONDecodeError:
            row['metadata'] = None
    row['created_at'] = serialize_timestamp(row.get('created_at'))
    # Fetch attached files for this entry
    entry_id = row.get('id')
    task_id = row.get('task_id')
    if entry_id:
        row['files'] = fetch_timeline_entry_files(entry_id, task_id)
    else:
        row['files'] = []
    return row

def fetch_timeline_entry_files(entry_id: str, task_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch files attached to a timeline entry"""
    try:
        query = """
            SELECT id, timeline_entry_id, task_id, file_name, original_name, content_type, file_size,
                   uploaded_by, uploaded_by_name, uploaded_at
            FROM task_timeline_files
            WHERE timeline_entry_id = %s
            ORDER BY uploaded_at ASC
        """
        rows = db.execute_query(query, (entry_id,))
        result = []
        for row in rows:
            item = dict(row)
            item_task_id = task_id or item['task_id']
            item['uploaded_at'] = serialize_timestamp(item.get('uploaded_at'))
            item['download_url'] = f"/api/tasks/{item_task_id}/timeline/{entry_id}/files/{item['id']}/download"
            result.append(item)
        return result
    except Exception as e:
        # Table might not exist yet if migration hasn't been applied
        # Return empty list instead of crashing
        print(f"Warning: Could not fetch timeline files (table may not exist): {e}")
        return []

def get_timeline_file_record(entry_id: str, file_id: str) -> Optional[Dict[str, Any]]:
    """Get a timeline file record"""
    try:
        query = """
            SELECT id, timeline_entry_id, task_id, file_name, original_name, content_type, file_size, storage_path,
                   uploaded_by, uploaded_by_name, uploaded_at
            FROM task_timeline_files
            WHERE id = %s AND timeline_entry_id = %s
        """
        rows = db.execute_query(query, (file_id, entry_id))
        if not rows:
            return None
        record = dict(rows[0])
        record['uploaded_at'] = serialize_timestamp(record.get('uploaded_at'))
        return record
    except Exception as e:
        # Table might not exist yet
        print(f"Warning: Could not get timeline file record (table may not exist): {e}")
        return None

def serialize_comment(row: Dict[str, Any]) -> Dict[str, Any]:
    row['created_at'] = serialize_timestamp(row.get('created_at'))
    return row

def serialize_file(row: Dict[str, Any]) -> Dict[str, Any]:
    row['uploaded_at'] = serialize_timestamp(row.get('uploaded_at'))
    row['download_url'] = f"/api/tasks/{row['task_id']}/files/{row['id']}/download"
    return row

def fetch_task_tags(task_id: str) -> List[Dict[str, Any]]:
    query = """
        SELECT t.id, t.name
        FROM task_tag_links ttl
        JOIN tags t ON ttl.tag_id = t.id
        WHERE ttl.task_id = %s
        ORDER BY t.name
    """
    results = db.execute_query(query, (task_id,))
    return [dict(row) for row in results]

def upsert_tag(name: str) -> Dict[str, Any]:
    """Create or get tag (uses unified tags table)"""
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
def upsert_task_tag(name: str) -> Dict[str, Any]:
    """Create or get task tag (uses unified tags table)"""
    return upsert_tag(name)

def normalize_tag_names(names: List[str]) -> List[str]:
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

def fetch_task_assignees(task_id: str) -> List[Dict[str, Any]]:
    query = """
        SELECT user_id, user_name
        FROM task_assignees
        WHERE task_id = %s
        ORDER BY user_name
    """
    rows = db.execute_query(query, (task_id,))
    return [{'user_id': int(row['user_id']), 'user_name': row['user_name']} for row in rows]

def fetch_task_files(task_id: str) -> List[Dict[str, Any]]:
    query = """
        SELECT id, task_id, file_name, original_name, content_type, file_size, uploaded_by, uploaded_by_name, uploaded_at
        FROM task_files
        WHERE task_id = %s
        ORDER BY uploaded_at DESC
    """
    rows = db.execute_query(query, (task_id,))
    return [serialize_file(dict(row)) for row in rows]

def get_task_file_record(task_id: str, file_id: str) -> Optional[Dict[str, Any]]:
    query = """
        SELECT id, task_id, file_name, original_name, content_type, file_size, storage_path, uploaded_by, uploaded_by_name, uploaded_at
        FROM task_files
        WHERE task_id = %s AND id = %s
    """
    rows = db.execute_query(query, (task_id, file_id))
    if not rows:
        return None
    return serialize_file(dict(rows[0]))

def update_task_tags(task: Dict[str, Any], tag_names: List[str], user: Dict) -> List[Dict[str, Any]]:
    current_tags = fetch_task_tags(task['id'])
    normalized = normalize_tag_names(tag_names)
    desired_tags: List[Dict[str, Any]] = [upsert_tag(name) for name in normalized]

    current_ids = {tag['id'] for tag in current_tags}
    desired_ids = {tag['id'] for tag in desired_tags}

    # Remove links no longer needed
    to_remove = list(current_ids - desired_ids)
    if to_remove:
        placeholders = ','.join(['%s'] * len(to_remove))
        params: Tuple[Any, ...] = tuple([task['id'], *to_remove])
        db.execute_update(
            f"DELETE FROM task_tag_links WHERE task_id = %s AND tag_id IN ({placeholders})",
            params
        )

    # Insert new links
    for tag in desired_tags:
        if tag['id'] not in current_ids:
            db.execute_update(
                "INSERT INTO task_tag_links (task_id, tag_id) VALUES (%s, %s)",
                (task['id'], tag['id'])
            )

    if current_ids != desired_ids:
        description = ', '.join([tag['name'] for tag in desired_tags]) if desired_tags else 'No tags'
        log_task_event(
            task_id=task['id'],
            event_type='tags_updated',
            title='Tags updated',
            description=description,
            metadata={'tags': [tag['name'] for tag in desired_tags]},
            user=user,
        )

    desired_tags_sorted = sorted(desired_tags, key=lambda tag: tag['name'].lower())
    return desired_tags_sorted

def update_task_assignees(task: Dict[str, Any], assignee_ids: List[int], responsible_id: Optional[int], user: Dict) -> Dict[str, Any]:
    current_rows = fetch_task_assignees(task['id'])
    current_ids = {row['user_id'] for row in current_rows}

    unique_ids: List[int] = []
    seen_ids = set()
    for uid in assignee_ids:
        if uid not in seen_ids:
            unique_ids.append(uid)
            seen_ids.add(uid)
    assignee_ids = unique_ids
    target_ids = set(assignee_ids)

    if responsible_id is not None and responsible_id not in target_ids:
        raise HTTPException(status_code=400, detail="Responsible user must be part of the assignee list")

    assignees: List[Dict[str, Any]] = []
    if target_ids:
        placeholders = ','.join(['%s'] * len(target_ids))
        users = db.execute_query(
            f"SELECT id, username, email FROM users WHERE id IN ({placeholders})",
            tuple(target_ids)
        )
        if len(users) != len(target_ids):
            raise HTTPException(status_code=404, detail="One or more assignees were not found")
        user_map = {row['id']: row for row in users}
        for uid in assignee_ids:
            info = user_map.get(uid)
            if not info:
                continue
            display_name = info['username'] or info['email']
            assignees.append({
                'user_id': uid,
                'user_name': display_name,
                'email': info['email']
            })

    # Reset assignments
    db.execute_update("DELETE FROM task_assignees WHERE task_id = %s", (task['id'],))
    for entry in assignees:
        db.execute_update(
            "INSERT INTO task_assignees (task_id, user_id, user_name) VALUES (%s, %s, %s)",
            (task['id'], entry['user_id'], entry['user_name'])
        )

    responsible_name = None
    if responsible_id is not None:
        responsible_entry = next((a for a in assignees if a['user_id'] == responsible_id), None)
        if not responsible_entry:
            raise HTTPException(status_code=400, detail="Responsible user must belong to the assignee list")
        responsible_name = responsible_entry['user_name']

    assigned_to_str = ', '.join([a['user_name'] for a in assignees]) if assignees else None
    db.execute_update(
        "UPDATE tasks SET assigned_to = %s, responsible_user_id = %s, responsible_user_name = %s WHERE id = %s",
        (assigned_to_str, responsible_id, responsible_name, task['id'])
    )

    previous_names = sorted([row['user_name'] for row in current_rows])
    new_names = sorted([a['user_name'] for a in assignees])
    previous_responsible = task.get('responsible_user_id')

    if previous_names != new_names:
        description = ', '.join(new_names) if new_names else 'No assignees'
        log_task_event(
            task_id=task['id'],
            event_type='assignees_updated',
            title='Assignees updated',
            description=description,
            metadata={'assignees': new_names},
            user=user,
        )

    if (responsible_id or None) != (previous_responsible or None):
        log_task_event(
            task_id=task['id'],
            event_type='responsible_changed',
            title='Responsible updated',
            description=responsible_name or 'No responsible',
            metadata={'responsible_id': responsible_id, 'responsible_name': responsible_name},
            user=user,
        )

    task['responsible_user_id'] = responsible_id
    task['responsible_user_name'] = responsible_name

    return {
        'assignees': [{'user_id': a['user_id'], 'user_name': a['user_name']} for a in assignees],
        'responsible_id': responsible_id,
        'responsible_name': responsible_name,
    }

async def save_task_file(task: Dict[str, Any], upload: UploadFile, user: Dict) -> Dict[str, Any]:
    if not upload.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    safe_name = os.path.basename(upload.filename)
    file_id = str(uuid.uuid4())
    task_dir = TASK_UPLOAD_DIR / task['id']
    task_dir.mkdir(parents=True, exist_ok=True)

    storage_name = f"{file_id}_{safe_name}"
    relative_path = Path(task['id']) / storage_name
    absolute_path = task_dir / storage_name

    with open(absolute_path, "wb") as buffer:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            buffer.write(chunk)

    file_size = absolute_path.stat().st_size
    if file_size > 50 * 1024 * 1024:
        absolute_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="File exceeds the 50 MB limit")

    user_id = user.get('id')
    user_name = user.get('username') or user.get('email')

    db.execute_update(
        """
        INSERT INTO task_files (id, task_id, file_name, original_name, content_type, file_size, storage_path, uploaded_by, uploaded_by_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            file_id,
            task['id'],
            storage_name,
            safe_name,
            upload.content_type,
            file_size,
            str(relative_path),
            user_id,
            user_name,
        )
    )

    log_task_event(
        task_id=task['id'],
        event_type='file_added',
        title='File uploaded',
        description=safe_name,
        metadata={'file_name': safe_name, 'file_size': file_size},
        user=user,
    )

    record = get_task_file_record(task['id'], file_id)
    if record is None:
        raise HTTPException(status_code=500, detail="Unable to load uploaded file metadata")
    return record

def delete_task_file(task: Dict[str, Any], record: Dict[str, Any], user: Dict) -> None:
    relative_path = record.get('storage_path')
    absolute_path = TASK_UPLOAD_DIR / relative_path if relative_path else None

    db.execute_update("DELETE FROM task_files WHERE id = %s", (record['id'],))

    if absolute_path and absolute_path.exists():
        absolute_path.unlink()

    log_task_event(
        task_id=task['id'],
        event_type='file_removed',
        title='File deleted',
        description=record.get('original_name'),
        metadata={'file_name': record.get('original_name')},
        user=user,
    )

async def save_timeline_file(entry_id: str, task_id: str, upload: UploadFile, user: Dict) -> Dict[str, Any]:
    """Save a file attached to a timeline entry"""
    if not upload.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    safe_name = os.path.basename(upload.filename)
    file_id = str(uuid.uuid4())
    entry_dir = TIMELINE_UPLOAD_DIR / task_id / entry_id
    entry_dir.mkdir(parents=True, exist_ok=True)

    storage_name = f"{file_id}_{safe_name}"
    relative_path = Path(task_id) / entry_id / storage_name
    absolute_path = entry_dir / storage_name

    with open(absolute_path, "wb") as buffer:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            buffer.write(chunk)

    file_size = absolute_path.stat().st_size
    if file_size > 50 * 1024 * 1024:
        absolute_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="File exceeds the 50 MB limit")

    user_id = user.get('id')
    user_name = user.get('username') or user.get('email')

    db.execute_update(
        """
        INSERT INTO task_timeline_files (id, timeline_entry_id, task_id, file_name, original_name, content_type, file_size, storage_path, uploaded_by, uploaded_by_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            file_id,
            entry_id,
            task_id,
            storage_name,
            safe_name,
            upload.content_type,
            file_size,
            str(relative_path),
            user_id,
            user_name,
        )
    )

    record = get_timeline_file_record(entry_id, file_id)
    if record is None:
        raise HTTPException(status_code=500, detail="Unable to load uploaded file metadata")
    return record

def normalize_checklist_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a checklist item from database (convert types)"""
    normalized = dict(item)
    # Convert completed from tinyint (0/1) to boolean
    normalized['completed'] = bool(normalized.get('completed', False))
    # Ensure order is an integer
    normalized['order'] = int(normalized.get('order', 0))
    normalized['created_at'] = serialize_timestamp(normalized.get('created_at'))
    normalized['updated_at'] = serialize_timestamp(normalized.get('updated_at'))
    return normalized

def fetch_task_checklist(task_id: str) -> List[Dict[str, Any]]:
    """Fetch checklist items for a task"""
    query = """
        SELECT id, task_id, text, completed, `order`, created_at, updated_at
        FROM task_checklist
        WHERE task_id = %s
        ORDER BY `order` ASC, created_at ASC
    """
    rows = db.execute_query(query, (task_id,))
    return [normalize_checklist_item(dict(row)) for row in rows]

# Endpoints
@router.get("/tasks/tree")
async def get_task_tree(workspace_id: str = 'demo', user: Dict = Depends(get_current_user)):
    """Get full task tree"""
    try:
        tree = build_task_tree('root', workspace_id)
        ws_query = "SELECT name FROM workspaces WHERE id = %s"
        ws = db.execute_query(ws_query, (workspace_id,))
        workspace_name = ws[0]['name'] if ws else 'Tasks'
        
        return {"success": True, "tree": tree, "workspace_name": workspace_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/reorder")
async def reorder_tasks(data: dict = Body(...), user: Dict = Depends(get_current_user)):
    """Reorder tasks by updating sort_order (requires write permission)"""
    try:
        task_ids = data.get('task_ids', [])
        if not task_ids:
            raise HTTPException(status_code=400, detail="task_ids is required")

        # Check permission on the first task's workspace
        first_task = ensure_task_exists(task_ids[0])
        workspace_id = first_task.get('workspace_id', 'demo')
        await check_workspace_permission(workspace_id, user, 'write')

        for index, task_id in enumerate(task_ids):
            db.execute_update("UPDATE tasks SET sort_order = %s WHERE id = %s", (index, task_id))

        await broadcast_task_tree_update()
        return {"success": True, "message": "Tasks reordered"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Kanban Task Order ──────────────────────────────────────────────────────

@router.get("/tasks/kanban-order")
async def get_kanban_order(workspace_id: str = "demo", user: Dict = Depends(get_current_user)):
    """Get kanban task ordering for all columns in a workspace"""
    try:
        rows = db.execute_query(
            "SELECT status_slug, task_id, sort_order FROM kanban_task_order WHERE workspace_id = %s ORDER BY status_slug, sort_order ASC",
            (workspace_id,),
        )
        order: Dict[str, List[str]] = {}
        for row in rows:
            slug = row['status_slug']
            if slug not in order:
                order[slug] = []
            order[slug].append(row['task_id'])
        return {"success": True, "order": order}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tasks/kanban-order")
async def save_kanban_order(data: dict = Body(...), user: Dict = Depends(get_current_user)):
    """Save kanban task ordering for a specific column"""
    try:
        workspace_id = data.get("workspace_id", "demo")
        status_slug = data.get("status_slug")
        task_ids = data.get("task_ids", [])
        if not status_slug:
            raise HTTPException(status_code=400, detail="status_slug is required")
        await check_workspace_permission(workspace_id, user, 'write')
        # Delete existing order for this column
        db.execute_update(
            "DELETE FROM kanban_task_order WHERE workspace_id = %s AND status_slug = %s",
            (workspace_id, status_slug),
        )
        # Insert new order
        for idx, task_id in enumerate(task_ids):
            db.execute_update(
                "INSERT INTO kanban_task_order (workspace_id, status_slug, task_id, sort_order) VALUES (%s, %s, %s, %s)",
                (workspace_id, status_slug, task_id, idx),
            )
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Workflow Steps ──────────────────────────────────────────────────────────

DEFAULT_WORKFLOW_STEPS = [
    {"name": "To do", "slug": "todo", "color": "blue", "sort_order": 0},
    {"name": "In progress", "slug": "in_progress", "color": "amber", "sort_order": 1},
    {"name": "Done", "slug": "done", "color": "green", "sort_order": 2},
]

def ensure_workflow_steps(workspace_id: str) -> List[Dict[str, Any]]:
    """Return workflow steps for a workspace, seeding defaults if none exist."""
    rows = db.execute_query(
        "SELECT id, workspace_id, name, slug, color, sort_order FROM workflow_steps WHERE workspace_id = %s ORDER BY sort_order ASC",
        (workspace_id,),
    )
    if rows:
        return [dict(r) for r in rows]
    # Seed defaults
    result = []
    for step in DEFAULT_WORKFLOW_STEPS:
        step_id = str(uuid.uuid4())
        db.execute_update(
            "INSERT INTO workflow_steps (id, workspace_id, name, slug, color, sort_order) VALUES (%s, %s, %s, %s, %s, %s)",
            (step_id, workspace_id, step["name"], step["slug"], step["color"], step["sort_order"]),
        )
        result.append({"id": step_id, "workspace_id": workspace_id, **step})
    return result

@router.get("/tasks/workflow-steps")
async def get_workflow_steps(workspace_id: str = "demo", user: Dict = Depends(get_current_user)):
    """Get workflow steps for a workspace (auto-seeds defaults if empty)."""
    try:
        await check_workspace_permission(workspace_id, user, "read")
        steps = ensure_workflow_steps(workspace_id)
        return {"success": True, "steps": steps}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/workflow-steps")
async def create_workflow_step(data: dict = Body(...), user: Dict = Depends(get_current_user)):
    """Add a new workflow step to a workspace."""
    try:
        workspace_id = data.get("workspace_id", "demo")
        await check_workspace_permission(workspace_id, user, "write")
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Step name is required")
        color = data.get("color", "gray")
        # Generate slug from name
        slug = name.lower().replace(" ", "_")
        # Ensure unique slug within workspace
        existing = db.execute_query(
            "SELECT id FROM workflow_steps WHERE workspace_id = %s AND slug = %s", (workspace_id, slug)
        )
        if existing:
            slug = f"{slug}_{str(uuid.uuid4())[:8]}"
        # Get max sort_order
        max_order = db.execute_query(
            "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM workflow_steps WHERE workspace_id = %s",
            (workspace_id,),
        )
        next_order = (max_order[0]["max_order"] if max_order else -1) + 1
        step_id = str(uuid.uuid4())
        db.execute_update(
            "INSERT INTO workflow_steps (id, workspace_id, name, slug, color, sort_order) VALUES (%s, %s, %s, %s, %s, %s)",
            (step_id, workspace_id, name, slug, color, next_order),
        )
        step = {"id": step_id, "workspace_id": workspace_id, "name": name, "slug": slug, "color": color, "sort_order": next_order}
        return {"success": True, "step": step}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tasks/workflow-steps/{step_id}")
async def update_workflow_step(step_id: str, data: dict = Body(...), user: Dict = Depends(get_current_user)):
    """Update a workflow step (name, color)."""
    try:
        rows = db.execute_query("SELECT * FROM workflow_steps WHERE id = %s", (step_id,))
        if not rows:
            raise HTTPException(status_code=404, detail="Workflow step not found")
        step = dict(rows[0])
        await check_workspace_permission(step["workspace_id"], user, "write")

        updates, params = [], []
        old_slug = step["slug"]
        if "name" in data and data["name"]:
            new_name = data["name"].strip()
            new_slug = new_name.lower().replace(" ", "_")
            # Ensure unique slug
            dup = db.execute_query(
                "SELECT id FROM workflow_steps WHERE workspace_id = %s AND slug = %s AND id != %s",
                (step["workspace_id"], new_slug, step_id),
            )
            if dup:
                new_slug = f"{new_slug}_{str(uuid.uuid4())[:8]}"
            updates.append("name = %s")
            params.append(new_name)
            updates.append("slug = %s")
            params.append(new_slug)
        if "color" in data:
            updates.append("color = %s")
            params.append(data["color"])
        if updates:
            params.append(step_id)
            db.execute_update(f"UPDATE workflow_steps SET {', '.join(updates)} WHERE id = %s", tuple(params))
            # If slug changed, update all tasks using the old slug
            updated = db.execute_query("SELECT slug FROM workflow_steps WHERE id = %s", (step_id,))
            if updated and updated[0]["slug"] != old_slug:
                db.execute_update(
                    "UPDATE tasks SET status = %s WHERE status = %s AND workspace_id = %s",
                    (updated[0]["slug"], old_slug, step["workspace_id"]),
                )

        final = db.execute_query(
            "SELECT id, workspace_id, name, slug, color, sort_order FROM workflow_steps WHERE id = %s", (step_id,)
        )
        return {"success": True, "step": dict(final[0]) if final else step}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tasks/workflow-steps/{step_id}")
async def delete_workflow_step(step_id: str, user: Dict = Depends(get_current_user)):
    """Delete a workflow step. Tasks with this status are moved to the first remaining step."""
    try:
        rows = db.execute_query("SELECT * FROM workflow_steps WHERE id = %s", (step_id,))
        if not rows:
            raise HTTPException(status_code=404, detail="Workflow step not found")
        step = dict(rows[0])
        workspace_id = step["workspace_id"]
        await check_workspace_permission(workspace_id, user, "write")

        # Must keep at least one step
        count = db.execute_query(
            "SELECT COUNT(*) AS cnt FROM workflow_steps WHERE workspace_id = %s", (workspace_id,)
        )
        if count[0]["cnt"] <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last workflow step")

        # Move tasks to the first remaining step
        first = db.execute_query(
            "SELECT slug FROM workflow_steps WHERE workspace_id = %s AND id != %s ORDER BY sort_order ASC LIMIT 1",
            (workspace_id, step_id),
        )
        if first:
            db.execute_update(
                "UPDATE tasks SET status = %s WHERE status = %s AND workspace_id = %s",
                (first[0]["slug"], step["slug"], workspace_id),
            )

        db.execute_update("DELETE FROM workflow_steps WHERE id = %s", (step_id,))
        await broadcast_task_tree_update()
        return {"success": True, "message": "Workflow step deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/workflow-steps/reorder")
async def reorder_workflow_steps(data: dict = Body(...), user: Dict = Depends(get_current_user)):
    """Reorder workflow steps."""
    try:
        step_ids = data.get("step_ids", [])
        workspace_id = data.get("workspace_id", "demo")
        if not step_ids:
            raise HTTPException(status_code=400, detail="step_ids is required")
        await check_workspace_permission(workspace_id, user, "write")
        for index, sid in enumerate(step_ids):
            db.execute_update("UPDATE workflow_steps SET sort_order = %s WHERE id = %s", (index, sid))
        return {"success": True, "message": "Workflow steps reordered"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/{task_id}")
async def get_task(task_id: str, user: Dict = Depends(get_current_user)):
    """Get single task"""
    try:
        query = "SELECT * FROM tasks WHERE id = %s"
        tasks = db.execute_query(query, (task_id,))
        
        if not tasks:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task = dict(tasks[0])
        if task.get('created_at'):
            task['created_at'] = task['created_at'].isoformat()
        if task.get('updated_at'):
            task['updated_at'] = task['updated_at'].isoformat()
        if task.get('due_date'):
            task['due_date'] = task['due_date'].isoformat()
        if task.get('responsible_user_id') is not None:
            try:
                task['responsible_user_id'] = int(task['responsible_user_id'])
            except (TypeError, ValueError):
                task['responsible_user_id'] = None
        
        return {"success": True, "task": task}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks")
async def create_task(task: TaskBase, user: Dict = Depends(get_current_user)):
    """Create new task or folder (requires write permission)"""
    try:
        await check_workspace_permission(task.workspace_id, user, 'write')
        task_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO tasks (id, name, type, parent_id, content, workspace_id, user_id, status, priority, assigned_to, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            task_id, task.name, task.type, task.parent_id, task.content,
            task.workspace_id, user['id'], task.status, task.priority, task.assigned_to, task.due_date
        ))
        
        if task.type == 'task':
            log_task_event(
                task_id=task_id,
                event_type='created',
                title='Task created',
                description=f'Task "{task.name}" created',
                metadata={
                    "status": task.status,
                    "priority": task.priority,
                    "assigned_to": task.assigned_to,
                    "due_date": task.due_date,
                },
                user=user,
            )

        # Broadcast tree update to all clients
        await broadcast_task_tree_update()

        return {"success": True, "task": {"id": task_id, **task.dict()}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate, user: Dict = Depends(get_current_user)):
    """Update task (requires write permission)"""
    try:
        current_task = ensure_task_exists(task_id)
        workspace_id = current_task.get('workspace_id', 'demo')
        await check_workspace_permission(workspace_id, user, 'write')

        updates = []
        params = []
        payload = task.dict(exclude_unset=True)

        if "name" in payload:
            updates.append("name = %s")
            params.append(payload["name"])
        if "content" in payload:
            updates.append("content = %s")
            params.append(payload["content"])
        if "parent_id" in payload:
            updates.append("parent_id = %s")
            params.append(payload["parent_id"])
        if "status" in payload:
            updates.append("status = %s")
            params.append(payload["status"])
        if "priority" in payload:
            updates.append("priority = %s")
            params.append(payload["priority"])
        if "assigned_to" in payload:
            updates.append("assigned_to = %s")
            params.append(payload["assigned_to"])
        if "due_date" in payload:
            updates.append("due_date = %s")
            params.append(payload["due_date"])
        
        if not updates:
            return {"success": True, "message": "No changes"}
        
        params.append(task_id)
        query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = %s"
        db.execute_update(query, tuple(params))

        if current_task['type'] == 'task':
            if "name" in payload and payload["name"] != current_task["name"]:
                log_task_event(
                    task_id,
                    "renamed",
                    "Task renamed",
                    f'"{current_task["name"]}" → "{payload["name"]}"',
                    {"from": current_task["name"], "to": payload["name"]},
                    user,
                )
            if "status" in payload and payload["status"] != current_task.get("status"):
                log_task_event(
                    task_id,
                    "status_changed",
                    "Status updated",
                    f'{current_task.get("status") or "unknown"} → {payload["status"]}',
                    {"from": current_task.get("status"), "to": payload["status"]},
                    user,
                )
            if "priority" in payload and payload["priority"] != current_task.get("priority"):
                log_task_event(
                    task_id,
                    "priority_changed",
                    "Priority updated",
                    f'{current_task.get("priority") or "unknown"} → {payload["priority"]}',
                    {"from": current_task.get("priority"), "to": payload["priority"]},
                    user,
                )
            if "assigned_to" in payload and payload["assigned_to"] != current_task.get("assigned_to"):
                log_task_event(
                    task_id,
                    "assignee_changed",
                    "Assignee updated",
                    f'{current_task.get("assigned_to") or "Unassigned"} → {payload["assigned_to"] or "Unassigned"}',
                    {"from": current_task.get("assigned_to"), "to": payload["assigned_to"]},
                    user,
                )
            if "due_date" in payload:
                current_due = current_task.get("due_date")
                current_due_formatted = current_due.isoformat() if isinstance(current_due, datetime) else current_due
                if payload["due_date"] != current_due_formatted:
                    log_task_event(
                        task_id,
                        "due_date_changed",
                        "Due date updated",
                        f'{current_due_formatted or "None"} → {payload["due_date"] or "None"}',
                        {"from": current_due_formatted, "to": payload["due_date"]},
                        user,
                    )
        
        # Broadcast tree update to all clients
        await broadcast_task_tree_update()
        await broadcast_task_activity_update(task_id)
        
        return {"success": True, "message": "Task updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: Dict = Depends(get_current_user)):
    """Delete task (requires write permission)"""
    try:
        if task_id == 'root':
            raise HTTPException(status_code=400, detail="Cannot delete root")
        
        # Get task to check workspace and permissions
        task = ensure_task_exists(task_id)
        workspace_id = task.get('workspace_id', 'demo')
        
        # Check write permission
        await check_workspace_permission(workspace_id, user, 'write')
        
        db.execute_update("DELETE FROM tasks WHERE id = %s", (task_id,))
        task_dir = TASK_UPLOAD_DIR / task_id
        if task_dir.exists():
            shutil.rmtree(task_dir, ignore_errors=True)
        
        # Broadcast tree update to all clients
        await broadcast_task_tree_update()
        
        return {"success": True, "message": "Task deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/{task_id}/move")
async def move_task(task_id: str, move_data: TaskMove, user: Dict = Depends(get_current_user)):
    """Move task to new parent (requires write permission)"""
    try:
        task = ensure_task_exists(task_id)
        workspace_id = task.get('workspace_id', 'demo')
        await check_workspace_permission(workspace_id, user, 'write')
        db.execute_update("UPDATE tasks SET parent_id = %s WHERE id = %s", (move_data.parent_id, task_id))
        
        # Broadcast tree update to all clients
        await broadcast_task_tree_update()
        
        return {"success": True, "message": "Task moved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/{task_id}/copy")
async def copy_task(task_id: str, user: Dict = Depends(get_current_user)):
    """Copy task (requires write permission)"""
    try:
        query = "SELECT * FROM tasks WHERE id = %s"
        tasks = db.execute_query(query, (task_id,))
        
        if not tasks:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task = tasks[0]
        workspace_id = task.get('workspace_id', 'demo')
        await check_workspace_permission(workspace_id, user, 'write')
        new_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO tasks (id, name, type, parent_id, content, workspace_id, user_id, status, priority, assigned_to, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            new_id, f"{task['name']} (copy)", task['type'], task['parent_id'],
            task['content'], task['workspace_id'], user['id'],
            task['status'], task['priority'], task['assigned_to'], task['due_date']
        ))
        
        # Broadcast tree update to all clients
        await broadcast_task_tree_update()
        
        return {"success": True, "task_id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tags")
async def list_tags(query: Optional[str] = None, limit: int = 50, user: Dict = Depends(get_current_user)):
    """List available tags"""
    try:
        limit = max(1, min(limit, 100))
        if query:
            search = f"%{query.strip()}%"
            rows = db.execute_query(
                """
                SELECT id, name FROM tags
                WHERE LOWER(name) LIKE LOWER(%s)
                ORDER BY name
                LIMIT %s
                """,
                (search, limit)
            )
        else:
            rows = db.execute_query(
                "SELECT id, name FROM tags ORDER BY name LIMIT %s",
                (limit,)
            )
        return {"success": True, "tags": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/{task_id}/tags")
async def get_task_tags(task_id: str, user: Dict = Depends(get_current_user)):
    """Get tags associated with a task"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Tags are only available for tasks")
    tags = fetch_task_tags(task_id)
    return {"success": True, "tags": tags}

@router.put("/tasks/{task_id}/tags")
async def update_task_tags_endpoint(task_id: str, payload: TagsUpdate, user: Dict = Depends(get_current_user)):
    """Replace task tags"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Tags are only available for tasks")
    tags = update_task_tags(task, payload.tags, user)
    
    # Broadcast tree update to all clients
    await broadcast_task_tree_update()
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "tags": tags}

@router.get("/tasks/{task_id}/assignees")
async def get_task_assignees(task_id: str, user: Dict = Depends(get_current_user)):
    """Get task assignees and responsible"""
    task = ensure_task_exists(task_id)
    assignees = fetch_task_assignees(task_id)
    return {
        "success": True,
        "assignees": assignees,
        "responsible_id": task.get('responsible_user_id'),
        "responsible_name": task.get('responsible_user_name'),
    }

@router.put("/tasks/{task_id}/assignees")
async def update_task_assignees_endpoint(task_id: str, payload: AssigneesUpdate, user: Dict = Depends(get_current_user)):
    """Update task assignees and responsible"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Assignments are only available for tasks")
    result = update_task_assignees(task, payload.assignee_ids, payload.responsible_id, user)
    
    # Broadcast tree update to all clients
    await broadcast_task_tree_update()
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, **result}

@router.get("/tasks/{task_id}/files")
async def list_task_files(task_id: str, user: Dict = Depends(get_current_user)):
    """List files attached to a task"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Files are only available for tasks")
    files = fetch_task_files(task_id)
    return {"success": True, "files": files}

@router.post("/tasks/{task_id}/files")
async def upload_task_file(task_id: str, file: UploadFile = File(...), user: Dict = Depends(get_current_user)):
    """Upload a file for a task"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Files are only available for tasks")
    record = await save_task_file(task, file, user)
    
    # Broadcast activity update to all clients
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "file": record}

@router.get("/tasks/{task_id}/files/{file_id}/download")
async def download_task_file(task_id: str, file_id: str, download: bool = True, user: Dict = Depends(get_current_user)):
    """Download or view a task file"""
    task = ensure_task_exists(task_id)
    record = get_task_file_record(task_id, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    relative_path = record.get('storage_path')
    absolute_path = TASK_UPLOAD_DIR / relative_path if relative_path else None
    if not absolute_path or not absolute_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    # If download=False, return file for viewing (inline)
    if not download:
        from fastapi.responses import Response
        with open(absolute_path, 'rb') as f:
            content = f.read()
        return Response(
            content=content,
            media_type=record.get('content_type') or 'application/octet-stream',
            headers={
                'Content-Disposition': 'inline'
            }
        )
    
    # If download=True, force download with filename
    return FileResponse(
        absolute_path,
        filename=record.get('original_name') or record.get('file_name'),
        media_type=record.get('content_type') or 'application/octet-stream'
    )

@router.delete("/tasks/{task_id}/files/{file_id}")
async def delete_task_file_endpoint(task_id: str, file_id: str, user: Dict = Depends(get_current_user)):
    """Delete a file attached to a task"""
    task = ensure_task_exists(task_id)
    record = get_task_file_record(task_id, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    delete_task_file(task, record, user)
    
    # Broadcast activity update to all clients
    await broadcast_task_activity_update(task_id)
    
    return {"success": True}

# Timeline & comments endpoints
@router.get("/tasks/{task_id}/timeline")
async def get_task_timeline(task_id: str, limit: int = 200, user: Dict = Depends(get_current_user)):
    """Get task timeline"""
    ensure_task_exists(task_id)
    query = """
        SELECT id, task_id, event_type, title, description, metadata, user_id, user_name, created_at
        FROM task_timeline
        WHERE task_id = %s
        ORDER BY created_at DESC
        LIMIT %s
    """
    timeline = db.execute_query(query, (task_id, limit))
    items = [serialize_timeline_entry(dict(entry)) for entry in timeline]
    return {"success": True, "timeline": items}

@router.post("/tasks/{task_id}/timeline")
async def add_task_timeline_entry(task_id: str, entry: TimelineEntryCreate, user: Dict = Depends(get_current_user)):
    """Add a manual task timeline entry"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Timeline is only available for tasks")

    title = entry.title.strip() if entry.title else ''
    description = entry.description.strip() if entry.description else None
    
    # At least description must be provided
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")

    event_type = (entry.event_type or 'note').strip().lower()

    entry_id = log_task_event(
        task_id=task_id,
        event_type=event_type,
        title=title,
        description=description,
        user=user,
    )

    query = """
        SELECT id, task_id, event_type, title, description, metadata, user_id, user_name, created_at
        FROM task_timeline
        WHERE id = %s
    """
    rows = db.execute_query(query, (entry_id,))
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to load created timeline entry")
    
    # Broadcast activity update to all clients
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "entry": serialize_timeline_entry(dict(rows[0]))}

@router.patch("/tasks/{task_id}/timeline/{entry_id}")
async def update_task_timeline_entry_patch(task_id: str, entry_id: str, entry: TimelineEntryUpdate, user: Dict = Depends(get_current_user)):
    """Update a timeline entry (only by the creator, and only manual notes)"""
    task = ensure_task_exists(task_id)
    
    # Get the entry to check ownership and type
    check_query = """
        SELECT id, user_id, event_type, title, description FROM task_timeline
        WHERE id = %s AND task_id = %s
    """
    existing = db.execute_query(check_query, (entry_id, task_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    
    # Only allow editing manual notes
    if existing[0]['event_type'] != 'note':
        raise HTTPException(status_code=400, detail="Only manual notes can be edited")
    
    # Check if user is the creator
    if existing[0]['user_id'] != user.get('id'):
        raise HTTPException(status_code=403, detail="You can only edit your own timeline entries")
    
    # Prepare update fields
    title = entry.title.strip() if entry.title is not None else existing[0]['title']
    if title is None:
        title = ''
    description = entry.description.strip() if entry.description is not None else existing[0]['description']
    
    # At least description must be provided (or already exist)
    if not description:
        raise HTTPException(status_code=400, detail="Description cannot be empty")
    
    # Update the entry
    update_query = """
        UPDATE task_timeline
        SET title = %s, description = %s
        WHERE id = %s AND task_id = %s
    """
    db.execute_update(update_query, (title, description, entry_id, task_id))
    
    # Fetch updated entry
    fetch_query = """
        SELECT id, task_id, event_type, title, description, metadata, user_id, user_name, created_at
        FROM task_timeline
        WHERE id = %s
    """
    rows = db.execute_query(fetch_query, (entry_id,))
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to load updated timeline entry")
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "entry": serialize_timeline_entry(dict(rows[0]))}

@router.post("/tasks/{task_id}/timeline/{entry_id}/files")
async def upload_timeline_file(task_id: str, entry_id: str, file: UploadFile = File(...), user: Dict = Depends(get_current_user)):
    """Upload a file to attach to a timeline entry"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Timeline is only available for tasks")
    
    # Verify entry exists and belongs to task
    check_query = "SELECT id FROM task_timeline WHERE id = %s AND task_id = %s"
    existing = db.execute_query(check_query, (entry_id, task_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    
    record = await save_timeline_file(entry_id, task_id, file, user)
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "file": record}

@router.get("/tasks/{task_id}/timeline/{entry_id}/files/{file_id}/download")
async def download_timeline_file(task_id: str, entry_id: str, file_id: str, download: bool = True, user: Dict = Depends(get_current_user)):
    """Download or view a timeline file"""
    task = ensure_task_exists(task_id)
    record = get_timeline_file_record(entry_id, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    relative_path = record.get('storage_path')
    absolute_path = TIMELINE_UPLOAD_DIR / relative_path if relative_path else None
    if not absolute_path or not absolute_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    # If download=False, return file for viewing (inline)
    if not download:
        from fastapi.responses import Response
        with open(absolute_path, 'rb') as f:
            content = f.read()
        return Response(
            content=content,
            media_type=record.get('content_type') or 'application/octet-stream',
            headers={
                'Content-Disposition': 'inline'
            }
        )
    
    # If download=True, force download with filename
    return FileResponse(
        absolute_path,
        filename=record.get('original_name') or record.get('file_name'),
        media_type=record.get('content_type') or 'application/octet-stream'
    )

@router.delete("/tasks/{task_id}/timeline/{entry_id}/files/{file_id}")
async def delete_timeline_file(task_id: str, entry_id: str, file_id: str, user: Dict = Depends(get_current_user)):
    """Delete a file attached to a timeline entry"""
    task = ensure_task_exists(task_id)
    record = get_timeline_file_record(entry_id, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    
    relative_path = record.get('storage_path')
    absolute_path = TIMELINE_UPLOAD_DIR / relative_path if relative_path else None

    db.execute_update("DELETE FROM task_timeline_files WHERE id = %s AND timeline_entry_id = %s", (file_id, entry_id))

    if absolute_path and absolute_path.exists():
        absolute_path.unlink()
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True}

@router.get("/tasks/{task_id}/comments")
async def get_task_comments(task_id: str, limit: int = 200, user: Dict = Depends(get_current_user)):
    """Get task comments"""
    ensure_task_exists(task_id)
    query = """
        SELECT id, task_id, user_id, user_name, content, created_at
        FROM task_comments
        WHERE task_id = %s
        ORDER BY created_at ASC
        LIMIT %s
    """
    comments = db.execute_query(query, (task_id, limit))
    items = [serialize_comment(dict(comment)) for comment in comments]
    return {"success": True, "comments": items}

@router.post("/tasks/{task_id}/comments")
async def add_task_comment(task_id: str, comment: TaskCommentCreate, user: Dict = Depends(get_current_user)):
    """Add a comment to a task"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Comments are only available for tasks")

    content = comment.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    comment_id = str(uuid.uuid4())
    user_id = user.get('id')
    user_name = user.get('username') or user.get('email')

    query = """
        INSERT INTO task_comments (id, task_id, user_id, user_name, content)
        VALUES (%s, %s, %s, %s, %s)
    """
    db.execute_update(query, (comment_id, task_id, user_id, user_name, content))

    fetch_query = """
        SELECT id, task_id, user_id, user_name, content, created_at
        FROM task_comments
        WHERE id = %s
    """
    rows = db.execute_query(fetch_query, (comment_id,))
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to load created comment")

    # Broadcast activity update to all clients
    await broadcast_task_activity_update(task_id)

    return {"success": True, "comment": serialize_comment(dict(rows[0]))}

@router.patch("/tasks/{task_id}/comments/{comment_id}")
async def update_task_comment(task_id: str, comment_id: str, comment: TaskCommentUpdate, user: Dict = Depends(get_current_user)):
    """Update a comment (only by the creator)"""
    task = ensure_task_exists(task_id)
    
    # Get the comment to check ownership
    check_query = """
        SELECT id, user_id, content FROM task_comments
        WHERE id = %s AND task_id = %s
    """
    existing = db.execute_query(check_query, (comment_id, task_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user is the creator
    if existing[0]['user_id'] != user.get('id'):
        raise HTTPException(status_code=403, detail="You can only edit your own comments")
    
    content = comment.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    
    # Update the comment
    update_query = """
        UPDATE task_comments
        SET content = %s
        WHERE id = %s AND task_id = %s
    """
    db.execute_update(update_query, (content, comment_id, task_id))
    
    # Fetch updated comment
    fetch_query = """
        SELECT id, task_id, user_id, user_name, content, created_at
        FROM task_comments
        WHERE id = %s
    """
    rows = db.execute_query(fetch_query, (comment_id,))
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to load updated comment")
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "comment": serialize_comment(dict(rows[0]))}

@router.delete("/tasks/{task_id}/comments/{comment_id}")
async def delete_task_comment(task_id: str, comment_id: str, user: Dict = Depends(get_current_user)):
    """Delete a comment (only by the creator)"""
    task = ensure_task_exists(task_id)
    
    # Get the comment to check ownership
    check_query = """
        SELECT id, user_id FROM task_comments
        WHERE id = %s AND task_id = %s
    """
    existing = db.execute_query(check_query, (comment_id, task_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user is the creator
    if existing[0]['user_id'] != user.get('id'):
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    
    # Delete the comment
    db.execute_update("DELETE FROM task_comments WHERE id = %s AND task_id = %s", (comment_id, task_id))
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True}

@router.delete("/tasks/{task_id}/timeline/{entry_id}")
async def delete_task_timeline_entry(task_id: str, entry_id: str, user: Dict = Depends(get_current_user)):
    """Delete a timeline entry (only by the creator, and only manual notes)"""
    task = ensure_task_exists(task_id)
    
    # Get the entry to check ownership and type
    check_query = """
        SELECT id, user_id, event_type FROM task_timeline
        WHERE id = %s AND task_id = %s
    """
    existing = db.execute_query(check_query, (entry_id, task_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    
    # Only allow deleting manual notes
    if existing[0]['event_type'] != 'note':
        raise HTTPException(status_code=400, detail="Only manual notes can be deleted")
    
    # Check if user is the creator
    if existing[0]['user_id'] != user.get('id'):
        raise HTTPException(status_code=403, detail="You can only delete your own timeline entries")
    
    # Delete the entry (CASCADE will handle files)
    db.execute_update("DELETE FROM task_timeline WHERE id = %s AND task_id = %s", (entry_id, task_id))
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True}

# Lock endpoints
@router.post("/tasks/{task_id}/lock")
async def lock_task(task_id: str, lock_req: LockRequest):
    """Lock task for editing"""
    try:
        check_query = "SELECT user_id, user_name FROM task_locks WHERE task_id = %s"
        existing = db.execute_query(check_query, (task_id,))
        
        if existing:
            if existing[0]['user_id'] == lock_req.user_id:
                return {"success": True, "message": "Already locked by you"}
            else:
                return {
                    "success": False,
                    "message": "Task is locked by another user",
                    "locked_by": existing[0]
                }
        
        query = "INSERT INTO task_locks (task_id, user_id, user_name) VALUES (%s, %s, %s)"
        db.execute_update(query, (task_id, lock_req.user_id, lock_req.user_name))
        
        # Broadcast lock update to all clients
        await broadcast_task_lock_update(task_id, {'user_id': lock_req.user_id, 'user_name': lock_req.user_name})
        
        return {"success": True, "message": "Task locked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tasks/{task_id}/lock")
async def unlock_task(task_id: str, user_id: str):
    """Unlock task"""
    try:
        db.execute_update("DELETE FROM task_locks WHERE task_id = %s AND user_id = %s", (task_id, user_id))
        
        # Broadcast lock update to all clients
        await broadcast_task_lock_update(task_id, None)
        
        return {"success": True, "message": "Task unlocked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/{task_id}/heartbeat")
async def heartbeat_task(task_id: str, user: Dict = Depends(get_current_user)):
    """Update lock timestamp to prevent expiration"""
    try:
        user_id = str(user['id'])
        # Check if user owns the lock
        check_query = "SELECT user_id FROM task_locks WHERE task_id = %s"
        existing = db.execute_query(check_query, (task_id,))
        
        if not existing:
            return {"success": False, "message": "Task not locked"}
            
        if str(existing[0]['user_id']) != user_id:
            return {"success": False, "message": "Lock owned by another user"}
        
        # Update heartbeat timestamp
        query = "UPDATE task_locks SET last_heartbeat = NOW() WHERE task_id = %s AND user_id = %s"
        db.execute_update(query, (task_id, user_id))
        
        return {"success": True, "message": "Heartbeat updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Checklist endpoints
@router.get("/tasks/{task_id}/checklist")
async def get_task_checklist(task_id: str, user: Dict = Depends(get_current_user)):
    """Get checklist items for a task"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Checklist is only available for tasks")
    items = fetch_task_checklist(task_id)
    return {"success": True, "items": items}

@router.post("/tasks/{task_id}/checklist")
async def add_task_checklist_item(task_id: str, item: ChecklistItemCreate, user: Dict = Depends(get_current_user)):
    """Add a checklist item to a task"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Checklist is only available for tasks")
    
    text = item.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # Get max order for this task
    max_order_query = "SELECT MAX(`order`) as max_order FROM task_checklist WHERE task_id = %s"
    max_order_result = db.execute_query(max_order_query, (task_id,))
    max_order = max_order_result[0]['max_order'] if max_order_result and max_order_result[0]['max_order'] is not None else -1
    new_order = max_order + 1
    
    item_id = str(uuid.uuid4())
    query = """
        INSERT INTO task_checklist (id, task_id, text, completed, `order`)
        VALUES (%s, %s, %s, %s, %s)
    """
    db.execute_update(query, (item_id, task_id, text, False, new_order))
    
    # Fetch created item
    fetch_query = """
        SELECT id, task_id, text, completed, `order`, created_at, updated_at
        FROM task_checklist
        WHERE id = %s
    """
    rows = db.execute_query(fetch_query, (item_id,))
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to load created checklist item")
    
    result_item = normalize_checklist_item(dict(rows[0]))
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "item": result_item}

@router.patch("/tasks/{task_id}/checklist/{item_id}")
async def update_task_checklist_item(
    task_id: str,
    item_id: str,
    updates: ChecklistItemUpdate,
    user: Dict = Depends(get_current_user)
):
    """Update a checklist item"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Checklist is only available for tasks")
    
    # Check if item exists and belongs to task
    check_query = "SELECT id FROM task_checklist WHERE id = %s AND task_id = %s"
    existing = db.execute_query(check_query, (item_id, task_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    updates_list = []
    params = []
    
    if updates.text is not None:
        text = updates.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        updates_list.append("text = %s")
        params.append(text)
    
    if updates.completed is not None:
        updates_list.append("completed = %s")
        params.append(bool(updates.completed))
    
    if not updates_list:
        return {"success": True, "message": "No changes"}
    
    params.extend([task_id, item_id])
    query = f"UPDATE task_checklist SET {', '.join(updates_list)} WHERE task_id = %s AND id = %s"
    db.execute_update(query, tuple(params))
    
    # Fetch updated item
    fetch_query = """
        SELECT id, task_id, text, completed, `order`, created_at, updated_at
        FROM task_checklist
        WHERE id = %s
    """
    rows = db.execute_query(fetch_query, (item_id,))
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to load updated checklist item")
    
    result_item = normalize_checklist_item(dict(rows[0]))
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True, "item": result_item}

@router.delete("/tasks/{task_id}/checklist/{item_id}")
async def delete_task_checklist_item(
    task_id: str,
    item_id: str,
    user: Dict = Depends(get_current_user)
):
    """Delete a checklist item"""
    task = ensure_task_exists(task_id)
    if task['type'] != 'task':
        raise HTTPException(status_code=400, detail="Checklist is only available for tasks")
    
    # Check if item exists and belongs to task
    check_query = "SELECT id FROM task_checklist WHERE id = %s AND task_id = %s"
    existing = db.execute_query(check_query, (item_id, task_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    db.execute_update("DELETE FROM task_checklist WHERE id = %s AND task_id = %s", (item_id, task_id))
    
    # Broadcast activity update
    await broadcast_task_activity_update(task_id)
    
    return {"success": True}


