import { Document, Task, TaskTimelineItem, TaskComment, Tag, TaskChecklistItem, TaskTag, TaskAssignee, TaskFile } from '../types';

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

  async updateTaskFileNote(taskId: string, fileId: string, note: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/files/${fileId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ markdown_note: note }),
    });
  }

  async getTaskChecklist(id: string): Promise<{ success: boolean; items: TaskChecklistItem[] }> {
    return this.request(`/tasks/${id}/checklist`);
  }

  async addTaskChecklistItem(id: string, text: string): Promise<{ success: boolean; item: TaskChecklistItem }> {
    return this.request(`/tasks/${id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async updateTaskChecklistItem(
    taskId: string,
    itemId: string,
    updates: { text?: string; completed?: boolean }
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

  async getTaskTimeline(id: string): Promise<{ success: boolean; timeline: TaskTimelineItem[] }> {
    return this.request(`/tasks/${id}/timeline`);
  }

  async addTaskTimelineEntry(
    id: string,
    data: { title: string; description?: string; event_type?: string }
  ): Promise<{ success: boolean; entry: TaskTimelineItem }> {
    return this.request(`/tasks/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data),
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

  // ===== System Settings =====
  async getModuleSettings(): Promise<{ documents: boolean; tasks: boolean; passwords: boolean }> {
    return this.request('/admin/settings/modules');
  }

  async updateModuleSettings(settings: { documents: boolean; tasks: boolean; passwords: boolean }): Promise<{ success: boolean; message: string }> {
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