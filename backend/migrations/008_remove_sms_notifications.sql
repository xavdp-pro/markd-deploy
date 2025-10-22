-- Migration 008: Remove SMS notifications
-- Remove unused SMS notification column from users table

ALTER TABLE users DROP COLUMN sms_notifications;

-- Verify
SELECT 'SMS notifications column removed' as '';
SHOW COLUMNS FROM users;
