-- Migration 025: Add support for files attached to timeline entries
-- Description: Creates table for files attached to timeline entries (discussion notes)

CREATE TABLE IF NOT EXISTS `task_timeline_files` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `timeline_entry_id` varchar(36) NOT NULL,
  `task_id` varchar(36) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `content_type` varchar(255) DEFAULT NULL,
  `file_size` bigint(20) DEFAULT NULL,
  `storage_path` varchar(500) NOT NULL,
  `uploaded_by` int(11) DEFAULT NULL,
  `uploaded_by_name` varchar(255) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  KEY `idx_timeline_files_entry` (`timeline_entry_id`),
  KEY `idx_timeline_files_task` (`task_id`),
  FOREIGN KEY (`timeline_entry_id`) REFERENCES `task_timeline`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

