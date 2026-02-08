import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, File, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  onUploadComplete: () => void;
  onUpload: (parentId: string, file: File) => Promise<void>;
}

interface UploadProgress {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  parentId,
  onUploadComplete,
  onUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilesSelected = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles: UploadProgress[] = Array.from(fileList).map(file => ({
      file,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(event.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFilesSelected(event.dataTransfer.files);
  }, [handleFilesSelected]);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = useCallback(async () => {
    if (!parentId || files.length === 0) return;

    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setUploading(true);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      const fileProgress = pendingFiles[i];
      let progressInterval: NodeJS.Timeout | null = null;
      
      // Update status to uploading
      setFiles(prev => {
        const fileIndex = prev.findIndex(f => f.file === fileProgress.file);
        if (fileIndex === -1) return prev;
        const updated = [...prev];
        updated[fileIndex] = { ...updated[fileIndex], status: 'uploading', progress: 0 };
        return updated;
      });

      // Simulate progress animation during upload
      progressInterval = setInterval(() => {
        setFiles(prev => {
          const fileIndex = prev.findIndex(f => f.file === fileProgress.file);
          if (fileIndex === -1) return prev;
          const current = prev[fileIndex];
          // Only update if still uploading
          if (current.status === 'uploading' && current.progress !== undefined && current.progress < 90) {
            const updated = [...prev];
            updated[fileIndex] = { 
              ...updated[fileIndex], 
              progress: Math.min(current.progress + Math.random() * 15, 90) 
            };
            return updated;
          }
          return prev;
        });
      }, 200);

      try {
        await onUpload(parentId, fileProgress.file);
        
        // Clear progress interval
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        
        successCount++;
        
        // Update status to success with 100% progress
        setFiles(prev => {
          const fileIndex = prev.findIndex(f => f.file === fileProgress.file);
          if (fileIndex === -1) return prev;
          const updated = [...prev];
          updated[fileIndex] = { ...updated[fileIndex], status: 'success', progress: 100 };
          return updated;
        });
      } catch (error) {
        // Clear progress interval on error
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'upload';
        
        // Update status to error with 100% progress (to show full bar)
        setFiles(prev => {
          const fileIndex = prev.findIndex(f => f.file === fileProgress.file);
          if (fileIndex === -1) return prev;
          const updated = [...prev];
          updated[fileIndex] = { 
            ...updated[fileIndex], 
            status: 'error',
            progress: 100,
            error: errorMessage
          };
          return updated;
        });
      }
    }

    setUploading(false);
    
    // All uploads completed, show toast and close modal
    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully`);
      onUploadComplete();
    }
    
    // Close modal after a short delay
    setTimeout(() => {
      setFiles([]);
      setIsDragging(false);
      onClose();
    }, successCount > 0 ? 1000 : 1500);
  }, [parentId, files, onUpload, onUploadComplete, onClose]);

  const handleClose = () => {
    if (uploading) return; // Prevent closing during upload
    setFiles([]);
    setIsDragging(false);
    onClose();
  };

  if (!isOpen) return null;

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const uploadingCount = files.filter(f => f.status === 'uploading').length;
  
  // Calculate overall progress percentage
  const totalFiles = files.length;
  const completedFiles = successCount + errorCount;
  const overallProgress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload files
          </h3>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar - Global */}
        {uploading && totalFiles > 0 && (
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progression globale
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {completedFiles} / {totalFiles} fichiers
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
              {overallProgress}%
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <Upload 
              size={48} 
              className={`mx-auto mb-4 ${
                isDragging 
                  ? 'text-blue-500' 
                  : 'text-gray-400 dark:text-gray-500'
              }`} 
            />
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Drag and drop your files here
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              or
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Maximum size: 100 MB per file
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Selected files ({files.length})
              </h4>
              {files.map((fileProgress, index) => {
                // Calculate file progress (0-100%)
                let fileProgressPercent = 0;
                if (fileProgress.status === 'success') {
                  fileProgressPercent = 100;
                } else if (fileProgress.status === 'error') {
                  fileProgressPercent = 100; // Show full bar for error
                } else if (fileProgress.status === 'uploading') {
                  // For uploading, show a pulsing progress or estimate based on position
                  fileProgressPercent = fileProgress.progress ?? 50; // Default to 50% while uploading
                }

                return (
                  <div
                    key={index}
                    className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <File size={20} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {fileProgress.file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(fileProgress.file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {fileProgress.status === 'pending' && (
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
                          >
                            <X size={16} />
                          </button>
                        )}
                        {fileProgress.status === 'uploading' && (
                          <Loader2 size={16} className="animate-spin text-blue-500" />
                        )}
                        {fileProgress.status === 'success' && (
                          <CheckCircle2 size={16} className="text-green-500" />
                        )}
                        {fileProgress.status === 'error' && (
                          <div className="flex items-center gap-1">
                            <AlertCircle size={16} className="text-red-500" />
                            {fileProgress.error && (
                              <span className="text-xs text-red-500" title={fileProgress.error}>
                                Erreur
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Individual file progress bar */}
                    {(fileProgress.status === 'uploading' || fileProgress.status === 'success' || fileProgress.status === 'error') && (
                      <div className="w-full">
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              fileProgress.status === 'success'
                                ? 'bg-green-500'
                                : fileProgress.status === 'error'
                                ? 'bg-red-500'
                                : 'bg-blue-500'
                            } ${fileProgress.status === 'uploading' ? 'animate-pulse' : ''}`}
                            style={{ width: `${fileProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {pendingCount > 0 && `${pendingCount} pending`}
            {successCount > 0 && ` • ${successCount} done`}
            {errorCount > 0 && ` • ${errorCount} error(s)`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {uploading ? 'Cancelling...' : 'Cancel'}
            </button>
            <button
              onClick={uploadFiles}
              disabled={pendingCount === 0 || uploading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload {pendingCount > 0 && `(${pendingCount})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;

