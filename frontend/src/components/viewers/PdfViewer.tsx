import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, X } from 'lucide-react';
import { FileItem } from '../../types';
import { FileViewerPlugin, FileViewerProps } from './types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const PdfViewer: React.FC<FileViewerProps> = ({ file, onClose, fullscreen: initialFullscreen }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [fullscreen, setFullscreen] = useState(initialFullscreen || false);
  
  const contentUrl = `/api/files/${file.id}/content`;
  
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };
  
  const goToPrevPage = () => setPageNumber(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(numPages, prev + 1));
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const toggleFullscreen = () => setFullscreen(prev => !prev);
  
  return (
    <div className={`flex flex-col h-full ${fullscreen ? 'fixed inset-0 z-50 bg-gray-900' : ''}`}>
      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
          {numPages > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Page {pageNumber} / {numPages}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Zoom in"
          >
            <ZoomIn size={16} />
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
        <Document
          file={contentUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="text-gray-500 dark:text-gray-400">Loading PDF...</div>
          }
          error={
            <div className="text-red-500">Error loading PDF</div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
};

const PdfViewerPlugin: FileViewerPlugin = {
  id: 'pdf-viewer',
  name: 'PDF Viewer',
  description: 'View PDF documents with page navigation',
  priority: 90,
  canHandle: (file: FileItem) => {
    if (file.mime_type === 'application/pdf') return true;
    return file.name.toLowerCase().endsWith('.pdf');
  },
  Viewer: PdfViewer,
  supportedMimeTypes: ['application/pdf'],
  supportedExtensions: ['.pdf'],
};

export default PdfViewerPlugin;

