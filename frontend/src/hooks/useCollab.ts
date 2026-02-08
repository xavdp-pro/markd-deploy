import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { websocket } from '../services/websocket';

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
    isTyping?: boolean; // Visual indicator when user is actively typing
}

export function useCollab(documentId: string, userId: string, userName: string, initialContent: string) {
    const [content, setContentState] = useState(initialContent);
    const [remoteUsers, setRemoteUsers] = useState<Map<string, CollabUser>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [localCursor, setLocalCursor] = useState<{ line: number; column: number } | null>(null);
    const [myColor, setMyColor] = useState<string>('#3b82f6'); // Default blue, will be updated by server

    const socketRef = useRef<Socket | null>(null);

    // Use the shared global socket instead of creating a separate connection
    useEffect(() => {
        websocket.connect();
        const socket = websocket.getSocket();
        if (!socket) return;

        setIsConnected(socket.connected);

        const onConnect = () => {
            console.log('[Collab] Shared socket connected', socket.id);
            setIsConnected(true);

            // Join the document room
            socket.emit('join_document', {
                document_id: documentId,
                user: { id: userId, username: userName, user_id: userId }
            }, (response: any) => {
                console.log('[Collab] join_document response', response);
                if (Array.isArray(response)) {
                    const newUsers = new Map<string, CollabUser>();
                    response.forEach((u: any) => {
                        const uId = String(u.user_id || u.id || '');
                        if (uId === String(userId)) {
                            if (u.color) setMyColor(u.color);
                        } else {
                            newUsers.set(uId, {
                                id: uId,
                                clientId: uId,
                                name: u.username || u.name || 'Unknown',
                                color: u.color || '#888',
                                isLocal: false,
                                isAgent: u.is_agent || false,
                                agentName: u.agent_name,
                                cursor: u.cursor_line !== undefined && u.cursor_line !== null ? {
                                    line: u.cursor_line,
                                    column: u.cursor_column || 0
                                } : undefined,
                                isTyping: false
                            });
                        }
                    });
                    setRemoteUsers(newUsers);
                    setIsSynced(true);
                }
            });
        };

        const onDisconnect = () => {
            console.log('[Collab] Shared socket disconnected');
            setIsConnected(false);
            setIsSynced(false);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        // If already connected, join immediately
        if (socket.connected) {
            onConnect();
        }

        // Backend emit: 'presence:join'
        const onPresenceJoin = (data: any) => {
            if (data.document_id !== documentId) return;
            const u = data.user;
            const uId = String(u.user_id || u.id || '');

            // If it's me providing the color
            if (uId === String(userId)) {
                setMyColor(u.color);
                // Don't add myself to remoteUsers, local user is handled separately
                return;
            }

            setRemoteUsers(prev => {
                const next = new Map(prev);
                const existing = prev.get(uId);
                next.set(uId, {
                    id: uId,
                    clientId: uId,
                    name: u.username || u.name || 'Unknown',
                    color: u.color || '#888',
                    isLocal: false,
                    isAgent: u.is_agent || false,
                    agentName: u.agent_name,
                    cursor: u.cursor_line !== undefined && u.cursor_line !== null ? {
                        line: u.cursor_line,
                        column: u.cursor_column || 0
                    } : undefined,
                    isTyping: existing?.isTyping || false // Preserve typing state
                });
                return next;
            });
        };
        socket.on('presence:join', onPresenceJoin);

        // Backend emit: 'presence:leave'
        const onPresenceLeave = (data: any) => {
            if (data.document_id !== documentId) return;
            const uId = String(data.user_id || data.id || '');
            setRemoteUsers(prev => {
                const next = new Map(prev);
                next.delete(uId);
                return next;
            });
        };
        socket.on('presence:leave', onPresenceLeave);

        // Backend emit: 'cursor_update' (Wait, backend emits 'cursor_update' OR 'presence:cursor'?)
        // In main.py: await sio.emit('cursor_update', ...)
        // In collaborative.py: await sio.emit('presence:cursor', ...)
        // It seems there are two paths! 'update_cursor_position' in collab uses 'presence:cursor'.
        // 'cursor_update' event in main.py uses 'cursor_update'.
        // Let's support both for safety.

        const handleCursor = (data: any) => {
            if (data.document_id !== documentId) return;
            const uid = String(data.user_id || data.id || '');
            if (uid === String(userId)) return;

            setRemoteUsers(prev => {
                const next = new Map(prev);
                const existing = next.get(uid);

                // If user not known (joined before we did?), add placeholder
                const color = data.color || (existing?.color || '#888');
                const name = data.username || data.name || (existing?.name || 'Unknown');

                next.set(uid, {
                    id: uid,
                    clientId: uid,
                    name: name,
                    color: color,
                    isLocal: false,
                    isAgent: data.is_agent || false,
                    agentName: data.agent_name,
                    cursor: {
                        line: data.cursor_line !== undefined ? data.cursor_line : (data.line !== undefined ? data.line : 0),
                        column: data.cursor_column !== undefined ? data.cursor_column : (data.column !== undefined ? data.column : 0)
                    }
                });
                return next;
            });
        };

        socket.on('presence:cursor', handleCursor);
        socket.on('cursor_update', handleCursor);

        // Backend emit: 'content:change'
        const onContentChange = (data: any) => {
            if (data.document_id !== documentId) return;
            const senderId = String(data.user_id || data.id || '');
            if (senderId !== String(userId) && data.content !== undefined) {
                // Update content state directly (this is a remote change, not local)
                setContentState(data.content);
                // Also update lastEmittedContentRef to prevent echo loops
                lastEmittedContentRef.current = data.content;
                // Mark user as typing + update cursor position if provided
                setRemoteUsers(prev => {
                    const next = new Map(prev);
                    const existing = next.get(senderId);
                    const baseUser: CollabUser = existing || {
                        id: senderId,
                        clientId: senderId,
                        name: data.username || 'Unknown',
                        color: '#888',
                        isLocal: false,
                        isAgent: false,
                    };
                    const cursorUpdate = (data.cursor_line !== undefined && data.cursor_line !== null)
                        ? { line: data.cursor_line, column: data.cursor_column || 0 }
                        : baseUser.cursor;
                    next.set(senderId, { ...baseUser, isTyping: true, cursor: cursorUpdate });
                    return next;
                });
                // Clear typing indicator after 2 seconds
                setTimeout(() => {
                    setRemoteUsers(current => {
                        const updated = new Map(current);
                        const u = updated.get(senderId);
                        if (u) {
                            updated.set(senderId, { ...u, isTyping: false });
                        }
                        return updated;
                    });
                }, 2000);
            }
        };
        socket.on('content:change', onContentChange);

        // Backend emit: 'content:sync'
        const onContentSync = (data: any) => {
            if (data.document_id !== documentId) return;
            setContentState(data.content);
            setIsSynced(true);
        };
        socket.on('content:sync', onContentSync);

        // Backend emit: 'stream:start' - MCP agent starts streaming
        const onStreamStart = (data: any) => {
            if (data.document_id !== documentId) return;
            console.log('[Collab] Stream started', data);
        };
        socket.on('stream:start', onStreamStart);

        // Backend emit: 'stream:chunk' - MCP agent sends text chunk
        const onStreamChunk = (data: any) => {
            if (data.document_id !== documentId) return;
            if (data.user_id === userId) return; // Skip our own chunks
            
            console.log('[Collab] Stream chunk received', data);
            
            // Insert chunk at position in current content
            setContentState(prevContent => {
                // Use position from data, or append at end if not provided
                const position = data.position !== undefined ? data.position : prevContent.length;
                // Insert text at position
                const newContent = prevContent.substring(0, position) + data.text + prevContent.substring(position);
                return newContent;
            });
            
            // Mark user as typing
            if (data.user_id) {
                setRemoteUsers(prev => {
                    const next = new Map(prev);
                    const existing = next.get(data.user_id);
                    if (existing) {
                        next.set(data.user_id, { ...existing, isTyping: true });
                    }
                    return next;
                });
                setTimeout(() => {
                    setRemoteUsers(current => {
                        const updated = new Map(current);
                        const u = updated.get(data.user_id);
                        if (u) {
                            updated.set(data.user_id, { ...u, isTyping: false });
                        }
                        return updated;
                    });
                }, 2000);
            }
        };
        socket.on('stream:chunk', onStreamChunk);

        // Backend emit: 'stream:end' - MCP agent ends streaming
        const onStreamEnd = (data: any) => {
            if (data.document_id !== documentId) return;
            console.log('[Collab] Stream ended', data);
        };
        socket.on('stream:end', onStreamEnd);

        socketRef.current = socket;

        // Listen for presence_updated to get full list of users
        const onPresenceUpdated = (data: any) => {
            if (data.document_id !== documentId) return;
            if (Array.isArray(data.users)) {
                const newUsers = new Map<string, CollabUser>();
                data.users.forEach((u: any) => {
                    const uId = String(u.user_id || u.id || '');
                    if (uId === String(userId)) {
                        if (u.color) setMyColor(u.color);
                        return;
                    }
                    newUsers.set(uId, {
                        id: uId,
                        clientId: uId,
                        name: u.username || u.name || 'Unknown',
                        color: u.color || '#888',
                        isLocal: false,
                        isAgent: u.is_agent || false,
                        agentName: u.agent_name,
                        cursor: u.cursor_line !== undefined && u.cursor_line !== null ? {
                            line: u.cursor_line,
                            column: u.cursor_column || 0
                        } : undefined,
                        isTyping: false
                    });
                });
                setRemoteUsers(newUsers);
            }
        };
        socket.on('presence_updated', onPresenceUpdated);

        return () => {
            socket.emit('leave_document', { document_id: documentId });
            // Remove only our listeners, do NOT disconnect the shared socket
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('presence:join', onPresenceJoin);
            socket.off('presence:leave', onPresenceLeave);
            socket.off('presence:cursor', handleCursor);
            socket.off('cursor_update', handleCursor);
            socket.off('content:change', onContentChange);
            socket.off('content:sync', onContentSync);
            socket.off('stream:start', onStreamStart);
            socket.off('stream:chunk', onStreamChunk);
            socket.off('stream:end', onStreamEnd);
            socket.off('presence_updated', onPresenceUpdated);
            socketRef.current = null;
        };
    }, [documentId, userId]);

    // Heartbeat Loop - Keeps session alive and prevents ghosts
    useEffect(() => {
        const interval = setInterval(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit('presence_heartbeat', { document_id: documentId });
            }
        }, 15000); // 15 seconds heartbeat (backend cleanup is 60s, so 4x margin)
        return () => clearInterval(interval);
    }, [documentId]);

    // Debounce content updates to avoid spam, but keep it responsive (100ms)
    const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastEmittedContentRef = useRef<string>('');
    
    const setContent = useCallback((newContent: string) => {
        setContentState(newContent);
        
        // Skip if content hasn't changed
        if (newContent === lastEmittedContentRef.current) {
            return;
        }
        
        // Clear existing debounce
        if (contentDebounceRef.current) {
            clearTimeout(contentDebounceRef.current);
        }
        
        // Debounce: emit after 300ms of inactivity (balance between real-time feel and performance)
        contentDebounceRef.current = setTimeout(() => {
            if (socketRef.current?.connected && newContent !== lastEmittedContentRef.current) {
                lastEmittedContentRef.current = newContent;
                // Include cursor position so remote users see cursor move while typing
                const cursor = lastEmittedCursorRef.current;
                socketRef.current.emit('content:change', {
                    document_id: documentId,
                    content: newContent,
                    user_id: userId,
                    username: userName,
                    cursor_line: cursor?.line,
                    cursor_column: cursor?.column
                });
            }
        }, 300);
    }, [documentId, userId, userName]);

    // Debounce cursor updates to avoid spam
    const cursorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastEmittedCursorRef = useRef<{ line: number; column: number } | null>(null);
    
    const setCursor = useCallback((cursor: { line: number, column: number }) => {
        setLocalCursor(cursor);
        
        // Skip if cursor hasn't changed
        const last = lastEmittedCursorRef.current;
        if (last && last.line === cursor.line && last.column === cursor.column) {
            return;
        }
        
        lastEmittedCursorRef.current = cursor;
        
        // Clear existing debounce
        if (cursorDebounceRef.current) {
            clearTimeout(cursorDebounceRef.current);
        }
        
        // Debounce: only emit after 150ms of inactivity
        cursorDebounceRef.current = setTimeout(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit('cursor_update', {
                    document_id: documentId,
                    cursor_line: cursor.line,
                    cursor_column: cursor.column,
                    position: 0
                });
            }
        }, 150);
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
