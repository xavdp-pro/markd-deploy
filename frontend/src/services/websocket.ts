import { io, Socket } from 'socket.io-client';
import { Document, LockInfo } from '../types';

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
type PresenceUpdateCallback = (documentId: string, users: Array<{ id: string; username: string }>) => void;

// Files callbacks
type FileTreeChangedCallback = () => void;
type FileLockUpdateCallback = (fileId: string, lockInfo: LockInfo | null) => void;
type FileContentUpdatedCallback = (data: { file_id: string; name?: string | null; user_id?: number | null }) => void;

// Schema callbacks
type SchemaTreeChangedCallback = () => void;
type SchemaLockUpdateCallback = (schemaId: string, lockInfo: LockInfo | null) => void;
type SchemaContentUpdatedCallback = (data: { schema_id: string; user_id?: number | null }) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private connectingPromise: Promise<void> | null = null;
  private connectionRefCount: number = 0;
  private listenersRegistered: boolean = false;
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
  private presenceUpdateCallbacks: Set<PresenceUpdateCallback> = new Set();

  // Files callbacks
  private fileTreeChangedCallbacks: Set<FileTreeChangedCallback> = new Set();
  private fileLockUpdateCallbacks: Set<FileLockUpdateCallback> = new Set();
  private fileContentUpdatedCallbacks: Set<FileContentUpdatedCallback> = new Set();

  // Schema callbacks
  private schemaTreeChangedCallbacks: Set<SchemaTreeChangedCallback> = new Set();
  private schemaLockUpdateCallbacks: Set<SchemaLockUpdateCallback> = new Set();
  private schemaContentUpdatedCallbacks: Set<SchemaContentUpdatedCallback> = new Set();

  private registerListeners() {
    if (!this.socket || this.listenersRegistered) return;
    this.listenersRegistered = true;

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

    this.socket.on('presence_updated', (data: { document_id: string; users: Array<{ id: string; username: string }> }) => {
      this.presenceUpdateCallbacks.forEach(cb => cb(data.document_id, data.users));
    });

    // Files events
    this.socket.on('file_tree_changed', () => {
      this.fileTreeChangedCallbacks.forEach(cb => cb());
    });

    this.socket.on('file_lock_updated', (data: { file_id: string; locked_by: LockInfo | null }) => {
      this.fileLockUpdateCallbacks.forEach(cb => cb(data.file_id, data.locked_by));
    });

    this.socket.on('file_content_updated', (data: { file_id: string; name?: string | null; user_id?: number | null }) => {
      this.fileContentUpdatedCallbacks.forEach(cb => cb(data));
    });

    // Schema events
    this.socket.on('schema_tree_changed', () => {
      this.schemaTreeChangedCallbacks.forEach(cb => cb());
    });

    this.socket.on('schema_lock_updated', (data: { schema_id: string; locked_by: LockInfo | null }) => {
      this.schemaLockUpdateCallbacks.forEach(cb => cb(data.schema_id, data.locked_by));
    });

    this.socket.on('schema_content_updated', (data: { schema_id: string; user_id?: number | null }) => {
      this.schemaContentUpdatedCallbacks.forEach(cb => cb(data));
    });
  }

  connect() {
    // Increment reference count (each module that needs websocket increments)
    this.connectionRefCount++;
    
    // If already connected, just return
    if (this.socket?.connected) {
      this.registerListeners();
      return;
    }
    
    // If a connection attempt is already in progress, wait for it
    if (this.connectingPromise) {
      this.registerListeners();
      return this.connectingPromise;
    }
    
    // If socket exists but not connected, and we're within retry attempts, let Socket.IO handle it
    if (this.socket && !this.socket.connected) {
      this.registerListeners();
      return;
    }

    // Create new connection
    this.connectingPromise = new Promise<void>((resolve) => {
      this.listenersRegistered = false;
      this.socket = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 3, // Reduced to 3 attempts
        timeout: 20000,
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        this.connectingPromise = null;
        resolve();
      });

      this.socket.on('disconnect', () => {
        // Connection lost - Socket.IO will handle reconnection automatically
      });
      
      this.socket.on('connect_error', (error) => {
        // Connection failed - will retry automatically (limited attempts)
        // Only log after all retries are exhausted
        if (this.socket && !this.socket.connected) {
          // Silent - let Socket.IO handle retries
        }
      });
    });

    this.registerListeners();
    return this.connectingPromise;
  }

  disconnect() {
    // Decrement reference count
    this.connectionRefCount = Math.max(0, this.connectionRefCount - 1);
    
    // Only disconnect if no modules are using the websocket
    if (this.connectionRefCount === 0 && this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectingPromise = null;
      this.listenersRegistered = false;
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

  joinDocument(documentId: string) {
    this.socket?.emit('join_document', { document_id: documentId });
  }

  leaveDocument(documentId: string) {
    this.socket?.emit('leave_document', { document_id: documentId });
  }

  onPresenceUpdate(callback: PresenceUpdateCallback) {
    this.presenceUpdateCallbacks.add(callback);
    return () => { this.presenceUpdateCallbacks.delete(callback); };
  }

  // Files methods
  onFileTreeChanged(callback: FileTreeChangedCallback) {
    this.fileTreeChangedCallbacks.add(callback);
    return () => { this.fileTreeChangedCallbacks.delete(callback); };
  }

  onFileLockUpdate(callback: FileLockUpdateCallback) {
    this.fileLockUpdateCallbacks.add(callback);
    return () => { this.fileLockUpdateCallbacks.delete(callback); };
  }

  onFileContentUpdated(callback: FileContentUpdatedCallback) {
    this.fileContentUpdatedCallbacks.add(callback);
    return () => { this.fileContentUpdatedCallbacks.delete(callback); };
  }

  // Schema handlers
  onSchemaTreeChanged(callback: SchemaTreeChangedCallback) {
    this.schemaTreeChangedCallbacks.add(callback);
    return () => { this.schemaTreeChangedCallbacks.delete(callback); };
  }

  onSchemaLockUpdated(callback: SchemaLockUpdateCallback) {
    this.schemaLockUpdateCallbacks.add(callback);
    return () => { this.schemaLockUpdateCallbacks.delete(callback); };
  }

  onSchemaContentUpdated(callback: SchemaContentUpdatedCallback) {
    this.schemaContentUpdatedCallbacks.add(callback);
    return () => { this.schemaContentUpdatedCallbacks.delete(callback); };
  }
}

export const websocket = new WebSocketService();