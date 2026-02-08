import { Document, Task, TaskComment, Tag, TaskChecklistItem, TaskTag, TaskAssignee, TaskFile, FileItem, FileDetail, SchemaItem, SchemaDetail, Device, Connection, DeviceTemplate, CustomDeviceTemplate, WorkflowStep } from '../types';

const API_BASE = '/api';

class ApiService {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      credentials: 'include', // Important: send cookies with every request
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  // Document operations
  async getTree(workspaceId: string = 'demo'): Promise<{ success: boolean; tree: Document[]; workspace_name?: string }> {
    return this.request(`/documents/tree?workspace_id=${workspaceId}`);
  }

  async getDocument(id: string): Promise<{ success: boolean; document: Document }> {
    return this.request(`/documents/${id}`);
  }

  async createDocument(data: {
    name: string;
    type: 'file' | 'folder';
    parent_id: string;
    content?: string;
    workspace_id?: string;
  }): Promise<{ success: boolean; document: Document }> {
    return this.request('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDocument(
    id: string,
    data: {
      name?: string;
      content?: string;
      parent_id?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDocument(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  async moveDocument(id: string, parentId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/documents/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: parentId }),
    });
  }

  async copyDocument(id: string): Promise<{ success: boolean; document_id: string }> {
    return this.request(`/documents/${id}/copy`, {
      method: 'POST',
    });
  }

  // Lock operations
  async lockDocument(id: string, userId: string, userName: string): Promise<{
    success: boolean;
    message?: string;
    locked_by?: { user_id: string; user_name: string };
  }> {
    return this.request(`/documents/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, user_name: userName }),
    });
  }

  async unlockDocument(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/documents/${id}/lock?user_id=${userId}`, {
      method: 'DELETE',
    });
  }

  async forceUnlockDocument(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/documents/${id}/force-unlock`, {
      method: 'POST',
    });
  }

  async heartbeatDocument(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/documents/${id}/heartbeat`, {
      method: 'POST',
    });
  }

  // Document tags
  async getDocumentTags(documentId: string): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/documents/${documentId}/tags`);
  }

  async updateDocumentTags(documentId: string, tags: string[]): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/documents/${documentId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  }

  async getDocumentTagSuggestions(query: string = '', limit: number = 20): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/documents/tags/suggestions?query=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // ===== Tasks Operations (Simple - same as documents) =====
  async getTasksTree(workspaceId: string = 'demo'): Promise<{ success: boolean; tree: Task[]; workspace_name?: string }> {
    return this.request(`/tasks/tree?workspace_id=${workspaceId}`);
  }

  async getTask(id: string): Promise<{ success: boolean; task: Task }> {
    return this.request(`/tasks/${id}`);
  }

  async createTask(data: {
    name: string;
    type: 'task' | 'folder';
    parent_id: string;
    content?: string;
    workspace_id?: string;
    status?: string;
    priority?: string;
  }): Promise<{ success: boolean; task: Task }> {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: {
    name?: string;
    content?: string;
    status?: string;
    priority?: string;
    assigned_to?: string | null;
    due_date?: string | null;
  }): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async moveTask(id: string, parentId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: parentId }),
    });
  }

  async reorderTasks(taskIds: string[]): Promise<{ success: boolean }> {
    return this.request('/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ task_ids: taskIds }),
    });
  }

  // ── Workflow Steps ─────────────────────────────────────────────────────
  async getWorkflowSteps(workspaceId: string): Promise<{ success: boolean; steps: WorkflowStep[] }> {
    return this.request(`/tasks/workflow-steps?workspace_id=${encodeURIComponent(workspaceId)}`);
  }

  async createWorkflowStep(workspaceId: string, name: string, color: string = 'gray'): Promise<{ success: boolean; step: WorkflowStep }> {
    return this.request('/tasks/workflow-steps', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, name, color }),
    });
  }

  async updateWorkflowStep(stepId: string, data: { name?: string; color?: string }): Promise<{ success: boolean; step: WorkflowStep }> {
    return this.request(`/tasks/workflow-steps/${stepId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkflowStep(stepId: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/workflow-steps/${stepId}`, { method: 'DELETE' });
  }

  // ── Kanban Task Order ──────────────────────────────────────────────────
  async getKanbanOrder(workspaceId: string): Promise<{ success: boolean; order: Record<string, string[]> }> {
    return this.request(`/tasks/kanban-order?workspace_id=${encodeURIComponent(workspaceId)}`);
  }

  async saveKanbanOrder(workspaceId: string, statusSlug: string, taskIds: string[]): Promise<{ success: boolean }> {
    return this.request('/tasks/kanban-order', {
      method: 'PUT',
      body: JSON.stringify({ workspace_id: workspaceId, status_slug: statusSlug, task_ids: taskIds }),
    });
  }

  async reorderWorkflowSteps(workspaceId: string, stepIds: string[]): Promise<{ success: boolean }> {
    return this.request('/tasks/workflow-steps/reorder', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, step_ids: stepIds }),
    });
  }

  async copyTask(id: string): Promise<{ success: boolean; task_id: string }> {
    return this.request(`/tasks/${id}/copy`, {
      method: 'POST',
    });
  }

  async listTags(query?: string, limit: number = 50): Promise<{ success: boolean; tags: TaskTag[] }> {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (limit) params.set('limit', String(limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/tags${suffix}`);
  }

  async getTaskTagSuggestions(query: string = '', limit: number = 20): Promise<{ success: boolean; tags: TaskTag[] }> {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (limit) params.set('limit', String(limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/tags${suffix}`);
  }

  async getTaskTags(id: string): Promise<{ success: boolean; tags: TaskTag[] }> {
    return this.request(`/tasks/${id}/tags`);
  }

  async updateTaskTags(id: string, tags: string[]): Promise<{ success: boolean; tags: TaskTag[] }> {
    return this.request(`/tasks/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  }

  async getTaskAssignees(
    id: string
  ): Promise<{ success: boolean; assignees: TaskAssignee[]; responsible_id?: number | null; responsible_name?: string | null }> {
    return this.request(`/tasks/${id}/assignees`);
  }

  async updateTaskAssignees(
    id: string,
    data: { assignee_ids: number[]; responsible_id?: number | null }
  ): Promise<{ success: boolean; assignees: TaskAssignee[]; responsible_id?: number | null; responsible_name?: string | null }> {
    return this.request(`/tasks/${id}/assignees`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getTaskFiles(id: string): Promise<{ success: boolean; files: TaskFile[] }> {
    return this.request(`/tasks/${id}/files`);
  }

  async uploadTaskFile(id: string, file: File): Promise<{ success: boolean; file: TaskFile }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/tasks/${id}/files`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to upload file');
    }

    return response.json();
  }

  async deleteTaskFile(taskId: string, fileId: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  async getTaskChecklist(id: string): Promise<{ success: boolean; items: TaskChecklistItem[] }> {
    return this.request(`/tasks/${id}/checklist`);
  }

  async addTaskChecklistItem(id: string, text: string, assignedTo?: number | null, parentId?: string | null): Promise<{ success: boolean; item: TaskChecklistItem }> {
    return this.request(`/tasks/${id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ text, assigned_to: assignedTo ?? null, parent_id: parentId ?? null }),
    });
  }

  async updateTaskChecklistItem(
    taskId: string,
    itemId: string,
    updates: { text?: string; completed?: boolean; assigned_to?: number | null; clear_assignee?: boolean; parent_id?: string | null; clear_parent?: boolean }
  ): Promise<{ success: boolean; item: TaskChecklistItem }> {
    return this.request(`/tasks/${taskId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTaskChecklistItem(taskId: string, itemId: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/checklist/${itemId}`, {
      method: 'DELETE',
    });
  }

  async getTaskComments(id: string): Promise<{ success: boolean; comments: TaskComment[] }> {
    return this.request(`/tasks/${id}/comments`);
  }

  async addTaskComment(id: string, data: { content: string }): Promise<{ success: boolean; comment: TaskComment }> {
    return this.request(`/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTaskComment(taskId: string, commentId: string, data: { content: string }): Promise<{ success: boolean; comment: TaskComment }> {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTaskComment(taskId: string, commentId: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Task locks
  async lockTask(id: string, userId: string, userName: string): Promise<{
    success: boolean;
    message?: string;
    locked_by?: { user_id: string; user_name: string };
  }> {
    return this.request(`/tasks/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, user_name: userName }),
    });
  }

  async unlockTask(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${id}/lock?user_id=${userId}`, {
      method: 'DELETE',
    });
  }

  async heartbeatTask(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/tasks/${id}/heartbeat`, {
      method: 'POST',
    });
  }

  // ===== Password Vault Operations =====
  async getPasswordTree(workspaceId: string = 'demo'): Promise<{ success: boolean; tree: any[]; workspace_name?: string }> {
    return this.request(`/vault/tree?workspace_id=${workspaceId}`);
  }

  async getPasswords(workspaceId: string): Promise<{ success: boolean; passwords: any[] }> {
    return this.request(`/vault/passwords?workspace_id=${workspaceId}`);
  }

  async getPassword(id: string): Promise<{ success: boolean; password: any }> {
    return this.request(`/vault/passwords/${id}`);
  }

  async createPassword(data: {
    workspace_id: string;
    title: string;
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
    parent_id?: string | null;
    type?: 'password' | 'folder';
  }): Promise<{ success: boolean; id: string }> {
    return this.request('/vault/passwords', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  async renamePassword(id: string, newName: string): Promise<{ success: boolean }> {
    return this.request(`/vault/passwords/${id}/rename?new_name=${encodeURIComponent(newName)}`, {
      method: 'PATCH',
    });
  }

  async updatePassword(id: string, data: {
    title?: string;
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
    parent_id?: string | null;
  }): Promise<{ success: boolean }> {
    return this.request(`/vault/passwords/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePassword(id: string): Promise<{ success: boolean }> {
    return this.request(`/vault/passwords/${id}`, {
      method: 'DELETE',
    });
  }

  // Password Locking
  async lockPassword(id: string, user: { id: string; username: string }): Promise<{ success: boolean; message: string }> {
    return this.request(`/vault/passwords/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, user_name: user.username }),
    });
  }

  async unlockPassword(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/vault/passwords/${id}/lock?user_id=${userId}`, {
      method: 'DELETE',
    });
  }

  async forceUnlockPassword(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/vault/passwords/${id}/force-unlock`, {
      method: 'POST',
    });
  }

  async heartbeatPassword(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/vault/passwords/${id}/heartbeat`, {
      method: 'POST',
    });
  }

  // Password tags
  async getPasswordTags(passwordId: string): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/vault/passwords/${passwordId}/tags`);
  }

  async updatePasswordTags(passwordId: string, tags: string[]): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/vault/passwords/${passwordId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  }

  async getPasswordTagSuggestions(query: string = '', limit: number = 20): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/vault/passwords/tags/suggestions?query=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // ===== Files Operations =====
  async getFilesTree(workspaceId: string = 'demo'): Promise<{ success: boolean; tree: FileItem[]; workspace_name?: string }> {
    return this.request(`/files/tree?workspace_id=${workspaceId}`);
  }

  async getFile(id: string): Promise<{ success: boolean; file: FileDetail }> {
    return this.request(`/files/${id}`);
  }

  async createFile(data: {
    workspace_id: string;
    parent_id?: string | null;
    name: string;
    type: 'file' | 'folder';
  }): Promise<{ success: boolean; file: FileItem }> {
    return this.request('/files', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFile(
    id: string,
    data: {
      name?: string;
      parent_id?: string | null;
    }
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFile(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadFileContent(fileId: string, file: File): Promise<{ success: boolean; file: FileItem }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/files/${fileId}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to upload file');
    }

    return response.json();
  }

  async getFileContent(fileId: string): Promise<string> {
    return `${API_BASE}/files/${fileId}/content`;
  }

  async downloadFile(fileId: string): Promise<void> {
    const url = `${API_BASE}/files/${fileId}/download`;
    window.open(url, '_blank');
  }

  // File tags
  async getFileTags(fileId: string): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/files/${fileId}/tags`);
  }

  async updateFileTags(fileId: string, tags: string[]): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/files/${fileId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  }

  async getFileTagSuggestions(query: string = '', limit: number = 20): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/files/tags/suggestions?query=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // File locks
  async lockFile(id: string, userId: number, userName: string): Promise<{
    success: boolean;
    message?: string;
    locked_by?: { user_id: number; user_name: string; locked_at?: string };
  }> {
    return this.request(`/files/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, user_name: userName }),
    });
  }

  async unlockFile(id: string, userId: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/files/${id}/lock?user_id=${userId}`, {
      method: 'DELETE',
    });
  }

  async forceUnlockFile(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/files/${id}/force-unlock`, {
      method: 'POST',
    });
  }

  // ===== Schema Operations =====
  async getSchemasTree(workspaceId: string = 'demo'): Promise<{ success: boolean; tree: SchemaItem[]; workspace_name?: string }> {
    return this.request(`/schemas/tree?workspace_id=${workspaceId}`);
  }

  async getSchema(id: string): Promise<{ success: boolean; schema: SchemaDetail }> {
    return this.request(`/schemas/${id}`);
  }

  async createSchema(data: {
    workspace_id: string;
    parent_id?: string | null;
    name: string;
    type: 'schema' | 'folder';
    description?: string;
  }): Promise<{ success: boolean; schema: SchemaItem }> {
    return this.request('/schemas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSchema(
    id: string,
    data: {
      name?: string;
      parent_id?: string | null;
      description?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/schemas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSchema(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/schemas/${id}`, {
      method: 'DELETE',
    });
  }

  // Schema devices
  async getSchemaDevices(schemaId: string): Promise<{ success: boolean; devices: Device[] }> {
    return this.request(`/schemas/${schemaId}/devices`);
  }

  async createDevice(schemaId: string, data: {
    device_type: string;
    name: string;
    model?: string;
    ip_address?: string;
    mac_address?: string;
    position_x: number;
    position_y: number;
    config_json?: Record<string, any>;
  }): Promise<{ success: boolean; device: Device }> {
    return this.request(`/schemas/${schemaId}/devices`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDevice(schemaId: string, deviceId: string, data: {
    name?: string;
    position_x?: number;
    position_y?: number;
    model?: string;
    ip_address?: string;
    mac_address?: string;
    config_json?: Record<string, any>;
  }): Promise<{ success: boolean; device: Device }> {
    return this.request(`/schemas/${schemaId}/devices/${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDevice(schemaId: string, deviceId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/schemas/${schemaId}/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  async getDeviceTemplates(workspaceId: string = 'demo'): Promise<{ success: boolean; templates: DeviceTemplate[] }> {
    return this.request(`/schemas/device-templates?workspace_id=${workspaceId}`);
  }

  // Custom device templates
  async getCustomTemplates(workspaceId: string = 'demo'): Promise<{ success: boolean; templates: CustomDeviceTemplate[] }> {
    return this.request(`/schemas/custom-templates?workspace_id=${workspaceId}`);
  }

  async createCustomTemplate(workspaceId: string, data: {
    device_type: string;
    name: string;
    description?: string;
    default_ports: Array<{ name: string; type: 'WAN' | 'LAN'; position: 'left' | 'right' | 'top' | 'bottom' }>;
    icon_svg?: string;
    default_size: { width: number; height: number };
  }): Promise<{ success: boolean; template: CustomDeviceTemplate }> {
    return this.request(`/schemas/custom-templates?workspace_id=${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomTemplate(templateId: string, workspaceId: string, data: {
    name?: string;
    description?: string;
    default_ports?: Array<{ name: string; type: 'WAN' | 'LAN'; position: 'left' | 'right' | 'top' | 'bottom' }>;
    icon_svg?: string;
    default_size?: { width: number; height: number };
  }): Promise<{ success: boolean; template: CustomDeviceTemplate }> {
    return this.request(`/schemas/custom-templates/${templateId}?workspace_id=${workspaceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomTemplate(templateId: string, workspaceId: string = 'demo'): Promise<{ success: boolean; message: string }> {
    return this.request(`/schemas/custom-templates/${templateId}?workspace_id=${workspaceId}`, {
      method: 'DELETE',
    });
  }

  // Schema connections
  async getSchemaConnections(schemaId: string): Promise<{ success: boolean; connections: Connection[] }> {
    return this.request(`/schemas/${schemaId}/connections`);
  }

  async createConnection(schemaId: string, data: {
    from_device_id: string;
    from_port: string;
    to_device_id: string;
    to_port: string;
    connection_type?: string;
    bandwidth?: number;
    vlan_id?: number;
    config_json?: Record<string, any>;
  }): Promise<{ success: boolean; connection: Connection }> {
    return this.request(`/schemas/${schemaId}/connections`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateConnection(schemaId: string, connectionId: string, data: {
    connection_type?: string;
    bandwidth?: number;
    vlan_id?: number;
    config_json?: Record<string, any>;
  }): Promise<{ success: boolean; connection: Connection }> {
    return this.request(`/schemas/${schemaId}/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteConnection(schemaId: string, connectionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/schemas/${schemaId}/connections/${connectionId}`, {
      method: 'DELETE',
    });
  }

  // Schema tags
  async getSchemaTags(schemaId: string): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/schemas/${schemaId}/tags`);
  }

  async updateSchemaTags(schemaId: string, tags: string[]): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/schemas/${schemaId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  }

  async getSchemaTagSuggestions(query: string = '', limit: number = 20): Promise<{ success: boolean; tags: Tag[] }> {
    return this.request(`/schemas/tags/suggestions?query=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // Schema locks
  async lockSchema(id: string, userId: number, userName: string): Promise<{
    success: boolean;
    locked_by: LockInfo;
  }> {
    return this.request(`/schemas/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, user_name: userName }),
    });
  }

  async unlockSchema(id: string, userId: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/schemas/${id}/lock?user_id=${userId}`, {
      method: 'DELETE',
    });
  }

  async forceUnlockSchema(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/schemas/${id}/force-unlock`, {
      method: 'POST',
    });
  }

  // ===== System Settings =====
  async getModuleSettings(): Promise<{ documents: boolean; tasks: boolean; passwords: boolean; files: boolean; schemas: boolean }> {
    return this.request('/admin/settings/modules');
  }

  async updateModuleSettings(settings: { documents: boolean; tasks: boolean; passwords: boolean; files: boolean; schemas: boolean }): Promise<{ success: boolean; message: string }> {
    return this.request('/admin/settings/modules', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // ===== Workspaces =====
  async getWorkspaces(): Promise<{ success: boolean; workspaces: any[] }> {
    return this.request('/workspaces');
  }
}

export const api = new ApiService();