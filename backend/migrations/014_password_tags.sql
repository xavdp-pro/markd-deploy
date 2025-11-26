-- Migration 014: Password vault tags

CREATE TABLE IF NOT EXISTS password_tags (
    id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

CREATE TABLE IF NOT EXISTS password_tag_links (
    password_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    tag_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
    PRIMARY KEY (password_id, tag_id),
    INDEX idx_password_tag_links_tag (tag_id),
    CONSTRAINT fk_password_tag_links_password FOREIGN KEY (password_id) REFERENCES password_vault(id) ON DELETE CASCADE,
    CONSTRAINT fk_password_tag_links_tag FOREIGN KEY (tag_id) REFERENCES password_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

SELECT 'Password tags applied' as '';

