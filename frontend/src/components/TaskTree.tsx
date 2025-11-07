import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Folder,
} from 'lucide-react';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIcon from './TaskPriorityIcon';
import TaskTypeIcon from './TaskTypeIcon';
import TaskAssigneeAvatars from './TaskAssigneeAvatars';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import InputModal from './InputModal';
import ConfirmModal from './ConfirmModal';

interface TaskTreeProps {
  tasks: Task[];
  selectedTask: Task | null;
  onSelect: (task: Task) => void;
  onCreateTask: (parentId: string | null, title: string) => void;
  onCreateFolder: (parentId: string | null, title: string) => void;
  onRenameTask: (taskId: string, newTitle: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDuplicateTask: (taskId: string) => void;
  expanded: Record<string, boolean>;
  onToggle: (taskId: string) => void;
  className?: string;
}

const TaskTree: React.FC<TaskTreeProps> = ({
  tasks,
  selectedTask,
  onSelect,
  onCreateTask,
  onCreateFolder,
  onRenameTask,
  onDeleteTask,
  onDuplicateTask,
  expanded,
  onToggle,
  className = '',
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    task: Task | null;
  } | null>(null);
  
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, task: Task | null) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      task,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div className={`${className}`}>
      {/* Root level actions */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 space-y-1">
        <button
          onClick={() => {
            setInputModal({
              isOpen: true,
              title: 'Nouvelle tâche',
              placeholder: 'Titre de la tâche...',
              onConfirm: (title) => {
                onCreateTask(null, title);
                setInputModal(null);
              }
            });
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full"
        >
          <Plus size={16} />
          Nouvelle tâche
        </button>
        <button
          onClick={() => {
            setInputModal({
              isOpen: true,
              title: 'Nouveau dossier',
              placeholder: 'Nom du dossier...',
              onConfirm: (title) => {
                onCreateFolder(null, title);
                setInputModal(null);
              }
            });
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full"
        >
          <Folder size={16} />
          Nouveau dossier
        </button>
      </div>

      {/* Task tree */}
      <div className="overflow-y-auto flex-1">
        {tasks.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            Aucune tâche. Créez-en une !
          </div>
        ) : (
          tasks.map(task => (
            <TaskTreeNode
              key={task.id}
              task={task}
              level={0}
              selected={selectedTask?.id === task.id}
              onSelect={onSelect}
              onContextMenu={handleContextMenu}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            {/* Create actions */}
            <button
              onClick={() => {
                closeContextMenu();
                setInputModal({
                  isOpen: true,
                  title: 'Nouvelle sous-tâche',
                  placeholder: 'Titre de la sous-tâche...',
                  onConfirm: (title) => {
                    onCreateTask(contextMenu.task?.id || null, title);
                    setInputModal(null);
                  }
                });
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Plus size={14} />
              Ajouter une tâche
            </button>
            
            <button
              onClick={() => {
                closeContextMenu();
                setInputModal({
                  isOpen: true,
                  title: 'Nouveau dossier',
                  placeholder: 'Nom du dossier...',
                  onConfirm: (title) => {
                    onCreateFolder(contextMenu.task?.id || null, title);
                    setInputModal(null);
                  }
                });
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Folder size={14} />
              Créer un dossier
            </button>

            {contextMenu.task && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                
                <button
                  onClick={() => {
                    closeContextMenu();
                    setInputModal({
                      isOpen: true,
                      title: 'Renommer',
                      placeholder: 'Nouveau titre...',
                      defaultValue: contextMenu.task?.title,
                      onConfirm: (title) => {
                        onRenameTask(contextMenu.task!.id, title);
                        setInputModal(null);
                      }
                    });
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Edit2 size={14} />
                  Renommer
                </button>
                
                <button
                  onClick={() => {
                    closeContextMenu();
                    onDuplicateTask(contextMenu.task!.id);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Copy size={14} />
                  Dupliquer
                </button>

                <button
                  onClick={() => {
                    const taskToDelete = contextMenu.task!;
                    closeContextMenu();
                    setConfirmModal({
                      isOpen: true,
                      title: 'Supprimer la tâche',
                      message: `Êtes-vous sûr de vouloir supprimer "${taskToDelete.title}" ?`,
                      onConfirm: () => {
                        onDeleteTask(taskToDelete.id);
                        setConfirmModal(null);
                      }
                    });
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Input Modal */}
      {inputModal && (
        <InputModal
          isOpen={inputModal.isOpen}
          onClose={() => setInputModal(null)}
          onConfirm={inputModal.onConfirm}
          title={inputModal.title}
          placeholder={inputModal.placeholder}
          defaultValue={inputModal.defaultValue}
        />
      )}
      
      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmStyle="danger"
        />
      )}
    </div>
  );
};

interface TaskTreeNodeProps {
  task: Task;
  level: number;
  selected: boolean;
  onSelect: (task: Task) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  expanded: Record<string, boolean>;
  onToggle: (taskId: string) => void;
}

const TaskTreeNode: React.FC<TaskTreeNodeProps> = ({
  task,
  level,
  selected,
  onSelect,
  onContextMenu,
  expanded,
  onToggle,
}) => {
  const hasChildren = task.children && task.children.length > 0;
  const isExpanded = expanded[task.id] || false;
  const paddingLeft = level * 16 + 8;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, paddingLeft: `${paddingLeft}px` }}
        className={`group flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
          selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        onClick={() => onSelect(task)}
        onContextMenu={e => onContextMenu(e, task)}
        {...attributes}
        {...listeners}
      >
        {/* Expand/collapse button */}
        <button
          onClick={e => {
            e.stopPropagation();
            if (hasChildren) {
              onToggle(task.id);
            }
          }}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-600 dark:text-gray-400" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Task type icon */}
        <TaskTypeIcon
          icon={task.type_icon}
          color={task.type_color}
          name={task.type_name || 'Task'}
          size="text-sm"
        />

        {/* Task title */}
        <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
          {task.title}
        </span>

        {/* Status badge */}
        {task.workflow_statuses && (
          <TaskStatusBadge
            status={task.status}
            workflowStatuses={task.workflow_statuses}
            className="flex-shrink-0"
          />
        )}

        {/* Priority icon */}
        <TaskPriorityIcon priority={task.priority} size={14} className="flex-shrink-0" />

        {/* Assignees */}
        {task.assigned_users && task.assigned_users.length > 0 && (
          <TaskAssigneeAvatars
            assignedUsers={task.assigned_users}
            responsibleUserId={task.responsible_user_id}
            maxDisplay={2}
            size="sm"
            className="flex-shrink-0"
          />
        )}

      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {task.children!.map(child => (
            <TaskTreeNode
              key={child.id}
              task={child}
              level={level + 1}
              selected={selected}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default TaskTree;

