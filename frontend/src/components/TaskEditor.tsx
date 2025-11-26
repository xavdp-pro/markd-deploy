import React, { useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Task, TaskTag, TaskAssignee } from '../types';
import { Image, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import TaskMetadataPanel from './TaskMetadataPanel';

interface TaskEditorProps {
  task: Task;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStatusChange?: (status: string) => void;
  onPriorityChange?: (priority: 'low' | 'medium' | 'high') => void;
  onDueDateChange?: (isoDate: string | null) => void;
  tags?: TaskTag[];
  availableTags?: TaskTag[];
  onAddTag?: (name: string) => Promise<void>;
  onRemoveTag?: (tagId: string) => Promise<void>;
  assignees?: TaskAssignee[];
  responsibleId?: number | null;
  onAssigneesChange?: (userIds: number[], responsibleId?: number) => void;
  workspaceId?: string;
}

const TaskEditor: React.FC<TaskEditorProps> = ({
  task,
  content,
  onContentChange,
  onSave,
  onCancel,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  tags = [],
  availableTags = [],
  onAddTag,
  onRemoveTag,
  assignees = [],
  responsibleId = null,
  onAssigneesChange,
  workspaceId = 'demo',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark');

  const uploadImage = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB');
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
      const imageMarkdown = `\n![${file.name}](${data.url})\n`;
      onContentChange(content + imageMarkdown);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Image upload failed');
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
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
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
            title="Upload an image"
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
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden px-4 pb-4">
        <div className="w-80 flex-shrink-0 overflow-y-auto">
          <TaskMetadataPanel
            task={task}
            canEdit={true}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onDueDateChange={onDueDateChange}
            tags={tags}
            availableTags={availableTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            assignees={assignees}
            responsibleId={responsibleId ?? undefined}
            onAssigneesChange={onAssigneesChange}
            workspaceId={workspaceId}
            className="h-full"
          />
        </div>

        <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div
            className="relative h-full"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {dragActive && (
              <div className="absolute inset-0 z-50 flex items-center justify-center border-4 border-dashed border-blue-500 bg-blue-500/10">
                <div className="rounded-lg bg-white p-6 text-center shadow-xl dark:bg-gray-800">
              <Upload size={48} className="mx-auto mb-3 text-blue-600" />
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Drop your image here</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The image will be inserted into the task</p>
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
        </div>
      </div>
    </div>
  );
};

export default TaskEditor;