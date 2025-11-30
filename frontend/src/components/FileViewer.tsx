import React from 'react';
import { FileItem } from '../types';
import { getViewerForFile } from './viewers';

interface FileViewerProps {
  file: FileItem;
  onClose?: () => void;
  fullscreen?: boolean;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, onClose, fullscreen }) => {
  if (file.type === 'folder') {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg">This is a folder.</p>
          <p className="text-sm mt-2">Select a file to view its content.</p>
        </div>
      </div>
    );
  }
  
  const plugin = getViewerForFile(file);
  
  if (!plugin) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>No viewer available for this file type.</p>
        </div>
      </div>
    );
  }
  
  const Viewer = plugin.Viewer;
  return <Viewer file={file} onClose={onClose} fullscreen={fullscreen} />;
};

export default FileViewer;

