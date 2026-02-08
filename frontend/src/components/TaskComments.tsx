import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TaskComment } from '../types';
import { Loader2, Send, X, Edit2, Save, Trash2, GripHorizontal, Image as ImageIcon, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import WysiwygEditor from './WysiwygEditor';

// Image component with thumbnail and modal (kept for existing image links in comments)
const ImageWithFallback: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!src || src.trim() === '' || src === 'undefined' || src.includes('undefined')) {
      setImgError(true);
      setImgLoading(false);
      return;
    }
    setImgError(false);
    setImgLoading(true);

    let fullSrc = src.trim();
    const urlParts = fullSrc.split('?');
    const baseUrl = urlParts[0];
    const params = new URLSearchParams(urlParts[1] || '');
    fullSrc = (!baseUrl.startsWith('/') && !baseUrl.startsWith('http')) ? `/${baseUrl}` : baseUrl;
    if (fullSrc.includes('/download')) {
      params.set('download', 'false');
      fullSrc = `${fullSrc}?${params.toString()}`;
    }
    setImgSrc(fullSrc);
  }, [src]);

  useEffect(() => {
    if (!showModal) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showModal]);

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
              <p className="text-xs text-gray-500 dark:text-gray-400">Image unavailable</p>
            </div>
          </div>
        ) : imgSrc ? (
          <div className="relative inline-block cursor-pointer group" onClick={() => setShowModal(true)}>
            <img
              src={imgSrc}
              alt={alt}
              className="rounded-lg max-w-[200px] max-h-[200px] object-cover border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity shadow-sm"
              onLoad={() => { setImgLoading(false); setImgError(false); }}
              onError={() => { setImgLoading(false); setImgError(true); }}
              loading="lazy"
            />
          </div>
        ) : null}
      </div>

      {showModal && imgSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2">
              <X size={24} />
            </button>
            <img src={imgSrc} alt={alt} className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
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
  currentUserId?: number | null;
  workspaceId?: string;
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

// Color palette for user avatars AND left border accents
const avatarPalette = [
  { avatar: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', border: 'border-l-blue-400 dark:border-l-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-950/10' },
  { avatar: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', border: 'border-l-purple-400 dark:border-l-purple-500', bg: 'bg-purple-50/50 dark:bg-purple-950/10' },
  { avatar: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', border: 'border-l-emerald-400 dark:border-l-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-950/10' },
  { avatar: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', border: 'border-l-amber-400 dark:border-l-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-950/10' },
  { avatar: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300', border: 'border-l-pink-400 dark:border-l-pink-500', bg: 'bg-pink-50/50 dark:bg-pink-950/10' },
  { avatar: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300', border: 'border-l-cyan-400 dark:border-l-cyan-500', bg: 'bg-cyan-50/50 dark:bg-cyan-950/10' },
  { avatar: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', border: 'border-l-orange-400 dark:border-l-orange-500', bg: 'bg-orange-50/50 dark:bg-orange-950/10' },
];

const TaskComments: React.FC<TaskCommentsProps> = ({
  comments,
  loading = false,
  canAdd = false,
  onAdd,
  onUpdate,
  onDelete,
  currentUserId,
  workspaceId,
}) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editorHeight, setEditorHeight] = useState(() => {
    try { const h = parseInt(localStorage.getItem('markd_comment_editor_height') || ''); return h > 60 ? h : 100; } catch { return 100; }
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Drag-to-resize handler (upward = increase height)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartH.current = editorHeight;
  }, [editorHeight]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = resizeStartY.current - e.clientY;
      const newH = Math.max(60, Math.min(500, resizeStartH.current + delta));
      setEditorHeight(newH);
    };
    const handleUp = () => {
      setIsResizing(false);
      localStorage.setItem('markd_comment_editor_height', String(editorHeight));
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); };
  }, [isResizing, editorHeight]);

  // Auto-scroll to bottom when new comments arrive
  const prevLengthRef = useRef(comments.length);
  useEffect(() => {
    if (comments.length > prevLengthRef.current) {
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    prevLengthRef.current = comments.length;
  }, [comments.length]);

  // Upload handler for WysiwygEditor toolbar buttons
  const handleWysiwygUpload = useCallback(async (file: File): Promise<{ url: string; name: string } | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      const data = await response.json();
      toast.success('File uploaded');
      return { url: data.url, name: file.name };
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed');
      return null;
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAdd || !content.trim() || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await onAdd(content.trim());
      setContent('');
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
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
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
    try {
      await onDelete(commentId);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      setConfirmDeleteId(null);
    }
  };

  // Assign a stable color to each unique user
  const userColors = useMemo(() => {
    const assigned = new Map<string, typeof avatarPalette[0]>();
    let index = 0;
    comments.forEach((comment) => {
      const key = (comment.user_name || 'user').toLowerCase();
      if (!assigned.has(key)) {
        assigned.set(key, avatarPalette[index % avatarPalette.length]);
        index += 1;
      }
    });
    return assigned;
  }, [comments]);

  const getColor = (userName: string) => {
    return userColors.get((userName || 'user').toLowerCase()) || avatarPalette[0];
  };

  // Filter comments by search query
  const filteredComments = useMemo(() => {
    if (!searchQuery.trim()) return comments;
    const q = searchQuery.toLowerCase();
    return comments.filter(c =>
      c.content.toLowerCase().includes(q) ||
      (c.user_name || '').toLowerCase().includes(q)
    );
  }, [comments, searchQuery]);

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      {comments.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comments..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Loading comments...</p>
          </div>
        ) : filteredComments.length === 0 && !searchQuery ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No comments yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ask questions, discuss with the team...</p>
          </div>
        ) : filteredComments.length === 0 && searchQuery ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <Search size={20} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No results</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">No comments match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredComments.map((comment) => {
              const initials = (comment.user_name || 'User').substring(0, 2).toUpperCase();
              const isEditing = editingId === comment.id;
              const canEdit = currentUserId !== null && comment.user_id === currentUserId;
              const color = getColor(comment.user_name || 'user');

              return (
                <div
                  key={comment.id}
                  className={`group rounded-lg border-l-[3px] ${color.border} ${color.bg} p-3 transition-all hover:shadow-sm`}
                >
                  {/* Comment header */}
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${color.avatar}`}>
                      {initials}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {comment.user_name || 'User'}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {formatDateTime(comment.created_at)}
                    </span>
                    {canEdit && !isEditing && (
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmDeleteId === comment.id ? (
                          <>
                            <span className="text-[11px] text-red-500 dark:text-red-400 mr-1 self-center">Delete?</span>
                            <button onClick={() => handleDelete(comment.id)} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 transition-colors" title="Confirm delete">
                              Yes
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors" title="Cancel">
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(comment)} className="rounded p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors" title="Edit">
                              <Edit2 size={13} />
                            </button>
                            {onDelete && (
                              <button onClick={() => setConfirmDeleteId(comment.id)} className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comment body */}
                  <div className="ml-9 text-sm text-gray-700 dark:text-gray-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 prose-img:rounded-lg prose-img:max-w-full prose-img:my-2 prose-a:text-blue-600 dark:prose-a:text-blue-400"
                      components={{
                        p: ({ children }) => <div className="my-1">{children}</div>,
                        img: ({ node, ...props }) => (
                          <ImageWithFallback src={props.src || ''} alt={props.alt || ''} />
                        ),
                        a: ({ node, ...props }) => (
                          <a {...props} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />
                        ),
                      }}
                    >
                      {comment.content}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      {canAdd && onAdd && (
        <div className="bg-white dark:bg-gray-900" style={{ cursor: isResizing ? 'row-resize' : 'default' }}>
          {/* Drag handle to resize editor upward */}
          <div
            onMouseDown={handleResizeStart}
            className="flex items-center justify-center h-3 cursor-row-resize border-t border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            title="Drag to resize"
          >
            <GripHorizontal size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" />
          </div>
          <div className="pb-2 px-3">
          {/* Edit banner (WhatsApp style) */}
          {editingId && (
            <div className="flex items-center gap-2 mb-1.5 px-1 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500">
              <Edit2 size={12} className="text-blue-500 ml-1" />
              <span className="text-xs text-blue-600 dark:text-blue-400 flex-1 truncate">Editing comment</span>
              <button onClick={handleCancelEdit} className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Cancel (Escape)">
                <X size={14} />
              </button>
            </div>
          )}
          <WysiwygEditor
            value={editingId ? editingContent : content}
            onChange={(val) => editingId ? setEditingContent(val) : setContent(val)}
            placeholder={editingId ? 'Edit your comment...' : 'Write a comment...'}
            height={editorHeight}
            onSubmit={() => { if (editingId) { handleSaveEdit(); } else { handleSubmit({ preventDefault: () => {} } as any); } }}
            onCancel={editingId ? handleCancelEdit : undefined}
            autoFocus={!!editingId}
            onUploadFile={handleWysiwygUpload}
            workspaceId={workspaceId}
          />
          {/* Action bar below editor */}
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{editingId ? 'Ctrl+Enter to save' : 'Ctrl+Enter to send'}</span>
            <button
              type="button"
              onClick={() => { if (editingId) { handleSaveEdit(); } else { handleSubmit({ preventDefault: () => {} } as any); } }}
              disabled={editingId ? !editingContent.trim() : (submitting || !content.trim())}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : editingId ? <><Save size={13} /> Save</> : <><Send size={13} /> Send</>}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskComments;
