-- Migration 021: Files Module
-- Complete file management system with hierarchy, tags, locks, and activity logging

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS=0;

-- Main files table
CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    parent_id VARCHAR(36) DEFAULT NULL,
    type ENUM('folder', 'file') DEFAULT 'file',
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) DEFAULT NULL,
    mime_type VARCHAR(100) DEFAULT NULL,
    file_size BIGINT DEFAULT 0,
    file_hash VARCHAR(64) DEFAULT NULL,
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_workspace (workspace_id),
    KEY idx_parent (parent_id),
    KEY idx_mime_type (mime_type),
    KEY idx_file_hash (file_hash),
    KEY idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints after table creation (check if they exist first)
-- Note: MySQL requires the referenced column to have the same charset/collation
-- Parent self-reference
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = DATABASE() 
     AND table_name = 'files' 
     AND constraint_name = 'fk_files_parent') = 0,
    'ALTER TABLE files ADD CONSTRAINT fk_files_parent FOREIGN KEY (parent_id) REFERENCES files(id) ON DELETE CASCADE',
    'SELECT "Constraint fk_files_parent already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- User reference
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = DATABASE() 
     AND table_name = 'files' 
     AND constraint_name = 'fk_files_user') = 0,
    'ALTER TABLE files ADD CONSTRAINT fk_files_user FOREIGN KEY (created_by) REFERENCES users(id)',
    'SELECT "Constraint fk_files_user already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Workspace reference
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = DATABASE() 
     AND table_name = 'files' 
     AND constraint_name = 'fk_files_workspace') = 0,
    'ALTER TABLE files ADD CONSTRAINT fk_files_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Constraint fk_files_workspace already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- File locks table for collaborative editing
CREATE TABLE IF NOT EXISTS file_locks (
    file_id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id INT(11) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_file_locks_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    CONSTRAINT fk_file_locks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- File tag links (uses unified tags table from migration 015)
CREATE TABLE IF NOT EXISTS file_tag_links (
    file_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (file_id, tag_id),
    KEY idx_file_tag_links_tag (tag_id),
    CONSTRAINT fk_file_tag_links_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    CONSTRAINT fk_file_tag_links_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- File activity log
CREATE TABLE IF NOT EXISTS file_activity_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT(11) NOT NULL,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    file_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    item_path TEXT,
    item_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_workspace (workspace_id),
    INDEX idx_file (file_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints for activity log
ALTER TABLE file_activity_log
    ADD CONSTRAINT fk_file_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_file_activity_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;

SELECT 'Files module tables created' as '';

