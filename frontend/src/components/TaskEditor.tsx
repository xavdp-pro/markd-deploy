import React, { useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Task } from '../types';
import { Image, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface TaskEditorProps {
  task: Task;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const TaskEditor: React.FC<TaskEditorProps> = ({
  task,
  content,
  onContentChange,
  onSave,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.task.taskElement.classList.contains('dark');

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

  return (
    <>
      <div className="p-4 border-b bg-white dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-bold text-lg text-gray-900 dark:text-white">{task.name}</h2>
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

      <div 
        className="flex-1 overflow-hidden relative"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="absolute inset-0 z-50 bg-blue-500 bg-opacity-10 border-4 border-dashed border-blue-500 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 text-center">
              <Upload size={48} className="mx-auto mb-3 text-blue-600" />
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Déposez votre image ici</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">L'image sera insérée dans le task</p>
            </div>
          </div>
        )}
        <MDEditor
          value={content}
          onChange={(val) => onContentChange(val || '')}
          height="100%"
          data-color-mode={isDarkMode ? 'dark' : 'light'}
          preview="edit"
          hideToolbar={false}
          extraCommands={[]}
        />
      </div>
    </>
  );
};

export default TaskEditor;