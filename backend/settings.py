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

@router.get("/api/admin/settings/modules")
async def get_module_settings(user: Dict = Depends(get_current_user)):
    """Get enabled modules configuration"""
    # Ensure table exists (lazy check, though main.py should handle it)
    try:
        settings = db.execute_query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'module_%'")
    except Exception:
        # Table might not exist yet if main.py hasn't run or failed
        return {"documents": True, "tasks": True, "passwords": True}
    
    # Default values
    result = {
        "documents": True,
        "tasks": True,
        "passwords": True
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
