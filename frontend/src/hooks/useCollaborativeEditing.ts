import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { PresenceUser } from '../components/PresenceBar';

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

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

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

  // Initialize socket connection
  useEffect(() => {
    if (!documentId) return;

    // Use existing socket or create new one
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Collaborative] Connected to server');
      
      // Re-join document if we were previously joined
      if (hasJoinedRef.current) {
        joinDocumentInternal();
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Collaborative] Disconnected from server');
    });

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
    socket.on('presence:list', (data: { document_id: string; users: PresenceUser[] }) => {
      if (data.document_id === documentId) {
        setUsers(data.users);
      }
    });

    socket.on('presence:join', (data: { document_id: string; user: PresenceUser }) => {
      if (data.document_id === documentId) {
        setUsers(prev => {
          // Check if user already exists
          const existingIndex = prev.findIndex(u => u.user_id === data.user.user_id);
          if (existingIndex >= 0) {
            // Update existing user (important for is_agent flag)
            const updated = [...prev];
            updated[existingIndex] = data.user;
            return updated;
          }
          return [...prev, data.user];
        });
      }
    });

    socket.on('presence:leave', (data: { document_id: string; user_id: string }) => {
      if (data.document_id === documentId) {
        setUsers(prev => prev.filter(u => u.user_id !== data.user_id));
      }
    });

    socket.on('presence:cursor', (data: {
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
    });

    // Legacy presence event for backward compatibility
    socket.on('presence_updated', (data: { document_id: string; users: PresenceUser[] }) => {
      if (data.document_id === documentId) {
        setUsers(data.users);
      }
    });

    // Streaming events
    socket.on('stream:start', (data: StreamingSession) => {
      if (data.document_id === documentId) {
        setStreamingSessions(prev => [...prev, data]);
      }
    });

    socket.on('stream:chunk', (data: {
      document_id: string;
      session_id: string;
      text: string;
      position: number;
      agent_name: string;
    }) => {
      if (data.document_id === documentId && onStreamChunk) {
        onStreamChunk(data.text, data.position, data.agent_name);
      }
    });

    socket.on('stream:end', (data: { document_id: string; session_id: string }) => {
      if (data.document_id === documentId) {
        setStreamingSessions(prev => 
          prev.filter(s => s.session_id !== data.session_id)
        );
      }
    });

    // Content change events from other users
    socket.on('content:change', (data: {
      document_id: string;
      content?: string;
      text?: string;
      position?: number;
      change_type?: string;
      user_id?: string;
      username?: string;
    }) => {
      if (data.document_id === documentId && data.content) {
        // Mark the user as typing
        if (data.user_id) {
          setUsers(prev => prev.map(u => 
            u.user_id === data.user_id 
              ? { ...u, is_typing: true } 
              : u
          ));
          // Clear typing indicator after 2 seconds
          setTimeout(() => {
            setUsers(prev => prev.map(u => 
              u.user_id === data.user_id 
                ? { ...u, is_typing: false } 
                : u
            ));
          }, 2000);
        }
        
        // Use the dedicated remote content change handler if available
        if (onRemoteContentChange) {
          onRemoteContentChange(data.content);
        } else if (onContentChange) {
          onContentChange(data.content);
        }
      }
    });

    socket.on('content:sync', (data: {
      document_id: string;
      content: string;
    }) => {
      if (data.document_id === documentId && onContentChange) {
        onContentChange(data.content);
      }
    });

    return () => {
      clearInterval(heartbeatInterval);
      if (hasJoinedRef.current) {
        socket.emit('leave_document', { document_id: documentId });
      }
      socket.disconnect();
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

