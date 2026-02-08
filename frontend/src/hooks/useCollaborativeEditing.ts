import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { PresenceUser } from '../components/PresenceBar';
import { websocket } from '../services/websocket';

interface StreamingSession {
  session_id: string;
  document_id: string;
  user_id: string;
  username: string;
  agent_name: string;
  position: number;
  color: string;
}

interface UseCollaborativeEditingOptions {
  documentId: string;
  userId: string;
  username: string;
  onContentChange?: (content: string) => void;
  onStreamChunk?: (chunk: string, position: number, agentName: string) => void;
  onRemoteContentChange?: (content: string) => void;
}

interface UseCollaborativeEditingReturn {
  users: PresenceUser[];
  isConnected: boolean;
  streamingSessions: StreamingSession[];
  updateCursorPosition: (line: number, column: number, position: number, selectionStart?: number, selectionEnd?: number) => void;
  broadcastContentChange: (newContent: string, cursorPosition: number) => void;
  joinDocument: () => void;
  leaveDocument: () => void;
}

export function useCollaborativeEditing({
  documentId,
  userId,
  username,
  onContentChange,
  onStreamChunk,
  onRemoteContentChange,
}: UseCollaborativeEditingOptions): UseCollaborativeEditingReturn {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingSessions, setStreamingSessions] = useState<StreamingSession[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRef = useRef(false);

  // Use the shared global socket instead of creating a new connection
  useEffect(() => {
    if (!documentId) return;

    // Ensure global websocket is connected and get the shared socket
    websocket.connect();
    const socket = websocket.getSocket();
    if (!socket) return;

    socketRef.current = socket;
    setIsConnected(socket.connected);

    // Listen for connect/disconnect on the shared socket
    const onConnect = () => {
      setIsConnected(true);
      console.log('[Collaborative] Shared socket connected');
      if (hasJoinedRef.current) {
        joinDocumentInternal();
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log('[Collaborative] Shared socket disconnected');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Heartbeat to keep presence alive (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      if (socket.connected && hasJoinedRef.current) {
        socket.emit('presence_heartbeat', {
          document_id: documentId,
          user_id: userId,
        });
      }
    }, 30000);

    // Presence events
    const onPresenceList = (data: { document_id: string; users: PresenceUser[] }) => {
      if (data.document_id === documentId) {
        setUsers(data.users);
      }
    };

    const onPresenceJoin = (data: { document_id: string; user: PresenceUser }) => {
      if (data.document_id === documentId) {
        setUsers(prev => {
          const existingIndex = prev.findIndex(u => u.user_id === data.user.user_id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = data.user;
            return updated;
          }
          return [...prev, data.user];
        });
      }
    };

    const onPresenceLeave = (data: { document_id: string; user_id: string }) => {
      if (data.document_id === documentId) {
        setUsers(prev => prev.filter(u => u.user_id !== data.user_id));
      }
    };

    const onPresenceCursor = (data: {
      document_id: string;
      user_id: string;
      cursor_position?: number;
      cursor_line?: number;
      cursor_column?: number;
    }) => {
      if (data.document_id === documentId) {
        setUsers(prev => prev.map(u => {
          if (u.user_id === data.user_id) {
            return {
              ...u,
              cursor_position: data.cursor_position,
              cursor_line: data.cursor_line,
              cursor_column: data.cursor_column,
            };
          }
          return u;
        }));
      }
    };

    const onPresenceUpdated = (data: { document_id: string; users: PresenceUser[] }) => {
      if (data.document_id === documentId) {
        setUsers(data.users);
      }
    };

    const onStreamStart = (data: StreamingSession) => {
      if (data.document_id === documentId) {
        setStreamingSessions(prev => [...prev, data]);
      }
    };

    const onStreamChunkEvent = (data: {
      document_id: string;
      session_id: string;
      text: string;
      position: number;
      agent_name: string;
    }) => {
      if (data.document_id === documentId && onStreamChunk) {
        onStreamChunk(data.text, data.position, data.agent_name);
      }
    };

    const onStreamEnd = (data: { document_id: string; session_id: string }) => {
      if (data.document_id === documentId) {
        setStreamingSessions(prev => 
          prev.filter(s => s.session_id !== data.session_id)
        );
      }
    };

    const onContentChangeEvent = (data: {
      document_id: string;
      content?: string;
      text?: string;
      position?: number;
      change_type?: string;
      user_id?: string;
      username?: string;
    }) => {
      if (data.document_id === documentId && data.content) {
        if (data.user_id) {
          setUsers(prev => prev.map(u => 
            u.user_id === data.user_id 
              ? { ...u, is_typing: true } 
              : u
          ));
          setTimeout(() => {
            setUsers(prev => prev.map(u => 
              u.user_id === data.user_id 
                ? { ...u, is_typing: false } 
                : u
            ));
          }, 2000);
        }
        
        if (onRemoteContentChange) {
          onRemoteContentChange(data.content);
        } else if (onContentChange) {
          onContentChange(data.content);
        }
      }
    };

    const onContentSync = (data: {
      document_id: string;
      content: string;
    }) => {
      if (data.document_id === documentId && onContentChange) {
        onContentChange(data.content);
      }
    };

    socket.on('presence:list', onPresenceList);
    socket.on('presence:join', onPresenceJoin);
    socket.on('presence:leave', onPresenceLeave);
    socket.on('presence:cursor', onPresenceCursor);
    socket.on('presence_updated', onPresenceUpdated);
    socket.on('stream:start', onStreamStart);
    socket.on('stream:chunk', onStreamChunkEvent);
    socket.on('stream:end', onStreamEnd);
    socket.on('content:change', onContentChangeEvent);
    socket.on('content:sync', onContentSync);

    return () => {
      clearInterval(heartbeatInterval);
      if (hasJoinedRef.current) {
        socket.emit('leave_document', { document_id: documentId });
        hasJoinedRef.current = false;
      }
      // Remove only our listeners, do NOT disconnect the shared socket
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('presence:list', onPresenceList);
      socket.off('presence:join', onPresenceJoin);
      socket.off('presence:leave', onPresenceLeave);
      socket.off('presence:cursor', onPresenceCursor);
      socket.off('presence_updated', onPresenceUpdated);
      socket.off('stream:start', onStreamStart);
      socket.off('stream:chunk', onStreamChunkEvent);
      socket.off('stream:end', onStreamEnd);
      socket.off('content:change', onContentChangeEvent);
      socket.off('content:sync', onContentSync);
      socketRef.current = null;
    };
  }, [documentId, userId]);

  const joinDocumentInternal = useCallback(() => {
    if (socketRef.current && documentId && userId) {
      socketRef.current.emit('join_document', {
        document_id: documentId,
        user: {
          user_id: userId,
          username: username,
          is_agent: false,
        },
      });
    }
  }, [documentId, userId, username]);

  const joinDocument = useCallback(() => {
    hasJoinedRef.current = true;
    if (isConnected) {
      joinDocumentInternal();
    }
  }, [isConnected, joinDocumentInternal]);

  const leaveDocument = useCallback(() => {
    hasJoinedRef.current = false;
    if (socketRef.current && documentId) {
      socketRef.current.emit('leave_document', { document_id: documentId });
      setUsers([]);
    }
  }, [documentId]);

  const updateCursorPosition = useCallback((
    line: number,
    column: number,
    position: number,
    selectionStart?: number,
    selectionEnd?: number
  ) => {
    if (socketRef.current && documentId && hasJoinedRef.current) {
      socketRef.current.emit('cursor_update', {
        document_id: documentId,
        line,
        column,
        position,
        selection_start: selectionStart,
        selection_end: selectionEnd,
      });
    }
  }, [documentId]);

  // Broadcast content change to other users
  const broadcastContentChange = useCallback((
    newContent: string,
    cursorPosition: number
  ) => {
    if (socketRef.current && documentId && hasJoinedRef.current) {
      socketRef.current.emit('content_change', {
        document_id: documentId,
        content: newContent,
        cursor_position: cursorPosition,
        user_id: userId,
        username: username,
      });
    }
  }, [documentId, userId, username]);

  return {
    users,
    isConnected,
    streamingSessions,
    updateCursorPosition,
    broadcastContentChange,
    joinDocument,
    leaveDocument,
  };
}

export default useCollaborativeEditing;

