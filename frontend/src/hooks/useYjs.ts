import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export interface YjsUser {
    id: string;
    clientId: number;
    name: string;
    color: string;
    isAgent: boolean;
    agentName?: string;
    isLocal: boolean;
    cursor?: {
        anchor: number;
        head: number;
        line: number;
        column: number;
    };
}

export interface UseYjsOptions {
    documentId: string;
    userId: string;
    userName: string;
    isAgent?: boolean;
    agentName?: string;
    initialContent?: string;
    onContentChange?: (content: string) => void;
    onUsersChange?: (users: YjsUser[]) => void;
    onSynced?: () => void;
}

export interface UseYjsReturn {
    content: string;
    setContent: (content: string) => void;
    users: YjsUser[];
    isConnected: boolean;
    isSynced: boolean;
    localClientId: number | undefined;
    setCursor: (cursorData: any) => void;
}

function generateColorFromId(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#E11D48', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0284C7', '#4F46E5', '#EA580C'];
    return colors[Math.abs(hash) % colors.length];
}

export function useYjs(options: UseYjsOptions): UseYjsReturn {
    const { documentId, userId, userName, isAgent = false, agentName, initialContent = '' } = options;

    const [content, setContentState] = useState(initialContent);
    const [users, setUsers] = useState<YjsUser[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [localClientId, setLocalClientId] = useState<number | undefined>();

    const ydocRef = useRef<Y.Doc | null>(null);
    const ytextRef = useRef<Y.Text | null>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const userColor = useMemo(() => generateColorFromId(userId), [userId]);

    const setContent = useCallback((newContent: string) => {
        const ytext = ytextRef.current;
        if (!ytext || ytext.toString() === newContent) return;
        ydocRef.current?.transact(() => {
            ytext.delete(0, ytext.length);
            ytext.insert(0, newContent);
        });
    }, []);

    const setCursor = useCallback((cursorData: any) => {
        const provider = providerRef.current;
        if (provider?.awareness) {
            provider.awareness.setLocalStateField('user', {
                id: userId,
                name: userName,
                color: userColor,
                isAgent,
                agentName,
                cursor: cursorData
            });
        }
    }, [userId, userName, userColor, isAgent, agentName]);

    useEffect(() => {
        if (!documentId) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Base URL with /yjs/ (trailing slash matches location /yjs/ in Nginx)
        const wsUrl = `${protocol}//${window.location.host}/yjs/`;
        const roomName = `doc-${documentId}`;

        const ydoc = new Y.Doc();
        const ytext = ydoc.getText('content');
        const provider = new WebsocketProvider(wsUrl, roomName, ydoc);

        ydocRef.current = ydoc;
        ytextRef.current = ytext;
        providerRef.current = provider;
        setLocalClientId(ydoc.clientID);

        // Initial Awareness
        provider.awareness.setLocalStateField('user', {
            id: userId,
            name: userName,
            color: userColor,
            isAgent,
            agentName
        });

        const handleStatus = (e: any) => {
            console.log(`[Yjs] Connection status for ${roomName}:`, e.status);
            setIsConnected(e.status === 'connected');
        };

        const handleSync = (synced: boolean) => {
            if (synced) {
                console.log(`[Yjs] Synced for ${roomName}, current length:`, ytext.length);
                setIsSynced(true);
                // Only initialize if server is empty AND we have initialContent
                if (ytext.length === 0 && optionsRef.current.initialContent) {
                    console.log(`[Yjs] Document empty on server, initializing...`);
                    ydoc.transact(() => {
                        ytext.insert(0, optionsRef.current.initialContent!);
                    }, 'initial-init');
                }
                setContentState(ytext.toString());
                optionsRef.current.onSynced?.();
            }
        };

        const handleYTextChange = (event: Y.YTextEvent) => {
            // Avoid local echo loops
            const val = ytext.toString();
            setContentState(val);
            optionsRef.current.onContentChange?.(val);
        };

        const handleAwarenessChange = () => {
            const states = provider.awareness.getStates();
            const usersList: YjsUser[] = [];

            states.forEach((state: any, clientId: number) => {
                if (state.user) {
                    usersList.push({
                        id: state.user.id || String(clientId),
                        clientId: clientId,
                        isLocal: clientId === ydoc.clientID,
                        name: state.user.name || 'Unknown',
                        color: state.user.color || '#888',
                        isAgent: !!state.user.isAgent,
                        agentName: state.user.agentName,
                        cursor: state.user.cursor
                    });
                }
            });

            setUsers(usersList);
            optionsRef.current.onUsersChange?.(usersList);
        };

        provider.on('status', handleStatus);
        provider.on('sync', handleSync);
        ytext.observe(handleYTextChange);
        provider.awareness.on('change', handleAwarenessChange);

        return () => {
            console.log(`[Yjs] Cleaning up provider for ${roomName}`);
            provider.disconnect();
            provider.destroy();
            ydoc.destroy();
        };
    }, [documentId, userId, userName, userColor, isAgent, agentName]);

    return { content, setContent, users, isConnected, isSynced, localClientId, setCursor };
}

export default useYjs;
