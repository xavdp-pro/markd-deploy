-- MarkD Database Installation Script
-- This script creates all necessary tables and initial data

-- NOTE: Run with: mysql YOUR_DB_NAME < install.sql
-- Do not hardcode database name here

-- ============================================
-- Core Tables
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT(11) NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','user') NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_username (username),
    KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Groups table
CREATE TABLE IF NOT EXISTS user_groups_table (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_business BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_name (name),
    KEY idx_business (is_business)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User-Group membership
CREATE TABLE IF NOT EXISTS user_groups (
    user_id INT(11) NOT NULL,
    group_id INT(11) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES user_groups_table(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_created_by (created_by),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Group-Workspace permissions
CREATE TABLE IF NOT EXISTS group_workspace_permissions (
    group_id INT(11) NOT NULL,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    permission_level ENUM('read', 'write', 'admin') NOT NULL DEFAULT 'read',
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, workspace_id),
    FOREIGN KEY (group_id) REFERENCES user_groups_table(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Document Management
-- ============================================

-- Document locks table
CREATE TABLE IF NOT EXISTS document_locks (
    document_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    locked_by INT(11) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    PRIMARY KEY (document_id, workspace_id),
    KEY idx_locked_by (locked_by),
    KEY idx_workspace (workspace_id),
    FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Password Vault
-- ============================================

-- Password vault table with hierarchy support
CREATE TABLE IF NOT EXISTS password_vault (
    id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    parent_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
    type ENUM('folder', 'password') DEFAULT 'password',
    title VARCHAR(255) NOT NULL,
    username VARCHAR(255) DEFAULT NULL,
    password_encrypted TEXT DEFAULT NULL,
    url VARCHAR(500) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    category ENUM('ssh', 'api', 'database', 'service', 'other') DEFAULT 'other',
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    KEY idx_workspace (workspace_id),
    KEY idx_parent (parent_id),
    KEY idx_category (category),
    KEY idx_created_by (created_by),
    CONSTRAINT fk_vault_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_vault_user FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_vault_parent FOREIGN KEY (parent_id) REFERENCES password_vault(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Initial Data
-- ============================================

-- Create default admin user (password: admin - CHANGE THIS!)
-- Password hash for 'admin' - MUST BE CHANGED ON FIRST LOGIN
INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@markd.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5oacX9Z2QWQHO', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- Create default groups
INSERT INTO user_groups_table (name, description, is_business, is_system) VALUES 
('Administrators', 'System administrators with full access', FALSE, TRUE),
('Users', 'Default user group', FALSE, TRUE),
('Business', 'Business management group', TRUE, TRUE)
ON DUPLICATE KEY UPDATE name=name;

-- Add admin to Administrators group
INSERT INTO user_groups (user_id, group_id)
SELECT u.id, g.id FROM users u, user_groups_table g
WHERE u.username = 'admin' AND g.name = 'Administrators'
ON DUPLICATE KEY UPDATE user_id=user_id;

-- Create default workspace
INSERT INTO workspaces (id, name, description, created_by) VALUES 
('default', 'Default Workspace', 'Default workspace for all users', 
(SELECT id FROM users WHERE username = 'admin' LIMIT 1))
ON DUPLICATE KEY UPDATE name=name;

-- Grant admin permission to Administrators group on default workspace
INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level)
SELECT g.id, 'default', 'admin' FROM user_groups_table g WHERE g.name = 'Administrators'
ON DUPLICATE KEY UPDATE permission_level='admin';

-- Grant read permission to Users group on default workspace
INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level)
SELECT g.id, 'default', 'read' FROM user_groups_table g WHERE g.name = 'Users'
ON DUPLICATE KEY UPDATE permission_level='read';

-- ============================================
-- Verification
-- ============================================

SELECT 'Database installation completed successfully!' as Status;
SELECT COUNT(*) as 'Total Users' FROM users;
SELECT COUNT(*) as 'Total Groups' FROM user_groups_table;
SELECT COUNT(*) as 'Total Workspaces' FROM workspaces;
