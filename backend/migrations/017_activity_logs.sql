-- Document activity log
CREATE TABLE IF NOT EXISTS document_activity_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT(11) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    item_path TEXT,
    item_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_workspace (workspace_id),
    INDEX idx_document (document_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Task activity log
CREATE TABLE IF NOT EXISTS task_activity_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT(11) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    item_path TEXT,
    item_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_workspace (workspace_id),
    INDEX idx_task (task_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password activity log
CREATE TABLE IF NOT EXISTS password_activity_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT(11) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    password_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    item_path TEXT,
    item_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_workspace (workspace_id),
    INDEX idx_password (password_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Activity log tables created' as '';

