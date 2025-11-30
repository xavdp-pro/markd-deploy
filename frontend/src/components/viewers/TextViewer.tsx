import React, { useState, useEffect } from 'react';
// Using simple pre tag for now - can add syntax highlighting later if needed
import { Download, Maximize2, Minimize2, X } from 'lucide-react';
import { FileItem } from '../../types';
import { FileViewerPlugin, FileViewerProps } from './types';
import { api } from '../../services/api';

const TextViewer: React.FC<FileViewerProps> = ({ file, onClose, fullscreen: initialFullscreen }) => {
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
  
  const getLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'sh': 'bash',
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sql': 'sql',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'log': 'log',
      'txt': 'plaintext',
    };
    return langMap[ext || ''] || 'plaintext';
  };
  
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
  
  const language = getLanguage(file.name);
  
  return (
    <div className={`flex flex-col h-full ${fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''}`}>
      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">({language})</span>
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
      <div className="flex-1 overflow-auto p-4">
        <pre className="font-mono text-sm whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-800 p-4 rounded">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
};

const TextViewerPlugin: FileViewerPlugin = {
  id: 'text-viewer',
  name: 'Text Viewer',
  description: 'View text files with syntax highlighting',
  priority: 80,
  canHandle: (file: FileItem) => {
    if (file.mime_type?.startsWith('text/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['txt', 'json', 'xml', 'csv', 'log', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'sh', 'yaml', 'yml'].includes(ext || '');
  },
  Viewer: TextViewer,
  supportedMimeTypes: ['text/*'],
  supportedExtensions: ['.txt', '.json', '.xml', '.csv', '.log', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.html', '.css', '.sh', '.yaml', '.yml'],
};

export default TextViewerPlugin;

