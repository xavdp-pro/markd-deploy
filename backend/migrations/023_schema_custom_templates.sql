-- Migration 023: Custom Device Templates for Schema Module
-- Allows users to create custom device templates per workspace

-- Custom device templates table
CREATE TABLE IF NOT EXISTS schema_device_templates (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    default_ports JSON NOT NULL,
    icon_svg TEXT DEFAULT NULL,
    default_size JSON NOT NULL,
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    KEY idx_workspace (workspace_id),
    KEY idx_device_type (device_type),
    KEY idx_created_by (created_by),
    UNIQUE KEY idx_workspace_device_type (workspace_id, device_type),
    
    CONSTRAINT fk_template_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

