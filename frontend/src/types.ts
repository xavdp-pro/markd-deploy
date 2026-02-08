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

// ===== Files Module Types =====

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent_id: string | null;
  original_name?: string;
  mime_type?: string;
  file_size?: number;
  file_hash?: string;
  created_at?: string;
  updated_at?: string;
  workspace_id?: string;
  children?: FileItem[];
  locked_by?: LockInfo | null;
}

export interface FileDetail extends FileItem {
  created_by: number;
  download_url: string;
  content_url: string;
}

// ===== Schema Module Types =====

export interface SchemaItem {
  id: string;
  name: string;
  type: 'schema' | 'folder';
  parent_id: string | null;
  description?: string;
  created_at?: string;
  updated_at?: string;
  workspace_id?: string;
  children?: SchemaItem[];
  locked_by?: LockInfo | null;
}

export interface SchemaDetail extends SchemaItem {
  created_by: number;
  devices: Device[];
  connections: Connection[];
}

export interface Device {
  id: string;
  schema_id: string;
  device_type: string;
  name: string;
  model?: string;
  ip_address?: string;
  mac_address?: string;
  position_x: number;
  position_y: number;
  config_json?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Connection {
  id: string;
  schema_id: string;
  from_device_id: string;
  from_port: string;
  to_device_id: string;
  to_port: string;
  connection_type?: string;
  bandwidth?: number;
  vlan_id?: number;
  config_json?: Record<string, any>;
}

export interface DeviceTemplate {
  device_type: string;
  name: string;
  description: string;
  default_ports: Array<{
    name: string;
    type: 'WAN' | 'LAN';
    position: 'left' | 'right' | 'top' | 'bottom';
  }>;
  icon_svg: string;
  default_size: { width: number; height: number };
  is_custom?: boolean;
  template_id?: string;
}

export interface CustomDeviceTemplate {
  id: string;
  device_type: string;
  name: string;
  description?: string;
  default_ports: Array<{
    name: string;
    type: 'WAN' | 'LAN';
    position: 'left' | 'right' | 'top' | 'bottom';
  }>;
  icon_svg?: string;
  default_size: { width: number; height: number };
  created_by: number;
  created_at?: string;
  updated_at?: string;
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
  assignees?: Array<{ user_id: number; user_name: string }>;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  children?: Task[];
  locked_by?: {
    user_id: string;
    user_name: string;
  } | null;
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

export interface TaskStatus {
  key: string;
  label: string;
  color: string;
  type: 'todo' | 'in_progress' | 'done';
}

export interface Workflow {
  id: number;
  name: string;
  statuses: TaskStatus[];
}

export interface WorkflowStep {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
}