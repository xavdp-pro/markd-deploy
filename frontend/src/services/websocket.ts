import { io, Socket } from 'socket.io-client';
import { Document, LockInfo } from '../types';

type TreeUpdateCallback = (tree: Document[]) => void;
type TreeChangedCallback = () => void;
type LockUpdateCallback = (documentId: string, lockInfo: LockInfo | null) => void;
type UserEditingCallback = (data: { document_id: string; user_name: string }) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private treeUpdateCallbacks: Set<TreeUpdateCallback> = new Set();
  private treeChangedCallbacks: Set<TreeChangedCallback> = new Set();
  private lockUpdateCallbacks: Set<LockUpdateCallback> = new Set();
  private userEditingCallbacks: Set<UserEditingCallback> = new Set();

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
}

export const websocket = new WebSocketService();