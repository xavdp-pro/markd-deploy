import os
from dotenv import load_dotenv
from database import db

# Load environment variables
load_dotenv()

def fix_permissions():
    print("🔧 Fixing permissions for 'demo' workspace...")

    # 1. Ensure 'demo' workspace exists
    print("Checking 'demo' workspace...")
    db.execute_update("""
        INSERT INTO workspaces (id, name, description, created_by, created_at, updated_at)
        VALUES ('demo', 'Demo Workspace', 'Demo workspace for testing', 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE name='Demo Workspace'
    """)

    # 2. Get Group IDs
    print("Getting group IDs...")
    groups = db.execute_query("SELECT id, name FROM user_groups_table WHERE name IN ('ALL', 'Users', 'Administrators')")
    group_map = {g['name']: g['id'] for g in groups}
    
    # Create groups if missing
    if 'ALL' not in group_map:
        db.execute_update("INSERT INTO user_groups_table (name, description, is_business, is_system) VALUES ('ALL', 'All Users', 1, 1)")
        group_map['ALL'] = db.execute_query("SELECT id FROM user_groups_table WHERE name='ALL'")[0]['id']
    
    if 'Administrators' not in group_map:
        db.execute_update("INSERT INTO user_groups_table (name, description, is_business, is_system) VALUES ('Administrators', 'Admins', 1, 1)")
        group_map['Administrators'] = db.execute_query("SELECT id FROM user_groups_table WHERE name='Administrators'")[0]['id']

    # 3. Grant Permissions to Groups for 'demo' workspace
    print("Granting group permissions...")
    for group_name in ['ALL', 'Users', 'Administrators']:
        if group_name in group_map:
            group_id = group_map[group_name]
            perm_level = 'admin' if group_name == 'Administrators' else 'write'
            
            # Check existing
            exists = db.execute_query(
                "SELECT 1 FROM group_workspace_permissions WHERE group_id=%s AND workspace_id='demo'", 
                (group_id,)
            )
            
            if not exists:
                db.execute_update(
                    "INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level, granted_at) VALUES (%s, 'demo', %s, NOW())",
                    (group_id, perm_level)
                )
                print(f"  -> Granted '{perm_level}' to group '{group_name}'")
            else:
                db.execute_update(
                    "UPDATE group_workspace_permissions SET permission_level=%s WHERE group_id=%s AND workspace_id='demo'",
                    (perm_level, group_id)
                )
                print(f"  -> Updated '{perm_level}' for group '{group_name}'")

    # 4. Add ALL Users to 'ALL' group
    print("Adding users to 'ALL' group...")
    all_users = db.execute_query("SELECT id, username FROM users")
    all_group_id = group_map['ALL']
    
    for user in all_users:
        user_id = user['id']
        username = user['username']
        
        in_group = db.execute_query(
            "SELECT 1 FROM user_groups WHERE user_id=%s AND group_id=%s",
            (user_id, all_group_id)
        )
        
        if not in_group:
            db.execute_update(
                "INSERT INTO user_groups (user_id, group_id) VALUES (%s, %s)",
                (user_id, all_group_id)
            )
            print(f"  -> Added user '{username}' (id={user_id}) to 'ALL' group")

    # 5. Fix Admin Users
    print("Fixing Admin users...")
    admin_users = db.execute_query("SELECT id, username FROM users WHERE role='admin'")
    admin_group_id = group_map['Administrators']
    
    for user in admin_users:
        user_id = user['id']
        in_admin = db.execute_query(
            "SELECT 1 FROM user_groups WHERE user_id=%s AND group_id=%s",
            (user_id, admin_group_id)
        )
        if not in_admin:
             db.execute_update(
                "INSERT INTO user_groups (user_id, group_id) VALUES (%s, %s)",
                (user_id, admin_group_id)
            )
             print(f"  -> Added admin '{user['username']}' to 'Administrators' group")

    print("✅ Permissions fixed successfully!")

if __name__ == "__main__":
    try:
        fix_permissions()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
