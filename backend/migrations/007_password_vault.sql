-- Migration 007: Password Vault
-- Simple password manager per workspace with encryption

CREATE TABLE password_vault (
    id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    workspace_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    title VARCHAR(255) NOT NULL,
    username VARCHAR(255) DEFAULT NULL,
    password_encrypted TEXT NOT NULL,
    url VARCHAR(500) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    category ENUM('ssh', 'api', 'database', 'service', 'other') DEFAULT 'other',
    created_by INT(11) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    KEY idx_workspace (workspace_id),
    KEY idx_category (category),
    KEY idx_created_by (created_by),
    CONSTRAINT fk_vault_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_vault_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify
SELECT 'Password vault table created' as '';
SHOW TABLES LIKE 'password_vault';
