-- Migration 006: Protect business groups from deletion
-- Prevent accidental deletion of ALL, Developers, Novice, Visitor groups

-- Trigger to prevent deletion of business groups
DELIMITER $$

DROP TRIGGER IF EXISTS prevent_business_group_deletion$$
CREATE TRIGGER prevent_business_group_deletion
BEFORE DELETE ON `groups`
FOR EACH ROW
BEGIN
    IF OLD.id IN ('all', 'developers', 'novice', 'visitor') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot delete business groups (ALL, Developers, Novice, Visitor)';
    END IF;
END$$

-- Trigger to prevent removing users from ALL group
DROP TRIGGER IF EXISTS prevent_all_group_user_removal$$
CREATE TRIGGER prevent_all_group_user_removal
BEFORE DELETE ON user_groups
FOR EACH ROW
BEGIN
    IF OLD.group_id = 'all' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot remove users from ALL group';
    END IF;
END$$

DELIMITER ;

-- Verify triggers
SELECT 'Triggers created:' as '';
SHOW TRIGGERS LIKE 'groups';
SHOW TRIGGERS LIKE 'user_groups';
