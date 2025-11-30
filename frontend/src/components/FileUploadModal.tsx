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

    for (let i = 0; i < pendingFiles.length; i++) {
      const fileProgress = pendingFiles[i];
      const fileIndex = files.findIndex(f => f.file === fileProgress.file);

      // Update status to uploading
      setFiles(prev => {
        const updated = [...prev];
        updated[fileIndex] = { ...updated[fileIndex], status: 'uploading' };
        return updated;
      });

      try {
        await onUpload(parentId, fileProgress.file);
        
        // Update status to success
        setFiles(prev => {
          const updated = [...prev];
          updated[fileIndex] = { ...updated[fileIndex], status: 'success' };
          return updated;
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'upload';
        
        // Update status to error
        setFiles(prev => {
          const updated = [...prev];
          updated[fileIndex] = { 
            ...updated[fileIndex], 
            status: 'error',
            error: errorMessage
          };
          return updated;
        });
      }
    }

    setUploading(false);
    
    // Check if all files are done
    const allDone = files.every(f => f.status === 'success' || f.status === 'error');
    if (allDone) {
      const successCount = files.filter(f => f.status === 'success').length;
      if (successCount > 0) {
        toast.success(`${successCount} fichier(s) uploadé(s) avec succès`);
        onUploadComplete();
        setTimeout(() => {
          handleClose();
        }, 1000);
      }
    }
  }, [parentId, files, onUpload, onUploadComplete]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Uploader des fichiers
          </h3>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

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
              Glissez-déposez vos fichiers ici
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              ou
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sélectionner des fichiers
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
              Taille maximale : 100 MB par fichier
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fichiers sélectionnés ({files.length})
              </h4>
              {files.map((fileProgress, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
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
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {pendingCount > 0 && `${pendingCount} en attente`}
            {successCount > 0 && ` • ${successCount} réussi(s)`}
            {errorCount > 0 && ` • ${errorCount} erreur(s)`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {uploading ? 'Annulation...' : 'Annuler'}
            </button>
            <button
              onClick={uploadFiles}
              disabled={pendingCount === 0 || uploading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Uploader {pendingCount > 0 && `(${pendingCount})`}
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

