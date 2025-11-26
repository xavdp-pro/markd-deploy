export interface Document {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  parent_id: string | null;
  created_at?: string;
  updated_at?: string;
  children?: Document[];
  locked_by?: {
    user_id: string;
    user_name: string;
  } | null;
}

export interface PasswordItem {
  id: string;
  name: string;
  type: 'folder' | 'password';
  parent_id?: string | null;
  username?: string | null;
  url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  workspace_id?: string;
  children?: PasswordItem[];
  locked_by?: {
    user_id: string;
    user_name: string;
    locked_at?: string;
  } | null;
}

export interface PasswordDetail extends PasswordItem {
  password: string;
  created_by: number;
}

export interface SessionState {
  expandedNodes: Record<string, boolean>;
  selectedId: string | null;
}

export interface LockInfo {
  user_id: string;
  user_name: string;
}

export interface MCPActivity {
  id: number;
  agent_id: string;
  action: string;
  document_id: string | null;
  details: any;
  created_at: string;
}

// ===== Task Management Types (Simple - mirrors Document structure) =====

export interface Task {
  id: string;
  name: string;
  type: 'task' | 'folder';
  content?: string;
  parent_id: string | null;
  workspace_id?: string;
  status?: string;
  priority?: 'low' | 'medium' | 'high';
  assigned_to?: string;
  responsible_user_id?: number | null;
  responsible_user_name?: string | null;
  due_date?: string;
  estimated_hours?: number | null;
  time_spent?: number | null;
  created_at?: string;
  updated_at?: string;
  children?: Task[];
  locked_by?: {
    user_id: string;
    user_name: string;
  } | null;
}

export interface TaskTimelineItem {
  id: string;
  task_id: string;
  event_type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  user_id?: number | null;
  user_name?: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id?: number | null;
  user_name?: string | null;
  content: string;
  created_at: string;
}

export interface TaskTag {
  id: string;
  name: string;
}

// Generic tag interface (used for documents, passwords, tasks)
export interface Tag {
  id: string;
  name: string;
}

// Alias for backward compatibility
export type DocumentTag = Tag;
export type PasswordTag = Tag;

export interface TaskFile {
  id: string;
  task_id: string;
  file_name: string;
  original_name: string;
  content_type?: string | null;
  file_size?: number | null;
  uploaded_by?: number | null;
  uploaded_by_name?: string | null;
  uploaded_at: string;
  download_url: string;
  markdown_note?: string | null;
}

export interface TaskAssignee {
  user_id: number;
  user_name: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  text: string;
  completed: boolean;
  order: number;
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  user_permission?: string;
}