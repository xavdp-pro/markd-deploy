-- Migration 015: Unified tags table for documents, tasks, and passwords

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS=0;

-- Create unified tags table
CREATE TABLE IF NOT EXISTS tags (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate document_tags to tags
INSERT IGNORE INTO tags (id, name, created_at)
SELECT id, name, created_at
FROM document_tags
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'document_tags');

-- Migrate task_tags to tags (merge duplicates by name)
-- First, insert tags that don't exist yet
INSERT IGNORE INTO tags (id, name, created_at)
SELECT tt.id, tt.name, tt.created_at
FROM task_tags tt
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'task_tags')
  AND NOT EXISTS (
    SELECT 1 FROM tags t WHERE LOWER(t.name) = LOWER(tt.name)
);

-- Migrate password_tags to tags (merge duplicates by name)
-- First, insert tags that don't exist yet
INSERT IGNORE INTO tags (id, name, created_at)
SELECT pt.id, pt.name, pt.created_at
FROM password_tags pt
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'password_tags')
  AND NOT EXISTS (
    SELECT 1 FROM tags t WHERE LOWER(t.name) = LOWER(pt.name)
);

-- Drop existing foreign key constraints
SET @dbname = DATABASE();
SET @tablename = 'document_tag_links';
SET @constraintname = 'fk_document_tag_links_tag';
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = @dbname 
     AND table_name = @tablename 
     AND constraint_name = @constraintname) > 0,
    CONCAT('ALTER TABLE ', @tablename, ' DROP FOREIGN KEY ', @constraintname),
    'SELECT "Constraint does not exist"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tablename = 'task_tag_links';
SET @constraintname = 'fk_task_tag_links_tag';
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = @dbname 
     AND table_name = @tablename 
     AND constraint_name = @constraintname) > 0,
    CONCAT('ALTER TABLE ', @tablename, ' DROP FOREIGN KEY ', @constraintname),
    'SELECT "Constraint does not exist"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tablename = 'password_tag_links';
SET @constraintname = 'fk_password_tag_links_tag';
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_schema = @dbname 
     AND table_name = @tablename 
     AND constraint_name = @constraintname) > 0,
    CONCAT('ALTER TABLE ', @tablename, ' DROP FOREIGN KEY ', @constraintname),
    'SELECT "Constraint does not exist"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update document_tag_links to use unified tags
UPDATE document_tag_links dtl
JOIN document_tags dt ON dtl.tag_id = dt.id
JOIN tags t ON LOWER(t.name) = LOWER(dt.name)
SET dtl.tag_id = t.id
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'document_tags')
  AND dtl.tag_id != t.id;

-- Update task_tag_links to use unified tags
UPDATE task_tag_links ttl
JOIN task_tags tt ON ttl.tag_id = tt.id
JOIN tags t ON LOWER(t.name) = LOWER(tt.name)
SET ttl.tag_id = t.id
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'task_tags')
  AND ttl.tag_id != t.id;

-- Update password_tag_links to use unified tags
UPDATE password_tag_links ptl
JOIN password_tags pt ON ptl.tag_id = pt.id
JOIN tags t ON LOWER(t.name) = LOWER(pt.name)
SET ptl.tag_id = t.id
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'password_tags')
  AND ptl.tag_id != t.id;

-- Ensure indexes exist on tag_id columns
-- Note: We check if they exist first to avoid errors
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics 
     WHERE table_schema = DATABASE() 
     AND table_name = 'document_tag_links' 
     AND index_name = 'idx_document_tag_links_tag') = 0,
    'CREATE INDEX idx_document_tag_links_tag ON document_tag_links(tag_id)',
    'SELECT "Index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics 
     WHERE table_schema = DATABASE() 
     AND table_name = 'task_tag_links' 
     AND index_name = 'idx_task_tag_links_tag') = 0,
    'CREATE INDEX idx_task_tag_links_tag ON task_tag_links(tag_id)',
    'SELECT "Index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics 
     WHERE table_schema = DATABASE() 
     AND table_name = 'password_tag_links' 
     AND index_name = 'idx_password_tag_links_tag') = 0,
    'CREATE INDEX idx_password_tag_links_tag ON password_tag_links(tag_id)',
    'SELECT "Index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update foreign key constraints to reference unified tags table
ALTER TABLE document_tag_links
    ADD CONSTRAINT fk_document_tag_links_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

ALTER TABLE task_tag_links
    ADD CONSTRAINT fk_task_tag_links_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

ALTER TABLE password_tag_links
    ADD CONSTRAINT fk_password_tag_links_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;

-- Drop old tag tables (keep links tables)
DROP TABLE IF EXISTS document_tags;
DROP TABLE IF EXISTS task_tags;
DROP TABLE IF EXISTS password_tags;

SELECT 'Unified tags table created and data migrated' as '';

