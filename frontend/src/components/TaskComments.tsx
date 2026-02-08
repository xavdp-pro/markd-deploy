import React, { useMemo, useState, useRef, useEffect } from 'react';
import { TaskComment } from '../types';
import { Loader2, Send, X, Edit2, Save, Image as ImageIcon, Trash2, Paperclip, Bold, Italic, Code, List, Link2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

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
  currentUserId
}) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

  // Shared upload logic for file input and clipboard paste
  const uploadFile = async (file: File) => {
    setUploading(true);
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
      const url = data.url;

      // Insert markdown for image or file link
      const markdown = file.type.startsWith('image/')
        ? `![${file.name}](${url})`
        : `[📎 ${file.name}](${url})`;

      setContent(prev => prev ? `${prev}\n${markdown}` : markdown);
      toast.success('File uploaded');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle file input change
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  // Handle paste from clipboard (images)
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Generate a meaningful filename from the type
          const ext = item.type.split('/')[1] || 'png';
          const namedFile = new File([file], `pasted-image.${ext}`, { type: item.type });
          await uploadFile(namedFile);
        }
        return;
      }
    }
    // If no image found in clipboard, let the default paste behavior happen (text)
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAdd || !content.trim() || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await onAdd(content.trim());
      setContent('');
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

  return (
    <div className="flex h-full flex-col">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No comments yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ask questions, discuss with the team...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => {
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
                  {isEditing ? (
                    <div className="ml-9">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        rows={3}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={handleCancelEdit} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700">
                          Cancel
                        </button>
                        <button onClick={handleSaveEdit} disabled={!editingContent.trim()} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
                          <Save size={14} className="inline" />
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      {canAdd && onAdd && (
        <div className="border-t border-gray-100 bg-white pb-2 pt-3 px-3 dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onPaste={handlePaste}
              placeholder="Write a comment..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              className="w-full resize-none rounded-t-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900 dark:focus:ring-blue-900 border-b-0"
              style={{ maxHeight: '120px' }}
            />
            {/* Bottom toolbar: markdown formatting left, actions right */}
            <div className="flex items-center justify-between rounded-b-xl border border-t-0 border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
              {/* Markdown formatting buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const sel = content.substring(start, end);
                    const replacement = sel ? `**${sel}**` : '**text**';
                    setContent(content.substring(0, start) + replacement + content.substring(end));
                    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + 2, start + 2 + (sel || 'text').length); }, 0);
                  }}
                  className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const sel = content.substring(start, end);
                    const replacement = sel ? `*${sel}*` : '*text*';
                    setContent(content.substring(0, start) + replacement + content.substring(end));
                    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + 1, start + 1 + (sel || 'text').length); }, 0);
                  }}
                  className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const sel = content.substring(start, end);
                    const replacement = sel ? `\`${sel}\`` : '`code`';
                    setContent(content.substring(0, start) + replacement + content.substring(end));
                    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + 1, start + 1 + (sel || 'code').length); }, 0);
                  }}
                  className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Inline code"
                >
                  <Code size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const prefix = start > 0 && content[start - 1] !== '\n' ? '\n' : '';
                    const insertion = `${prefix}- `;
                    setContent(content.substring(0, start) + insertion + content.substring(start));
                    const pos = start + insertion.length;
                    setTimeout(() => { ta.focus(); ta.setSelectionRange(pos, pos); }, 0);
                  }}
                  className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="List"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const sel = content.substring(start, end);
                    const replacement = sel ? `[${sel}](url)` : '[text](url)';
                    setContent(content.substring(0, start) + replacement + content.substring(end));
                    const urlStart = start + (sel || 'text').length + 3;
                    setTimeout(() => { ta.focus(); ta.setSelectionRange(urlStart, urlStart + 3); }, 0);
                  }}
                  className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Link"
                >
                  <Link2 size={14} />
                </button>
              </div>

              {/* Upload & send buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-900/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  title="Upload image"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-900/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  title="Attach file"
                >
                  <Paperclip size={14} />
                </button>
                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:text-blue-400 dark:hover:bg-blue-900/30 dark:disabled:text-gray-600 transition-colors"
                  title="Send (Enter)"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </form>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default TaskComments;
