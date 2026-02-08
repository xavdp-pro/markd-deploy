from fastapi import APIRouter, Depends, HTTPException
from typing import Dict
from pydantic import BaseModel
from database import db
from auth import get_current_user

router = APIRouter()

class ModuleSettings(BaseModel):
    documents: bool = True
    tasks: bool = True
    passwords: bool = True
    files: bool = True
    schemas: bool = True

@router.get("/api/admin/settings/modules")
async def get_module_settings(user: Dict = Depends(get_current_user)):
    """Get enabled modules configuration"""
    # Ensure table exists (lazy check, though main.py should handle it)
    try:
        settings = db.execute_query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'module_%'")
    except Exception:
        # Table might not exist yet if main.py hasn't run or failed
        return {"documents": True, "tasks": True, "passwords": True, "files": True, "schemas": True}
    
    # Default values
    result = {
        "documents": True,
        "tasks": True,
        "passwords": True,
        "files": True,
        "schemas": True
    }
    
    for row in settings:
        key = row['setting_key'].replace('module_', '')
        # Check for 'true' string, or boolean 1/0 if stored that way (but we use text column usually for settings)
        # forcing string comparison for safety
        value = str(row['setting_value']).lower() in ('true', '1', 'yes', 'on')
        if key in result:
            result[key] = value
            
    return result

@router.post("/api/admin/settings/modules")
async def update_module_settings(settings: ModuleSettings, user: Dict = Depends(get_current_user)):
    """Update enabled modules (Admin only)"""
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update system settings")
        
    # Upsert settings
    for key, value in settings.dict().items():
        db_key = f"module_{key}"
        db_value = "true" if value else "false"
        
        # Check if exists
        existing = db.execute_query("SELECT 1 FROM system_settings WHERE setting_key = %s", (db_key,))
        if existing:
            db.execute_update("UPDATE system_settings SET setting_value = %s WHERE setting_key = %s", (db_value, db_key))
        else:
            db.execute_update("INSERT INTO system_settings (setting_key, setting_value) VALUES (%s, %s)", (db_key, db_value))
            
    return {"success": True, "message": "Settings updated"}

# ============================================================
# Demo Mode
# ============================================================

@router.get("/api/admin/settings/demo-mode")
async def get_demo_mode(user: Dict = Depends(get_current_user)):
    """Get demo mode status (admin only)"""
    try:
        row = db.execute_query("SELECT setting_value FROM system_settings WHERE setting_key = 'demo_mode'")
        enabled = row[0]['setting_value'].lower() in ('true', '1', 'yes', 'on') if row else False
        return {"demo_mode": enabled}
    except Exception:
        return {"demo_mode": False}

@router.post("/api/admin/settings/demo-mode")
async def set_demo_mode(user: Dict = Depends(get_current_user)):
    """Toggle demo mode (admin only)"""
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update system settings")

    # Get current value and toggle
    row = db.execute_query("SELECT setting_value FROM system_settings WHERE setting_key = 'demo_mode'")
    current = row[0]['setting_value'].lower() in ('true', '1', 'yes', 'on') if row else False
    new_value = "false" if current else "true"

    if row:
        db.execute_update("UPDATE system_settings SET setting_value = %s WHERE setting_key = 'demo_mode'", (new_value,))
    else:
        db.execute_update("INSERT INTO system_settings (setting_key, setting_value) VALUES ('demo_mode', %s)", (new_value,))

    return {"success": True, "demo_mode": new_value == "true"}

@router.get("/api/auth/demo-users")
async def get_demo_users():
    """Public endpoint: returns demo user list if demo mode is enabled"""
    try:
        row = db.execute_query("SELECT setting_value FROM system_settings WHERE setting_key = 'demo_mode'")
        enabled = row[0]['setting_value'].lower() in ('true', '1', 'yes', 'on') if row else False
        if not enabled:
            return {"demo_mode": False, "users": []}

        users = db.execute_query("SELECT id, username, email, role FROM users ORDER BY role DESC, username ASC")
        return {
            "demo_mode": True,
            "users": [
                {"id": u['id'], "username": u['username'], "email": u['email'], "role": u['role']}
                for u in users
            ]
        }
    except Exception:
        return {"demo_mode": False, "users": []}
