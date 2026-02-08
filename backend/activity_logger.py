"""
Activity Logger - Activity logging system for MarkD
Records all user actions in activity tables
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
    Record a user activity in the appropriate table
    
    Args:
        user_id: User ID
        workspace_id: Workspace ID
        item_id: Item ID (document, task, password)
        action: Action type ('create', 'update', 'delete', 'move', 'rename', etc.)
        item_type: Item type ('document', 'task', 'password')
        item_name: Item name
        item_path: Item path (optional)
        details: Additional details (optional)
    """
    try:
        # Generate a UUID for the ID
        activity_id = str(uuid.uuid4())
        
        # Determine table based on type
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
        
        # Build SQL query
        query = f"""
            INSERT INTO {table} (id, user_id, workspace_id, {id_column}, action, item_name, item_path, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """
        
        # Execute query
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
    Retrieve activity logs with filters
    
    Returns:
        List[Dict]: List of activities
    """
    try:
        # Tables to query
        tables = []
        if not item_type or item_type == 'document':
            tables.append(('document_activity_log', 'document_id', 'document'))
        if not item_type or item_type == 'task':
            tables.append(('task_activity_log', 'task_id', 'task'))
        if not item_type or item_type == 'password':
            tables.append(('password_activity_log', 'password_id', 'password'))
        
        # Build UNION queries
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
            
            # Add filters
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
        
        # Combine with UNION and sort
        final_query = f"""
            ({') UNION ALL ('.join(union_queries)})
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        
        params.extend([limit, offset])
        
        # Execute query
        results = db.execute_query(final_query, tuple(params))
        
        # Enrich with user information
        enriched_results = []
        for row in results:
            # Get user info
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
    Retrieve activity statistics
    
    Returns:
        Dict: Activity statistics
    """
    try:
        stats = {
            'total_activities': 0,
            'activities_by_type': {},
            'activities_by_action': {},
            'top_users': []
        }
        
        # Query to count activities by type
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
        
        # Top users
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
            
            # Enrich with usernames
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
