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

// ===== Task Management Types =====

export interface User {
  id: number;
  username: string;
  email: string;
  role?: string;
}

export interface TaskType {
  id: number;
  workspace_id: string;
  name: string;
  icon?: string;
  color?: string;
  position: number;
  created_at?: string;
}

export interface WorkflowStatus {
  key: string;
  label: string;
  color: string;
}

export interface Workflow {
  id: number;
  workspace_id: string;
  name: string;
  is_default: boolean;
  statuses: WorkflowStatus[];
  created_at?: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  parent_id?: string | null;
  task_type_id: number;
  workflow_id: number;
  title: string;
  description?: string;
  status: string;
  priority: 'low' | 'medium' | 'high';
  due_date?: string | null;
  responsible_user_id?: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  
  // Related data (populated by API)
  type_name?: string;
  type_icon?: string;
  type_color?: string;
  workflow_name?: string;
  workflow_statuses?: WorkflowStatus[];
  responsible_username?: string;
  responsible?: User;
  created_by_username?: string;
  assigned_users?: User[];
  tags?: string[];
  children?: Task[];
}

export interface TaskComment {
  id: number;
  task_id: string;
  user_id: number;
  content: string;
  type: 'comment' | 'system';
  created_at: string;
  updated_at?: string;
  
  // Populated by API
  username?: string;
  email?: string;
}

export interface TaskFile {
  id: number;
  task_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_by: number;
  uploaded_at: string;
  
  // Populated by API
  username?: string;
}