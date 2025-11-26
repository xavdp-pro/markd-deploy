-- Migration 011: Task timeline and comments

CREATE TABLE IF NOT EXISTS task_timeline (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSON,
    user_id INT(11),
    user_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_timeline_task (task_id),
    INDEX idx_task_timeline_created (created_at),
    CONSTRAINT fk_task_timeline_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_comments (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    user_id INT(11),
    user_name VARCHAR(255),
    content LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_comments_task (task_id),
    INDEX idx_task_comments_created (created_at),
    CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Task timeline and comments tables created' as '';

