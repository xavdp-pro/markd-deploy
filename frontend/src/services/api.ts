import { Document, Task, TaskType, Workflow, TaskComment, TaskFile, User } from '../types';

const API_BASE = '/api';

class ApiService {
  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      credentials: 'include', // Important: envoie les cookies avec chaque requête
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
  async getTree(workspaceId: string = 'default'): Promise<{ success: boolean; tree: Document[]; workspace_name?: string }> {
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

  // ===== Task Types Operations =====
  async getTaskTypes(workspaceId: string): Promise<{ success: boolean; task_types: TaskType[] }> {
    return this.request(`/task-types?workspace_id=${workspaceId}`);
  }

  async createTaskType(data: { name: string; icon?: string; color?: string; position?: number }, workspaceId: string): Promise<{ success: boolean; id: number }> {
    return this.request(`/task-types?workspace_id=${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTaskType(id: number, data: { name?: string; icon?: string; color?: string; position?: number }): Promise<{ success: boolean }> {
    return this.request(`/task-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTaskType(id: number): Promise<{ success: boolean }> {
    return this.request(`/task-types/${id}`, {
      method: 'DELETE',
    });
  }

  // ===== Workflows Operations =====
  async getWorkflows(workspaceId: string): Promise<{ success: boolean; workflows: Workflow[] }> {
    return this.request(`/workflows?workspace_id=${workspaceId}`);
  }

  async createWorkflow(data: { name: string; is_default?: boolean; statuses: any[] }, workspaceId: string): Promise<{ success: boolean; id: number }> {
    return this.request(`/workflows?workspace_id=${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(id: number, data: { name?: string; is_default?: boolean; statuses?: any[] }): Promise<{ success: boolean }> {
    return this.request(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkflow(id: number): Promise<{ success: boolean }> {
    return this.request(`/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  // ===== Tasks Operations =====
  async getTasksTree(workspaceId: string): Promise<{ success: boolean; tasks: Task[] }> {
    return this.request(`/tasks/tree?workspace_id=${workspaceId}`);
  }

  async getTask(id: string): Promise<{ success: boolean; task: Task }> {
    return this.request(`/tasks/${id}`);
  }

  async createTask(data: {
    workspace_id: string;
    parent_id?: string | null;
    task_type_id: number;
    workflow_id: number;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    due_date?: string | null;
    responsible_user_id?: number | null;
  }): Promise<{ success: boolean; id: string }> {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    due_date?: string | null;
    responsible_user_id?: number | null;
    task_type_id?: number;
    workflow_id?: number;
  }): Promise<{ success: boolean }> {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async moveTask(id: string, parentId: string | null): Promise<{ success: boolean }> {
    return this.request(`/tasks/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: parentId }),
    });
  }

  async duplicateTask(id: string): Promise<{ success: boolean; id: string }> {
    return this.request(`/tasks/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async changeTaskStatus(id: string, status: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${id}/change-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async applyToChildren(id: string, properties: any): Promise<{ success: boolean; updated_count: number }> {
    return this.request(`/tasks/${id}/apply-to-children`, {
      method: 'POST',
      body: JSON.stringify({ properties }),
    });
  }

  // ===== Task Assignments =====
  async assignUsers(taskId: string, userIds: number[], responsibleId?: number): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds, responsible_id: responsibleId }),
    });
  }

  async unassignUser(taskId: string, userId: number): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/assign/${userId}`, {
      method: 'DELETE',
    });
  }

  // ===== Task Tags =====
  async addTag(taskId: string, tag: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag }),
    });
  }

  async removeTag(taskId: string, tag: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    });
  }

  // ===== Task Comments =====
  async getComments(taskId: string): Promise<{ success: boolean; comments: TaskComment[] }> {
    return this.request(`/tasks/${taskId}/comments`);
  }

  async addComment(taskId: string, content: string): Promise<{ success: boolean; id: number }> {
    return this.request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async updateComment(taskId: string, commentId: number, content: string): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteComment(taskId: string, commentId: number): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // ===== Task Files =====
  async getTaskFiles(taskId: string): Promise<{ success: boolean; files: TaskFile[] }> {
    return this.request(`/tasks/${taskId}/files`);
  }

  async uploadTaskFile(taskId: string, file: File): Promise<{ success: boolean; id: number; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/tasks/${taskId}/upload-file`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  async deleteTaskFile(taskId: string, fileId: number): Promise<{ success: boolean }> {
    return this.request(`/tasks/${taskId}/files/${fileId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();