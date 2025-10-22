import React from 'react';
import { FileEdit, Lock } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { Document } from '../types';

interface DocumentViewerProps {
  document: Document;
  onEdit: () => void;
  currentUserId?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onEdit, currentUserId }) => {
  // Check if document is locked by another user
  const isLockedByOther = document.locked_by && String(document.locked_by.user_id) !== String(currentUserId);
  const isLockedByMe = document.locked_by && String(document.locked_by.user_id) === String(currentUserId);
  
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark');
  
  return (
    <>
      <div className="p-4 border-b bg-white dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
          {document.name}
          {isLockedByOther && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <Lock size={14} />
              Verrouillé par {document.locked_by.user_name}
            </span>
          )}
          {isLockedByMe && (
            <span className="flex items-center gap-1 text-sm text-orange-600">
              <Lock size={14} />
              Verrouillé par vous
            </span>
          )}
        </h2>
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