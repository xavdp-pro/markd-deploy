-- Migration 024: Add task_checklist table
-- Description: Creates table for task checklist items (sub-tasks)

CREATE TABLE IF NOT EXISTS `task_checklist` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `task_id` varchar(36) NOT NULL,
  `text` varchar(500) NOT NULL,
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  KEY `idx_task_checklist_task` (`task_id`),
  KEY `idx_task_checklist_order` (`order`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

