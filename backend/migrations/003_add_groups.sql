-- Migration: Add Groups System
-- Description: Create tables for user groups and group-based workspace permissions

-- Table: groups
CREATE TABLE IF NOT EXISTS `groups` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- Table: user_groups (many-to-many relationship between users and groups)
CREATE TABLE IF NOT EXISTS `user_groups` (
  `user_id` INT NOT NULL,
  `group_id` VARCHAR(36) NOT NULL,
  `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, group_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- Table: group_workspace_permissions (replaces workspace_permissions)
CREATE TABLE IF NOT EXISTS `group_workspace_permissions` (
  `group_id` VARCHAR(36) NOT NULL,
  `workspace_id` VARCHAR(36) NOT NULL,
  `permission_level` ENUM('read', 'write', 'admin') NOT NULL DEFAULT 'read',
  `granted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, workspace_id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- Migrate existing permissions to groups (create a group per user)
INSERT INTO `groups` (id, name, description)
SELECT 
  CONCAT('user-', user_id) as id,
  CONCAT('User ', username, ' (Auto)') as name,
  'Auto-created group from individual permissions' as description
FROM workspace_permissions wp
JOIN users u ON wp.user_id = u.id
GROUP BY wp.user_id, u.username
ON DUPLICATE KEY UPDATE id=id;

-- Add users to their auto-created groups
INSERT INTO user_groups (user_id, group_id)
SELECT 
  user_id,
  CONCAT('user-', user_id) as group_id
FROM workspace_permissions
GROUP BY user_id
ON DUPLICATE KEY UPDATE user_id=user_id;

-- Migrate permissions to group permissions
INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level)
SELECT 
  CONCAT('user-', user_id) as group_id,
  workspace_id,
  permission_level
FROM workspace_permissions
ON DUPLICATE KEY UPDATE permission_level=VALUES(permission_level);

-- Create default groups
INSERT INTO `groups` (id, name, description) VALUES
  ('default-admins', 'Administrators', 'Full access to all workspaces'),
  ('default-editors', 'Editors', 'Can create and edit documents'),
  ('default-viewers', 'Viewers', 'Read-only access')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Add admin users to admin group
INSERT INTO user_groups (user_id, group_id)
SELECT id, 'default-admins'
FROM users
WHERE role = 'admin'
ON DUPLICATE KEY UPDATE user_id=user_id;

-- Note: Keep workspace_permissions table for backward compatibility (optional)
-- You can drop it later: DROP TABLE IF EXISTS workspace_permissions;
