import { FileItem } from '../../types';
import { FileViewerPlugin } from './types';
import ImageViewer from './ImageViewer';
import PdfViewer from './PdfViewer';
import TextViewer from './TextViewer';
import MarkdownViewer from './MarkdownViewer';
import DefaultViewer from './DefaultViewer';

const fileViewerPlugins: FileViewerPlugin[] = [
  ImageViewer,
  PdfViewer,
  MarkdownViewer,
  TextViewer,
  DefaultViewer,
];

export function getViewerForFile(file: FileItem): FileViewerPlugin | null {
  // Sort by priority (highest first)
  const sortedPlugins = [...fileViewerPlugins].sort((a, b) => b.priority - a.priority);
  
  for (const plugin of sortedPlugins) {
    if (plugin.canHandle(file)) {
      return plugin;
    }
  }
  
  return null;
}

export { fileViewerPlugins };
export { default as ImageViewer } from './ImageViewer';
export { default as PdfViewer } from './PdfViewer';
export { default as TextViewer } from './TextViewer';
export { default as MarkdownViewer } from './MarkdownViewer';
export { default as DefaultViewer } from './DefaultViewer';

