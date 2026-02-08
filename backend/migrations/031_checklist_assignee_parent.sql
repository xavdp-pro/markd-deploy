-- Migration 031: Add assigned_to and parent_id to task_checklist
-- Description: Allows checklist items to have an assignee and 1-level nesting

ALTER TABLE `task_checklist`
  ADD COLUMN `assigned_to` int(11) DEFAULT NULL AFTER `completed`,
  ADD COLUMN `parent_id` varchar(36) DEFAULT NULL AFTER `assigned_to`;

ALTER TABLE `task_checklist`
  ADD KEY `idx_task_checklist_parent` (`parent_id`);
