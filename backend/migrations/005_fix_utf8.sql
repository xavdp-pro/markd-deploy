-- Migration 005: Fix UTF-8 encoding
-- Convert all tables to utf8mb4 and fix corrupted data

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS=0;

-- Convert all tables to UTF8MB4
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE workspaces CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE documents CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `groups` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE user_groups CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE group_workspace_permissions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE workspace_permissions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE password_reset_codes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;

-- Fix corrupted data in workspaces
UPDATE workspaces 
SET name = 'Bac à sable', 
    description = 'Espace d''entraînement pour tous'
WHERE id = 'sandbox';

-- Fix corrupted data in groups
UPDATE `groups` SET description = 'Tous les utilisateurs - Groupe par défaut' WHERE id = 'all';
UPDATE `groups` SET description = 'Équipe technique - Développeurs' WHERE id = 'developers';
UPDATE `groups` SET description = 'Nouveaux utilisateurs - En apprentissage' WHERE id = 'novice';
UPDATE `groups` SET description = 'Visiteurs externes - Accès limité' WHERE id = 'visitor';

-- Verify
SELECT 'Workspaces fixed:' as '';
SELECT id, name, description FROM workspaces WHERE id = 'sandbox';

SELECT 'Groups fixed:' as '';
SELECT id, name, description FROM `groups`;
