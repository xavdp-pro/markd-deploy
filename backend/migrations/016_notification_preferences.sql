-- User notification preferences (global)
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id INT(11) NOT NULL PRIMARY KEY,
    documents_enabled BOOLEAN DEFAULT TRUE,
    tasks_enabled BOOLEAN DEFAULT TRUE,
    passwords_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User workspace notification preferences (override global preferences per workspace)
CREATE TABLE IF NOT EXISTS user_workspace_notification_preferences (
    user_id INT(11) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    documents_enabled BOOLEAN DEFAULT NULL,
    tasks_enabled BOOLEAN DEFAULT NULL,
    passwords_enabled BOOLEAN DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, workspace_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Notification preferences tables created' as '';

