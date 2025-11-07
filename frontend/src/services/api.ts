import { Document, Task } from '../types';

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

  // ===== Tasks Operations (Simple - same as documents) =====
  async getTasksTree(workspaceId: string = 'default'): Promise<{ success: boolean; tree: Task[]; workspace_name?: string }> {
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
    assigned_to?: string;
    due_date?: string;
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
}

export const api = new ApiService();