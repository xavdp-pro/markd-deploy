from fastapi import APIRouter, HTTPException, Request, Depends, File, UploadFile
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import db
from auth import get_current_user
import uuid
import json
from datetime import datetime
from pathlib import Path
import os
import shutil

router = APIRouter(prefix="/api")

# ===== Pydantic Models =====

class TaskTypeBase(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    position: int = 0

class TaskTypeUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None

class WorkflowStatus(BaseModel):
    key: str
    label: str
    color: str

class WorkflowBase(BaseModel):
    name: str
    is_default: bool = False
    statuses: List[WorkflowStatus]

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None
    statuses: Optional[List[WorkflowStatus]] = None

class TaskCreate(BaseModel):
    workspace_id: str
    parent_id: Optional[str] = None
    task_type_id: int
    workflow_id: int
    title: str
    description: Optional[str] = None
    status: str
    priority: str = 'medium'
    due_date: Optional[str] = None
    responsible_user_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    responsible_user_id: Optional[int] = None
    task_type_id: Optional[int] = None
    workflow_id: Optional[int] = None

class TaskMove(BaseModel):
    parent_id: Optional[str] = None

class TaskAssign(BaseModel):
    user_ids: List[int]
    responsible_id: Optional[int] = None

class TaskTag(BaseModel):
    tag: str

class TaskComment(BaseModel):
    content: str

class TaskStatusChange(BaseModel):
    status: str

class TaskApplyToChildren(BaseModel):
    properties: Dict[str, Any]

# ===== Helper Functions =====

async def check_workspace_permission(workspace_id: str, user: Dict, required_level: str = 'read') -> str:
    """Check user permission for workspace. Returns permission level if authorized."""
    # Admins have full access
    if user.get('role') == 'admin':
        return 'admin'
    
    # Get user's highest permission level for this workspace via groups
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
    
    # Check required level
    level_map = {'read': 1, 'write': 2, 'admin': 3}
    if level_map.get(user_level, 0) < level_map.get(required_level, 0):
        raise HTTPException(status_code=403, detail=f"Insufficient permissions. Requires '{required_level}' level.")
    
    return user_level

async def get_task_tree(workspace_id: str, user: Dict) -> List[Dict]:
    """Get hierarchical task tree for a workspace"""
    # Check permissions
    await check_workspace_permission(workspace_id, user, 'read')
    
    # Get all tasks for workspace with related data
    query = """
        SELECT 
            t.*,
            tt.name as type_name, tt.icon as type_icon, tt.color as type_color,
            w.name as workflow_name, w.statuses as workflow_statuses,
            u_resp.username as responsible_username,
            u_creator.username as created_by_username,
            GROUP_CONCAT(DISTINCT ta.user_id) as assigned_user_ids
        FROM tasks t
        JOIN task_types tt ON t.task_type_id = tt.id
        JOIN workflows w ON t.workflow_id = w.id
        LEFT JOIN users u_resp ON t.responsible_user_id = u_resp.id
        JOIN users u_creator ON t.created_by = u_creator.id
        LEFT JOIN task_assignments ta ON t.id = ta.task_id
        WHERE t.workspace_id = %s
        GROUP BY t.id
        ORDER BY t.created_at
    """
    tasks = db.execute_query(query, (workspace_id,))
    
    # Get tags for all tasks
    tags_query = "SELECT task_id, tag FROM task_tags WHERE task_id IN (%s)" % ','.join(['%s'] * len(tasks))
    tags = db.execute_query(tags_query, tuple([t['id'] for t in tasks])) if tasks else []
    
    # Group tags by task_id
    tags_by_task = {}
    for tag in tags:
        if tag['task_id'] not in tags_by_task:
            tags_by_task[tag['task_id']] = []
        tags_by_task[tag['task_id']].append(tag['tag'])
    
    # Build task dictionary with enhanced data
    tasks_dict = {}
    for task in tasks:
        task_data = dict(task)
        task_data['tags'] = tags_by_task.get(task['id'], [])
        task_data['assigned_users'] = []
        if task['assigned_user_ids']:
            user_ids = [int(uid) for uid in task['assigned_user_ids'].split(',')]
            users_query = "SELECT id, username, email FROM users WHERE id IN (%s)" % ','.join(['%s'] * len(user_ids))
            task_data['assigned_users'] = db.execute_query(users_query, tuple(user_ids))
        
        # Parse workflow statuses from JSON
        task_data['workflow_statuses'] = json.loads(task['workflow_statuses'])
        task_data['children'] = []
        tasks_dict[task['id']] = task_data
    
    # Build tree structure
    root_tasks = []
    for task in tasks_dict.values():
        if task['parent_id']:
            parent = tasks_dict.get(task['parent_id'])
            if parent:
                parent['children'].append(task)
        else:
            root_tasks.append(task)
    
    return root_tasks

async def inherit_from_parent(parent_id: str) -> Dict:
    """Get properties to inherit from parent task"""
    query = """
        SELECT 
            t.workspace_id, t.workflow_id, t.task_type_id,
            t.responsible_user_id,
            GROUP_CONCAT(DISTINCT ta.user_id) as assigned_user_ids,
            GROUP_CONCAT(DISTINCT tt.tag) as tags
        FROM tasks t
        LEFT JOIN task_assignments ta ON t.id = ta.task_id
        LEFT JOIN task_tags tt ON t.id = tt.task_id
        WHERE t.id = %s
        GROUP BY t.id
    """
    result = db.execute_query(query, (parent_id,))
    if not result:
        return {}
    
    parent = result[0]
    inherited = {
        'workspace_id': parent['workspace_id'],
        'workflow_id': parent['workflow_id'],
        'task_type_id': parent['task_type_id'],
        'responsible_user_id': parent['responsible_user_id'],
        'assigned_user_ids': [int(uid) for uid in parent['assigned_user_ids'].split(',')] if parent['assigned_user_ids'] else [],
        'tags': parent['tags'].split(',') if parent['tags'] else []
    }
    
    return inherited

async def log_timeline_event(task_id: str, user_id: int, event_type: str, details: Dict):
    """Log a system event to task timeline"""
    content = generate_timeline_message(event_type, details)
    query = """
        INSERT INTO task_comments (task_id, user_id, content, type)
        VALUES (%s, %s, %s, 'system')
    """
    db.execute_update(query, (task_id, user_id, content))

def generate_timeline_message(event_type: str, details: Dict) -> str:
    """Generate human-readable timeline message"""
    messages = {
        'created': f"Tâche créée",
        'status_changed': f"Statut changé de '{details.get('old_status')}' à '{details.get('new_status')}'",
        'assigned': f"Assigné à {details.get('user_name')}",
        'unassigned': f"Désassigné de {details.get('user_name')}",
        'priority_changed': f"Priorité changée de '{details.get('old_priority')}' à '{details.get('new_priority')}'",
        'due_date_set': f"Date d'échéance définie au {details.get('due_date')}",
        'due_date_removed': f"Date d'échéance supprimée",
        'responsible_changed': f"Responsable changé à {details.get('user_name')}",
        'moved': f"Déplacé vers {details.get('parent_name', 'la racine')}",
    }
    return messages.get(event_type, f"Événement: {event_type}")

# ===== TASK TYPES ENDPOINTS =====

@router.get("/task-types")
async def get_task_types(workspace_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all task types for a workspace"""
    await check_workspace_permission(workspace_id, current_user, 'read')
    
    query = "SELECT * FROM task_types WHERE workspace_id = %s ORDER BY position, name"
    types = db.execute_query(query, (workspace_id,))
    return {"success": True, "task_types": types}

@router.post("/task-types")
async def create_task_type(data: TaskTypeBase, workspace_id: str, current_user: Dict = Depends(get_current_user)):
    """Create a new task type (admin only)"""
    await check_workspace_permission(workspace_id, current_user, 'admin')
    
    query = """
        INSERT INTO task_types (workspace_id, name, icon, color, position)
        VALUES (%s, %s, %s, %s, %s)
    """
    type_id = db.execute_insert(query, (workspace_id, data.name, data.icon, data.color, data.position))
    return {"success": True, "id": type_id}

@router.put("/task-types/{type_id}")
async def update_task_type(type_id: int, data: TaskTypeUpdate, current_user: Dict = Depends(get_current_user)):
    """Update a task type (admin only)"""
    # Get task type to check workspace
    type_query = "SELECT workspace_id FROM task_types WHERE id = %s"
    type_result = db.execute_query(type_query, (type_id,))
    if not type_result:
        raise HTTPException(status_code=404, detail="Task type not found")
    
    await check_workspace_permission(type_result[0]['workspace_id'], current_user, 'admin')
    
    # Build update query
    updates = []
    params = []
    if data.name is not None:
        updates.append("name = %s")
        params.append(data.name)
    if data.icon is not None:
        updates.append("icon = %s")
        params.append(data.icon)
    if data.color is not None:
        updates.append("color = %s")
        params.append(data.color)
    if data.position is not None:
        updates.append("position = %s")
        params.append(data.position)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    params.append(type_id)
    query = f"UPDATE task_types SET {', '.join(updates)} WHERE id = %s"
    db.execute_update(query, tuple(params))
    
    return {"success": True}

@router.delete("/task-types/{type_id}")
async def delete_task_type(type_id: int, current_user: Dict = Depends(get_current_user)):
    """Delete a task type (admin only)"""
    # Get task type to check workspace
    type_query = "SELECT workspace_id FROM task_types WHERE id = %s"
    type_result = db.execute_query(type_query, (type_id,))
    if not type_result:
        raise HTTPException(status_code=404, detail="Task type not found")
    
    await check_workspace_permission(type_result[0]['workspace_id'], current_user, 'admin')
    
    # Check if type is in use
    usage_query = "SELECT COUNT(*) as count FROM tasks WHERE task_type_id = %s"
    usage = db.execute_query(usage_query, (type_id,))
    if usage[0]['count'] > 0:
        raise HTTPException(status_code=400, detail="Cannot delete task type that is in use")
    
    db.execute_update("DELETE FROM task_types WHERE id = %s", (type_id,))
    return {"success": True}

# ===== WORKFLOWS ENDPOINTS =====

@router.get("/workflows")
async def get_workflows(workspace_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all workflows for a workspace"""
    await check_workspace_permission(workspace_id, current_user, 'read')
    
    query = "SELECT * FROM workflows WHERE workspace_id = %s ORDER BY is_default DESC, name"
    workflows = db.execute_query(query, (workspace_id,))
    
    # Parse statuses JSON
    for workflow in workflows:
        workflow['statuses'] = json.loads(workflow['statuses'])
    
    return {"success": True, "workflows": workflows}

@router.post("/workflows")
async def create_workflow(data: WorkflowBase, workspace_id: str, current_user: Dict = Depends(get_current_user)):
    """Create a new workflow (admin only)"""
    await check_workspace_permission(workspace_id, current_user, 'admin')
    
    # If setting as default, unset other defaults
    if data.is_default:
        db.execute_update("UPDATE workflows SET is_default = FALSE WHERE workspace_id = %s", (workspace_id,))
    
    statuses_json = json.dumps([s.dict() for s in data.statuses])
    query = """
        INSERT INTO workflows (workspace_id, name, is_default, statuses)
        VALUES (%s, %s, %s, %s)
    """
    workflow_id = db.execute_insert(query, (workspace_id, data.name, data.is_default, statuses_json))
    return {"success": True, "id": workflow_id}

@router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: int, data: WorkflowUpdate, current_user: Dict = Depends(get_current_user)):
    """Update a workflow (admin only)"""
    # Get workflow to check workspace
    workflow_query = "SELECT workspace_id FROM workflows WHERE id = %s"
    workflow_result = db.execute_query(workflow_query, (workflow_id,))
    if not workflow_result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    await check_workspace_permission(workflow_result[0]['workspace_id'], current_user, 'admin')
    
    # If setting as default, unset other defaults
    if data.is_default:
        db.execute_update("UPDATE workflows SET is_default = FALSE WHERE workspace_id = %s", 
                         (workflow_result[0]['workspace_id'],))
    
    # Build update query
    updates = []
    params = []
    if data.name is not None:
        updates.append("name = %s")
        params.append(data.name)
    if data.is_default is not None:
        updates.append("is_default = %s")
        params.append(data.is_default)
    if data.statuses is not None:
        updates.append("statuses = %s")
        params.append(json.dumps([s.dict() for s in data.statuses]))
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    params.append(workflow_id)
    query = f"UPDATE workflows SET {', '.join(updates)} WHERE id = %s"
    db.execute_update(query, tuple(params))
    
    return {"success": True}

@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: int, current_user: Dict = Depends(get_current_user)):
    """Delete a workflow (admin only)"""
    # Get workflow to check workspace
    workflow_query = "SELECT workspace_id FROM workflows WHERE id = %s"
    workflow_result = db.execute_query(workflow_query, (workflow_id,))
    if not workflow_result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    await check_workspace_permission(workflow_result[0]['workspace_id'], current_user, 'admin')
    
    # Check if workflow is in use
    usage_query = "SELECT COUNT(*) as count FROM tasks WHERE workflow_id = %s"
    usage = db.execute_query(usage_query, (workflow_id,))
    if usage[0]['count'] > 0:
        raise HTTPException(status_code=400, detail="Cannot delete workflow that is in use")
    
    db.execute_update("DELETE FROM workflows WHERE id = %s", (workflow_id,))
    return {"success": True}

# ===== TASKS ENDPOINTS =====

@router.get("/tasks/tree")
async def get_tasks_tree(workspace_id: str, current_user: Dict = Depends(get_current_user)):
    """Get hierarchical task tree"""
    tree = await get_task_tree(workspace_id, current_user)
    return {"success": True, "tasks": tree}

@router.get("/tasks/{task_id}")
async def get_task(task_id: str, current_user: Dict = Depends(get_current_user)):
    """Get single task with all details"""
    # Get task
    task_query = """
        SELECT 
            t.*,
            tt.name as type_name, tt.icon as type_icon, tt.color as type_color,
            w.name as workflow_name, w.statuses as workflow_statuses,
            u_resp.id as responsible_id, u_resp.username as responsible_username, u_resp.email as responsible_email,
            u_creator.username as created_by_username
        FROM tasks t
        JOIN task_types tt ON t.task_type_id = tt.id
        JOIN workflows w ON t.workflow_id = w.id
        LEFT JOIN users u_resp ON t.responsible_user_id = u_resp.id
        JOIN users u_creator ON t.created_by = u_creator.id
        WHERE t.id = %s
    """
    tasks = db.execute_query(task_query, (task_id,))
    if not tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = dict(tasks[0])
    
    # Check permissions
    await check_workspace_permission(task['workspace_id'], current_user, 'read')
    
    # Get assigned users
    assigned_query = """
        SELECT u.id, u.username, u.email
        FROM task_assignments ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id = %s
    """
    task['assigned_users'] = db.execute_query(assigned_query, (task_id,))
    
    # Get tags
    tags_query = "SELECT tag FROM task_tags WHERE task_id = %s"
    task['tags'] = [t['tag'] for t in db.execute_query(tags_query, (task_id,))]
    
    # Parse workflow statuses
    task['workflow_statuses'] = json.loads(task['workflow_statuses'])
    
    return {"success": True, "task": task}

@router.post("/tasks")
async def create_task(data: TaskCreate, current_user: Dict = Depends(get_current_user)):
    """Create a new task"""
    # Check permissions
    await check_workspace_permission(data.workspace_id, current_user, 'write')
    
    task_id = str(uuid.uuid4())
    
    # If parent_id specified, inherit properties
    inherited = {}
    if data.parent_id:
        inherited = await inherit_from_parent(data.parent_id)
        # Override with inherited values if not explicitly set
        if not data.responsible_user_id and inherited.get('responsible_user_id'):
            data.responsible_user_id = inherited['responsible_user_id']
    
    query = """
        INSERT INTO tasks (
            id, workspace_id, parent_id, task_type_id, workflow_id,
            title, description, status, priority, due_date, responsible_user_id, created_by
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        task_id, data.workspace_id, data.parent_id, data.task_type_id, data.workflow_id,
        data.title, data.description, data.status, data.priority, data.due_date,
        data.responsible_user_id, current_user['id']
    ))
    
    # Inherit assignments if from parent
    if data.parent_id and inherited.get('assigned_user_ids'):
        for user_id in inherited['assigned_user_ids']:
            db.execute_update(
                "INSERT INTO task_assignments (task_id, user_id) VALUES (%s, %s)",
                (task_id, user_id)
            )
    
    # Inherit tags if from parent
    if data.parent_id and inherited.get('tags'):
        for tag in inherited['tags']:
            db.execute_update(
                "INSERT INTO task_tags (task_id, tag) VALUES (%s, %s)",
                (task_id, tag)
            )
    
    # Log creation
    await log_timeline_event(task_id, current_user['id'], 'created', {})
    
    return {"success": True, "id": task_id}

@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, current_user: Dict = Depends(get_current_user)):
    """Update a task"""
    # Get task to check workspace and permissions
    task_query = "SELECT workspace_id, status, priority FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    old_task = task_result[0]
    
    # Build update query
    updates = []
    params = []
    
    if data.title is not None:
        updates.append("title = %s")
        params.append(data.title)
    if data.description is not None:
        updates.append("description = %s")
        params.append(data.description)
    if data.status is not None:
        updates.append("status = %s")
        params.append(data.status)
        # Log status change
        if data.status != old_task['status']:
            await log_timeline_event(task_id, current_user['id'], 'status_changed', {
                'old_status': old_task['status'],
                'new_status': data.status
            })
    if data.priority is not None:
        updates.append("priority = %s")
        params.append(data.priority)
        if data.priority != old_task['priority']:
            await log_timeline_event(task_id, current_user['id'], 'priority_changed', {
                'old_priority': old_task['priority'],
                'new_priority': data.priority
            })
    if data.due_date is not None:
        updates.append("due_date = %s")
        params.append(data.due_date)
    if data.responsible_user_id is not None:
        updates.append("responsible_user_id = %s")
        params.append(data.responsible_user_id)
    if data.task_type_id is not None:
        updates.append("task_type_id = %s")
        params.append(data.task_type_id)
    if data.workflow_id is not None:
        updates.append("workflow_id = %s")
        params.append(data.workflow_id)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    params.append(task_id)
    query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = %s"
    db.execute_update(query, tuple(params))
    
    return {"success": True}

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete a task (cascade to children)"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    db.execute_update("DELETE FROM tasks WHERE id = %s", (task_id,))
    return {"success": True}

@router.post("/tasks/{task_id}/move")
async def move_task(task_id: str, data: TaskMove, current_user: Dict = Depends(get_current_user)):
    """Move task to new parent"""
    # Get task to check workspace
    task_query = "SELECT workspace_id, title FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    # Check parent exists if specified
    parent_name = "la racine"
    if data.parent_id:
        parent_query = "SELECT title FROM tasks WHERE id = %s"
        parent_result = db.execute_query(parent_query, (data.parent_id,))
        if not parent_result:
            raise HTTPException(status_code=404, detail="Parent task not found")
        parent_name = parent_result[0]['title']
    
    db.execute_update("UPDATE tasks SET parent_id = %s WHERE id = %s", (data.parent_id, task_id))
    
    # Log move
    await log_timeline_event(task_id, current_user['id'], 'moved', {'parent_name': parent_name})
    
    return {"success": True}

@router.post("/tasks/{task_id}/duplicate")
async def duplicate_task(task_id: str, current_user: Dict = Depends(get_current_user)):
    """Duplicate a task and its subtree"""
    # Get task to duplicate
    task_query = "SELECT * FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = task_result[0]
    await check_workspace_permission(task['workspace_id'], current_user, 'write')
    
    # Create duplicate
    new_id = str(uuid.uuid4())
    query = """
        INSERT INTO tasks (
            id, workspace_id, parent_id, task_type_id, workflow_id,
            title, description, status, priority, due_date, responsible_user_id, created_by
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        new_id, task['workspace_id'], task['parent_id'], task['task_type_id'], task['workflow_id'],
        f"{task['title']} (copie)", task['description'], task['status'], task['priority'],
        None,  # Clear due date
        task['responsible_user_id'], current_user['id']
    ))
    
    # Copy assignments
    assign_query = "SELECT user_id FROM task_assignments WHERE task_id = %s"
    assignments = db.execute_query(assign_query, (task_id,))
    for assignment in assignments:
        db.execute_update(
            "INSERT INTO task_assignments (task_id, user_id) VALUES (%s, %s)",
            (new_id, assignment['user_id'])
        )
    
    # Copy tags
    tags_query = "SELECT tag FROM task_tags WHERE task_id = %s"
    tags = db.execute_query(tags_query, (task_id,))
    for tag in tags:
        db.execute_update(
            "INSERT INTO task_tags (task_id, tag) VALUES (%s, %s)",
            (new_id, tag['tag'])
        )
    
    return {"success": True, "id": new_id}

# ===== TASK ASSIGNMENTS =====

@router.post("/tasks/{task_id}/assign")
async def assign_users(task_id: str, data: TaskAssign, current_user: Dict = Depends(get_current_user)):
    """Assign users to a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    # Clear existing assignments
    db.execute_update("DELETE FROM task_assignments WHERE task_id = %s", (task_id,))
    
    # Add new assignments
    for user_id in data.user_ids:
        db.execute_update(
            "INSERT INTO task_assignments (task_id, user_id) VALUES (%s, %s)",
            (task_id, user_id)
        )
    
    # Update responsible if specified
    if data.responsible_id:
        db.execute_update(
            "UPDATE tasks SET responsible_user_id = %s WHERE id = %s",
            (data.responsible_id, task_id)
        )
    
    return {"success": True}

@router.delete("/tasks/{task_id}/assign/{user_id}")
async def unassign_user(task_id: str, user_id: int, current_user: Dict = Depends(get_current_user)):
    """Unassign a user from a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    db.execute_update("DELETE FROM task_assignments WHERE task_id = %s AND user_id = %s", (task_id, user_id))
    return {"success": True}

# ===== TASK TAGS =====

@router.post("/tasks/{task_id}/tags")
async def add_tag(task_id: str, data: TaskTag, current_user: Dict = Depends(get_current_user)):
    """Add a tag to a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    # Check if tag already exists
    existing = db.execute_query(
        "SELECT id FROM task_tags WHERE task_id = %s AND tag = %s",
        (task_id, data.tag)
    )
    if existing:
        return {"success": True, "message": "Tag already exists"}
    
    db.execute_update(
        "INSERT INTO task_tags (task_id, tag) VALUES (%s, %s)",
        (task_id, data.tag)
    )
    return {"success": True}

@router.delete("/tasks/{task_id}/tags/{tag}")
async def remove_tag(task_id: str, tag: str, current_user: Dict = Depends(get_current_user)):
    """Remove a tag from a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    db.execute_update("DELETE FROM task_tags WHERE task_id = %s AND tag = %s", (task_id, tag))
    return {"success": True}

# ===== TASK COMMENTS =====

@router.get("/tasks/{task_id}/comments")
async def get_comments(task_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all comments and timeline events for a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'read')
    
    query = """
        SELECT tc.*, u.username, u.email
        FROM task_comments tc
        JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = %s
        ORDER BY tc.created_at DESC
    """
    comments = db.execute_query(query, (task_id,))
    return {"success": True, "comments": comments}

@router.post("/tasks/{task_id}/comments")
async def add_comment(task_id: str, data: TaskComment, current_user: Dict = Depends(get_current_user)):
    """Add a comment to a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    query = """
        INSERT INTO task_comments (task_id, user_id, content, type)
        VALUES (%s, %s, %s, 'comment')
    """
    comment_id = db.execute_insert(query, (task_id, current_user['id'], data.content))
    return {"success": True, "id": comment_id}

@router.put("/tasks/{task_id}/comments/{comment_id}")
async def update_comment(task_id: str, comment_id: int, data: TaskComment, current_user: Dict = Depends(get_current_user)):
    """Update a comment (own comments only)"""
    # Check comment ownership
    comment_query = "SELECT user_id FROM task_comments WHERE id = %s AND task_id = %s"
    comment_result = db.execute_query(comment_query, (comment_id, task_id))
    if not comment_result:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment_result[0]['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Can only edit own comments")
    
    db.execute_update(
        "UPDATE task_comments SET content = %s WHERE id = %s",
        (data.content, comment_id)
    )
    return {"success": True}

@router.delete("/tasks/{task_id}/comments/{comment_id}")
async def delete_comment(task_id: str, comment_id: int, current_user: Dict = Depends(get_current_user)):
    """Delete a comment (own comments only or admin)"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check comment ownership
    comment_query = "SELECT user_id FROM task_comments WHERE id = %s AND task_id = %s"
    comment_result = db.execute_query(comment_query, (comment_id, task_id))
    if not comment_result:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Allow deletion if owner or workspace admin
    if comment_result[0]['user_id'] != current_user['id']:
        await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'admin')
    
    db.execute_update("DELETE FROM task_comments WHERE id = %s", (comment_id,))
    return {"success": True}

# ===== TASK FILES =====

# Create task files upload directory
TASK_FILES_DIR = Path("task_files")
TASK_FILES_DIR.mkdir(exist_ok=True)

@router.get("/tasks/{task_id}/files")
async def get_files(task_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all files attached to a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'read')
    
    query = """
        SELECT tf.*, u.username
        FROM task_files tf
        JOIN users u ON tf.uploaded_by = u.id
        WHERE tf.task_id = %s
        ORDER BY tf.uploaded_at DESC
    """
    files = db.execute_query(query, (task_id,))
    return {"success": True, "files": files}

@router.post("/tasks/{task_id}/upload-file")
async def upload_file(task_id: str, file: UploadFile = File(...), current_user: Dict = Depends(get_current_user)):
    """Upload a file to a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    # Generate unique filename
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = TASK_FILES_DIR / unique_filename
    
    # Save file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get file size
    file_size = file_path.stat().st_size
    
    # Save to database
    query = """
        INSERT INTO task_files (task_id, filename, file_path, file_size, mime_type, uploaded_by)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    file_id = db.execute_insert(query, (
        task_id, file.filename, str(file_path), file_size,
        file.content_type, current_user['id']
    ))
    
    return {"success": True, "id": file_id, "filename": file.filename}

@router.delete("/tasks/{task_id}/files/{file_id}")
async def delete_file(task_id: str, file_id: int, current_user: Dict = Depends(get_current_user)):
    """Delete a file from a task"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    # Get file info
    file_query = "SELECT file_path FROM task_files WHERE id = %s AND task_id = %s"
    file_result = db.execute_query(file_query, (file_id, task_id))
    if not file_result:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete physical file
    file_path = Path(file_result[0]['file_path'])
    if file_path.exists():
        file_path.unlink()
    
    # Delete from database
    db.execute_update("DELETE FROM task_files WHERE id = %s", (file_id,))
    return {"success": True}

# ===== TASK ACTIONS =====

@router.post("/tasks/{task_id}/change-status")
async def change_status(task_id: str, data: TaskStatusChange, current_user: Dict = Depends(get_current_user)):
    """Change task status with timeline logging"""
    # Get task
    task_query = "SELECT workspace_id, status FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    old_status = task_result[0]['status']
    
    # Update status
    db.execute_update("UPDATE tasks SET status = %s WHERE id = %s", (data.status, task_id))
    
    # Log timeline event
    await log_timeline_event(task_id, current_user['id'], 'status_changed', {
        'old_status': old_status,
        'new_status': data.status
    })
    
    return {"success": True}

@router.post("/tasks/{task_id}/apply-to-children")
async def apply_to_children(task_id: str, data: TaskApplyToChildren, current_user: Dict = Depends(get_current_user)):
    """Apply properties to all children tasks"""
    # Get task to check workspace
    task_query = "SELECT workspace_id FROM tasks WHERE id = %s"
    task_result = db.execute_query(task_query, (task_id,))
    if not task_result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await check_workspace_permission(task_result[0]['workspace_id'], current_user, 'write')
    
    # Get all children (recursive)
    def get_all_children(parent_id):
        children_query = "SELECT id FROM tasks WHERE parent_id = %s"
        direct_children = db.execute_query(children_query, (parent_id,))
        all_children = [c['id'] for c in direct_children]
        for child in direct_children:
            all_children.extend(get_all_children(child['id']))
        return all_children
    
    children_ids = get_all_children(task_id)
    
    if not children_ids:
        return {"success": True, "message": "No children to update"}
    
    # Apply properties to all children
    for prop_name, prop_value in data.properties.items():
        if prop_name in ['workflow_id', 'task_type_id', 'priority', 'responsible_user_id']:
            placeholders = ','.join(['%s'] * len(children_ids))
            query = f"UPDATE tasks SET {prop_name} = %s WHERE id IN ({placeholders})"
            db.execute_update(query, (prop_value, *children_ids))
    
    return {"success": True, "updated_count": len(children_ids)}

