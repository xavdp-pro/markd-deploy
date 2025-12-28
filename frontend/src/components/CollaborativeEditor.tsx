import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Document, Tag as TagType } from '../types';
import { Image, Upload, Tag, Users, Bot, User, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import TagSelector from './TagSelector';
import { api } from '../services/api';
import { useCollab, CollabUser } from '../hooks/useCollab';
import CollaborativeCursors from './CollaborativeCursors';

interface CollaborativeEditorProps {
    document: Document;
    initialContent: string;
    onSave: (content: string) => void;
    onCancel: () => void;
    currentUserId: string;
    currentUserName: string;
}

const CollaboratorAvatar: React.FC<{ user: CollabUser; isCurrentUser: boolean }> = ({ user, isCurrentUser }) => {
    return (
        <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
            style={{ backgroundColor: user.color }}
        >
            {user.isAgent ? <Bot size={12} /> : <User size={12} />}
            <span>{user.name}{isCurrentUser ? ' (Vous)' : ''}</span>
        </div>
    );
};

const ConnectionStatus: React.FC<{ isConnected: boolean; isSynced: boolean }> = ({ isConnected, isSynced }) => {
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? 'Connecté' : 'Déconnecté'}
        </div>
    );
};

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
    document,
    initialContent,
    onSave,
    onCancel,
    currentUserId,
    currentUserName,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [tags, setTags] = useState<TagType[]>([]);
    const [availableTags, setAvailableTags] = useState<TagType[]>([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const {
        content,
        setContent,
        users,
        isConnected,
        isSynced,
        localClientId,
        setCursor
    } = useCollab(document.id, currentUserId, currentUserName, initialContent);

    useEffect(() => {
        if (content !== initialContent) setHasUnsavedChanges(true);
    }, [content, initialContent]);

    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const lines = textarea.value.substring(0, start).split('\n');
        setCursor({
            anchor: start,
            head: textarea.selectionEnd,
            line: lines.length,
            column: lines[lines.length - 1].length
        });
    };

    // Fast cursor sync
    useEffect(() => {
        const interval = setInterval(() => {
            if (textareaRef.current === document.activeElement) {
                const el = textareaRef.current;
                const lines = el.value.substring(0, el.selectionStart).split('\n');
                setCursor({
                    anchor: el.selectionStart,
                    head: el.selectionEnd,
                    line: lines.length,
                    column: lines[lines.length - 1].length
                });
            }
        }, 100);
        return () => clearInterval(interval);
    }, [setCursor]);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const formData = new FormData();
            formData.append('file', file);
            setUploading(true);
            try {
                const res = await api.post(`/uploads?workspace_id=${document.workspace_id}`, formData);
                const url = res.data.url;
                const newContent = content + `\n![${file.name}](${url})\n`;
                setContent(newContent);
                toast.success('Image ajoutée');
            } catch (err) {
                toast.error('Erreur upload');
            } finally {
                setUploading(false);
            }
        }
    };

    const otherUsers = users.filter(u => !u.isLocal);
    const currentUser = users.find(u => u.isLocal);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
            <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-lg text-gray-900 dark:text-white truncate max-w-sm">{document.name}</h2>
                    <ConnectionStatus isConnected={isConnected} isSynced={isSynced} />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onSave(content)} className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">Enregistrer</button>
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded font-medium hover:bg-gray-200 dark:hover:bg-gray-700">Fermer</button>
                </div>
            </div>

            {users.length > 0 && (
                <div className="px-4 py-2 border-b dark:border-gray-800 flex items-center gap-3 shrink-0 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1.5 text-gray-500 whitespace-nowrap">
                        <Users size={14} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Collaborateurs</span>
                    </div>
                    <div className="flex gap-2">
                        {currentUser && <CollaboratorAvatar user={currentUser} isCurrentUser={true} />}
                        {otherUsers.map(u => <CollaboratorAvatar key={u.clientId} user={u} isCurrentUser={false} />)}
                    </div>
                </div>
            )}

            <div
                ref={editorContainerRef}
                className="flex-1 relative overflow-hidden"
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onSelect={handleSelect}
                    className="w-full h-full p-10 bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-mono text-[16px] leading-[1.6] resize-none outline-none border-none relative z-10"
                    style={{ fontFamily: "monospace" }}
                    placeholder="Commencez à collaborer..."
                    spellCheck={false}
                />

                <div className="absolute inset-0 z-20 pointer-events-none">
                    <CollaborativeCursors
                        users={users.map(u => ({
                            client_id: u.clientId,
                            username: u.name,
                            color: u.color,
                            is_agent: !!u.isAgent,
                            agent_name: u.agentName,
                            cursor_line: u.cursor?.line,
                            cursor_column: u.cursor?.column,
                            is_local: u.isLocal,
                        }))}
                        localClientId={localClientId}
                        textareaElement={textareaRef.current}
                        content={content}
                    />
                </div>

                {dragActive && (
                    <div className="absolute inset-0 bg-blue-500/10 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center">
                            <Upload size={48} className="mx-auto mb-4 text-blue-500 animate-bounce" />
                            <p className="text-xl font-bold text-blue-500">Déposez l'image</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CollaborativeEditor;
