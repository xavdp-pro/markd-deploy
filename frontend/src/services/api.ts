import { Document } from '../types';

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
}

export const api = new ApiService();