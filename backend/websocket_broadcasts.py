# Shared WebSocket broadcast functions for all modules
# This file provides harmonized broadcasting functions for Documents, Tasks, and Passwords

from typing import Optional, Dict

# Socket.IO instance will be set by main.py
sio = None

def set_sio(sio_instance):
    """Set the Socket.IO instance (called from main.py)"""
    global sio
    sio = sio_instance

# ===== Documents Module =====

async def broadcast_document_tree_update():
    """Broadcast document tree update signal to all connected clients"""
    if sio:
        await sio.emit('document_tree_changed', {'action': 'reload'})
        # Also emit legacy event for backward compatibility
        await sio.emit('tree_changed', {'action': 'reload'})

async def broadcast_document_lock_update(document_id: str, lock_info: Optional[Dict] = None):
    """Broadcast document lock status change"""
    if sio:
        await sio.emit('document_lock_updated', {
            'document_id': document_id,
            'locked_by': lock_info
        })
        # Also emit legacy event for backward compatibility
        await sio.emit('lock_updated', {
            'document_id': document_id,
            'locked_by': lock_info
        })

async def broadcast_document_content_updated(document_id: str, name: Optional[str] = None, user_id: Optional[int] = None):
    """Broadcast document content update"""
    if sio:
        await sio.emit('document_content_updated', {
            'document_id': document_id,
            'name': name,
            'user_id': user_id
        })

# ===== Tasks Module =====

async def broadcast_task_tree_update():
    """Broadcast task tree update signal to all connected clients"""
    if sio:
        await sio.emit('task_tree_changed', {'action': 'reload'})

async def broadcast_task_lock_update(task_id: str, lock_info: Optional[Dict] = None):
    """Broadcast task lock status change"""
    if sio:
        await sio.emit('task_lock_updated', {
            'task_id': task_id,
            'locked_by': lock_info
        })

async def broadcast_task_activity_update(task_id: str, user_id: Optional[int] = None):
    """Broadcast task activity update (timeline, comments, files)"""
    if sio:
        await sio.emit('task_activity_updated', {
            'task_id': task_id,
            'user_id': user_id
        })

async def broadcast_task_status_changed(task_id: str, new_status: str, user_id: Optional[int] = None):
    """Broadcast task status change"""
    if sio:
        await sio.emit('task_status_changed', {
            'task_id': task_id,
            'status': new_status,
            'user_id': user_id
        })

# ===== Passwords (Vault) Module =====

async def broadcast_vault_tree_update():
    """Broadcast vault tree update signal to all connected clients"""
    if sio:
        await sio.emit('vault_tree_changed', {'action': 'reload'})

async def broadcast_vault_item_updated(password_id: str, name: Optional[str] = None, user_id: Optional[int] = None):
    """Broadcast vault item update"""
    if sio:
        await sio.emit('vault_item_updated', {
            'password_id': password_id,
            'name': name,
            'user_id': user_id
        })
