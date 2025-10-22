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