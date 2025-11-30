import React, { useState } from 'react';
import { Download, File as FileIcon, Maximize2, Minimize2, X } from 'lucide-react';
import { FileViewerPlugin, FileViewerProps } from './types';
import { api } from '../../services/api';

const DefaultViewer: React.FC<FileViewerProps> = ({ file, onClose, fullscreen: initialFullscreen }) => {
  const [fullscreen, setFullscreen] = useState(initialFullscreen || false);
  
  const handleDownload = () => {
    api.downloadFile(file.id);
  };
  
  const toggleFullscreen = () => setFullscreen(prev => !prev);
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  
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
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <FileIcon size={64} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{file.name}</h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Type:</strong> {file.mime_type || 'Unknown'}</p>
            <p><strong>Size:</strong> {formatFileSize(file.file_size)}</p>
            {file.file_hash && (
              <p className="text-xs font-mono break-all"><strong>Hash:</strong> {file.file_hash}</p>
            )}
          </div>
          <button
            onClick={handleDownload}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <Download size={16} />
            Download File
          </button>
        </div>
      </div>
    </div>
  );
};

const DefaultViewerPlugin: FileViewerPlugin = {
  id: 'default-viewer',
  name: 'Default Viewer',
  description: 'Default viewer for unsupported file types',
  priority: 0,
  canHandle: () => true, // Fallback for all files
  Viewer: DefaultViewer,
};

export default DefaultViewerPlugin;

