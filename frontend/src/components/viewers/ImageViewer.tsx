import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, X } from 'lucide-react';
import { FileItem } from '../../types';
import { FileViewerPlugin, FileViewerProps } from './types';

const ImageViewer: React.FC<FileViewerProps> = ({ file, onClose, fullscreen: initialFullscreen }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(initialFullscreen || false);
  
  const contentUrl = `/api/files/${file.id}/content`;
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const toggleFullscreen = () => setFullscreen(prev => !prev);
  
  return (
    <div className={`flex flex-col h-full ${fullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleRotate}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Rotate"
          >
            <RotateCw size={16} />
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
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <img
          src={contentUrl}
          alt={file.name}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          className="object-contain"
        />
      </div>
    </div>
  );
};

const ImageViewerPlugin: FileViewerPlugin = {
  id: 'image-viewer',
  name: 'Image Viewer',
  description: 'View images with zoom and rotation',
  priority: 100,
  canHandle: (file: FileItem) => {
    if (file.mime_type?.startsWith('image/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
  },
  Viewer: ImageViewer,
  supportedMimeTypes: ['image/*'],
  supportedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
};

export default ImageViewerPlugin;

