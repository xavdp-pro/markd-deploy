-- Migration 013: Document tags

CREATE TABLE IF NOT EXISTS document_tags (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_document_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_tag_links (
    document_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (document_id, tag_id),
    INDEX idx_document_tag_links_tag (tag_id),
    CONSTRAINT fk_document_tag_links_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_tag_links_tag FOREIGN KEY (tag_id) REFERENCES document_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Document tags applied' as '';

