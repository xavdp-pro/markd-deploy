import React, { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Download, Maximize2, Minimize2, X } from 'lucide-react';
import { FileItem } from '../../types';
import { FileViewerPlugin, FileViewerProps } from './types';
import { api } from '../../services/api';

const MarkdownViewer: React.FC<FileViewerProps> = ({ file, onClose, fullscreen: initialFullscreen }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(initialFullscreen || false);
  
  useEffect(() => {
    const loadContent = async () => {
      try {
        const contentUrl = await api.getFileContent(file.id);
        const response = await fetch(contentUrl);
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error loading file content:', err);
        setContent('Error loading file content');
      } finally {
        setLoading(false);
      }
    };
    
    if (file.type === 'file') {
      loadContent();
    }
  }, [file]);
  
  const handleDownload = () => {
    api.downloadFile(file.id);
  };
  
  const toggleFullscreen = () => setFullscreen(prev => !prev);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col h-full ${fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''}`}>
      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Download"
          >
            <Download size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4" data-color-mode={typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark') ? 'dark' : 'light'}>
        <MDEditor.Markdown source={content} />
      </div>
    </div>
  );
};

const MarkdownViewerPlugin: FileViewerPlugin = {
  id: 'markdown-viewer',
  name: 'Markdown Viewer',
  description: 'View Markdown files with preview',
  priority: 85,
  canHandle: (file: FileItem) => {
    if (file.mime_type === 'text/markdown') return true;
    return file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown');
  },
  Viewer: MarkdownViewer,
  supportedMimeTypes: ['text/markdown'],
  supportedExtensions: ['.md', '.markdown'],
};

export default MarkdownViewerPlugin;

