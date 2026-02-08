"""
Admin Routes - Administration routes for MarkD
Activity log management and other admin features
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, Dict, List
from pydantic import BaseModel
from auth import get_current_user
from activity_logger import get_activity_logs, get_activity_stats
from database import db

router = APIRouter()

class ActivityLogResponse(BaseModel):
    id: str
    user_id: int
    username: str
    user_email: str
    workspace_id: str
    item_id: str
    item_type: str
    action: str
    item_name: str
    item_path: Optional[str]
    created_at: str

class ActivityStatsResponse(BaseModel):
    total_activities: int
    activities_by_type: Dict[str, int]
    activities_by_action: Dict[str, int]
    top_users: List[Dict]

@router.get("/api/admin/activity-logs")
async def get_activity_logs_endpoint(
    user: Dict = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user_id: Optional[int] = Query(None),
    workspace_id: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """
    Retrieve activity logs (Admin only)
    
    Query Parameters:
        - limit: Maximum number of results (default: 100, max: 1000)
        - offset: Pagination offset (default: 0)
        - user_id: Filter by user
        - workspace_id: Filter by workspace
        - item_type: Filter by type ('document', 'task', 'password')
        - action: Filter by action ('create', 'update', 'delete', 'move', etc.)
        - start_date: Start date (ISO format)
        - end_date: End date (ISO format)
    """
    # Check that user is admin
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        logs = get_activity_logs(
            limit=limit,
            offset=offset,
            user_id=user_id,
            workspace_id=workspace_id,
            item_type=item_type,
            action=action,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "success": True,
            "logs": logs,
            "count": len(logs),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        print(f"Error retrieving activity logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity logs")

@router.get("/api/admin/activity-stats")
async def get_activity_stats_endpoint(
    user: Dict = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365)
):
    """
    Retrieve activity statistics (Admin only)
    
    Query Parameters:
        - workspace_id: Filter by workspace (optional)
        - days: Number of days to analyze (default: 30, max: 365)
    """
    # Check that user is admin
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        stats = get_activity_stats(
            workspace_id=workspace_id,
            days=days
        )
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        print(f"Error retrieving activity stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity stats")

@router.get("/api/admin/activity-logs/export")
async def export_activity_logs(
    user: Dict = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """
    Export activity logs as CSV (Admin only)
    """
    # Check that user is admin
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Retrieve all logs without limit
        logs = get_activity_logs(
            limit=10000,  # Reasonable limit for export
            offset=0,
            workspace_id=workspace_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Generate CSV
        import csv
        import io
        from fastapi.responses import StreamingResponse
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow([
            'Date',
            'User',
            'Email',
            'Workspace',
            'Type',
            'Action',
            'Item Name',
            'Item Path'
        ])
        
        # Data
        for log in logs:
            writer.writerow([
                log.get('created_at', ''),
                log.get('username', ''),
                log.get('user_email', ''),
                log.get('workspace_id', ''),
                log.get('item_type', ''),
                log.get('action', ''),
                log.get('item_name', ''),
                log.get('item_path', '')
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=activity_logs_{start_date or 'all'}_{end_date or 'all'}.csv"
            }
        )
        
    except Exception as e:
        print(f"Error exporting activity logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to export activity logs")

@router.get("/api/admin/mcp/configs")
async def get_all_mcp_configs(
    user: Dict = Depends(get_current_user)
):
    """
    Retrieve all MCP configurations (Admin only)
    """
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        query = """
            SELECT mc.id, mc.workspace_id, mc.source_path, mc.destination_path, 
                   mc.enabled, mc.created_at, mc.updated_at, mc.api_key,
                   mc.folder_id, mc.mcp_token, mc.is_active, mc.user_id,
                   w.name as workspace_name,
                   u.username,
                   d.name as folder_name
            FROM mcp_configs mc
            LEFT JOIN workspaces w ON mc.workspace_id = w.id
            LEFT JOIN users u ON mc.user_id = u.id
            LEFT JOIN documents d ON mc.folder_id = d.id
            ORDER BY mc.created_at DESC
        """
        configs = db.execute_query(query)
        
        return {"success": True, "configs": configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
