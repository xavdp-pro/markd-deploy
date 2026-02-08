import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Document, Tag as TagType } from '../types';
import {
    Image as ImageIcon, Upload, Tag, Users, Bot, User, Wifi, WifiOff,
    Bold, Italic, List, ListOrdered, Link, Heading1, Heading2, Code, Quote, CheckSquare,
    Paperclip, Columns2, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import 'prism-themes/themes/prism-vsc-dark-plus.css';

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
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm transition-all hover:scale-105 border border-white/20 relative"
            style={{ backgroundColor: user.color }}
            title={isCurrentUser ? 'You' : user.isTyping ? `${user.name} is typing...` : user.name}
        >
            {user.isAgent ? <Bot size={14} /> : <User size={14} />}
            <span>{user.name}{isCurrentUser ? ' (You)' : ''}</span>
            {user.isTyping && !isCurrentUser && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse border-2 border-white"></span>
            )}
        </div>
    );
};

const ConnectionStatus: React.FC<{ isConnected: boolean; isSynced: boolean }> = ({ isConnected, isSynced }) => {
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? (isSynced ? 'Synchronisé' : 'Synchro...') : 'Déconnecté'}
        </div>
    );
};

// Glassy round indicator lamp: green = saved, orange = unsaved changes
const SaveIndicator: React.FC<{ isDirty: boolean }> = ({ isDirty }) => (
    <div
        className="relative w-3 h-3 rounded-full flex-shrink-0 transition-all duration-500"
        title={isDirty ? 'Unsaved changes' : 'All changes saved'}
    >
        <div className={`absolute inset-0 rounded-full blur-[3px] transition-colors duration-500 ${isDirty ? 'bg-orange-400/60' : 'bg-emerald-400/60'}`} />
        <div className={`absolute inset-0 rounded-full border transition-colors duration-500 ${isDirty ? 'bg-gradient-to-br from-orange-300 via-orange-400 to-orange-500 border-orange-500/50' : 'bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-500 border-emerald-500/50'}`} />
        <div className="absolute top-[1px] left-[2px] w-[5px] h-[4px] rounded-full bg-white/50" />
    </div>
);

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
    document,
    initialContent,
    onSave,
    onCancel,
    currentUserId,
    currentUserName,
}) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split');
    const [savedContent, setSavedContent] = useState(initialContent);

    const {
        content,
        setContent,
        users,
        isConnected,
        isSynced,
        localClientId,
        setCursor
    } = useCollab(document.id, currentUserId, currentUserName, initialContent);

    // Sync cursor on selection/change - debounced to avoid spam
    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let lastSentCursor: { line: number; column: number } | null = null;
        
        const syncCursor = () => {
            if (!textareaRef.current) return;
            const el = textareaRef.current;
            const lines = el.value.substring(0, el.selectionStart).split('\n');
            const line = lines.length;
            const column = lines[lines.length - 1].length;
            
            // Only send if cursor actually changed
            if (lastSentCursor && lastSentCursor.line === line && lastSentCursor.column === column) {
                return;
            }
            
            lastSentCursor = { line, column };
            
            // Clear existing debounce timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            
            // Debounce: wait 300ms before sending
            debounceTimer = setTimeout(() => {
                setCursor({ line, column });
            }, 300);
        };
        
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        // Sync on key events only (input, keyup for navigation keys)
        textarea.addEventListener('input', syncCursor);
        textarea.addEventListener('keyup', syncCursor);
        textarea.addEventListener('click', syncCursor);
        textarea.addEventListener('mouseup', syncCursor);
        
        // Sync periodically (reduced frequency: 1000ms instead of 200ms)
        const interval = setInterval(syncCursor, 1000);
        
        return () => {
            textarea.removeEventListener('input', syncCursor);
            textarea.removeEventListener('keyup', syncCursor);
            textarea.removeEventListener('click', syncCursor);
            textarea.removeEventListener('mouseup', syncCursor);
            clearInterval(interval);
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [setCursor]);

    // Sync scroll from editor to preview
    const handleScroll = () => {
        if (!textareaRef.current || !previewRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;
        const ratio = scrollTop / (scrollHeight - clientHeight);
        previewRef.current.scrollTop = ratio * (previewRef.current.scrollHeight - previewRef.current.clientHeight);
    };

    const insertMarkdown = (prefix: string, suffix: string = '') => {
        if (!textareaRef.current) return;
        const el = textareaRef.current;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selectedText = el.value.substring(start, end);
        const newText = el.value.substring(0, start) + prefix + selectedText + suffix + el.value.substring(end);
        setContent(newText);
        setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await performUpload(file);
    };

    const performUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        setUploading(true);
        try {
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            const data = await response.json();
            const url = data.url;
            if (file.type.startsWith('image/')) {
                insertMarkdown(`\n![${file.name}](${url})\n`);
            } else {
                insertMarkdown(`\n[📎 ${file.name}](${url})\n`);
            }
            toast.success('Fichier ajouté');
        } catch (err) {
            console.error('Upload error:', err);
            toast.error('Erreur upload');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            await performUpload(file);
        }
    };

    const otherUsers = users.filter(u => !u.isLocal);
    const currentUser = users.find(u => u.isLocal);
    const isDirty = content !== savedContent;

    const handleSave = () => {
        onSave(content);
        setSavedContent(content);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* Header / Toolbar */}
            <div className="border-b dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
                {/* Top Row: Title & Save */}
                <div className="px-4 py-3 flex items-center justify-between border-b dark:border-gray-800/50">
                    <div className="flex items-center gap-3">
                        <SaveIndicator isDirty={isDirty} />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-sm">{document.name}</h2>
                                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                    {isDirty ? 'Unsaved changes' : 'Saved'}
                                </span>
                            </div>
                            <ConnectionStatus isConnected={isConnected} isSynced={isSynced} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View mode toggle */}
                        <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                            <button
                                onClick={() => setViewMode('edit')}
                                className={`p-1.5 transition-colors ${
                                    viewMode === 'edit'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                                title="Edit only"
                            >
                                <Code size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('split')}
                                className={`p-1.5 border-x border-gray-200 dark:border-gray-600 transition-colors ${
                                    viewMode === 'split'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                                title="Split view"
                            >
                                <Columns2 size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('preview')}
                                className={`p-1.5 transition-colors ${
                                    viewMode === 'preview'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                                title="Preview only"
                            >
                                <Eye size={14} />
                            </button>
                        </div>
                        <button onClick={handleSave} className="px-5 py-1.5 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95">
                            Save
                        </button>
                        <button onClick={onCancel} className="px-5 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-md text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            Close
                        </button>
                    </div>
                </div>

                {/* Second Row: Markdown Tools & Users (hidden in preview mode) */}
                {viewMode !== 'preview' && (
                <div className="px-2 py-1.5 flex items-center justify-between overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-0.5">
                        <ToolbarButton icon={<Heading1 size={16} />} onClick={() => insertMarkdown('# ')} title="Heading 1" />
                        <ToolbarButton icon={<Heading2 size={16} />} onClick={() => insertMarkdown('## ')} title="Heading 2" />
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1.5" />
                        <ToolbarButton icon={<Bold size={16} />} onClick={() => insertMarkdown('**', '**')} title="Bold" />
                        <ToolbarButton icon={<Italic size={16} />} onClick={() => insertMarkdown('_', '_')} title="Italic" />
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1.5" />
                        <ToolbarButton icon={<List size={16} />} onClick={() => insertMarkdown('- ')} title="List" />
                        <ToolbarButton icon={<CheckSquare size={16} />} onClick={() => insertMarkdown('- [ ] ')} title="Task List" />
                        <ToolbarButton icon={<Code size={16} />} onClick={() => insertMarkdown('```\n', '\n```')} title="Code" />
                        <ToolbarButton icon={<Link size={16} />} onClick={() => insertMarkdown('[', '](url)')} title="Link" />
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1.5" />
                        <ToolbarButton
                            icon={uploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" /> : <ImageIcon size={16} />}
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload Image"
                        />
                        <ToolbarButton
                            icon={<Paperclip size={16} />}
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach File"
                        />
                    </div>

                    {/* Collaborators List */}
                    <div className="flex items-center gap-2 pl-4 border-l dark:border-gray-800 ml-2">
                        <div className="flex -space-x-2 mr-2">
                            {users.slice(0, 5).map(u => (
                                <div
                                    key={u.clientId}
                                    className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-bold text-white shadow"
                                    style={{ backgroundColor: u.color }}
                                    title={u.name}
                                >
                                    {u.name.charAt(0).toUpperCase()}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            {currentUser && <CollaboratorAvatar user={currentUser} isCurrentUser={true} />}
                            {otherUsers.map(u => <CollaboratorAvatar key={u.clientId} user={u} isCurrentUser={false} />)}
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* Editor / Preview panels */}
            <div
                ref={editorContainerRef}
                className="flex-1 flex overflow-hidden relative"
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                {/* LEFT: Editor Panel */}
                {viewMode !== 'preview' && (
                <div className={`${viewMode === 'split' ? 'flex-1' : 'w-full'} h-full relative ${viewMode === 'split' ? 'border-r dark:border-gray-800' : ''}`}>
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onScroll={handleScroll}
                        className="w-full h-full p-8 bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-mono text-[15px] leading-[1.6] resize-none outline-none border-none relative z-10"
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                        placeholder="Tapez votre markdown ici..."
                        spellCheck={false}
                    />

                    {/* Cursors Layer */}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                        <CollaborativeCursors
                            users={users.map(u => {
                                const mapped = {
                                    client_id: u.clientId,
                                    username: u.name,
                                    color: u.color,
                                    is_agent: !!u.isAgent,
                                    agent_name: u.agentName,
                                    cursor_line: u.cursor?.line,
                                    cursor_column: u.cursor?.column,
                                    is_local: u.isLocal,
                                };
                                return mapped;
                            })}
                            localClientId={localClientId}
                            textareaElement={textareaRef.current}
                            content={content}
                        />
                    </div>
                </div>
                )}

                {/* RIGHT: Preview Panel (Markdown Engine) */}
                {viewMode !== 'edit' && (
                <div
                    ref={previewRef}
                    className="flex-1 h-full overflow-y-auto p-10 bg-gray-50/50 dark:bg-gray-900/20 custom-markdown-renderer text-gray-900 dark:text-gray-100"
                >
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                                // Apply custom styling to all elements
                                h1: ({node, ...props}) => <h1 className="text-3xl font-bold border-b border-gray-300 dark:border-gray-700 pb-2 mb-4 mt-6 first:mt-0" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-2xl font-semibold border-b border-gray-300 dark:border-gray-700 pb-2 mb-4 mt-6 first:mt-0" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-xl font-semibold mb-3 mt-5 first:mt-0" {...props} />,
                                p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-1" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-1" {...props} />,
                                li: ({node, ...props}) => <li className="my-1" {...props} />,
                                code: ({node, inline, ...props}: any) => 
                                    inline ? (
                                        <code className="bg-gray-200 dark:bg-gray-800 rounded px-1.5 py-0.5 text-sm font-mono" {...props} />
                                    ) : (
                                        <code {...props} />
                                    ),
                                pre: ({node, ...props}) => <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4 overflow-x-auto" {...props} />,
                                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-400 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-4" {...props} />,
                                img: ({node, ...props}) => <img className="max-w-full rounded-lg my-4" {...props} />,
                                table: ({node, ...props}) => <table className="border-collapse w-full mb-4 border border-gray-300 dark:border-gray-700" {...props} />,
                                th: ({node, ...props}) => <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold" {...props} />,
                                td: ({node, ...props}) => <td className="border border-gray-300 dark:border-gray-700 px-3 py-2" {...props} />,
                                a: ({node, ...props}) => <a className="text-blue-600 dark:text-blue-400 hover:underline" {...props} />,
                            }}
                        >
                            {content || "*Commencez à rédiger pour voir l'aperçu...*"}
                        </ReactMarkdown>
                    </div>
                </div>
                )}

                {/* Drag & Drop Overlay */}
                {dragActive && (
                    <div className="absolute inset-0 z-50 bg-blue-500/10 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center transform scale-110 border dark:border-gray-700">
                            <Upload size={48} className="mx-auto mb-4 text-blue-500 animate-bounce" />
                            <p className="text-xl font-bold text-gray-900 dark:text-white">Déposez l'image ici</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ToolbarButton: React.FC<{ icon: React.ReactNode; onClick: () => void; title: string }> = ({ icon, onClick, title }) => (
    <button
        onClick={onClick}
        title={title}
        className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all hover:text-blue-600 dark:hover:text-blue-400 active:bg-blue-50 dark:active:bg-blue-900/20"
    >
        {icon}
    </button>
);

export default CollaborativeEditor;
