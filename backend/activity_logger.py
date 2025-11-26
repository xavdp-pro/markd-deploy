"""
Activity Logger - Système de logs d'activité pour MarkD
Enregistre toutes les actions utilisateurs dans les tables d'activité
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from database import db

def log_activity(
    user_id: int,
    workspace_id: str,
    item_id: str,
    action: str,
    item_type: str,
    item_name: str,
    item_path: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    """
    Enregistre une activité utilisateur dans la table appropriée
    
    Args:
        user_id: ID de l'utilisateur
        workspace_id: ID du workspace
        item_id: ID de l'élément (document, task, password)
        action: Type d'action ('create', 'update', 'delete', 'move', 'rename', etc.)
        item_type: Type d'élément ('document', 'task', 'password')
        item_name: Nom de l'élément
        item_path: Chemin de l'élément (optionnel)
        details: Détails supplémentaires (optionnel)
    """
    try:
        # Générer un UUID pour l'ID
        activity_id = str(uuid.uuid4())
        
        # Déterminer la table selon le type
        table_map = {
            'document': 'document_activity_log',
            'task': 'task_activity_log', 
            'password': 'password_activity_log'
        }
        
        if item_type not in table_map:
            print(f"Warning: Unknown item_type '{item_type}' for activity logging")
            return False
            
        table = table_map[item_type]
        id_column = f"{item_type}_id"
        
        # Construire la requête SQL
        query = f"""
            INSERT INTO {table} (id, user_id, workspace_id, {id_column}, action, item_name, item_path, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """
        
        # Exécuter la requête
        db.execute_update(query, (
            activity_id,
            user_id,
            workspace_id,
            item_id,
            action,
            item_name,
            item_path
        ))
        
        print(f"✓ Activity logged: {action} {item_type} '{item_name}' by user {user_id}")
        return True
        
    except Exception as e:
        print(f"Error logging activity: {e}")
        return False

def get_activity_logs(
    limit: int = 100,
    offset: int = 0,
    user_id: Optional[int] = None,
    workspace_id: Optional[str] = None,
    item_type: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Récupère les logs d'activité avec filtres
    
    Returns:
        List[Dict]: Liste des activités
    """
    try:
        # Tables à interroger
        tables = []
        if not item_type or item_type == 'document':
            tables.append(('document_activity_log', 'document_id', 'document'))
        if not item_type or item_type == 'task':
            tables.append(('task_activity_log', 'task_id', 'task'))
        if not item_type or item_type == 'password':
            tables.append(('password_activity_log', 'password_id', 'password'))
        
        # Construire les requêtes UNION
        union_queries = []
        params = []
        
        for table, id_col, type_name in tables:
            query_parts = [f"""
                SELECT 
                    id,
                    user_id,
                    workspace_id,
                    {id_col} as item_id,
                    action,
                    item_name,
                    item_path,
                    created_at,
                    '{type_name}' as item_type
                FROM {table}
                WHERE 1=1
            """]
            
            # Ajouter les filtres
            if user_id:
                query_parts.append("AND user_id = %s")
                params.append(user_id)
            
            if workspace_id:
                query_parts.append("AND workspace_id = %s")
                params.append(workspace_id)
                
            if action:
                query_parts.append("AND action = %s")
                params.append(action)
                
            if start_date:
                query_parts.append("AND created_at >= %s")
                params.append(start_date)
                
            if end_date:
                query_parts.append("AND created_at <= %s")
                params.append(end_date)
            
            union_queries.append(" ".join(query_parts))
        
        # Combiner avec UNION et trier
        final_query = f"""
            ({') UNION ALL ('.join(union_queries)})
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        
        params.extend([limit, offset])
        
        # Exécuter la requête
        results = db.execute_query(final_query, tuple(params))
        
        # Enrichir avec les informations utilisateur
        enriched_results = []
        for row in results:
            # Récupérer les infos utilisateur
            user_query = "SELECT username, email FROM users WHERE id = %s"
            user_info = db.execute_query(user_query, (row['user_id'],))
            
            enriched_row = dict(row)
            if user_info:
                enriched_row['username'] = user_info[0]['username']
                enriched_row['user_email'] = user_info[0]['email']
            else:
                enriched_row['username'] = 'Unknown'
                enriched_row['user_email'] = 'unknown@example.com'
                
            enriched_results.append(enriched_row)
        
        return enriched_results
        
    except Exception as e:
        print(f"Error retrieving activity logs: {e}")
        return []

def get_activity_stats(
    workspace_id: Optional[str] = None,
    days: int = 30
):
    """
    Récupère des statistiques d'activité
    
    Returns:
        Dict: Statistiques d'activité
    """
    try:
        stats = {
            'total_activities': 0,
            'activities_by_type': {},
            'activities_by_action': {},
            'top_users': []
        }
        
        # Requête pour compter les activités par type
        tables = [
            ('document_activity_log', 'document'),
            ('task_activity_log', 'task'),
            ('password_activity_log', 'password')
        ]
        
        for table, type_name in tables:
            query = f"""
                SELECT COUNT(*) as count
                FROM {table}
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
            """
            params = [days]
            
            if workspace_id:
                query += " AND workspace_id = %s"
                params.append(workspace_id)
            
            result = db.execute_query(query, tuple(params))
            count = result[0]['count'] if result else 0
            stats['activities_by_type'][type_name] = count
            stats['total_activities'] += count
        
        # Top utilisateurs
        union_parts = []
        params = []
        
        for table, type_name in tables:
            query_part = f"""
                SELECT user_id, COUNT(*) as count
                FROM {table}
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
            """
            params.extend([days])
            
            if workspace_id:
                query_part += " AND workspace_id = %s"
                params.append(workspace_id)
                
            query_part += " GROUP BY user_id"
            union_parts.append(f"({query_part})")
        
        if union_parts:
            top_users_query = f"""
                SELECT user_id, SUM(count) as total_count
                FROM ({' UNION ALL '.join(union_parts)}) as combined
                GROUP BY user_id
                ORDER BY total_count DESC
                LIMIT 10
            """
            
            top_users_result = db.execute_query(top_users_query, tuple(params))
            
            # Enrichir avec les noms d'utilisateurs
            for row in top_users_result:
                user_query = "SELECT username FROM users WHERE id = %s"
                user_info = db.execute_query(user_query, (row['user_id'],))
                username = user_info[0]['username'] if user_info else 'Unknown'
                
                stats['top_users'].append({
                    'user_id': row['user_id'],
                    'username': username,
                    'activity_count': row['total_count']
                })
        
        return stats
        
    except Exception as e:
        print(f"Error retrieving activity stats: {e}")
        return {
            'total_activities': 0,
            'activities_by_type': {},
            'activities_by_action': {},
            'top_users': []
        }
