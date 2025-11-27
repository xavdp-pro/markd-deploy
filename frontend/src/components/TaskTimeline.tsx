import React, { useState } from 'react';
import { TaskTimelineItem } from '../types';
import { Loader2, Clock, Activity } from 'lucide-react';

interface TaskTimelineProps {
  items: TaskTimelineItem[];
  loading?: boolean;
  canAdd?: boolean;
  onAdd?: (entry: { title: string; description?: string }) => Promise<void>;
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

const TaskTimeline: React.FC<TaskTimelineProps> = ({ items, loading = false, canAdd = false, onAdd }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAdd || !title.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onAdd({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Chargement de l'historique...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <Activity size={24} className="text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Aucun historique</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Les actions récentes apparaîtront ici.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-gray-100 ml-3 dark:border-gray-800 space-y-8">
            {items.map((item) => (
              <div key={item.id} className="relative pl-8">
                {/* Timeline dot */}
                <div className="absolute -left-[9px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-blue-500 dark:border-gray-900"></div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-gray-200">{item.user_name || 'Système'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatDateTime(item.created_at)}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</h4>
                  
                  {item.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                      {item.description}
                    </p>
                  )}
                  
                  <div className="mt-1 inline-flex items-center gap-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {item.event_type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canAdd && onAdd && (
        <div className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm font-medium text-gray-500 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-blue-900/20"
            >
              <Activity size={16} />
              Ajouter un événement manuellement
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Nouvel événement</h3>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Titre de l'événement"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                autoFocus
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description (optionnelle)"
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Ajouter
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskTimeline;

