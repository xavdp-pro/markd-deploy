-- Simple Task Management System
-- Same structure as documents, just different content

-- Tasks table (mirrors documents structure)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('task', 'folder') NOT NULL,
    content LONGTEXT,
    parent_id VARCHAR(36),
    workspace_id VARCHAR(50) DEFAULT 'default',
    user_id INT(11) DEFAULT NULL,
    
    -- Task-specific fields
    status VARCHAR(50) DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    assigned_to VARCHAR(255) DEFAULT NULL,
    due_date DATETIME DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_type (type),
    INDEX idx_workspace (workspace_id),
    INDEX idx_status (status),
    FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Task locks table (same as document_locks)
CREATE TABLE IF NOT EXISTS task_locks (
    task_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Task session state (UI persistence)
CREATE TABLE IF NOT EXISTS task_session_states (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    expanded_nodes JSON,
    selected_id VARCHAR(36),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert root folder
INSERT INTO tasks (id, name, type, parent_id, content) VALUES
('root', 'Tasks', 'folder', NULL, NULL);

-- Sample tasks
INSERT INTO tasks (id, name, type, parent_id, content, status, priority) VALUES
('task-1', 'Première tâche', 'task', 'root', '# Ma première tâche\n\nDescription en Markdown', 'todo', 'medium'),
('folder-1', 'Projet A', 'folder', 'root', NULL, 'todo', 'medium'),
('task-2', 'Tâche du projet A', 'task', 'folder-1', 'Description', 'doing', 'high');

SELECT 'Simple task management tables created' as '';
SHOW TABLES LIKE 'task%';

