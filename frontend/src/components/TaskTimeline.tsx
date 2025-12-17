import React, { useState, useRef, useMemo, useEffect } from 'react';
import { TaskTimelineItem, TaskTimelineFile } from '../types';
import { Loader2, Clock, Activity, Paperclip, X, CheckCircle2, Circle, Image as ImageIcon, Edit2, Save, Smile, Trash2, Send } from 'lucide-react';
import { api } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Image component with thumbnail and modal
const ImageWithFallback: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  useEffect(() => {
    if (!src || typeof src !== 'string' || src.trim() === '' || src === 'undefined' || src.includes('undefined')) {
      setImgError(true);
      setImgLoading(false);
      return;
    }

    // Reset states
    setImgError(false);
    setImgLoading(true);

    try {
      // Normalize URL: ensure it has ?download=false for images
      let fullSrc = src.trim();
      if (fullSrc.startsWith('/api')) {
        fullSrc = src;
      } else if (fullSrc.startsWith('/')) {
        fullSrc = src;
      } else {
        fullSrc = `/${src}`;
      }
      
      // Add ?download=false if not already present and URL contains /download
      if (fullSrc.includes('/download') && !fullSrc.includes('?')) {
        fullSrc += '?download=false';
      } else if (fullSrc.includes('/download') && !fullSrc.includes('download=')) {
        fullSrc += '&download=false';
      }
      
      // Load image as blob with credentials to handle auth cookies
      fetch(fullSrc, {
        credentials: 'include',
        mode: 'cors',
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          if (!blob || blob.size === 0) {
            throw new Error('Empty blob');
          }
          const objectUrl = URL.createObjectURL(blob);
          setImgSrc(objectUrl);
          setImgLoading(false);
          setImgError(false);
        })
        .catch(err => {
          console.error('Image load error:', fullSrc, err);
          setImgLoading(false);
          setImgError(true);
        });
    } catch (err) {
      console.error('Error setting up image fetch:', err);
      setImgLoading(false);
      setImgError(true);
    }
    
    // No cleanup here - it's handled by the separate useEffect
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
    };
  }, [imgSrc]);
  
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
              onLoad={() => setImgLoading(false)}
              onError={(e) => {
                console.error('Image render error:', e);
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
      {showModal && imgSrc && (
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
              src={imgSrc}
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

interface TaskTimelineProps {
  items: TaskTimelineItem[];
  loading?: boolean;
  canAdd?: boolean;
  taskId?: string;
  onAdd?: (entry: { title: string; description?: string }) => Promise<void>;
  onUpdate?: (entryId: string, data: { title?: string; description?: string }) => Promise<void>;
  onDelete?: (entryId: string) => Promise<void>;
  currentUserId?: number | null;
  onRefresh?: () => Promise<void>;
}

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return 'Date inconnue';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Relative time for recent items
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    
    // Full date for older items
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
};

const formatDateOnly = (iso: string | null | undefined) => {
  if (!iso) return 'Date inconnue';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return iso;
  }
};

const formatTimeOnly = (iso: string | null | undefined) => {
  if (!iso) return '--:--';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '--:--';
  }
};

// Filter timeline to show only manual entries created by human users
const isActionVisible = (item: TaskTimelineItem): boolean => {
  if (!item) return false;
  
  // Only show actions from real users (not system)
  if (!item.user_name || item.user_name === 'Système' || item.user_id === null || item.user_id === undefined) {
    return false;
  }
  
  // Show ONLY manual notes created by users
  // Exclude all automatic events (status_changed, etc.)
  return item.event_type === 'note';
};

const TaskTimeline: React.FC<TaskTimelineProps> = ({ items = [], loading = false, canAdd = false, taskId, onAdd, onUpdate, onDelete, currentUserId, onRefresh }) => {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAdd || !description.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onAdd({
        title: '',
        description: description.trim(),
      });
      setDescription('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: TaskTimelineItem) => {
    if (!item || !item.id) return;
    setEditingId(item.id);
    setEditingDescription(item.description || '');
  };

  const handleSaveEdit = async () => {
    if (!onUpdate || !editingId) return;
    try {
      await onUpdate(editingId, {
        description: editingDescription.trim(),
      });
      setEditingId(null);
      setEditingDescription('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update entry');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingDescription('');
  };

  const handleDelete = async (entryId: string) => {
    if (!onDelete || !entryId) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) return;
    try {
      await onDelete(entryId);
      if (onRefresh) {
        try {
          await onRefresh();
        } catch (refreshErr) {
          console.error('Error refreshing timeline:', refreshErr);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  // Close emoji picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const insertEmoji = (emoji: string) => {
    setDescription(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Safety check for items
  const safeItems = Array.isArray(items) ? items : [];

  // Filter items to show only visible actions
  const visibleItems = useMemo(() => {
    if (!safeItems || safeItems.length === 0) {
      return [];
    }
    try {
      return safeItems.filter(isActionVisible).sort((a, b) => {
        // Sort by date descending (newest first)
        const dateA = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error processing timeline items:', error);
      return [];
    }
  }, [safeItems]);

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups: Record<string, TaskTimelineItem[]> = {};
    try {
      visibleItems.forEach(item => {
        if (!item || !item.created_at) return;
        const dateKey = formatDateOnly(item.created_at);
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(item);
      });
    } catch (error) {
      console.error('Error grouping timeline items:', error);
    }
    return groups;
  }, [visibleItems]);

  const isImage = (contentType?: string | null) => {
    return contentType?.startsWith('image/');
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getEventIconColor = (eventType: string) => {
    switch (eventType) {
      case 'note':
        return 'bg-blue-500';
      case 'status_changed':
        return 'bg-green-500';
      case 'created':
        return 'bg-blue-500';
      case 'file_added':
        return 'bg-purple-500';
      default:
        return 'bg-gray-400';
    }
  };
  
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'note':
        return Activity;
      case 'status_changed':
        return CheckCircle2;
      case 'created':
        return Circle;
      case 'file_added':
        return Paperclip;
      default:
        return Clock;
    }
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      'note': 'Note',
      'created': 'Création',
      'status_changed': 'Statut modifié',
      'priority_changed': 'Priorité modifiée',
      'due_date_changed': 'Date d\'échéance modifiée',
      'assignees_updated': 'Assignés modifiés',
      'responsible_changed': 'Responsable modifié',
      'file_added': 'Fichier ajouté',
      'file_removed': 'Fichier supprimé'
    };
    return labels[eventType] || eventType;
  };

  // Safety check for items
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Chargement de la timeline...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <Clock size={24} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Aucune entrée manuelle</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Les entrées manuelles créées par les utilisateurs apparaîtront ici.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {Object.entries(groupedItems).map(([dateKey, dateItems]) => {
              if (!dateItems || !Array.isArray(dateItems) || dateItems.length === 0) return null;
              return (
              <div key={dateKey} className="mb-10 first:mt-0">
                {/* Date header - improved positioning */}
                <div className="flex items-center gap-4 mb-6 relative">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-gray-300 dark:via-gray-700 dark:to-gray-600"></div>
                  <div className="flex-shrink-0">
                    <span className="inline-block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider px-4 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                      {dateKey}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent via-gray-200 to-gray-300 dark:via-gray-700 dark:to-gray-600"></div>
                </div>

                {/* Timeline items for this date */}
                <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-8 space-y-8">
                  {dateItems.map((item, idx) => {
                    if (!item || !item.id) return null;
                    const eventType = item.event_type || 'note';
                    const IconComponent = getEventIcon(eventType);
                    const iconColor = getEventIconColor(eventType);
                    return (
                      <div key={item.id} className="relative pl-10">
                        {/* Timeline dot with icon - improved design */}
                        <div className="absolute -left-[17px] top-0.5 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white dark:border-gray-900 bg-white dark:bg-gray-900 z-10 shadow-sm">
                          <div className={`h-5 w-5 rounded-full ${iconColor} flex items-center justify-center shadow-sm`}>
                            <IconComponent size={14} className="text-white" />
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-3 pb-2">
                          {/* Header: Time + User + Action type */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                                  {formatTimeOnly(item.created_at)}
                                </span>
                                <span className="text-gray-300 dark:text-gray-600">•</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                  {item.user_name || 'Utilisateur inconnu'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Description and Edit button */}
                          <div className="flex items-start justify-between gap-2">
                            {editingId === item.id ? (
                              <div className="flex-1 space-y-2">
                                <textarea
                                  value={editingDescription}
                                  onChange={(e) => setEditingDescription(e.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                  rows={3}
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={handleCancelEdit}
                                    className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    onClick={handleSaveEdit}
                                    disabled={!editingDescription.trim()}
                                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <Save size={14} className="inline" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1">
                                  {item.description && item.description.trim() && (
                                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-lg border border-gray-100 dark:border-gray-800 leading-relaxed">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 prose-img:rounded-lg prose-img:max-w-full prose-img:my-2"
                                        components={{
                                          img: ({ node, ...props }) => {
                                            try {
                                              return <ImageWithFallback src={props.src || ''} alt={props.alt || ''} />;
                                            } catch (error) {
                                              console.error('Error rendering image:', error);
                                              return <span>Image non disponible</span>;
                                            }
                                          },
                                        }}
                                      >
                                        {item.description}
                                      </ReactMarkdown>
                                    </div>
                                  )}
                                </div>
                                {currentUserId !== null && item.user_id === currentUserId && (
                                  <div className="flex gap-1">
                                    {onUpdate && (
                                      <button
                                        onClick={() => handleEdit(item)}
                                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        title="Modifier"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                    )}
                                    {onDelete && (
                                      <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                        title="Supprimer"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        
                          {/* Files */}
                          {item.files && item.files.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.files.map((file) => {
                                if (!file || !file.id) return null;
                                return (
                                  <div key={file.id} className="group relative flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
                                    {isImage(file.content_type) ? (
                                      <ImageIcon size={16} className="text-blue-500" />
                                    ) : (
                                      <Paperclip size={16} className="text-gray-400" />
                                    )}
                                    {file.download_url ? (
                                      <a
                                        href={file.download_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        {file.original_name || 'Fichier'}
                                      </a>
                                    ) : (
                                      <span className="text-xs text-gray-600 dark:text-gray-400">
                                        {file.original_name || 'Fichier'}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400">{formatFileSize(file.file_size)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {canAdd && onAdd && (
        <div className="border-t border-gray-100 bg-white pb-2 pt-3 px-2 dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Écrivez une note..."
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
                  type="submit"
                  disabled={submitting || !description.trim()}
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
          </form>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default TaskTimeline;

