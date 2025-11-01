-- Documentation Management System Database Schema
-- Database: markd-v1

-- Documents table (files and folders)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('file', 'folder') NOT NULL,
    content LONGTEXT,
    parent_id VARCHAR(36),
    workspace_id VARCHAR(50) DEFAULT 'default',
    user_id INT(11) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_type (type),
    INDEX idx_workspace (workspace_id),
    INDEX idx_user (user_id),
    FOREIGN KEY (parent_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Document locks table
CREATE TABLE IF NOT EXISTS document_locks (
    document_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session state table (for UI persistence)
CREATE TABLE IF NOT EXISTS session_states (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    expanded_nodes JSON,
    selected_id VARCHAR(36),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MCP activity log (for AI agent documentation)
CREATE TABLE IF NOT EXISTS mcp_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    document_id VARCHAR(36),
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent (agent_id),
    INDEX idx_document (document_id),
    INDEX idx_created (created_at),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert root folder
INSERT INTO documents (id, name, type, parent_id, content) VALUES
('root', 'Racine', 'folder', NULL, NULL);

-- Insert sample documents
INSERT INTO documents (id, name, type, parent_id, content) VALUES
('doc-1', 'Guide.md', 'file', 'root', '# Guide\n\nBienvenue dans votre gestionnaire de documents !\n\nCe système vous permet de :\n- Créer et organiser des documents\n- Éditer en temps réel\n- Collaborer avec d''autres utilisateurs'),
('folder-1', 'Documentation', 'folder', 'root', NULL),
('doc-2', 'README.md', 'file', 'folder-1', '# README\n\nCe dossier contient la documentation du projet.');