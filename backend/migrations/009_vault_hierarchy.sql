-- Migration 009: Add hierarchy support to password vault
-- Add parent_id and type to support folder structure like documents

-- Add new columns
ALTER TABLE password_vault
ADD COLUMN parent_id VARCHAR(36) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci DEFAULT NULL AFTER workspace_id,
ADD COLUMN type ENUM('folder', 'password') DEFAULT 'password' AFTER parent_id;

-- Add index for parent_id
ALTER TABLE password_vault
ADD KEY idx_parent (parent_id);

-- Add foreign key for parent_id (self-referencing)
ALTER TABLE password_vault
ADD CONSTRAINT fk_vault_parent FOREIGN KEY (parent_id) REFERENCES password_vault(id) ON DELETE CASCADE;

-- Update existing passwords to have type='password' and parent_id=NULL
UPDATE password_vault SET type = 'password', parent_id = NULL WHERE type IS NULL;

-- Verify
SELECT 'Password vault hierarchy columns added' as '';
DESCRIBE password_vault;
