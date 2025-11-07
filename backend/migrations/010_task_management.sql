-- Migration 010: Task Management System
-- Complete task management with hierarchical structure, workflows, and collaboration

-- ============================================
-- Task Types (configurable by admin)
-- ============================================

CREATE TABLE IF NOT EXISTS task_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(20) DEFAULT NULL,
    color VARCHAR(20) DEFAULT NULL,
    position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    INDEX idx_workspace (workspace_id),
    INDEX idx_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Workflows (process templates)
-- ============================================

CREATE TABLE IF NOT EXISTS workflows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    statuses JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    INDEX idx_workspace (workspace_id),
    INDEX idx_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tasks (main tasks table)
-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci PRIMARY KEY,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    parent_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL,
    task_type_id INT NOT NULL,
    workflow_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description LONGTEXT DEFAULT NULL,
    status VARCHAR(50) NOT NULL,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    due_date DATETIME DEFAULT NULL,
    responsible_user_id INT DEFAULT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (task_type_id) REFERENCES task_types(id),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id),
    FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_workspace (workspace_id),
    INDEX idx_parent (parent_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_due_date (due_date),
    INDEX idx_responsible (responsible_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Task Assignments (multiple users per task)
-- ============================================

CREATE TABLE IF NOT EXISTS task_assignments (
    task_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    user_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task (task_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Task Tags (flexible tagging)
-- ============================================

CREATE TABLE IF NOT EXISTS task_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    tag VARCHAR(50) NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    INDEX idx_task (task_id),
    INDEX idx_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Task Comments (comments + timeline events)
-- ============================================

CREATE TABLE IF NOT EXISTS task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    user_id INT NOT NULL,
    content LONGTEXT NOT NULL,
    type ENUM('comment', 'system') DEFAULT 'comment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_task (task_id),
    INDEX idx_type (type),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Task Files (attachments)
-- ============================================

CREATE TABLE IF NOT EXISTS task_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) DEFAULT NULL,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    INDEX idx_task (task_id),
    INDEX idx_uploaded (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Seed Data: Task Types for default workspace
-- ============================================

INSERT INTO task_types (workspace_id, name, icon, color, position) VALUES
('default', 'Epic', '🎯', '#9333ea', 1),
('default', 'Story', '📖', '#3b82f6', 2),
('default', 'Task', '✓', '#10b981', 3),
('default', 'Subtask', '→', '#6b7280', 4);

-- ============================================
-- Seed Data: Default Workflows
-- ============================================

INSERT INTO workflows (workspace_id, name, is_default, statuses) VALUES
('default', 'Simple', TRUE, '[
  {"key": "todo", "label": "À faire", "color": "#6b7280"},
  {"key": "doing", "label": "En cours", "color": "#3b82f6"},
  {"key": "done", "label": "Terminé", "color": "#10b981"}
]'),
('default', 'Avec validation', FALSE, '[
  {"key": "todo", "label": "À faire", "color": "#6b7280"},
  {"key": "doing", "label": "En cours", "color": "#3b82f6"},
  {"key": "validating", "label": "En validation", "color": "#f59e0b"},
  {"key": "done", "label": "Terminé", "color": "#10b981"}
]');

-- ============================================
-- Verify Installation
-- ============================================

SELECT 'Task Management tables created successfully' as '';
SHOW TABLES LIKE 'task%';
SELECT COUNT(*) as task_types_count FROM task_types;
SELECT COUNT(*) as workflows_count FROM workflows;

