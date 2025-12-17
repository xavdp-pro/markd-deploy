-- Migration 026: MCP Configuration Table
-- Stores user-specific MCP configurations (source_path, destination_path, workspace_id)

CREATE TABLE IF NOT EXISTS mcp_configs (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT(11) NOT NULL,
    workspace_id VARCHAR(50) NOT NULL,
    source_path VARCHAR(500) NOT NULL,
    destination_path VARCHAR(500) DEFAULT '',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_workspace (workspace_id),
    UNIQUE KEY unique_user_workspace_source (user_id, workspace_id, source_path),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

