from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import db
import uuid

router = APIRouter(prefix="/api")

# ===== Pydantic Models =====

class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class GroupUserAdd(BaseModel):
    user_id: int

class GroupWorkspacePermission(BaseModel):
    workspace_id: str
    permission_level: str  # 'read', 'write', 'admin'

# ===== Group Management Endpoints =====

@router.get("/groups")
async def get_groups(request: Request):
    """Get all groups (admin only)"""
    try:
        # Note: Add authentication check here
        query = """
            SELECT g.*, COUNT(DISTINCT ug.user_id) as user_count,
                   COUNT(DISTINCT gwp.workspace_id) as workspace_count
            FROM `groups` g
            LEFT JOIN user_groups ug ON g.id = ug.group_id
            LEFT JOIN group_workspace_permissions gwp ON g.id = gwp.group_id
            GROUP BY g.id
            ORDER BY g.name
        """
        groups = db.execute_query(query)
        return {"success": True, "groups": groups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/groups")
async def create_group(group: GroupBase, request: Request):
    """Create a new group (admin only)"""
    try:
        group_id = str(uuid.uuid4())
        query = """
            INSERT INTO `groups` (id, name, description)
            VALUES (%s, %s, %s)
        """
        db.execute_update(query, (group_id, group.name, group.description))
        
        return {
            "success": True,
            "group": {
                "id": group_id,
                "name": group.name,
                "description": group.description
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/groups/{group_id}")
async def update_group(group_id: str, group: GroupUpdate, request: Request):
    """Update a group (admin only)"""
    try:
        # Build update query dynamically
        updates = []
        params = []
        
        if group.name is not None:
            updates.append("name = %s")
            params.append(group.name)
        
        if group.description is not None:
            updates.append("description = %s")
            params.append(group.description)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.append(group_id)
        query = f"UPDATE `groups` SET {', '.join(updates)} WHERE id = %s"
        affected = db.execute_update(query, tuple(params))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Group not found")
        
        return {"success": True, "message": "Group updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, request: Request):
    """Delete a group (admin only)"""
    try:
        # Prevent deleting only the ALL group
        if group_id == 'all':
            raise HTTPException(status_code=400, detail="Cannot delete the ALL group")
        
        query = "DELETE FROM `groups` WHERE id = %s"
        affected = db.execute_update(query, (group_id,))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Group not found")
        
        return {"success": True, "message": "Group deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Group Users Management =====

@router.get("/groups/{group_id}/users")
async def get_group_users(group_id: str, request: Request):
    """Get all users in a group"""
    try:
        query = """
            SELECT u.id, u.username, u.email, u.role, ug.added_at
            FROM user_groups ug
            JOIN users u ON ug.user_id = u.id
            WHERE ug.group_id = %s
            ORDER BY u.username
        """
        users = db.execute_query(query, (group_id,))
        return {"success": True, "users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/groups/{group_id}/users")
async def add_user_to_group(group_id: str, data: GroupUserAdd, request: Request):
    """Add a user to a group (admin only)"""
    try:
        # Check if user exists
        user_query = "SELECT id FROM users WHERE id = %s"
        user_exists = db.execute_query(user_query, (data.user_id,))
        if not user_exists:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if group exists
        group_query = "SELECT id FROM `groups` WHERE id = %s"
        group_exists = db.execute_query(group_query, (group_id,))
        if not group_exists:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Add user to group
        query = """
            INSERT INTO user_groups (user_id, group_id)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE user_id=user_id
        """
        db.execute_update(query, (data.user_id, group_id))
        
        return {"success": True, "message": "User added to group"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/groups/{group_id}/users/{user_id}")
async def remove_user_from_group(group_id: str, user_id: int, request: Request):
    """Remove a user from a group (admin only)"""
    try:
        # Prevent removing users from ALL group
        if group_id == 'all':
            raise HTTPException(status_code=400, detail="Cannot remove users from ALL group")
        
        query = "DELETE FROM user_groups WHERE group_id = %s AND user_id = %s"
        affected = db.execute_update(query, (group_id, user_id))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="User not in group")
        
        return {"success": True, "message": "User removed from group"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Group Workspace Permissions =====

@router.get("/groups/{group_id}/workspaces")
async def get_group_workspaces(group_id: str, request: Request):
    """Get all workspaces accessible by a group"""
    try:
        query = """
            SELECT w.id, w.name, w.description, gwp.permission_level, gwp.granted_at
            FROM group_workspace_permissions gwp
            JOIN workspaces w ON gwp.workspace_id = w.id
            WHERE gwp.group_id = %s
            ORDER BY w.name
        """
        workspaces = db.execute_query(query, (group_id,))
        return {"success": True, "workspaces": workspaces}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/groups/{group_id}/workspaces")
async def add_workspace_to_group(group_id: str, data: GroupWorkspacePermission, request: Request):
    """Grant a group access to a workspace (admin only)"""
    try:
        # Validate permission level
        if data.permission_level not in ['read', 'write', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid permission level")
        
        # Check if workspace exists
        ws_query = "SELECT id FROM workspaces WHERE id = %s"
        ws_exists = db.execute_query(ws_query, (data.workspace_id,))
        if not ws_exists:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Check if group exists
        group_query = "SELECT id FROM `groups` WHERE id = %s"
        group_exists = db.execute_query(group_query, (group_id,))
        if not group_exists:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Add or update permission
        query = """
            INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE permission_level = %s
        """
        db.execute_update(query, (group_id, data.workspace_id, data.permission_level, data.permission_level))
        
        return {"success": True, "message": "Workspace access granted to group"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/groups/{group_id}/workspaces/{workspace_id}")
async def update_group_workspace_permission(
    group_id: str, 
    workspace_id: str, 
    data: GroupWorkspacePermission, 
    request: Request
):
    """Update group permission for a workspace (admin only)"""
    try:
        # Validate permission level
        if data.permission_level not in ['read', 'write', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid permission level")
        
        query = """
            UPDATE group_workspace_permissions 
            SET permission_level = %s 
            WHERE group_id = %s AND workspace_id = %s
        """
        affected = db.execute_update(query, (data.permission_level, group_id, workspace_id))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        return {"success": True, "message": "Permission updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/groups/{group_id}/workspaces/{workspace_id}")
async def remove_workspace_from_group(group_id: str, workspace_id: str, request: Request):
    """Revoke group access to a workspace (admin only)"""
    try:
        query = "DELETE FROM group_workspace_permissions WHERE group_id = %s AND workspace_id = %s"
        affected = db.execute_update(query, (group_id, workspace_id))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        return {"success": True, "message": "Workspace access revoked from group"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
