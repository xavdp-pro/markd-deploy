-- Migration 004: Groupes métier (Business Groups)
-- Replace old permission-based groups with business role groups

-- Clean old groups (keep user-specific groups)
DELETE FROM group_workspace_permissions WHERE group_id LIKE 'default-%';
DELETE FROM user_groups WHERE group_id LIKE 'default-%';
DELETE FROM `groups` WHERE id LIKE 'default-%';

-- Create new business groups
INSERT INTO `groups` (id, name, description) VALUES
('all', 'ALL', 'Tous les utilisateurs - Groupe par défaut'),
('developers', 'Developers', 'Équipe technique - Développeurs'),
('novice', 'Novice', 'Nouveaux utilisateurs - En apprentissage'),
('visitor', 'Visitor', 'Visiteurs externes - Accès limité')
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);

-- Add all existing users to ALL group
INSERT INTO user_groups (user_id, group_id)
SELECT id, 'all' FROM users
ON DUPLICATE KEY UPDATE user_id=user_id;

-- Optional: Create a default sandbox workspace with ALL group in RW
INSERT INTO workspaces (id, name, description) VALUES
('sandbox', 'Bac à sable', 'Espace d''entraînement pour tous')
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);

-- Grant RW access to ALL group on sandbox
INSERT INTO group_workspace_permissions (group_id, workspace_id, permission_level) VALUES
('all', 'sandbox', 'write')
ON DUPLICATE KEY UPDATE permission_level='write';

-- Migration complete
