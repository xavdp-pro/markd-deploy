import React from 'react';
import { Calendar, Clock, Flag, Tag, User, X, CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle, MinusCircle, AlertCircle } from 'lucide-react';
import { Task, TaskTag, TaskAssignee } from '../types';
import UserMultiSelect from './UserMultiSelect';
import TagSelector from './TagSelector';

interface TaskMetadataPanelProps {
  task: Task;
  canEdit: boolean;
  onStatusChange?: (status: string) => void;
  onPriorityChange?: (priority: 'low' | 'medium' | 'high') => void;
  onDueDateChange?: (isoDate: string | null) => void;
  tags?: TaskTag[];
  availableTags?: TaskTag[];
  onAddTag?: (name: string) => Promise<void>;
  onRemoveTag?: (tagId: string) => Promise<void>;
  assignees?: TaskAssignee[];
  responsibleId?: number | null;
  onAssigneesChange?: (userIds: number[], responsibleId?: number) => void;
  workspaceId?: string;
  className?: string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string; color: string; icon: React.ReactNode }> = [
  { value: 'todo', label: 'À faire', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700', icon: <Circle size={14} /> },
  { value: 'doing', label: 'En cours', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50', icon: <ArrowUpCircle size={14} /> },
  { value: 'done', label: 'Terminé', color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50', icon: <CheckCircle2 size={14} /> },
];

const PRIORITY_OPTIONS: Array<{ value: 'low' | 'medium' | 'high'; label: string; color: string; icon: React.ReactNode }> = [
  { value: 'low', label: 'Basse', color: 'text-gray-600 dark:text-gray-400', icon: <ArrowDownCircle size={14} className="text-blue-500" /> },
  { value: 'medium', label: 'Moyenne', color: 'text-amber-600 dark:text-amber-400', icon: <MinusCircle size={14} className="text-amber-500" /> },
  { value: 'high', label: 'Haute', color: 'text-red-600 dark:text-red-400', icon: <AlertCircle size={14} className="text-red-500" /> },
];

const formatDateForInput = (value?: string | null) => {
  if (!value) return '';
  return value.split('T')[0] ?? '';
};

const TaskMetadataPanel: React.FC<TaskMetadataPanelProps> = ({
  task,
  canEdit,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  tags = [],
  availableTags = [],
  onAddTag,
  onRemoveTag,
  assignees = [],
  responsibleId = null,
  onAssigneesChange,
  workspaceId = 'demo',
  className,
}) => {
  const handleStatusClick = (status: string) => {
    if (!canEdit || !onStatusChange) return;
    onStatusChange(status);
  };

  const handlePriorityClick = (priority: 'low' | 'medium' | 'high') => {
    if (!canEdit || !onPriorityChange) return;
    onPriorityChange(priority);
  };

  const handleDueDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit || !onDueDateChange) return;
    const value = event.target.value;
    if (!value) {
      onDueDateChange(null);
      return;
    }
    try {
      const iso = new Date(`${value}T00:00:00`).toISOString();
      onDueDateChange(iso);
    } catch (error) {
      console.error('Invalid due date value', error);
    }
  };

  const selectedUserIds = assignees.map((assignee) => assignee.user_id);

  const handleAssigneeSelectionChange = (userIds: number[], responsible?: number) => {
    onAssigneesChange?.(userIds, responsible);
  };

  const containerClass =
    `flex h-full flex-col gap-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm ` +
    `dark:border-gray-800 dark:bg-gray-900 ${className ? className : ''}`;

  return (
    <div className={containerClass}>
      {/* Status Section */}
      <section>
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <Clock size={12} />
          Statut
        </span>
        <div className="flex flex-col gap-2">
          <div className="flex w-full rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {STATUS_OPTIONS.map((option) => {
              const isSelected = task.status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStatusClick(option.value)}
                  disabled={!canEdit}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  } ${!canEdit ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {option.icon}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Priority Section */}
      <section>
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <Flag size={12} />
          Priorité
        </span>
        <div className="flex gap-2">
          {PRIORITY_OPTIONS.map((option) => {
            const isSelected = task.priority === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handlePriorityClick(option.value)}
                disabled={!canEdit}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 ${
                  isSelected
                    ? `border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800`
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                } ${!canEdit ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Due Date Section */}
      <section>
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <Calendar size={12} />
          Échéance
        </span>
        <div className="relative group">
          <div className="relative flex items-center">
            <input
              type="date"
              value={formatDateForInput(task.due_date)}
              onChange={handleDueDateChange}
              disabled={!canEdit}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900 dark:focus:ring-blue-900"
            />
            {!task.due_date && (
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Calendar size={16} />
              </div>
            )}
          </div>
          {task.due_date && canEdit && (
            <button
              type="button"
              onClick={() => onDueDateChange?.(null)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-gray-200 p-1 text-gray-500 opacity-0 transition-opacity hover:bg-gray-300 hover:text-gray-700 group-hover:opacity-100 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
              title="Effacer la date"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </section>

      {/* Assignment Section */}
      <section>
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <User size={12} />
          Assignation
        </span>
        <UserMultiSelect
          selectedUserIds={selectedUserIds}
          responsibleUserId={responsibleId ?? undefined}
          onSelectionChange={handleAssigneeSelectionChange}
          workspaceId={workspaceId}
          className={canEdit ? '' : 'pointer-events-none opacity-60'}
        />
      </section>

      {/* Tags Section */}
      <section className="flex-1">
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <Tag size={12} />
          Tags
        </span>
        <TagSelector
          tags={tags}
          suggestions={availableTags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          readOnly={!canEdit}
        />
      </section>
    </div>
  );
};

export default TaskMetadataPanel;

