import React, { useMemo, useState, useRef, useEffect } from 'react';
import { TaskComment, TaskFile } from '../types';
import { Loader2, Send, Paperclip, X, Edit2, Save, Smile, Image as ImageIcon, Trash2, Upload, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../services/api';
import remarkGfm from 'remark-gfm';

// Image component with thumbnail and modal
const ImageWithFallback: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [fullImgSrc, setFullImgSrc] = useState<string | null>(null);
  
  useEffect(() => {
    if (!src || src.trim() === '' || src === 'undefined' || src.includes('undefined')) {
      setImgError(true);
      setImgLoading(false);
      return;
    }
    
    // Reset states
    setImgError(false);
    setImgLoading(true);
    
    // Normalize URL: download_url already starts with /api/tasks/...
    let fullSrc = src.trim();
    
    // Remove query params if present and rebuild correctly
    const urlParts = fullSrc.split('?');
    const baseUrl = urlParts[0];
    const params = new URLSearchParams(urlParts[1] || '');
    
    // If URL doesn't start with / or http, prepend /
    if (!baseUrl.startsWith('/') && !baseUrl.startsWith('http')) {
      fullSrc = `/${baseUrl}`;
    } else {
      fullSrc = baseUrl;
    }
    
    // Ensure download=false for images (for inline display, not download)
    if (fullSrc.includes('/download')) {
      params.set('download', 'false');
      fullSrc = `${fullSrc}?${params.toString()}`;
    }
    
    // Use direct URL - browser will send cookies automatically for same-origin requests
    setImgSrc(fullSrc);
    setFullImgSrc(fullSrc);
    
    // Cleanup
    return () => {
      // Cleanup will be handled by the separate useEffect
    };
  }, [src]);
  
  // Handle Escape key to close modal
  useEffect(() => {
    if (!showModal) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showModal]);
  
  // Cleanup blob URLs on unmount (only if they are blob URLs)
  useEffect(() => {
    return () => {
      if (imgSrc && imgSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imgSrc);
      }
      if (fullImgSrc && fullImgSrc.startsWith('blob:') && fullImgSrc !== imgSrc) {
        URL.revokeObjectURL(fullImgSrc);
      }
    };
  }, [imgSrc, fullImgSrc]);
  
  return (
    <>
      <div className="relative my-2 inline-block">
        {imgLoading && !imgError && (
          <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg min-h-[150px] min-w-[150px]">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        )}
        {imgError ? (
          <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[150px] min-w-[150px]">
            <div className="text-center">
              <ImageIcon size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Image non disponible</p>
            </div>
          </div>
        ) : imgSrc ? (
          <div
            className="relative inline-block cursor-pointer group"
            onClick={() => setShowModal(true)}
          >
            <img
              src={imgSrc}
              alt={alt}
              className="rounded-lg max-w-[200px] max-h-[200px] object-cover border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity shadow-sm"
              onLoad={() => {
                setImgLoading(false);
                setImgError(false);
              }}
              onError={(e) => {
                console.error('Image render error:', imgSrc, e);
                setImgLoading(false);
                setImgError(true);
              }}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2">
                <ImageIcon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      
      {/* Modal for full-size image */}
      {showModal && fullImgSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
            >
              <X size={24} />
            </button>
            <img
              src={fullImgSrc}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
};

interface TaskCommentsProps {
  comments: TaskComment[];
  loading?: boolean;
  canAdd?: boolean;
  onAdd?: (content: string) => Promise<void>;
  onUpdate?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  taskId?: string;
  currentUserId?: number | null;
}

const formatDateTime = (iso: string) => {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
};

// Simple emoji picker - common emojis
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
  '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
  '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿'
];

const TaskComments: React.FC<TaskCommentsProps> = ({ 
  comments, 
  loading = false, 
  canAdd = false, 
  onAdd,
  onUpdate,
  onDelete,
  taskId,
  currentUserId
}) => {
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({});
  const [uploadProgress, setUploadProgress] = useState<{
    isOpen: boolean;
    files: Array<{ file: File; status: 'pending' | 'uploading' | 'success' | 'error'; error?: string }>;
    currentStep: string;
  }>({
    isOpen: false,
    files: [],
    currentStep: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle paste images
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Add to selected files for upload
            setSelectedFiles(prev => {
              const newIndex = prev.length;
              const newFiles = [...prev, file];
              // Create preview
              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const preview = readerEvent.target?.result as string;
                if (preview && typeof preview === 'string') {
                  setImagePreviews(prevPreviews => ({
                    ...prevPreviews,
                    [newIndex]: preview
                  }));
                }
              };
              reader.onerror = () => {
                console.error('Error reading file for preview');
              };
              reader.readAsDataURL(file);
              return newFiles;
            });
          }
        }
      }
    };

    textarea.addEventListener('paste', handlePaste);
    return () => textarea.removeEventListener('paste', handlePaste);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAdd || (!content.trim() && selectedFiles.length === 0) || submitting || !taskId) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      let finalContent = content.trim();
      
      // If there are files, upload them with progress tracking
      if (selectedFiles.length > 0) {
        setUploadProgress({
          isOpen: true,
          files: selectedFiles.map(f => ({ file: f, status: 'pending' as const })),
          currentStep: 'Préparation de l\'upload...',
        });

        try {
          // Upload files one by one to track progress
          const uploadResults = [];
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // Update status to uploading
            setUploadProgress(prev => ({
              ...prev,
              files: prev.files.map((f, idx) => 
                idx === i ? { ...f, status: 'uploading' as const } : f
              ),
              currentStep: `Upload de ${file.name}... (${i + 1}/${selectedFiles.length})`,
            }));

            try {
              const result = await api.uploadTaskFile(taskId, file);
              uploadResults.push(result);
              
              // Update status to success
              setUploadProgress(prev => ({
                ...prev,
                files: prev.files.map((f, idx) => 
                  idx === i ? { ...f, status: 'success' as const } : f
                ),
              }));

              // Add markdown link/image to content
              const uploadedFile = result.file;
              if (uploadedFile.content_type?.startsWith('image/')) {
                finalContent += `\n![${uploadedFile.original_name}](${uploadedFile.download_url}?download=false)\n`;
              } else {
                finalContent += `\n[📎 ${uploadedFile.original_name}](${uploadedFile.download_url})\n`;
              }
            } catch (fileErr) {
              // Update status to error
              setUploadProgress(prev => ({
                ...prev,
                files: prev.files.map((f, idx) => 
                  idx === i ? { 
                    ...f, 
                    status: 'error' as const,
                    error: fileErr instanceof Error ? fileErr.message : 'Erreur lors de l\'upload'
                  } : f
                ),
              }));
              throw fileErr;
            }
          }

          // All files uploaded successfully
          setUploadProgress(prev => ({
            ...prev,
            currentStep: 'Finalisation...',
          }));
          
          // Wait a bit before closing modal
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (fileErr) {
          console.error('Error uploading files:', fileErr);
          setUploadProgress(prev => ({
            ...prev,
            currentStep: 'Erreur lors de l\'upload des fichiers',
          }));
          // Don't throw, continue with comment creation
        }
      }
      
      // Create comment with content (including file links if files were uploaded)
      await onAdd(finalContent);
      
      // Close modal after success
      if (selectedFiles.length > 0) {
        setTimeout(() => {
          setUploadProgress({ isOpen: false, files: [], currentStep: '' });
        }, 500);
      }
      
      setContent('');
      setSelectedFiles([]);
      setImagePreviews({});
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
      if (uploadProgress.isOpen) {
        setUploadProgress(prev => ({
          ...prev,
          currentStep: 'Erreur lors de la création du commentaire',
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (comment: TaskComment) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!onUpdate || !editingId || !editingContent.trim()) return;
    try {
      await onUpdate(editingId, editingContent.trim());
      setEditingId(null);
      setEditingContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update comment');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleDelete = async (commentId: string) => {
    if (!onDelete) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) return;
    try {
      await onDelete(commentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => {
      const newFiles = [...prev, ...files];
      // Create previews for images
      files.forEach((file, fileIndex) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const preview = e.target?.result as string;
            setImagePreviews(prevPreviews => ({
              ...prevPreviews,
              [prev.length + fileIndex]: preview
            }));
          };
          reader.readAsDataURL(file);
        }
      });
      return newFiles;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      const newPreviews: Record<number, string> = {};
      Object.keys(prev).forEach(key => {
        const oldIndex = parseInt(key, 10);
        if (!isNaN(oldIndex) && oldIndex !== index) {
          if (oldIndex > index) {
            newPreviews[oldIndex - 1] = prev[oldIndex];
          } else {
            newPreviews[oldIndex] = prev[oldIndex];
          }
        }
      });
      return newPreviews;
    });
  };

  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const palette = [
    'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100',
    'bg-purple-50 text-purple-900 dark:bg-purple-900/20 dark:text-purple-100',
    'bg-pink-50 text-pink-900 dark:bg-pink-900/20 dark:text-pink-100',
    'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100',
    'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100',
  ];

  const colorClasses = useMemo(() => {
    const assigned = new Map<string, string>();
    let index = 0;

    return comments.map((comment) => {
      const key = (comment.user_name || 'user').toLowerCase();
      if (!assigned.has(key)) {
        assigned.set(key, palette[index % palette.length]);
        index += 1;
      }
      return assigned.get(key)!;
    });
  }, [comments]);

  return (
    <div className="flex h-full flex-col">
      {/* Upload Progress Modal */}
      {uploadProgress.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Upload des fichiers
              </h3>
              {uploadProgress.files.every(f => f.status === 'success' || f.status === 'error') && (
                <button
                  onClick={() => setUploadProgress({ isOpen: false, files: [], currentStep: '' })}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto custom-scrollbar">
              {uploadProgress.files.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex-shrink-0">
                    {item.status === 'pending' && (
                      <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 animate-spin" />
                    )}
                    {item.status === 'uploading' && (
                      <Loader2 size={20} className="text-blue-500 animate-spin" />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle2 size={20} className="text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <X size={20} className="text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.file.name}
                    </p>
                    {item.status === 'uploading' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Upload en cours...
                      </p>
                    )}
                    {item.status === 'success' && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Upload réussi
                      </p>
                    )}
                    {item.status === 'error' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {item.error || 'Erreur lors de l\'upload'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Loader2 
                size={16} 
                className={`animate-spin ${uploadProgress.files.every(f => f.status === 'success' || f.status === 'error') ? 'hidden' : ''}`} 
              />
              <span>{uploadProgress.currentStep}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Chargement des commentaires...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Aucune discussion</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Posez des questions, échangez avec l'équipe...</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {comments.map((comment, index) => {
              const initials = (comment.user_name || 'User').substring(0, 2).toUpperCase();
              const isEditing = editingId === comment.id;
              const canEdit = currentUserId !== null && comment.user_id === currentUserId;
              
              return (
                <li key={comment.id} className="flex gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorClasses[index]}`}>
                    {initials}
                  </div>
                  <div className="flex flex-col gap-1 max-w-[85%] flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {comment.user_name || 'User'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDateTime(comment.created_at)}
                      </span>
                      {canEdit && !isEditing && (
                        <div className="ml-auto flex gap-1">
                          <button
                            onClick={() => handleEdit(comment)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Modifier"
                          >
                            <Edit2 size={14} />
                          </button>
                          {onDelete && (
                            <button
                              onClick={() => handleDelete(comment.id)}
                              className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="rounded-2xl rounded-tl-none bg-gray-50 px-4 py-2 dark:bg-gray-800">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          rows={3}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={!editingContent.trim()}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save size={14} className="inline" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-tl-none bg-gray-50 px-4 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 prose-img:rounded-lg prose-img:max-w-full prose-img:my-2"
                          components={{
                            img: ({ node, ...props }) => (
                              <ImageWithFallback src={props.src || ''} alt={props.alt || ''} />
                            ),
                          }}
                        >
                          {comment.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canAdd && onAdd && (
        <div className="border-t border-gray-100 bg-white pb-2 pt-3 px-2 dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Écrivez un commentaire... (Coller une image avec Ctrl+V)"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 py-3 pl-4 pr-24 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900 dark:focus:ring-blue-900"
                style={{ maxHeight: '120px' }}
              />
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  title="Emojis"
                >
                  <Smile size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  title="Joindre des fichiers"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!content.trim() && selectedFiles.length === 0)}
                  className="flex items-center justify-center rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:text-blue-400 dark:hover:bg-blue-900/30 dark:disabled:text-gray-600"
                  title="Envoyer (Entrée)"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
            
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-16 right-0 z-10 max-h-64 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="grid grid-cols-8 gap-1">
                  {EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="rounded p-1 text-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {selectedFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => {
                  const isImage = isImageFile(file);
                  const preview = imagePreviews[index];
                  
                  return (
                    <div key={index} className="group relative rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                      {isImage && preview ? (
                        <div className="relative">
                          <img
                            src={preview}
                            alt={file.name}
                            className="h-20 w-20 object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                          >
                            <X size={12} />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                            {file.name}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 text-xs">
                          <Paperclip size={12} className="text-gray-400" />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </form>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default TaskComments;
