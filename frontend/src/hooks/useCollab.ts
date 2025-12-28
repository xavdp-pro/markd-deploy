import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CollabUser {
    id: string;
    clientId: string; // Socket ID or User ID (string)
    name: string;
    color: string;
    isLocal: boolean;
    isAgent?: boolean;
    agentName?: string;
    cursor?: {
        line: number;
        column: number;
    };
}

export function useCollab(documentId: string, userId: string, userName: string, initialContent: string) {
    const [content, setContentState] = useState(initialContent);
    const [remoteUsers, setRemoteUsers] = useState<Map<string, CollabUser>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [localCursor, setLocalCursor] = useState<{ line: number; column: number } | null>(null);
    const [myColor, setMyColor] = useState<string>('#3b82f6'); // Default blue, will be updated by server

    const socketRef = useRef<Socket | null>(null);

    // Connect to Socket.IO server
    useEffect(() => {
        // Connect to the same host, but via socket.io path
        const socket = io('/', {
            path: '/socket.io',
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('[Collab] Connected to server', socket.id);
            setIsConnected(true);

            // Join the document room
            socket.emit('join_document', {
                document_id: documentId,
                user: { id: userId, username: userName }
            });
        });

        socket.on('disconnect', () => {
            console.log('[Collab] Disconnected');
            setIsConnected(false);
            setIsSynced(false);
        });

        // Receive list of current users when joining
        socket.on('presence:list', (data: any) => {
            if (data.document_id !== documentId) return;
            // Not implemented in backend yet, but join returns users list if we use REST or ACK
            // For now, let's rely on 'join' events or improve backend later.
            // Wait! join_document in backend returns users list!
            // But via ACK callback, not emitted event 'presence:list'.
            // Socket.IO emit with callback is tricky in React useEffect.
            // Alternatively, we can listen to 'presence:join' for ourselves?
            // No, the backend emits 'presence:join' to room.
            // We need the initial list.
            // Let's rely on the ACK of emit('join_document').
        });

        // Backend emit: 'presence:join'
        socket.on('presence:join', (data: any) => {
            if (data.document_id !== documentId) return;
            const u = data.user;

            // If it's me providing the color
            if (u.user_id === userId) {
                setMyColor(u.color);
                // Don't return, add myself to remoteUsers? No, local user is handled separately.
                return;
            }

            setRemoteUsers(prev => {
                const next = new Map(prev);
                next.set(u.user_id, {
                    id: u.user_id,
                    clientId: u.user_id,
                    name: u.username,
                    color: u.color,
                    isLocal: false,
                    isAgent: u.is_agent,
                    agentName: u.agent_name,
                    cursor: undefined
                });
                return next;
            });
        });

        // Backend emit: 'presence:leave'
        socket.on('presence:leave', (data: any) => {
            if (data.document_id !== documentId) return;
            setRemoteUsers(prev => {
                const next = new Map(prev);
                next.delete(data.user_id);
                return next;
            });
        });

        // Backend emit: 'cursor_update' (Wait, backend emits 'cursor_update' OR 'presence:cursor'?)
        // In main.py: await sio.emit('cursor_update', ...)
        // In collaborative.py: await sio.emit('presence:cursor', ...)
        // It seems there are two paths! 'update_cursor_position' in collab uses 'presence:cursor'.
        // 'cursor_update' event in main.py uses 'cursor_update'.
        // Let's support both for safety.

        const handleCursor = (data: any) => {
            if (data.document_id !== documentId) return;
            const uid = data.user_id || data.id;
            if (uid === userId) return;

            setRemoteUsers(prev => {
                const next = new Map(prev);
                const existing = next.get(uid);

                // If user not known (joined before we did?), add placeholder
                const color = data.color || (existing?.color || '#888');
                const name = data.username || (existing?.name || 'Unknown');

                next.set(uid, {
                    id: uid,
                    clientId: uid,
                    name: name,
                    color: color,
                    isLocal: false,
                    isAgent: data.is_agent,
                    agentName: data.agent_name,
                    cursor: {
                        line: data.cursor_line || data.line,
                        column: data.cursor_column || data.column || 0
                    }
                });
                return next;
            });
        };

        socket.on('presence:cursor', handleCursor);
        socket.on('cursor_update', handleCursor); // Legacy support

        // Backend emit: 'content:change'
        socket.on('content:change', (data: any) => {
            if (data.document_id !== documentId) return;
            if (data.user_id !== userId) {
                if (data.content !== undefined) {
                    setContentState(data.content);
                }
                // Handle other change types if implemented
            }
        });

        // Backend emit: 'content:sync'
        socket.on('content:sync', (data: any) => {
            if (data.document_id !== documentId) return;
            setContentState(data.content);
            setIsSynced(true);
        });

        socketRef.current = socket;

        // Fetch initial users list via REST or a specific event if needed.
        // For now, we might miss existing users if we don't get a list on join.
        // Let's invoke a callback on join.
        socket.emit('join_document', {
            document_id: documentId,
            user: { id: userId, username: userName }
        }, (response: any) => {
            // If backend supports callback (it returns list in main.py but does socketio support return?)
            // main.py: return get_deduplicated_users(document_id)
            // Yes, Python-socketio supports ack.
            if (Array.isArray(response)) {
                const newUsers = new Map<string, CollabUser>();
                response.forEach((u: any) => {
                    if (u.user_id === userId) {
                        setMyColor(u.color);
                    } else {
                        newUsers.set(u.user_id, {
                            id: u.user_id,
                            clientId: u.user_id,
                            name: u.username,
                            color: u.color,
                            isLocal: false,
                            isAgent: u.is_agent,
                            agentName: u.agent_name,
                            cursor: u.cursor_line ? { line: u.cursor_line, column: u.cursor_column || 0 } : undefined
                        });
                    }
                });
                setRemoteUsers(newUsers);
                setIsSynced(true);
            }
        });

        return () => {
            socket.emit('leave_document', { document_id: documentId });
            socket.disconnect();
        };
    }, [documentId, userId]); // Removed userName from deps to avoid reconnect loops if name changes

    // Heartbeat Loop - Keeps session alive and prevents ghosts
    useEffect(() => {
        const interval = setInterval(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit('presence_heartbeat', { document_id: documentId });
            }
        }, 5000); // 5 seconds heartbeat
        return () => clearInterval(interval);
    }, [documentId]);

    const setContent = useCallback((newContent: string) => {
        setContentState(newContent);
        if (socketRef.current?.connected) {
            socketRef.current.emit('content:change', {
                document_id: documentId,
                content: newContent,
                user_id: userId,
                username: userName
            });
        }
    }, [documentId, userId, userName]);

    const setCursor = useCallback((cursor: { line: number, column: number }) => {
        setLocalCursor(cursor);
        if (socketRef.current?.connected) {
            socketRef.current.emit('cursor_update', {
                document_id: documentId,
                cursor_line: cursor.line, // Match backend expectation
                cursor_column: cursor.column,
                position: 0
            });
        }
    }, [documentId]);

    // Build the full users list including the local user for rendering
    const allUsers: CollabUser[] = useMemo(() => {
        const localUser: CollabUser = {
            id: userId,
            clientId: userId, // Use userId as clientId for local as well
            name: userName,
            color: myColor,
            isLocal: true,
            isAgent: false,
            cursor: localCursor || undefined
        };
        return [localUser, ...Array.from(remoteUsers.values())];
    }, [userId, userName, myColor, localCursor, remoteUsers]);

    return {
        content,
        setContent,
        users: allUsers,
        isConnected,
        isSynced: isSynced || isConnected,
        localClientId: userId,
        setCursor
    };
}
