"""
Admin Routes - Routes d'administration pour MarkD
Gestion des logs d'activité et autres fonctionnalités admin
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, Dict, List
from pydantic import BaseModel
from auth import get_current_user
from activity_logger import get_activity_logs, get_activity_stats

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
    Récupère les logs d'activité (Admin uniquement)
    
    Query Parameters:
        - limit: Nombre maximum de résultats (défaut: 100, max: 1000)
        - offset: Décalage pour la pagination (défaut: 0)
        - user_id: Filtrer par utilisateur
        - workspace_id: Filtrer par workspace
        - item_type: Filtrer par type ('document', 'task', 'password')
        - action: Filtrer par action ('create', 'update', 'delete', 'move', etc.)
        - start_date: Date de début (format ISO)
        - end_date: Date de fin (format ISO)
    """
    # Vérifier que l'utilisateur est admin
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
    Récupère les statistiques d'activité (Admin uniquement)
    
    Query Parameters:
        - workspace_id: Filtrer par workspace (optionnel)
        - days: Nombre de jours à analyser (défaut: 30, max: 365)
    """
    # Vérifier que l'utilisateur est admin
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
    Exporte les logs d'activité en CSV (Admin uniquement)
    """
    # Vérifier que l'utilisateur est admin
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Récupérer tous les logs sans limite
        logs = get_activity_logs(
            limit=10000,  # Limite raisonnable pour l'export
            offset=0,
            workspace_id=workspace_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Générer le CSV
        import csv
        import io
        from fastapi.responses import StreamingResponse
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # En-têtes
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
        
        # Données
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
