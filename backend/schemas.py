from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from database import db
from websocket_broadcasts import broadcast_schema_tree_update, broadcast_schema_lock_update, broadcast_schema_content_updated
from schema_device_templates import get_device_templates, get_template_by_type
import uuid
from datetime import datetime, timedelta
import json

router = APIRouter()

# Constants
LOCK_TIMEOUT_MINUTES = 30

# Import get_current_user from auth
from auth import get_current_user

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

def build_schemas_tree(parent_id: Optional[str] = None, workspace_id: str = 'demo', depth: int = 0) -> List[Dict]:
    """Build schemas tree recursively with depth limit"""
    # Prevent infinite recursion
    if depth > 20:
        return []
    
    # For root level, get all schemas/folders with parent_id = NULL in the specified workspace
    # Order: folders first (type='folder'), then schemas (type='schema')
    if parent_id is None:
        query = """
            SELECT s.id, s.name, s.type, s.parent_id, s.description, s.created_at, s.updated_at, s.workspace_id,
                   sl.user_id as locked_user_id, sl.user_name as locked_user_name, sl.locked_at as locked_at
            FROM `schemas` s
            LEFT JOIN schema_locks sl ON s.id = sl.schema_id
            WHERE s.parent_id IS NULL AND s.workspace_id = %s
            ORDER BY CASE WHEN s.type = 'folder' THEN 0 ELSE 1 END, s.name ASC
        """
        params = (workspace_id,)
    else:
        query = """
            SELECT s.id, s.name, s.type, s.parent_id, s.description, s.created_at, s.updated_at, s.workspace_id,
                   sl.user_id as locked_user_id, sl.user_name as locked_user_name, sl.locked_at as locked_at
            FROM `schemas` s
            LEFT JOIN schema_locks sl ON s.id = sl.schema_id
            WHERE s.parent_id = %s AND s.workspace_id = %s
            ORDER BY CASE WHEN s.type = 'folder' THEN 0 ELSE 1 END, s.name ASC
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
            if locked_at and isinstance(locked_at, datetime) and (datetime.now() - locked_at) > timedelta(minutes=LOCK_TIMEOUT_MINUTES):
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
            if isinstance(item_dict['created_at'], datetime):
                item_dict['created_at'] = item_dict['created_at'].isoformat()
        if item_dict.get('updated_at'):
            if isinstance(item_dict['updated_at'], datetime):
                item_dict['updated_at'] = item_dict['updated_at'].isoformat()
        
        # If folder, get children recursively with depth tracking
        if item_dict.get('type') == 'folder':
            item_dict['children'] = build_schemas_tree(item['id'], workspace_id, depth + 1)
        
        result.append(item_dict)
    
    return result

def log_schema_activity(user_id: int, workspace_id: str, schema_id: str, action: str, item_path: str, item_name: str):
    """Log schema activity"""
    activity_id = str(uuid.uuid4())
    query = """
        INSERT INTO schema_activity_log (id, user_id, workspace_id, schema_id, action, item_path, item_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (activity_id, user_id, workspace_id, schema_id, action, item_path, item_name))

def fetch_schema_tags(schema_id: str) -> List[Dict[str, Any]]:
    """Fetch tags for a schema"""
    query = """
        SELECT t.id, t.name
        FROM schema_tag_links stl
        JOIN tags t ON stl.tag_id = t.id
        WHERE stl.schema_id = %s
        ORDER BY t.name
    """
    results = db.execute_query(query, (schema_id,))
    return [dict(row) for row in results]

def upsert_schema_tag(name: str) -> Dict[str, Any]:
    """Create or get schema tag (uses unified tags table)"""
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

def update_schema_tags(schema_id: str, tag_names: List[str]) -> List[Dict[str, Any]]:
    """Update tags for a schema"""
    current_tags = fetch_schema_tags(schema_id)
    normalized = normalize_tag_names(tag_names)
    desired_tags: List[Dict[str, Any]] = [upsert_schema_tag(name) for name in normalized]

    current_ids = {tag['id'] for tag in current_tags}
    desired_ids = {tag['id'] for tag in desired_tags}

    # Remove links no longer needed
    to_remove = list(current_ids - desired_ids)
    if to_remove:
        placeholders = ','.join(['%s'] * len(to_remove))
        params = tuple([schema_id, *to_remove])
        db.execute_update(
            f"DELETE FROM schema_tag_links WHERE schema_id = %s AND tag_id IN ({placeholders})",
            params
        )

    # Insert new links
    for tag in desired_tags:
        if tag['id'] not in current_ids:
            db.execute_update(
                "INSERT INTO schema_tag_links (schema_id, tag_id) VALUES (%s, %s)",
                (schema_id, tag['id'])
            )

    return desired_tags

def build_path(schema_id: str, schemas_map: Dict[str, Dict]) -> str:
    """Build full path for a schema"""
    parts = []
    current_id = schema_id
    
    while current_id and current_id in schemas_map:
        schema = schemas_map[current_id]
        parts.insert(0, schema['name'])
        current_id = schema.get('parent_id')
    
    return ' / '.join(parts) if parts else ''

# ===== Pydantic Models =====

class SchemaCreate(BaseModel):
    workspace_id: str
    parent_id: Optional[str] = None
    name: str
    type: str  # 'schema' or 'folder'
    description: Optional[str] = None

class SchemaUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    description: Optional[str] = None

class DeviceCreate(BaseModel):
    device_type: str
    name: str
    model: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    position_x: int
    position_y: int
    config_json: Optional[Dict[str, Any]] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    model: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None

class ConnectionCreate(BaseModel):
    from_device_id: str
    from_port: str
    to_device_id: str
    to_port: str
    connection_type: Optional[str] = None
    bandwidth: Optional[int] = None
    vlan_id: Optional[int] = None
    config_json: Optional[Dict[str, Any]] = None

class ConnectionUpdate(BaseModel):
    connection_type: Optional[str] = None
    bandwidth: Optional[int] = None
    vlan_id: Optional[int] = None
    config_json: Optional[Dict[str, Any]] = None

class LockRequest(BaseModel):
    user_id: int
    user_name: str

class TagsUpdate(BaseModel):
    tags: List[str] = []

# ===== Endpoints =====

# GET DEVICE TEMPLATES (must be before /api/schemas/{schema_id} routes)
@router.get("/api/schemas/device-templates")
async def get_device_templates_endpoint(workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Get all available device templates (built-in + custom for workspace)"""
    # Get built-in templates
    builtin_templates = get_device_templates()
    
    # Get custom templates for workspace
    custom_query = """
        SELECT id, device_type, name, description, default_ports, icon_svg, default_size
        FROM schema_device_templates
        WHERE workspace_id = %s
    """
    custom_results = db.execute_query(custom_query, (workspace_id,))
    
    custom_templates = []
    for row in custom_results:
        template = {
            'device_type': row['device_type'],
            'name': row['name'],
            'description': row.get('description', ''),
            'default_ports': json.loads(row['default_ports']) if isinstance(row['default_ports'], str) else row['default_ports'],
            'icon_svg': row.get('icon_svg', ''),
            'default_size': json.loads(row['default_size']) if isinstance(row['default_size'], str) else row['default_size'],
            'is_custom': True,
            'template_id': row['id']
        }
        custom_templates.append(template)
    
    # Combine built-in and custom templates
    all_templates = builtin_templates + custom_templates
    return {"success": True, "templates": all_templates}

# GET TREE
@router.get("/api/schemas/tree")
async def get_schemas_tree(workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Get schemas tree for a workspace (requires read permission)"""
    try:
        user_id = current_user['id']
        user_role = current_user.get('role')
        permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
        
        if permission == 'none':
            raise HTTPException(status_code=403, detail="Access denied")
        
        tree = build_schemas_tree(None, workspace_id)
        
        # Get workspace info
        ws_query = "SELECT name FROM workspaces WHERE id = %s"
        ws = db.execute_query(ws_query, (workspace_id,))
        workspace_name = ws[0]['name'] if ws else 'Schemas'
        
        return {"success": True, "tree": tree or [], "workspace_name": workspace_name}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# CREATE
@router.post("/api/schemas")
async def create_schema(data: SchemaCreate, current_user: Dict = Depends(get_current_user)):
    """Create schema or folder (requires write or admin)"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, data.workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Validate name
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Validate type
    if data.type not in ['schema', 'folder']:
        raise HTTPException(status_code=400, detail="Type must be 'schema' or 'folder'")
    
    # Validate parent if provided
    if data.parent_id:
        parent_query = "SELECT id, type, workspace_id FROM `schemas` WHERE id = %s"
        parent_result = db.execute_query(parent_query, (data.parent_id,))
        if not parent_result:
            raise HTTPException(status_code=404, detail="Parent not found")
        if parent_result[0]['type'] != 'folder':
            raise HTTPException(status_code=400, detail="Parent must be a folder")
        if parent_result[0]['workspace_id'] != data.workspace_id:
            raise HTTPException(status_code=400, detail="Parent must be in the same workspace")
    
    schema_id = str(uuid.uuid4())
    name = data.name.strip()
    
    query = """
        INSERT INTO `schemas` 
        (id, workspace_id, parent_id, type, name, description, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        schema_id, data.workspace_id, data.parent_id, data.type, name, data.description, user_id
    ))
    
    # Build item path for activity log
    item_path = name
    if data.parent_id:
        item_path = name
    
    # Log activity
    log_schema_activity(user_id, data.workspace_id, schema_id, 'create', item_path, name)
    
    # Broadcast tree update to all clients
    await broadcast_schema_tree_update()
    
    # Get created schema
    get_query = """
        SELECT id, name, type, parent_id, description, created_at, updated_at, workspace_id
        FROM `schemas` WHERE id = %s
    """
    schema_result = db.execute_query(get_query, (schema_id,))
    schema_item = dict(schema_result[0]) if schema_result else {}
    
    # Convert datetime objects
    if schema_item.get('created_at'):
        if isinstance(schema_item['created_at'], datetime):
            schema_item['created_at'] = schema_item['created_at'].isoformat()
    if schema_item.get('updated_at'):
        if isinstance(schema_item['updated_at'], datetime):
            schema_item['updated_at'] = schema_item['updated_at'].isoformat()
    
    return {"success": True, "schema": schema_item}

# GET
@router.get("/api/schemas/{schema_id}")
async def get_schema(schema_id: str, current_user: Dict = Depends(get_current_user)):
    """Get schema details with devices and connections (requires read permission)"""
    try:
        query = """
            SELECT id, name, type, parent_id, description, created_at, updated_at, workspace_id, created_by
            FROM `schemas` WHERE id = %s
        """
        result = db.execute_query(query, (schema_id,))
        
        if not result:
            raise HTTPException(status_code=404, detail="Schema not found")
        
        schema_item = dict(result[0])
        user_id = current_user['id']
        user_role = current_user.get('role')
        permission = get_workspace_permission_sync(user_id, schema_item['workspace_id'], user_role)
        
        if permission == 'none':
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Convert datetime objects
        if schema_item.get('created_at'):
            if isinstance(schema_item['created_at'], datetime):
                schema_item['created_at'] = schema_item['created_at'].isoformat()
        if schema_item.get('updated_at'):
            if isinstance(schema_item['updated_at'], datetime):
                schema_item['updated_at'] = schema_item['updated_at'].isoformat()
        
        # Get devices
        devices_query = """
            SELECT id, schema_id, device_type, name, model, ip_address, mac_address,
                   position_x, position_y, config_json, created_at, updated_at
            FROM schema_devices WHERE schema_id = %s
        """
        devices_result = db.execute_query(devices_query, (schema_id,))
        devices = []
        for device in devices_result:
            device_dict = dict(device)
            # Parse config_json if it's a string
            if device_dict.get('config_json') and isinstance(device_dict['config_json'], str):
                try:
                    device_dict['config_json'] = json.loads(device_dict['config_json'])
                except:
                    device_dict['config_json'] = {}
            # Convert datetime objects
            if device_dict.get('created_at'):
                if isinstance(device_dict['created_at'], datetime):
                    device_dict['created_at'] = device_dict['created_at'].isoformat()
            if device_dict.get('updated_at'):
                if isinstance(device_dict['updated_at'], datetime):
                    device_dict['updated_at'] = device_dict['updated_at'].isoformat()
            devices.append(device_dict)
        
        # Get connections
        connections_query = """
            SELECT id, schema_id, from_device_id, from_port, to_device_id, to_port,
                   connection_type, bandwidth, vlan_id, config_json, created_at, updated_at
            FROM schema_connections WHERE schema_id = %s
        """
        connections_result = db.execute_query(connections_query, (schema_id,))
        connections = []
        for conn in connections_result:
            conn_dict = dict(conn)
            # Parse config_json if it's a string
            if conn_dict.get('config_json') and isinstance(conn_dict['config_json'], str):
                try:
                    conn_dict['config_json'] = json.loads(conn_dict['config_json'])
                except:
                    conn_dict['config_json'] = {}
            # Convert datetime objects
            if conn_dict.get('created_at'):
                if isinstance(conn_dict['created_at'], datetime):
                    conn_dict['created_at'] = conn_dict['created_at'].isoformat()
            if conn_dict.get('updated_at'):
                if isinstance(conn_dict['updated_at'], datetime):
                    conn_dict['updated_at'] = conn_dict['updated_at'].isoformat()
            connections.append(conn_dict)
        
        schema_item['devices'] = devices
        schema_item['connections'] = connections
        
        return {"success": True, "schema": schema_item}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# UPDATE
@router.put("/api/schemas/{schema_id}")
async def update_schema(schema_id: str, data: SchemaUpdate, current_user: Dict = Depends(get_current_user)):
    """Update schema (rename, move, or update description) (requires write or admin)"""
    user_id = current_user['id']
    
    # Get current schema
    get_query = "SELECT workspace_id, type, name FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(get_query, (schema_id,))
    
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    workspace_id = schema_result[0]['workspace_id']
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
        params.append(data.name.strip())
        action = 'rename'
    
    if data.description is not None:
        updates.append("description = %s")
        params.append(data.description)
        if not action:
            action = 'update'
    
    if data.parent_id is not None:
        # Validate parent
        if data.parent_id:
            parent_query = "SELECT id, type, workspace_id FROM `schemas` WHERE id = %s"
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
    
    params.append(schema_id)
    update_query = f"""
        UPDATE `schemas` 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    db.execute_update(update_query, tuple(params))
    
    # Log activity
    if action:
        log_schema_activity(user_id, workspace_id, schema_id, action, schema_result[0]['name'], data.name or schema_result[0]['name'])
    
    # Broadcast tree update
    await broadcast_schema_tree_update()
    
    return {"success": True, "message": f"Schema {action} successful"}

# DELETE
@router.delete("/api/schemas/{schema_id}")
async def delete_schema(schema_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete schema or folder (recursive) (requires write or admin)"""
    user_id = current_user['id']
    
    # Get schema info
    query = "SELECT id, workspace_id, type, name FROM `schemas` WHERE id = %s"
    result = db.execute_query(query, (schema_id,))
    
    if not result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    schema_info = result[0]
    workspace_id = schema_info['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Build path for activity log
    all_schemas_query = "SELECT id, name, parent_id FROM `schemas` WHERE workspace_id = %s"
    all_schemas = db.execute_query(all_schemas_query, (workspace_id,))
    schemas_map = {s['id']: dict(s) for s in all_schemas}
    item_path = build_path(schema_id, schemas_map)
    
    # Delete (CASCADE will handle children, devices, connections, locks, tags, activity logs)
    delete_query = "DELETE FROM `schemas` WHERE id = %s"
    db.execute_update(delete_query, (schema_id,))
    
    # Log activity
    log_schema_activity(user_id, workspace_id, schema_id, 'delete', item_path, schema_info['name'])
    
    # Broadcast tree update
    await broadcast_schema_tree_update()
    
    return {"success": True, "message": "Schema deleted"}

# ===== Device Endpoints =====

# GET DEVICES
@router.get("/api/schemas/{schema_id}/devices")
async def get_schema_devices(schema_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all devices for a schema (requires read permission)"""
    user_id = current_user['id']
    
    # Check schema exists and get workspace
    schema_query = "SELECT workspace_id FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get devices
    devices_query = """
        SELECT id, schema_id, device_type, name, model, ip_address, mac_address,
               position_x, position_y, config_json, created_at, updated_at
        FROM schema_devices WHERE schema_id = %s
    """
    devices_result = db.execute_query(devices_query, (schema_id,))
    devices = []
    for device in devices_result:
        device_dict = dict(device)
        # Parse config_json if it's a string
        if device_dict.get('config_json') and isinstance(device_dict['config_json'], str):
            try:
                device_dict['config_json'] = json.loads(device_dict['config_json'])
            except:
                device_dict['config_json'] = {}
        # Convert datetime objects
        if device_dict.get('created_at'):
            if isinstance(device_dict['created_at'], datetime):
                device_dict['created_at'] = device_dict['created_at'].isoformat()
        if device_dict.get('updated_at'):
            if isinstance(device_dict['updated_at'], datetime):
                device_dict['updated_at'] = device_dict['updated_at'].isoformat()
        devices.append(device_dict)
    
    return {"success": True, "devices": devices}

# CREATE DEVICE
@router.post("/api/schemas/{schema_id}/devices")
async def create_device(schema_id: str, data: DeviceCreate, current_user: Dict = Depends(get_current_user)):
    """Create a device in a schema (requires write or admin)"""
    user_id = current_user['id']
    
    # Check schema exists and get workspace
    schema_query = "SELECT workspace_id, type FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    if schema_result[0]['type'] != 'schema':
        raise HTTPException(status_code=400, detail="Can only add devices to schemas, not folders")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Validate device_type exists in templates
    template = get_template_by_type(data.device_type)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown device type: {data.device_type}")
    
    device_id = str(uuid.uuid4())
    config_json_str = json.dumps(data.config_json) if data.config_json else None
    
    query = """
        INSERT INTO schema_devices 
        (id, schema_id, device_type, name, model, ip_address, mac_address, position_x, position_y, config_json, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        device_id, schema_id, data.device_type, data.name, data.model, data.ip_address,
        data.mac_address, data.position_x, data.position_y, config_json_str, user_id
    ))
    
    # Broadcast content update
    await broadcast_schema_content_updated(schema_id, user_id)
    
    # Get created device
    get_query = """
        SELECT id, schema_id, device_type, name, model, ip_address, mac_address,
               position_x, position_y, config_json, created_at, updated_at
        FROM schema_devices WHERE id = %s
    """
    device_result = db.execute_query(get_query, (device_id,))
    device = dict(device_result[0]) if device_result else {}
    
    # Parse config_json
    if device.get('config_json') and isinstance(device['config_json'], str):
        try:
            device['config_json'] = json.loads(device['config_json'])
        except:
            device['config_json'] = {}
    
    # Convert datetime objects
    if device.get('created_at'):
        if isinstance(device['created_at'], datetime):
            device['created_at'] = device['created_at'].isoformat()
    if device.get('updated_at'):
        if isinstance(device['updated_at'], datetime):
            device['updated_at'] = device['updated_at'].isoformat()
    
    return {"success": True, "device": device}

# UPDATE DEVICE
@router.put("/api/schemas/{schema_id}/devices/{device_id}")
async def update_device(schema_id: str, device_id: str, data: DeviceUpdate, current_user: Dict = Depends(get_current_user)):
    """Update a device (requires write or admin)"""
    user_id = current_user['id']
    
    # Check device exists and belongs to schema
    device_query = """
        SELECT sd.id, sd.schema_id, s.workspace_id
        FROM schema_devices sd
        JOIN `schemas` s ON sd.schema_id = s.id
        WHERE sd.id = %s AND sd.schema_id = %s
    """
    device_result = db.execute_query(device_query, (device_id, schema_id))
    if not device_result:
        raise HTTPException(status_code=404, detail="Device not found")
    
    workspace_id = device_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Build update query
    updates = []
    params = []
    
    if data.name is not None:
        updates.append("name = %s")
        params.append(data.name)
    if data.position_x is not None:
        updates.append("position_x = %s")
        params.append(data.position_x)
    if data.position_y is not None:
        updates.append("position_y = %s")
        params.append(data.position_y)
    if data.model is not None:
        updates.append("model = %s")
        params.append(data.model)
    if data.ip_address is not None:
        updates.append("ip_address = %s")
        params.append(data.ip_address)
    if data.mac_address is not None:
        updates.append("mac_address = %s")
        params.append(data.mac_address)
    if data.config_json is not None:
        updates.append("config_json = %s")
        params.append(json.dumps(data.config_json))
    
    if not updates:
        return {"success": True, "message": "No changes"}
    
    params.extend([device_id])
    update_query = f"""
        UPDATE schema_devices 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    db.execute_update(update_query, tuple(params))
    
    # Broadcast content update
    await broadcast_schema_content_updated(schema_id, user_id)
    
    # Get updated device
    get_query = """
        SELECT id, schema_id, device_type, name, model, ip_address, mac_address,
               position_x, position_y, config_json, created_at, updated_at
        FROM schema_devices WHERE id = %s
    """
    device_result = db.execute_query(get_query, (device_id,))
    device = dict(device_result[0]) if device_result else {}
    
    # Parse config_json
    if device.get('config_json') and isinstance(device['config_json'], str):
        try:
            device['config_json'] = json.loads(device['config_json'])
        except:
            device['config_json'] = {}
    
    # Convert datetime objects
    if device.get('created_at'):
        if isinstance(device['created_at'], datetime):
            device['created_at'] = device['created_at'].isoformat()
    if device.get('updated_at'):
        if isinstance(device['updated_at'], datetime):
            device['updated_at'] = device['updated_at'].isoformat()
    
    return {"success": True, "device": device}

# DELETE DEVICE
@router.delete("/api/schemas/{schema_id}/devices/{device_id}")
async def delete_device(schema_id: str, device_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete a device (requires write or admin)"""
    user_id = current_user['id']
    
    # Check device exists and belongs to schema
    device_query = """
        SELECT sd.id, s.workspace_id
        FROM schema_devices sd
        JOIN `schemas` s ON sd.schema_id = s.id
        WHERE sd.id = %s AND sd.schema_id = %s
    """
    device_result = db.execute_query(device_query, (device_id, schema_id))
    if not device_result:
        raise HTTPException(status_code=404, detail="Device not found")
    
    workspace_id = device_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Delete device (CASCADE will handle connections)
    delete_query = "DELETE FROM schema_devices WHERE id = %s"
    db.execute_update(delete_query, (device_id,))
    
    # Broadcast content update
    await broadcast_schema_content_updated(schema_id, user_id)
    
    return {"success": True, "message": "Device deleted"}

# GET DEVICE TEMPLATES
# ===== Connection Endpoints =====

# GET CONNECTIONS
@router.get("/api/schemas/{schema_id}/connections")
async def get_schema_connections(schema_id: str, current_user: Dict = Depends(get_current_user)):
    """Get all connections for a schema (requires read permission)"""
    user_id = current_user['id']
    
    # Check schema exists and get workspace
    schema_query = "SELECT workspace_id FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get connections
    connections_query = """
        SELECT id, schema_id, from_device_id, from_port, to_device_id, to_port,
               connection_type, bandwidth, vlan_id, config_json, created_at, updated_at
        FROM schema_connections WHERE schema_id = %s
    """
    connections_result = db.execute_query(connections_query, (schema_id,))
    connections = []
    for conn in connections_result:
        conn_dict = dict(conn)
        # Parse config_json if it's a string
        if conn_dict.get('config_json') and isinstance(conn_dict['config_json'], str):
            try:
                conn_dict['config_json'] = json.loads(conn_dict['config_json'])
            except:
                conn_dict['config_json'] = {}
        # Convert datetime objects
        if conn_dict.get('created_at'):
            if isinstance(conn_dict['created_at'], datetime):
                conn_dict['created_at'] = conn_dict['created_at'].isoformat()
        if conn_dict.get('updated_at'):
            if isinstance(conn_dict['updated_at'], datetime):
                conn_dict['updated_at'] = conn_dict['updated_at'].isoformat()
        connections.append(conn_dict)
    
    return {"success": True, "connections": connections}

# CREATE CONNECTION
@router.post("/api/schemas/{schema_id}/connections")
async def create_connection(schema_id: str, data: ConnectionCreate, current_user: Dict = Depends(get_current_user)):
    """Create a connection between devices (requires write or admin)"""
    user_id = current_user['id']
    
    # Check schema exists and get workspace
    schema_query = "SELECT workspace_id, type FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    if schema_result[0]['type'] != 'schema':
        raise HTTPException(status_code=400, detail="Can only add connections to schemas, not folders")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Validate devices exist and belong to schema
    devices_query = """
        SELECT id FROM schema_devices 
        WHERE id IN (%s, %s) AND schema_id = %s
    """
    devices_result = db.execute_query(devices_query, (data.from_device_id, data.to_device_id, schema_id))
    if len(devices_result) != 2:
        raise HTTPException(status_code=400, detail="Both devices must exist in the schema")
    
    # Check for duplicate connection
    duplicate_query = """
        SELECT id FROM schema_connections 
        WHERE schema_id = %s AND from_device_id = %s AND from_port = %s 
        AND to_device_id = %s AND to_port = %s
    """
    duplicate_result = db.execute_query(duplicate_query, (
        schema_id, data.from_device_id, data.from_port, data.to_device_id, data.to_port
    ))
    if duplicate_result:
        raise HTTPException(status_code=400, detail="Connection already exists")
    
    connection_id = str(uuid.uuid4())
    config_json_str = json.dumps(data.config_json) if data.config_json else None
    
    query = """
        INSERT INTO schema_connections 
        (id, schema_id, from_device_id, from_port, to_device_id, to_port, 
         connection_type, bandwidth, vlan_id, config_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        connection_id, schema_id, data.from_device_id, data.from_port,
        data.to_device_id, data.to_port, data.connection_type, data.bandwidth,
        data.vlan_id, config_json_str
    ))
    
    # Broadcast content update
    await broadcast_schema_content_updated(schema_id, user_id)
    
    # Get created connection
    get_query = """
        SELECT id, schema_id, from_device_id, from_port, to_device_id, to_port,
               connection_type, bandwidth, vlan_id, config_json, created_at, updated_at
        FROM schema_connections WHERE id = %s
    """
    conn_result = db.execute_query(get_query, (connection_id,))
    connection = dict(conn_result[0]) if conn_result else {}
    
    # Parse config_json
    if connection.get('config_json') and isinstance(connection['config_json'], str):
        try:
            connection['config_json'] = json.loads(connection['config_json'])
        except:
            connection['config_json'] = {}
    
    # Convert datetime objects
    if connection.get('created_at'):
        if isinstance(connection['created_at'], datetime):
            connection['created_at'] = connection['created_at'].isoformat()
    if connection.get('updated_at'):
        if isinstance(connection['updated_at'], datetime):
            connection['updated_at'] = connection['updated_at'].isoformat()
    
    return {"success": True, "connection": connection}

# UPDATE CONNECTION
@router.put("/api/schemas/{schema_id}/connections/{connection_id}")
async def update_connection(schema_id: str, connection_id: str, data: ConnectionUpdate, current_user: Dict = Depends(get_current_user)):
    """Update a connection (requires write or admin)"""
    user_id = current_user['id']
    
    # Check connection exists and belongs to schema
    conn_query = """
        SELECT sc.id, s.workspace_id
        FROM schema_connections sc
        JOIN `schemas` s ON sc.schema_id = s.id
        WHERE sc.id = %s AND sc.schema_id = %s
    """
    conn_result = db.execute_query(conn_query, (connection_id, schema_id))
    if not conn_result:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    workspace_id = conn_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Build update query
    updates = []
    params = []
    
    if data.connection_type is not None:
        updates.append("connection_type = %s")
        params.append(data.connection_type)
    if data.bandwidth is not None:
        updates.append("bandwidth = %s")
        params.append(data.bandwidth)
    if data.vlan_id is not None:
        updates.append("vlan_id = %s")
        params.append(data.vlan_id)
    if data.config_json is not None:
        updates.append("config_json = %s")
        params.append(json.dumps(data.config_json))
    
    if not updates:
        return {"success": True, "message": "No changes"}
    
    params.append(connection_id)
    update_query = f"""
        UPDATE schema_connections 
        SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """
    db.execute_update(update_query, tuple(params))
    
    # Broadcast content update
    await broadcast_schema_content_updated(schema_id, user_id)
    
    # Get updated connection
    get_query = """
        SELECT id, schema_id, from_device_id, from_port, to_device_id, to_port,
               connection_type, bandwidth, vlan_id, config_json, created_at, updated_at
        FROM schema_connections WHERE id = %s
    """
    conn_result = db.execute_query(get_query, (connection_id,))
    connection = dict(conn_result[0]) if conn_result else {}
    
    # Parse config_json
    if connection.get('config_json') and isinstance(connection['config_json'], str):
        try:
            connection['config_json'] = json.loads(connection['config_json'])
        except:
            connection['config_json'] = {}
    
    # Convert datetime objects
    if connection.get('created_at'):
        if isinstance(connection['created_at'], datetime):
            connection['created_at'] = connection['created_at'].isoformat()
    if connection.get('updated_at'):
        if isinstance(connection['updated_at'], datetime):
            connection['updated_at'] = connection['updated_at'].isoformat()
    
    return {"success": True, "connection": connection}

# DELETE CONNECTION
@router.delete("/api/schemas/{schema_id}/connections/{connection_id}")
async def delete_connection(schema_id: str, connection_id: str, current_user: Dict = Depends(get_current_user)):
    """Delete a connection (requires write or admin)"""
    user_id = current_user['id']
    
    # Check connection exists and belongs to schema
    conn_query = """
        SELECT sc.id, s.workspace_id
        FROM schema_connections sc
        JOIN `schemas` s ON sc.schema_id = s.id
        WHERE sc.id = %s AND sc.schema_id = %s
    """
    conn_result = db.execute_query(conn_query, (connection_id, schema_id))
    if not conn_result:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    workspace_id = conn_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Delete connection
    delete_query = "DELETE FROM schema_connections WHERE id = %s"
    db.execute_update(delete_query, (connection_id,))
    
    # Broadcast content update
    await broadcast_schema_content_updated(schema_id, user_id)
    
    return {"success": True, "message": "Connection deleted"}

# ===== Tags Endpoints =====

# GET TAGS
@router.get("/api/schemas/{schema_id}/tags")
async def get_schema_tags(schema_id: str, current_user: Dict = Depends(get_current_user)):
    """Get tags for a schema (requires read permission)"""
    user_id = current_user['id']
    
    # Check schema exists and get workspace
    schema_query = "SELECT workspace_id FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission == 'none':
        raise HTTPException(status_code=403, detail="Access denied")
    
    tags = fetch_schema_tags(schema_id)
    return {"success": True, "tags": tags}

# UPDATE TAGS
@router.put("/api/schemas/{schema_id}/tags")
async def update_schema_tags_endpoint(schema_id: str, data: TagsUpdate, current_user: Dict = Depends(get_current_user)):
    """Update tags for a schema (requires write or admin)"""
    user_id = current_user['id']
    
    # Check schema exists and get workspace
    schema_query = "SELECT workspace_id FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    tags = update_schema_tags(schema_id, data.tags)
    return {"success": True, "tags": tags}

# GET TAG SUGGESTIONS
@router.get("/api/schemas/tags/suggestions")
async def get_schema_tag_suggestions(
    query: str = Query('', description="Search query"),
    limit: int = Query(20, description="Max results"),
    current_user: Dict = Depends(get_current_user)
):
    """Get tag suggestions (requires read permission)"""
    search_query = query.strip().lower()
    
    if search_query:
        sql_query = """
            SELECT DISTINCT t.id, t.name
            FROM tags t
            WHERE LOWER(t.name) LIKE %s
            ORDER BY t.name
            LIMIT %s
        """
        results = db.execute_query(sql_query, (f"%{search_query}%", limit))
    else:
        sql_query = """
            SELECT DISTINCT t.id, t.name
            FROM tags t
            ORDER BY t.name
            LIMIT %s
        """
        results = db.execute_query(sql_query, (limit,))
    
    tags = [dict(row) for row in results]
    return {"success": True, "tags": tags}

# ===== Lock Endpoints =====

# LOCK
@router.post("/api/schemas/{schema_id}/lock")
async def lock_schema(schema_id: str, data: LockRequest, current_user: Dict = Depends(get_current_user)):
    """Lock a schema for editing (requires write or admin)"""
    user_id = current_user['id']
    
    # Check schema exists and get workspace
    schema_query = "SELECT workspace_id, type FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    if schema_result[0]['type'] != 'schema':
        raise HTTPException(status_code=400, detail="Can only lock schemas, not folders")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Check if already locked
    lock_query = "SELECT user_id, user_name, locked_at FROM schema_locks WHERE schema_id = %s"
    lock_result = db.execute_query(lock_query, (schema_id,))
    
    if lock_result:
        lock_info = lock_result[0]
        locked_at = lock_info['locked_at']
        # Check if lock is expired
        if locked_at and isinstance(locked_at, datetime) and (datetime.now() - locked_at) > timedelta(minutes=LOCK_TIMEOUT_MINUTES):
            # Lock expired, remove it
            db.execute_update("DELETE FROM schema_locks WHERE schema_id = %s", (schema_id,))
        else:
            # Still locked by someone else
            if lock_info['user_id'] != data.user_id:
                raise HTTPException(status_code=409, detail="Schema is locked by another user")
    
    # Create or update lock
    upsert_query = """
        INSERT INTO schema_locks (schema_id, user_id, user_name, locked_at, last_heartbeat)
        VALUES (%s, %s, %s, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            user_name = VALUES(user_name),
            locked_at = NOW(),
            last_heartbeat = NOW()
    """
    db.execute_update(upsert_query, (schema_id, data.user_id, data.user_name))
    
    lock_info = {
        'user_id': str(data.user_id),
        'user_name': data.user_name,
        'locked_at': datetime.now().isoformat()
    }
    
    # Broadcast lock update
    await broadcast_schema_lock_update(schema_id, lock_info)
    
    return {"success": True, "locked_by": lock_info}

# UNLOCK
@router.delete("/api/schemas/{schema_id}/lock")
async def unlock_schema(schema_id: str, user_id: int = Query(..., description="User ID"), current_user: Dict = Depends(get_current_user)):
    """Unlock a schema (requires write or admin)"""
    current_user_id = current_user['id']
    
    # Check schema exists
    schema_query = "SELECT workspace_id FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    workspace_id = schema_result[0]['workspace_id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(current_user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Check lock exists and belongs to user (or user is admin)
    lock_query = "SELECT user_id FROM schema_locks WHERE schema_id = %s"
    lock_result = db.execute_query(lock_query, (schema_id,))
    
    if not lock_result:
        return {"success": True, "message": "Schema not locked"}
    
    if lock_result[0]['user_id'] != user_id and permission != 'admin':
        raise HTTPException(status_code=403, detail="Can only unlock your own locks")
    
    # Delete lock
    db.execute_update("DELETE FROM schema_locks WHERE schema_id = %s", (schema_id,))
    
    # Broadcast lock update
    await broadcast_schema_lock_update(schema_id, None)
    
    return {"success": True, "message": "Schema unlocked"}

# FORCE UNLOCK
@router.post("/api/schemas/{schema_id}/force-unlock")
async def force_unlock_schema(schema_id: str, current_user: Dict = Depends(get_current_user)):
    """Force unlock a schema (requires admin)"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    
    if user_role != 'admin':
        raise HTTPException(status_code=403, detail="Admin permission required")
    
    # Check schema exists
    schema_query = "SELECT id FROM `schemas` WHERE id = %s"
    schema_result = db.execute_query(schema_query, (schema_id,))
    if not schema_result:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    # Delete lock
    db.execute_update("DELETE FROM schema_locks WHERE schema_id = %s", (schema_id,))
    
    # Broadcast lock update
    await broadcast_schema_lock_update(schema_id, None)
    
    return {"success": True, "message": "Schema force unlocked"}

# ===== Custom Device Templates Endpoints =====

class CustomTemplateCreate(BaseModel):
    device_type: str
    name: str
    description: Optional[str] = None
    default_ports: List[Dict[str, str]]
    icon_svg: Optional[str] = None
    default_size: Dict[str, int]

class CustomTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_ports: Optional[List[Dict[str, str]]] = None
    icon_svg: Optional[str] = None
    default_size: Optional[Dict[str, int]] = None

# GET CUSTOM TEMPLATES
@router.get("/api/schemas/custom-templates")
async def get_custom_templates(workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Get custom device templates for a workspace"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['read', 'write', 'admin']:
        raise HTTPException(status_code=403, detail="Read permission required")
    
    query = """
        SELECT id, device_type, name, description, default_ports, icon_svg, default_size, created_by, created_at, updated_at
        FROM schema_device_templates
        WHERE workspace_id = %s
        ORDER BY name ASC
    """
    results = db.execute_query(query, (workspace_id,))
    
    templates = []
    for row in results:
        template = dict(row)
        if isinstance(template.get('default_ports'), str):
            template['default_ports'] = json.loads(template['default_ports'])
        if isinstance(template.get('default_size'), str):
            template['default_size'] = json.loads(template['default_size'])
        if template.get('created_at') and isinstance(template['created_at'], datetime):
            template['created_at'] = template['created_at'].isoformat()
        if template.get('updated_at') and isinstance(template['updated_at'], datetime):
            template['updated_at'] = template['updated_at'].isoformat()
        templates.append(template)
    
    return {"success": True, "templates": templates}

# CREATE CUSTOM TEMPLATE
@router.post("/api/schemas/custom-templates")
async def create_custom_template(data: CustomTemplateCreate, workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Create a custom device template"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Check if device_type already exists for this workspace
    check_query = "SELECT id FROM schema_device_templates WHERE workspace_id = %s AND device_type = %s"
    existing = db.execute_query(check_query, (workspace_id, data.device_type))
    if existing:
        raise HTTPException(status_code=400, detail=f"Template with device_type '{data.device_type}' already exists")
    
    template_id = str(uuid.uuid4())
    
    query = """
        INSERT INTO schema_device_templates 
        (id, workspace_id, device_type, name, description, default_ports, icon_svg, default_size, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    db.execute_update(query, (
        template_id, workspace_id, data.device_type, data.name, data.description,
        json.dumps(data.default_ports), data.icon_svg, json.dumps(data.default_size), user_id
    ))
    
    # Get created template
    get_query = """
        SELECT id, device_type, name, description, default_ports, icon_svg, default_size, created_by, created_at, updated_at
        FROM schema_device_templates WHERE id = %s
    """
    result = db.execute_query(get_query, (template_id,))
    template = dict(result[0]) if result else {}
    
    if isinstance(template.get('default_ports'), str):
        template['default_ports'] = json.loads(template['default_ports'])
    if isinstance(template.get('default_size'), str):
        template['default_size'] = json.loads(template['default_size'])
    if template.get('created_at') and isinstance(template['created_at'], datetime):
        template['created_at'] = template['created_at'].isoformat()
    if template.get('updated_at') and isinstance(template['updated_at'], datetime):
        template['updated_at'] = template['updated_at'].isoformat()
    
    return {"success": True, "template": template}

# UPDATE CUSTOM TEMPLATE
@router.put("/api/schemas/custom-templates/{template_id}")
async def update_custom_template(template_id: str, data: CustomTemplateUpdate, workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Update a custom device template"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Check template exists and belongs to workspace
    check_query = "SELECT id, created_by FROM schema_device_templates WHERE id = %s AND workspace_id = %s"
    existing = db.execute_query(check_query, (template_id, workspace_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build update query dynamically
    updates = []
    params = []
    
    if data.name is not None:
        updates.append("name = %s")
        params.append(data.name)
    if data.description is not None:
        updates.append("description = %s")
        params.append(data.description)
    if data.default_ports is not None:
        updates.append("default_ports = %s")
        params.append(json.dumps(data.default_ports))
    if data.icon_svg is not None:
        updates.append("icon_svg = %s")
        params.append(data.icon_svg)
    if data.default_size is not None:
        updates.append("default_size = %s")
        params.append(json.dumps(data.default_size))
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    params.extend([template_id, workspace_id])
    query = f"UPDATE schema_device_templates SET {', '.join(updates)} WHERE id = %s AND workspace_id = %s"
    db.execute_update(query, tuple(params))
    
    # Get updated template
    get_query = """
        SELECT id, device_type, name, description, default_ports, icon_svg, default_size, created_by, created_at, updated_at
        FROM schema_device_templates WHERE id = %s
    """
    result = db.execute_query(get_query, (template_id,))
    template = dict(result[0]) if result else {}
    
    if isinstance(template.get('default_ports'), str):
        template['default_ports'] = json.loads(template['default_ports'])
    if isinstance(template.get('default_size'), str):
        template['default_size'] = json.loads(template['default_size'])
    if template.get('created_at') and isinstance(template['created_at'], datetime):
        template['created_at'] = template['created_at'].isoformat()
    if template.get('updated_at') and isinstance(template['updated_at'], datetime):
        template['updated_at'] = template['updated_at'].isoformat()
    
    return {"success": True, "template": template}

# DELETE CUSTOM TEMPLATE
@router.delete("/api/schemas/custom-templates/{template_id}")
async def delete_custom_template(template_id: str, workspace_id: str = Query('demo'), current_user: Dict = Depends(get_current_user)):
    """Delete a custom device template"""
    user_id = current_user['id']
    user_role = current_user.get('role')
    permission = get_workspace_permission_sync(user_id, workspace_id, user_role)
    
    if permission not in ['write', 'admin']:
        raise HTTPException(status_code=403, detail="Write permission required")
    
    # Check template exists and belongs to workspace
    check_query = "SELECT id FROM schema_device_templates WHERE id = %s AND workspace_id = %s"
    existing = db.execute_query(check_query, (template_id, workspace_id))
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check if template is used by any devices
    devices_query = "SELECT COUNT(*) as count FROM schema_devices WHERE device_type = (SELECT device_type FROM schema_device_templates WHERE id = %s)"
    devices_result = db.execute_query(devices_query, (template_id,))
    if devices_result and devices_result[0].get('count', 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete template: it is used by devices")
    
    delete_query = "DELETE FROM schema_device_templates WHERE id = %s AND workspace_id = %s"
    db.execute_update(delete_query, (template_id, workspace_id))
    
    return {"success": True, "message": "Template deleted"}

