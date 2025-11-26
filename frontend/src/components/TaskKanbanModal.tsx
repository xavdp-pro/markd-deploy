import React, { useMemo, useEffect } from 'react';
import { Task } from '../types';
import { X, CheckSquare, Clock, User, Calendar, Circle, CheckCircle, AlertCircle } from 'lucide-react';

interface TaskKanbanModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, status: string) => void;
}

const STATUS_COLUMNS = [
  { id: 'todo', label: 'À faire', icon: Circle, color: 'gray', bgColor: 'bg-gray-50 dark:bg-gray-800/30' },
  { id: 'in_progress', label: 'En cours', icon: Clock, color: 'blue', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'done', label: 'Terminé', icon: CheckCircle, color: 'green', bgColor: 'bg-green-50 dark:bg-green-900/20' },
];

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const TaskKanbanModal: React.FC<TaskKanbanModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onSelectTask,
  onStatusChange,
}) => {
  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };

    tasks.forEach((task) => {
      if (task.type === 'task') {
        const status = task.status || 'todo';
        if (grouped[status]) {
          grouped[status].push(task);
        } else {
          grouped.todo.push(task);
        }
      }
    });

    return grouped;
  }, [tasks]);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onStatusChange) {
      onStatusChange(taskId, status);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now;
    const isToday = date.toDateString() === now.toDateString();
    
    return {
      text: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      isOverdue,
      isToday,
    };
  };

  const handleTaskClick = (task: Task) => {
    onSelectTask(task);
    onClose();
  };

  const totalTasks = tasks.filter(t => t.type === 'task').length;
  const completedTasks = tasksByStatus.done.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-7xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Vue Kanban
            </h2>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckSquare size={16} />
                <span>{totalTasks} tâches</span>
              </div>
              <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Kanban Board */}
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {STATUS_COLUMNS.map((column) => {
            const columnTasks = tasksByStatus[column.id] || [];
            const Icon = column.icon;

            return (
              <div
                key={column.id}
                className={`flex w-80 flex-shrink-0 flex-col rounded-lg ${column.bgColor}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <Icon
                      size={18}
                      className={`text-${column.color}-500 dark:text-${column.color}-400`}
                    />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {column.label}
                    </h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4 custom-scrollbar">
                  {columnTasks.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 dark:border-gray-600 dark:text-gray-500">
                      Aucune tâche
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const dueDate = formatDate(task.due_date);
                      
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onClick={() => handleTaskClick(task)}
                          className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                        >
                          {/* Task Title */}
                          <div className="mb-2 flex items-start gap-2">
                            <CheckSquare size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                            <h4 className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
                              {task.name}
                            </h4>
                          </div>

                          {/* Task Metadata */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Priority */}
                            {task.priority && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                  PRIORITY_COLORS[task.priority]
                                }`}
                              >
                                {task.priority === 'low' && 'Basse'}
                                {task.priority === 'medium' && 'Moyenne'}
                                {task.priority === 'high' && 'Haute'}
                              </span>
                            )}

                            {/* Due Date */}
                            {dueDate && (
                              <span
                                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                                  dueDate.isOverdue
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                    : dueDate.isToday
                                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                              >
                                <Calendar size={10} />
                                {dueDate.text}
                              </span>
                            )}

                            {/* Assignee */}
                            {task.responsible_user_name && (
                              <span className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                <User size={10} />
                                {task.responsible_user_name}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TaskKanbanModal;
