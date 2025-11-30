import React from 'react';
import { FileItem } from '../../types';

export interface FileViewerProps {
  file: FileItem;
  onClose?: () => void;
  fullscreen?: boolean;
}

export interface FileViewerPlugin {
  id: string;
  name: string;
  description: string;
  priority: number;
  canHandle: (file: FileItem) => boolean;
  Viewer: React.ComponentType<FileViewerProps>;
  Icon?: React.ComponentType<{ size?: number }>;
  supportedMimeTypes?: string[];
  supportedExtensions?: string[];
}

