import React, { useState, useEffect } from 'react';
import { FileEdit, Lock, Unlock, Tag, Link } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { Document, Tag as TagType } from '../types';
import TagSelector from './TagSelector';
import PresenceAvatars from './PresenceAvatars';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface DocumentViewerProps {
  document: Document;
  onEdit: () => void;
  currentUserId?: string;
  presenceUsers?: Array<{ id: string; username: string }>;
  onUnlock?: () => void;
  isEditing?: boolean;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  document, 
  onEdit, 
  currentUserId,
  presenceUsers,
  onUnlock,
  isEditing = false
}) => {
  const [tags, setTags] = useState<TagType[]>([]);
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  
  // Check if document is locked by another user
  const isLockedByOther = Boolean(document.locked_by && String(document.locked_by.user_id) !== String(currentUserId));
  const isLockedByMe = Boolean(document.locked_by && String(document.locked_by.user_id) === String(currentUserId));
  const canUnlock = isLockedByMe && !isEditing;
  
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark');
  
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
  
  const copyLinkToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#doc=${document.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié ! Vous pouvez le coller dans un document Markdown ou une tâche');
  };
  
  const copyMarkdownToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#doc=${document.id}`;
    const markdown = `📄 [${document.name}](${url})`;
    navigator.clipboard.writeText(markdown);
    toast.success('Lien Markdown copié !');
  };
  
  return (
    <>
      <div className="p-4 border-b bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
          {document.name}
          {isLockedByOther && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <Lock size={14} />
              Verrouillé par {document.locked_by?.user_name}
            </span>
          )}
          {isLockedByMe && (
            <span className="flex items-center gap-1 text-sm text-orange-600">
              <Lock size={14} />
              Verrouillé par vous
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {presenceUsers && presenceUsers.length > 0 && (
            <PresenceAvatars users={presenceUsers} />
          )}
          <button
            onClick={copyLinkToClipboard}
            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex items-center gap-2"
            title="Copier le lien vers ce document pour le coller ailleurs"
          >
            <Link className="w-4 h-4" />
            Copier le lien
          </button>
          <button
            onClick={copyMarkdownToClipboard}
            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Copier le lien au format Markdown : 📄 [Nom](URL)"
          >
            Markdown
          </button>
          {canUnlock && onUnlock && (
            <button
              onClick={onUnlock}
              className="px-3 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors flex items-center gap-2"
              title="Retirer mon verrou"
            >
              <Unlock className="w-4 h-4" />
              Déverrouiller
            </button>
          )}
          <button
            onClick={onEdit}
            disabled={isLockedByOther}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              isLockedByOther
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title={isLockedByMe ? 'Continuer l\'édition' : isLockedByOther ? `Verrouillé par ${document.locked_by?.user_name}` : 'Éditer le document'}
          >
            <FileEdit size={16} />
            {isLockedByMe ? 'Continuer' : 'Éditer'}
          </button>
        </div>
        </div>
        {document.type === 'file' && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={14} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</span>
            </div>
            <TagSelector
              tags={tags}
              suggestions={availableTags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              readOnly={true}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <MDEditor
          value={document.content || ''}
          preview="preview"
          hideToolbar={true}
          visibleDragbar={false}
          height="100%"
          data-color-mode={isDarkMode ? 'dark' : 'light'}
          previewOptions={{
            className: 'p-8 h-full dark:bg-gray-900 dark:text-gray-100',
          }}
        />
      </div>
    </>
  );
};

export default DocumentViewer;