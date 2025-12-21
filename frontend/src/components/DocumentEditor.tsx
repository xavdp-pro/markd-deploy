import React, { useRef, useState, useEffect, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Document, Tag as TagType } from '../types';
import { Image, Upload, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import TagSelector from './TagSelector';
import { api } from '../services/api';
import PresenceBar from './PresenceBar';
import { CursorOverlay, StreamingIndicator } from './RemoteCursor';
import { useCollaborativeEditing } from '../hooks/useCollaborativeEditing';
import { useAuth } from '../contexts/AuthContext';

interface DocumentEditorProps {
  document: Document;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  document,
  content,
  onContentChange,
  onSave,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [tags, setTags] = useState<TagType[]>([]);
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  
  // Auth context for user info
  const { user } = useAuth();
  
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark');
  
  // Track if we're receiving remote content (to avoid echo)
  const isReceivingRemoteContent = useRef(false);
  const lastLocalChangeTime = useRef(0);
  
  // Handle streaming content updates from remote agents
  const handleStreamChunk = useCallback((chunk: string, position: number, agentName: string) => {
    // For streaming, we append to the current content
    isReceivingRemoteContent.current = true;
    onContentChange(content + chunk);
    setTimeout(() => { isReceivingRemoteContent.current = false; }, 100);
  }, [content, onContentChange]);
  
  // Handle remote content changes from other users
  const handleRemoteContentChange = useCallback((newContent: string) => {
    // Only apply if we haven't made a local change recently (avoid conflicts)
    const now = Date.now();
    if (now - lastLocalChangeTime.current > 500) {
      isReceivingRemoteContent.current = true;
      onContentChange(newContent);
      setTimeout(() => { isReceivingRemoteContent.current = false; }, 100);
    }
  }, [onContentChange]);

  // Collaborative editing hook
  const {
    users: presenceUsers,
    isConnected,
    streamingSessions,
    updateCursorPosition,
    broadcastContentChange,
    joinDocument,
    leaveDocument,
  } = useCollaborativeEditing({
    documentId: document.id,
    userId: user?.id || '',
    username: user?.username || 'Anonymous',
    onStreamChunk: handleStreamChunk,
    onContentChange: handleRemoteContentChange,
  });
  
  // Track typing state for remote users
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Join document on mount, leave on unmount
  useEffect(() => {
    if (document.id && user?.id) {
      joinDocument();
      return () => {
        leaveDocument();
      };
    }
  }, [document.id, user?.id, joinDocument, leaveDocument]);

  // Calculate line and column from cursor position
  const getLineAndColumn = useCallback((text: string, position: number) => {
    const lines = text.substring(0, position).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length;
    return { line, column };
  }, []);

  // Track cursor position in editor
  const handleEditorChange = useCallback((value: string | undefined) => {
    // Skip if this is a remote change being applied
    if (isReceivingRemoteContent.current) {
      return;
    }
    
    const newContent = value || '';
    lastLocalChangeTime.current = Date.now();
    onContentChange(newContent);
    
    // Try to get cursor position from the textarea
    const textarea = editorContainerRef.current?.querySelector('textarea');
    if (textarea) {
      const position = textarea.selectionStart || 0;
      const { line, column } = getLineAndColumn(newContent, position);
      updateCursorPosition(line, column, position, textarea.selectionStart, textarea.selectionEnd);
      
      // Broadcast content change to other users (debounced slightly)
      broadcastContentChange(newContent, position);
    }
  }, [onContentChange, getLineAndColumn, updateCursorPosition, broadcastContentChange]);

  // Handle cursor movement (selection change)
  const handleSelectionChange = useCallback(() => {
    const textarea = editorContainerRef.current?.querySelector('textarea');
    if (textarea && content) {
      const position = textarea.selectionStart || 0;
      const { line, column } = getLineAndColumn(content, position);
      updateCursorPosition(line, column, position, textarea.selectionStart, textarea.selectionEnd);
    }
  }, [content, getLineAndColumn, updateCursorPosition]);

  // Listen for selection changes in the editor
  useEffect(() => {
    const textarea = editorContainerRef.current?.querySelector('textarea');
    if (textarea) {
      textarea.addEventListener('select', handleSelectionChange);
      textarea.addEventListener('click', handleSelectionChange);
      textarea.addEventListener('keyup', handleSelectionChange);
      
      return () => {
        textarea.removeEventListener('select', handleSelectionChange);
        textarea.removeEventListener('click', handleSelectionChange);
        textarea.removeEventListener('keyup', handleSelectionChange);
      };
    }
  }, [handleSelectionChange]);
  
  useEffect(() => {
    if (document.id) {
      loadTags();
      loadTagSuggestions();
    }
  }, [document.id]);
  
  const loadTags = async () => {
    try {
      const result = await api.getDocumentTags(document.id);
      if (result.success) {
        setTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };
  
  const loadTagSuggestions = async () => {
    try {
      const result = await api.getDocumentTagSuggestions('', 20);
      if (result.success) {
        setAvailableTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tag suggestions:', error);
    }
  };
  
  const handleAddTag = async (name: string) => {
    try {
      const newTags = [...tags.map(t => t.name), name];
      const result = await api.updateDocumentTags(document.id, newTags);
      if (result.success) {
        setTags(result.tags);
        await loadTagSuggestions();
        toast.success('Tag ajouté');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'ajout du tag');
      throw error;
    }
  };
  
  const handleRemoveTag = async (tagId: string) => {
    try {
      const newTags = tags.filter(t => t.id !== tagId).map(t => t.name);
      const result = await api.updateDocumentTags(document.id, newTags);
      if (result.success) {
        setTags(result.tags);
        toast.success('Tag supprimé');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression du tag');
      throw error;
    }
  };

  const uploadImage = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image valide');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5 Mo');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      // Insert markdown image syntax at cursor position
      const imageMarkdown = `\n![${file.name}](${data.url})\n`;
      onContentChange(content + imageMarkdown);
      
      toast.success('Image uploadée avec succès');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erreur lors de l\'upload de l\'image');
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadImage(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await uploadImage(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Map presence users for components
  const mappedPresenceUsers = presenceUsers.map(u => ({
    user_id: u.user_id,
    username: u.username,
    color: u.color,
    is_agent: u.is_agent,
    agent_name: u.agent_name,
    cursor_position: u.cursor_position,
    cursor_line: u.cursor_line,
    cursor_column: u.cursor_column,
    is_typing: typingUsers.has(u.user_id),
  }));

  // Find active streaming session for indicator
  const activeStreaming = streamingSessions.length > 0 ? streamingSessions[0] : null;

  return (
    <>
      {/* Presence Bar - shows connected users */}
      <PresenceBar 
        users={mappedPresenceUsers}
        currentUserId={user?.id}
        documentName={document.name}
      />
      
      <div className="p-4 border-b bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">{document.name}</h2>
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Temps réel
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
            title="Uploader une image"
          >
            {uploading ? (
              <>
                <Upload size={16} className="animate-bounce" />
                Upload...
              </>
            ) : (
              <>
                <Image size={16} />
                Image
              </>
            )}
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Enregistrer
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Annuler
          </button>
        </div>
        </div>
      </div>

      <div 
        className="flex-1 overflow-hidden relative"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {document.type === 'file' && (
          <div className="px-4 py-3 border-b bg-white dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={14} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</span>
            </div>
            <TagSelector
              tags={tags}
              suggestions={availableTags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
          </div>
        )}

        {dragActive && (
          <div className="absolute inset-0 z-50 bg-blue-500 bg-opacity-10 border-4 border-dashed border-blue-500 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 text-center">
              <Upload size={48} className="mx-auto mb-3 text-blue-600" />
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Déposez votre image ici</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">L'image sera insérée dans le document</p>
            </div>
          </div>
        )}
        
        {/* Editor container with cursor overlay */}
        <div ref={editorContainerRef} className="relative h-full">
          {/* Remote cursors overlay */}
          <CursorOverlay 
            users={mappedPresenceUsers}
            currentUserId={user?.id}
            content={content}
          />
          
          <MDEditor
            value={content}
            onChange={handleEditorChange}
            height="100%"
            data-color-mode={isDarkMode ? 'dark' : 'light'}
            preview="edit"
            hideToolbar={false}
            extraCommands={[]}
          />
        </div>
      </div>
      
      {/* Streaming indicator - shows when an AI agent is writing */}
      {activeStreaming && (
        <StreamingIndicator
          agentName={activeStreaming.agent_name}
          color={activeStreaming.color || '#9333EA'}
          position={activeStreaming.position}
        />
      )}
    </>
  );
};

export default DocumentEditor;