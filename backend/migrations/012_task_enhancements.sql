-- Migration 012: Task enhancements (tags, assignments, files)

ALTER TABLE tasks
    ADD COLUMN responsible_user_id INT(11) NULL AFTER assigned_to,
    ADD COLUMN responsible_user_name VARCHAR(255) NULL AFTER responsible_user_id;

CREATE TABLE IF NOT EXISTS task_assignees (
    task_id VARCHAR(36) NOT NULL,
    user_id INT(11) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (task_id, user_id),
    INDEX idx_task_assignees_user (user_id),
    CONSTRAINT fk_task_assignees_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_tags (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_tag_links (
    task_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (task_id, tag_id),
    INDEX idx_task_tag_links_tag (tag_id),
    CONSTRAINT fk_task_tag_links_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_tag_links_tag FOREIGN KEY (tag_id) REFERENCES task_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_files (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(255),
    file_size BIGINT,
    storage_path VARCHAR(500) NOT NULL,
    uploaded_by INT(11),
    uploaded_by_name VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_files_task (task_id),
    CONSTRAINT fk_task_files_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Task enhancements applied' as '';

