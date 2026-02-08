import React, { useRef, useState } from 'react';
import { CloudUpload, Download, FileText, Loader2, Trash2, File, Image, FileCode, FileArchive, Music, Video, ExternalLink } from 'lucide-react';
import { TaskFile } from '../types';

interface TaskFilesProps {
  files: TaskFile[];
  loading?: boolean;
  canUpload?: boolean;
  onUpload?: (file: File) => Promise<void>;
  onDelete?: (fileId: string) => Promise<void>;
}

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
};

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return <FileText size={20} />;

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return <Image size={20} className="text-purple-500" />;
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'html', 'css'].includes(ext)) return <FileCode size={20} className="text-blue-500" />;
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return <FileArchive size={20} className="text-amber-500" />;
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return <Music size={20} className="text-pink-500" />;
  if (['mp4', 'avi', 'mkv', 'mov'].includes(ext)) return <Video size={20} className="text-red-500" />;

  return <FileText size={20} className="text-gray-500" />;
};

const isImageFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext || '');
};

const TaskFiles: React.FC<TaskFilesProps> = ({ files, loading = false, canUpload = false, onUpload, onDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSelectFile = async (file: File) => {
    if (!onUpload) return;
    try {
      setSubmitting(true);
      setError(null);
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleSelectFile(file);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await handleSelectFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDelete = async (fileId: string) => {
    if (!onDelete) return;
    try {
      setSubmitting(true);
      await onDelete(fileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <File size={24} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No files</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {canUpload ? 'Drag a file here or use the button below.' : 'No files attached to this task.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="group rounded-lg border border-gray-200 bg-white transition-all hover:border-blue-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800"
              >
                {/* Image Preview */}
                {isImageFile(file.original_name) && (
                  <div className="overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-700">
                    <img
                      src={`${file.download_url}?download=false`}
                      alt={file.original_name}
                      className="h-48 w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                      crossOrigin="use-credentials"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-4 p-4">
                  <div className="flex-shrink-0">
                    {getFileIcon(file.original_name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {file.original_name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatBytes(file.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                      {file.uploaded_by_name && (
                        <>
                          <span>•</span>
                          <span>{file.uploaded_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.open(`${file.download_url}?download=false`, '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                      Open
                    </button>

                    <a
                      href={file.download_url}
                      download={file.original_name}
                      className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-green-500 hover:bg-green-50 hover:text-green-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-green-500 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                      title="Download file"
                    >
                      <Download size={14} />
                      Download
                    </a>

                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file.id)}
                        disabled={submitting}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canUpload && onUpload && (
        <div className="border-t border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative rounded-lg border-2 border-dashed p-2 transition-all
              ${isDragging
                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-blue-600'
              }
            `}
          >
            <div className="flex items-center justify-center gap-3">
              <div className={`rounded-full p-1.5 ${isDragging ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <CloudUpload size={16} className={isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <CloudUpload size={12} />}
                Choose a file
              </button>

              <span className="text-xs text-gray-500 dark:text-gray-400">
                or drag & drop • Max 50 MB
              </span>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-center text-xs text-red-500">{error}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskFiles;
