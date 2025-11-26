import React, { useRef, useState, useEffect } from 'react';
import { CloudUpload, Download, FileText, Loader2, Trash2, File, Image, FileCode, FileArchive, Music, Video, ExternalLink, Edit3, Save, X } from 'lucide-react';
import { TaskFile } from '../types';
import MDEditor from '@uiw/react-md-editor';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker - use local file to avoid CORS issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface TaskFilesProps {
  files: TaskFile[];
  loading?: boolean;
  canUpload?: boolean;
  onUpload?: (file: File) => Promise<void>;
  onDelete?: (fileId: string) => Promise<void>;
  onUpdateFileNote?: (fileId: string, note: string) => Promise<void>;
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

const TaskFiles: React.FC<TaskFilesProps> = ({ files, loading = false, canUpload = false, onUpload, onDelete, onUpdateFileNote }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string>('');
  const [viewingFile, setViewingFile] = useState<TaskFile | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleEditNote = (file: TaskFile) => {
    setEditingNoteId(file.id);
    setEditingNote(file.markdown_note || '');
  };

  const handleSaveNote = async (fileId: string) => {
    if (!onUpdateFileNote) return;
    try {
      setSubmitting(true);
      await onUpdateFileNote(fileId, editingNote);
      setEditingNoteId(null);
      setEditingNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNote('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Chargement des fichiers...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <File size={24} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Aucun fichier</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {canUpload ? 'Glissez un fichier ici ou utilisez le bouton ci-dessous.' : 'Aucun fichier attaché à cette tâche.'}
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
                  <div className="overflow-hidden rounded-t-lg">
                    <img
                      src={file.download_url}
                      alt={file.original_name}
                      className="h-48 w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
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
                      onClick={() => {
                        const isPdf = file.content_type?.includes('pdf') || file.original_name.toLowerCase().endsWith('.pdf');
                        if (isPdf) {
                          window.open(`${file.download_url}?download=false`, '_blank', 'noopener,noreferrer');
                        } else {
                          setViewingFile(file);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                      title="Ouvrir le fichier"
                    >
                      <ExternalLink size={14} />
                      Ouvrir
                    </button>

                    <a
                      href={file.download_url}
                      download={file.original_name}
                      className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-green-500 hover:bg-green-50 hover:text-green-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-green-500 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                      title="Télécharger le fichier"
                    >
                      <Download size={14} />
                      Télécharger
                    </a>
                    
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file.id)}
                        disabled={submitting}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* File Note Section */}
                {editingNoteId === file.id ? (
                  <div className="border-t border-gray-100 p-4 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Note Markdown</h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveNote(file.id)}
                          disabled={submitting}
                          className="rounded-md p-1.5 text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-900/20"
                          title="Sauvegarder"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                          title="Annuler"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="h-32" data-color-mode="auto">
                      <MDEditor
                        value={editingNote}
                        onChange={(val) => setEditingNote(val || '')}
                        height={128}
                        preview="edit"
                        hideToolbar={false}
                        textareaProps={{
                          placeholder: 'Ajoutez une note markdown pour ce fichier...'
                        }}
                      />
                    </div>
                  </div>
                ) : file.markdown_note ? (
                  <div className="border-t border-gray-100 p-4 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Note</h4>
                      {onUpdateFileNote && (
                        <button
                          type="button"
                          onClick={() => handleEditNote(file)}
                          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          title="Modifier la note"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert" data-color-mode="auto">
                      <MDEditor.Markdown source={file.markdown_note} />
                    </div>
                  </div>
                ) : null}
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
                Choisir un fichier
              </button>
              
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ou glissez-déposez • Max 50 MB
              </span>
            </div>
          </div>
          
          {error && (
            <p className="mt-2 text-center text-xs text-red-500">{error}</p>
          )}
        </div>
      )}

      {/* Fullscreen File Viewer Modal */}
      {viewingFile && (
        <FileViewerModal
          file={viewingFile}
          onClose={() => setViewingFile(null)}
          numPages={numPages}
          pageNumber={pageNumber}
          setNumPages={setNumPages}
          setPageNumber={setPageNumber}
        />
      )}
    </div>
  );
};

// Separate component to handle Escape key
const FileViewerModal: React.FC<{
  file: TaskFile;
  onClose: () => void;
  numPages: number | null;
  pageNumber: number;
  setNumPages: (n: number | null) => void;
  setPageNumber: (n: number | ((p: number) => number)) => void;
}> = ({ file, onClose, numPages, pageNumber, setNumPages, setPageNumber }) => {
  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg bg-gray-800 p-2 text-white transition-colors hover:bg-gray-700"
            title="Fermer (Échap)"
          >
            <X size={24} />
          </button>
          
          <div className="flex h-full w-full flex-col items-center justify-center p-8">
            <div className="mb-4 text-center">
              <h3 className="text-lg font-medium text-white">{file.original_name}</h3>
              <p className="text-sm text-gray-400">
                {formatBytes(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString()}
              </p>
            </div>
            
            <div className="flex max-h-[calc(100vh-200px)] max-w-[90vw] flex-col items-center justify-center overflow-auto">
              {isImageFile(file.original_name) ? (
                <img
                  src={`${file.download_url}?download=false`}
                  alt={file.original_name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : file.content_type?.includes('pdf') || file.original_name.toLowerCase().endsWith('.pdf') ? (
                <div className="flex flex-col items-center gap-4">
                  <Document
                    file={`${file.download_url}?download=false`}
                    onLoadSuccess={({ numPages: n }) => {
                      setNumPages(n);
                      setPageNumber(1);
                    }}
                    loading={
                      <div className="flex items-center gap-2 text-white">
                        <Loader2 className="animate-spin" size={24} />
                        <span>Chargement du PDF...</span>
                      </div>
                    }
                    error={
                      <div className="flex flex-col items-center gap-4 text-white">
                        <FileText size={64} className="text-gray-400" />
                        <p>Erreur lors du chargement du PDF</p>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      className="rounded-lg shadow-lg"
                      width={Math.min(window.innerWidth * 0.85, 1200)}
                    />
                  </Document>
                  
                  {numPages && numPages > 1 && (
                    <div className="flex items-center gap-4 rounded-lg bg-gray-800 px-4 py-2 text-white">
                      <button
                        onClick={() => setPageNumber((p: number) => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        className="rounded px-3 py-1 hover:bg-gray-700 disabled:opacity-50"
                      >
                        ← Précédent
                      </button>
                      <span>
                        Page {pageNumber} / {numPages}
                      </span>
                      <button
                        onClick={() => setPageNumber((p: number) => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        className="rounded px-3 py-1 hover:bg-gray-700 disabled:opacity-50"
                      >
                        Suivant →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-white">
                  <FileText size={64} className="text-gray-400" />
                  <p className="text-center">
                    Aperçu non disponible pour ce type de fichier.
                  </p>
                  <a
                    href={file.download_url}
                    download={file.original_name}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Download size={16} />
                    Télécharger le fichier
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
  );
};

export default TaskFiles;

