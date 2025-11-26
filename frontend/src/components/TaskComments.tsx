import React, { useMemo, useState } from 'react';
import { TaskComment } from '../types';
import { Loader2, Send } from 'lucide-react';

interface TaskCommentsProps {
  comments: TaskComment[];
  loading?: boolean;
  canAdd?: boolean;
  onAdd?: (content: string) => Promise<void>;
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

const TaskComments: React.FC<TaskCommentsProps> = ({ comments, loading = false, canAdd = false, onAdd }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAdd || !content.trim()) {
      return;
    }

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
      <div className="flex-1 overflow-y-auto p-6">
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
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Aucun commentaire</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Soyez le premier à commenter cette tâche.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {comments.map((comment, index) => {
              const initials = (comment.user_name || 'User').substring(0, 2).toUpperCase();
              return (
                <li key={comment.id} className="flex gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorClasses[index]}`}>
                    {initials}
                  </div>
                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {comment.user_name || 'User'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDateTime(comment.created_at)}
                      </span>
                    </div>
                    <div className="rounded-2xl rounded-tl-none bg-gray-50 px-4 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      <p className="whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canAdd && onAdd && (
        <div className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Écrivez un commentaire..."
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 py-3 pl-4 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900 dark:focus:ring-blue-900"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="absolute bottom-1.5 right-1.5 rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:text-blue-400 dark:hover:bg-blue-900/30 dark:disabled:text-gray-600"
              title="Envoyer (Entrée)"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
            Appuyez sur Entrée pour envoyer, Shift+Entrée pour une nouvelle ligne
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskComments;

