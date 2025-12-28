import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

export interface CollabUser {
    id: string;
    clientId: number;
    name: string;
    color: string;
    isLocal: boolean;
    isAgent?: boolean;
    agentName?: string;
    cursor?: {
        line: number;
        column: number;
        anchor?: number;
    };
}

export function useCollab(documentId: string, userId: string, userName: string, initialContent: string) {
    const [content, setContentState] = useState(initialContent);
    const [remoteUsers, setRemoteUsers] = useState<Map<number, CollabUser>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [localCursor, setLocalCursor] = useState<{ line: number; column: number } | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const myClientIdRef = useRef<number>(Math.floor(Math.random() * 1000000));

    const color = useMemo(() => {
        const colors = ['#E11D48', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0284C7', '#4F46E5', '#EA580C'];
        let hash = 0;
        for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    }, [userId]);

    const connect = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/yjs/`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            setIsConnected(true);
            socket.send(JSON.stringify({
                type: 'join',
                room: `doc-${documentId}`,
                clientId: myClientIdRef.current,
                user: { id: userId, name: userName, color, isAgent: userId.startsWith('agent') }
            }));
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'sync-content') {
                    setContentState(data.content);
                    setIsSynced(true);
                } else if (data.type === 'content') {
                    setContentState(data.content);
                } else if (data.type === 'cursor' || data.type === 'join') {
                    setRemoteUsers(prev => {
                        const next = new Map(prev);
                        const cId = Number(data.clientId);
                        if (cId === myClientIdRef.current) return prev; // Ignore self

                        const existing = next.get(cId) || {};
                        next.set(cId, {
                            id: data.user?.id || data.userId || existing.id,
                            clientId: cId,
                            name: data.user?.name || data.userName || existing.name || 'Collaborator',
                            color: data.user?.color || data.color || existing.color || '#888',
                            isAgent: data.user?.isAgent || data.isAgent || existing.isAgent,
                            isLocal: false,
                            cursor: data.cursor || existing.cursor
                        });
                        return next;
                    });
                }
            } catch (e) {
                console.error('[SCS] Message error', e);
            }
        };

        socket.onclose = () => {
            setIsConnected(false);
            setIsSynced(false);
            setTimeout(connect, 2000);
        };

        wsRef.current = socket;
    }, [documentId, userId, userName, color]);

    useEffect(() => {
        connect();
        return () => wsRef.current?.close();
    }, [connect]);

    const setContent = useCallback((newContent: string) => {
        setContentState(newContent);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'content',
                content: newContent,
                clientId: myClientIdRef.current
            }));
        }
    }, []);

    const setCursor = useCallback((cursor: any) => {
        // Update local cursor state immediately
        setLocalCursor({ line: cursor.line, column: cursor.column });

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'cursor',
                cursor,
                clientId: myClientIdRef.current,
                userId,
                userName,
                color,
                isAgent: userId.startsWith('agent')
            }));
        }
    }, [userId, userName, color]);

    // Build the full users list including the local user
    const allUsers: CollabUser[] = useMemo(() => {
        const localUser: CollabUser = {
            id: userId,
            clientId: myClientIdRef.current,
            name: userName,
            color,
            isLocal: true,
            isAgent: userId.startsWith('agent'),
            cursor: localCursor || undefined
        };
        return [localUser, ...Array.from(remoteUsers.values())];
    }, [userId, userName, color, localCursor, remoteUsers]);

    return {
        content,
        setContent,
        users: allUsers,
        isConnected,
        isSynced: isSynced || isConnected,
        localClientId: myClientIdRef.current,
        setCursor
    };
}
