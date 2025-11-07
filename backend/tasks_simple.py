from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List, Dict
from database import db
import uuid
from auth import get_current_user

router = APIRouter(prefix="/api")

# Pydantic Models
class TaskBase(BaseModel):
    name: str
    type: str  # 'task' or 'folder'
    parent_id: Optional[str] = None
    content: Optional[str] = None
    workspace_id: str = 'default'
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

# Helper function
def build_task_tree(parent_id: Optional[str] = 'root', workspace_id: str = 'default', depth: int = 0) -> List[Dict]:
    """Build task tree recursively"""
    if depth > 20:
        return []
    
    query = """
        SELECT id, name, type, content, parent_id, status, priority, assigned_to, due_date, created_at, updated_at, workspace_id
        FROM tasks
        WHERE parent_id = %s AND id != 'root' AND workspace_id = %s
        ORDER BY type DESC, name ASC
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
        
        # Check lock
        lock_query = "SELECT user_id, user_name FROM task_locks WHERE task_id = %s"
        locks = db.execute_query(lock_query, (task['id'],))
        task_dict['locked_by'] = locks[0] if locks else None
        
        # Get children
        if task['type'] == 'folder':
            task_dict['children'] = build_task_tree(task['id'], workspace_id, depth + 1)
        
        result.append(task_dict)
    
    return result

# Endpoints
@router.get("/tasks/tree")
async def get_task_tree(workspace_id: str = 'default', user: Dict = Depends(get_current_user)):
    """Get full task tree"""
    try:
        tree = build_task_tree('root', workspace_id)
        ws_query = "SELECT name FROM workspaces WHERE id = %s"
        ws = db.execute_query(ws_query, (workspace_id,))
        workspace_name = ws[0]['name'] if ws else 'Tasks'
        
        return {"success": True, "tree": tree, "workspace_name": workspace_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
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
        
        return {"success": True, "task": task}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks")
async def create_task(task: TaskBase, user: Dict = Depends(get_current_user)):
    """Create new task or folder"""
    try:
        task_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO tasks (id, name, type, parent_id, content, workspace_id, user_id, status, priority, assigned_to, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            task_id, task.name, task.type, task.parent_id, task.content,
            task.workspace_id, user['id'], task.status, task.priority, task.assigned_to, task.due_date
        ))
        
        return {"success": True, "task": {"id": task_id, **task.dict()}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate):
    """Update task"""
    try:
        updates = []
        params = []
        
        if task.name is not None:
            updates.append("name = %s")
            params.append(task.name)
        if task.content is not None:
            updates.append("content = %s")
            params.append(task.content)
        if task.parent_id is not None:
            updates.append("parent_id = %s")
            params.append(task.parent_id)
        if task.status is not None:
            updates.append("status = %s")
            params.append(task.status)
        if task.priority is not None:
            updates.append("priority = %s")
            params.append(task.priority)
        if task.assigned_to is not None:
            updates.append("assigned_to = %s")
            params.append(task.assigned_to)
        if task.due_date is not None:
            updates.append("due_date = %s")
            params.append(task.due_date)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.append(task_id)
        query = f"UPDATE tasks SET {', '.join(updates)} WHERE id = %s"
        db.execute_update(query, tuple(params))
        
        return {"success": True, "message": "Task updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete task"""
    try:
        if task_id == 'root':
            raise HTTPException(status_code=400, detail="Cannot delete root")
        
        db.execute_update("DELETE FROM tasks WHERE id = %s", (task_id,))
        return {"success": True, "message": "Task deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/{task_id}/move")
async def move_task(task_id: str, move_data: TaskMove):
    """Move task to new parent"""
    try:
        db.execute_update("UPDATE tasks SET parent_id = %s WHERE id = %s", (move_data.parent_id, task_id))
        return {"success": True, "message": "Task moved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/{task_id}/copy")
async def copy_task(task_id: str, user: Dict = Depends(get_current_user)):
    """Copy task"""
    try:
        query = "SELECT * FROM tasks WHERE id = %s"
        tasks = db.execute_query(query, (task_id,))
        
        if not tasks:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task = tasks[0]
        new_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO tasks (id, name, type, parent_id, content, workspace_id, user_id, status, priority, assigned_to, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            new_id, f"{task['name']} (copie)", task['type'], task['parent_id'],
            task['content'], task['workspace_id'], user['id'],
            task['status'], task['priority'], task['assigned_to'], task['due_date']
        ))
        
        return {"success": True, "task_id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        
        return {"success": True, "message": "Task locked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tasks/{task_id}/lock")
async def unlock_task(task_id: str, user_id: str):
    """Unlock task"""
    try:
        db.execute_update("DELETE FROM task_locks WHERE task_id = %s AND user_id = %s", (task_id, user_id))
        return {"success": True, "message": "Task unlocked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

