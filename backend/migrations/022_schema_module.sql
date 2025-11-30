-- Migration 022: Schema Module
-- Complete schema management system with hierarchy, devices, connections, tags, locks, and activity logging

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS=0;

-- Main schemas table
CREATE TABLE IF NOT EXISTS `schemas` (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    parent_id VARCHAR(36) DEFAULT NULL,
    type ENUM('schema', 'folder') DEFAULT 'schema',
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_workspace (workspace_id),
    KEY idx_parent (parent_id),
    KEY idx_type (type),
    KEY idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints after table creation
-- Parent self-reference
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = DATABASE() 
     AND table_name = 'schemas' 
     AND constraint_name = 'fk_schemas_parent') = 0,
    'ALTER TABLE `schemas` ADD CONSTRAINT fk_schemas_parent FOREIGN KEY (parent_id) REFERENCES `schemas`(id) ON DELETE CASCADE',
    'SELECT "Constraint fk_schemas_parent already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- User reference
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = DATABASE() 
     AND table_name = 'schemas' 
     AND constraint_name = 'fk_schemas_user') = 0,
    'ALTER TABLE `schemas` ADD CONSTRAINT fk_schemas_user FOREIGN KEY (created_by) REFERENCES users(id)',
    'SELECT "Constraint fk_schemas_user already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Workspace reference
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = DATABASE() 
     AND table_name = 'schemas' 
     AND constraint_name = 'fk_schemas_workspace') = 0,
    'ALTER TABLE `schemas` ADD CONSTRAINT fk_schemas_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    'SELECT "Constraint fk_schemas_workspace already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Schema devices table
CREATE TABLE IF NOT EXISTS schema_devices (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    schema_id VARCHAR(36) NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(255) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    mac_address VARCHAR(17) DEFAULT NULL,
    position_x INT(11) NOT NULL DEFAULT 0,
    position_y INT(11) NOT NULL DEFAULT 0,
    config_json JSON DEFAULT NULL,
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_schema (schema_id),
    KEY idx_device_type (device_type),
    KEY idx_created_by (created_by),
    CONSTRAINT fk_schema_devices_schema FOREIGN KEY (schema_id) REFERENCES `schemas`(id) ON DELETE CASCADE,
    CONSTRAINT fk_schema_devices_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schema connections table
CREATE TABLE IF NOT EXISTS schema_connections (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    schema_id VARCHAR(36) NOT NULL,
    from_device_id VARCHAR(36) NOT NULL,
    from_port VARCHAR(50) NOT NULL,
    to_device_id VARCHAR(36) NOT NULL,
    to_port VARCHAR(50) NOT NULL,
    connection_type VARCHAR(50) DEFAULT NULL,
    bandwidth INT(11) DEFAULT NULL,
    vlan_id INT(11) DEFAULT NULL,
    config_json JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_schema (schema_id),
    KEY idx_from_device (from_device_id),
    KEY idx_to_device (to_device_id),
    CONSTRAINT fk_schema_connections_schema FOREIGN KEY (schema_id) REFERENCES `schemas`(id) ON DELETE CASCADE,
    CONSTRAINT fk_schema_connections_from_device FOREIGN KEY (from_device_id) REFERENCES schema_devices(id) ON DELETE CASCADE,
    CONSTRAINT fk_schema_connections_to_device FOREIGN KEY (to_device_id) REFERENCES schema_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schema locks table for collaborative editing
CREATE TABLE IF NOT EXISTS schema_locks (
    schema_id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id INT(11) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_schema_locks_schema FOREIGN KEY (schema_id) REFERENCES `schemas`(id) ON DELETE CASCADE,
    CONSTRAINT fk_schema_locks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schema tag links (uses unified tags table)
CREATE TABLE IF NOT EXISTS schema_tag_links (
    schema_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (schema_id, tag_id),
    KEY idx_schema_tag_links_tag (tag_id),
    CONSTRAINT fk_schema_tag_links_schema FOREIGN KEY (schema_id) REFERENCES `schemas`(id) ON DELETE CASCADE,
    CONSTRAINT fk_schema_tag_links_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schema activity log
CREATE TABLE IF NOT EXISTS schema_activity_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT(11) NOT NULL,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    schema_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    item_path TEXT,
    item_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_workspace (workspace_id),
    INDEX idx_schema (schema_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints for activity log
ALTER TABLE schema_activity_log
    ADD CONSTRAINT fk_schema_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_schema_activity_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_schema_activity_schema FOREIGN KEY (schema_id) REFERENCES `schemas`(id) ON DELETE CASCADE;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;

SELECT 'Schema module tables created' as '';

