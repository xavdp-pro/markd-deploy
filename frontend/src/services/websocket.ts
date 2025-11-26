import { io, Socket } from 'socket.io-client';
import { Document, LockInfo, Task } from '../types';

type TreeUpdateCallback = (tree: Document[]) => void;
type TreeChangedCallback = () => void;
type LockUpdateCallback = (documentId: string, lockInfo: LockInfo | null) => void;
type UserEditingCallback = (data: { document_id: string; user_name: string }) => void;
type DocumentUpdatedCallback = (data: { document_id: string; name?: string | null }) => void;

type TaskTreeChangedCallback = () => void;
type TaskLockUpdateCallback = (taskId: string, lockInfo: LockInfo | null) => void;
type TaskActivityUpdateCallback = (taskId: string) => void;

// Vault (Passwords) callbacks
type VaultTreeChangedCallback = () => void;
type VaultItemUpdatedCallback = (data: { password_id: string; name?: string | null }) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private treeUpdateCallbacks: Set<TreeUpdateCallback> = new Set();
  private treeChangedCallbacks: Set<TreeChangedCallback> = new Set();
  private lockUpdateCallbacks: Set<LockUpdateCallback> = new Set();
  private userEditingCallbacks: Set<UserEditingCallback> = new Set();
  private documentUpdatedCallbacks: Set<DocumentUpdatedCallback> = new Set();

  private taskTreeChangedCallbacks: Set<TaskTreeChangedCallback> = new Set();
  private taskLockUpdateCallbacks: Set<TaskLockUpdateCallback> = new Set();
  private taskActivityCallbacks: Set<TaskActivityUpdateCallback> = new Set();

  // Vault (Passwords) callbacks
  private vaultTreeChangedCallbacks: Set<VaultTreeChangedCallback> = new Set();
  private vaultItemUpdatedCallbacks: Set<VaultItemUpdatedCallback> = new Set();
  private vaultLockUpdateCallbacks: Set<LockUpdateCallback> = new Set();

  connect() {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('tree_updated', (data: { tree: Document[] }) => {
      this.treeUpdateCallbacks.forEach(cb => cb(data.tree));
    });

    this.socket.on('tree_changed', () => {
      this.treeChangedCallbacks.forEach(cb => cb());
    });

    this.socket.on('lock_updated', (data: { document_id: string; locked_by: LockInfo | null }) => {
      this.lockUpdateCallbacks.forEach(cb => cb(data.document_id, data.locked_by));
    });

    this.socket.on('user_editing', (data: { document_id: string; user_name: string }) => {
      this.userEditingCallbacks.forEach(cb => cb(data));
    });
    this.socket.on('document_content_updated', (data: { document_id: string; name?: string | null }) => {
      this.documentUpdatedCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('task_tree_changed', () => {
      this.taskTreeChangedCallbacks.forEach(cb => cb());
    });

    this.socket.on('task_lock_updated', (data: { task_id: string; locked_by: LockInfo | null }) => {
      this.taskLockUpdateCallbacks.forEach(cb => cb(data.task_id, data.locked_by));
    });

    this.socket.on('task_activity_updated', (data: { task_id: string }) => {
      this.taskActivityCallbacks.forEach(cb => cb(data.task_id));
    });

    // Vault (Passwords) events
    this.socket.on('vault_tree_changed', () => {
      this.vaultTreeChangedCallbacks.forEach(cb => cb());
    });

    this.socket.on('vault_item_updated', (data: { password_id: string; name?: string | null }) => {
      this.vaultItemUpdatedCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('vault_lock_updated', (data: { password_id: string; locked_by: LockInfo | null }) => {
      this.vaultLockUpdateCallbacks.forEach(cb => cb(data.password_id, data.locked_by));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  requestTree() {
    this.socket?.emit('request_tree');
  }

  notifyEditing(documentId: string, userName: string) {
    this.socket?.emit('document_editing', {
      document_id: documentId,
      user_name: userName,
    });
  }

  onTreeUpdate(callback: TreeUpdateCallback) {
    this.treeUpdateCallbacks.add(callback);
    return () => { this.treeUpdateCallbacks.delete(callback); };
  }

  onTreeChanged(callback: TreeChangedCallback) {
    this.treeChangedCallbacks.add(callback);
    return () => { this.treeChangedCallbacks.delete(callback); };
  }

  onLockUpdate(callback: LockUpdateCallback) {
    this.lockUpdateCallbacks.add(callback);
    return () => { this.lockUpdateCallbacks.delete(callback); };
  }

  onUserEditing(callback: UserEditingCallback) {
    this.userEditingCallbacks.add(callback);
    return () => { this.userEditingCallbacks.delete(callback); };
  }
  onDocumentUpdated(callback: DocumentUpdatedCallback) {
    this.documentUpdatedCallbacks.add(callback);
    return () => { this.documentUpdatedCallbacks.delete(callback); };
  }

  onTaskTreeChanged(callback: TaskTreeChangedCallback) {
    this.taskTreeChangedCallbacks.add(callback);
    return () => { this.taskTreeChangedCallbacks.delete(callback); };
  }

  onTaskLockUpdate(callback: TaskLockUpdateCallback) {
    this.taskLockUpdateCallbacks.add(callback);
    return () => { this.taskLockUpdateCallbacks.delete(callback); };
  }

  onTaskActivityUpdate(callback: TaskActivityUpdateCallback) {
    this.taskActivityCallbacks.add(callback);
    return () => { this.taskActivityCallbacks.delete(callback); };
  }

  notifyDocumentUpdated(documentId: string, name?: string) {
    this.socket?.emit('document_content_updated', { document_id: documentId, name });
  }

  notifyTaskTreeChanged() {
    this.socket?.emit('task_tree_changed');
  }

  notifyTaskLockUpdate(taskId: string, lockInfo: LockInfo | null) {
    this.socket?.emit('task_lock_updated', { task_id: taskId, locked_by: lockInfo });
  }

  notifyTaskActivity(taskId: string) {
    this.socket?.emit('task_activity_updated', { task_id: taskId });
  }

  // Vault (Passwords) methods
  onVaultTreeChanged(callback: VaultTreeChangedCallback) {
    this.vaultTreeChangedCallbacks.add(callback);
    return () => { this.vaultTreeChangedCallbacks.delete(callback); };
  }

  onVaultItemUpdated(callback: VaultItemUpdatedCallback) {
    this.vaultItemUpdatedCallbacks.add(callback);
    return () => { this.vaultItemUpdatedCallbacks.delete(callback); };
  }

  onVaultLockUpdate(callback: LockUpdateCallback) {
    this.vaultLockUpdateCallbacks.add(callback);
    return () => { this.vaultLockUpdateCallbacks.delete(callback); };
  }

  notifyVaultTreeChanged() {
    this.socket?.emit('vault_tree_changed');
  }

  notifyVaultItemUpdated(passwordId: string, name?: string) {
    this.socket?.emit('vault_item_updated', { password_id: passwordId, name });
  }
}

export const websocket = new WebSocketService();