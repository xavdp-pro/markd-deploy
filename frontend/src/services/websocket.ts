import { io, Socket } from 'socket.io-client';
import { Document, LockInfo, Task } from '../types';

type TreeUpdateCallback = (tree: Document[]) => void;
type TreeChangedCallback = () => void;
type LockUpdateCallback = (documentId: string, lockInfo: LockInfo | null) => void;
type UserEditingCallback = (data: { document_id: string; user_name: string }) => void;

// Task-related callbacks
type TaskUpdatedCallback = (data: any) => void;
type TaskStatusChangedCallback = (data: { task_id: string; status: string; user_name: string; task_title: string }) => void;
type TaskCommentAddedCallback = (data: { task_id: string; comment: any }) => void;
type TaskAssignedCallback = (data: { task_id: string; user_id: number; user_name: string }) => void;
type TaskMovedCallback = (data: { task_id: string; parent_id: string | null }) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private treeUpdateCallbacks: Set<TreeUpdateCallback> = new Set();
  private treeChangedCallbacks: Set<TreeChangedCallback> = new Set();
  private lockUpdateCallbacks: Set<LockUpdateCallback> = new Set();
  private userEditingCallbacks: Set<UserEditingCallback> = new Set();
  
  // Task callbacks
  private taskUpdatedCallbacks: Set<TaskUpdatedCallback> = new Set();
  private taskStatusChangedCallbacks: Set<TaskStatusChangedCallback> = new Set();
  private taskCommentAddedCallbacks: Set<TaskCommentAddedCallback> = new Set();
  private taskAssignedCallbacks: Set<TaskAssignedCallback> = new Set();
  private taskMovedCallbacks: Set<TaskMovedCallback> = new Set();

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

    // Task WebSocket events
    this.socket.on('task_updated', (data: any) => {
      this.taskUpdatedCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('task_status_changed', (data: { task_id: string; status: string; user_name: string; task_title: string }) => {
      this.taskStatusChangedCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('task_comment_added', (data: { task_id: string; comment: any }) => {
      this.taskCommentAddedCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('task_assigned', (data: { task_id: string; user_id: number; user_name: string }) => {
      this.taskAssignedCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('task_moved', (data: { task_id: string; parent_id: string | null }) => {
      this.taskMovedCallbacks.forEach(cb => cb(data));
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
    return () => this.treeUpdateCallbacks.delete(callback);
  }

  onTreeChanged(callback: TreeChangedCallback) {
    this.treeChangedCallbacks.add(callback);
    return () => this.treeChangedCallbacks.delete(callback);
  }

  onLockUpdate(callback: LockUpdateCallback) {
    this.lockUpdateCallbacks.add(callback);
    return () => this.lockUpdateCallbacks.delete(callback);
  }

  onUserEditing(callback: UserEditingCallback) {
    this.userEditingCallbacks.add(callback);
    return () => this.userEditingCallbacks.delete(callback);
  }

  // Task event listeners
  onTaskUpdated(callback: TaskUpdatedCallback) {
    this.taskUpdatedCallbacks.add(callback);
    return () => this.taskUpdatedCallbacks.delete(callback);
  }

  onTaskStatusChanged(callback: TaskStatusChangedCallback) {
    this.taskStatusChangedCallbacks.add(callback);
    return () => this.taskStatusChangedCallbacks.delete(callback);
  }

  onTaskCommentAdded(callback: TaskCommentAddedCallback) {
    this.taskCommentAddedCallbacks.add(callback);
    return () => this.taskCommentAddedCallbacks.delete(callback);
  }

  onTaskAssigned(callback: TaskAssignedCallback) {
    this.taskAssignedCallbacks.add(callback);
    return () => this.taskAssignedCallbacks.delete(callback);
  }

  onTaskMoved(callback: TaskMovedCallback) {
    this.taskMovedCallbacks.add(callback);
    return () => this.taskMovedCallbacks.delete(callback);
  }

  // Task event emitters (for broadcasting to other clients)
  notifyTaskUpdated(data: any) {
    this.socket?.emit('task_updated', data);
  }

  notifyTaskStatusChanged(data: { task_id: string; status: string; user_name: string; task_title: string }) {
    this.socket?.emit('task_status_changed', data);
  }

  notifyTaskCommentAdded(data: { task_id: string; comment: any }) {
    this.socket?.emit('task_comment_added', data);
  }

  notifyTaskAssigned(data: { task_id: string; user_id: number; user_name: string }) {
    this.socket?.emit('task_assigned', data);
  }

  notifyTaskMoved(data: { task_id: string; parent_id: string | null }) {
    this.socket?.emit('task_moved', data);
  }
}

export const websocket = new WebSocketService();