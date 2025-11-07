import React, { useState, useCallback } from 'react';
import { Task, TaskType, Workflow } from '../types';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  Copy,
  MoreVertical,
} from 'lucide-react';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIcon from './TaskPriorityIcon';
import TaskTypeIcon from './TaskTypeIcon';
import TaskAssigneeAvatars from './TaskAssigneeAvatars';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskTreeProps {
  tasks: Task[];
  selectedTask: Task | null;
  onSelect: (task: Task) => void;
  onCreateTask: (parentId: string | null, taskType: TaskType) => void;
  onDeleteTask: (taskId: string) => void;
  onDuplicateTask: (taskId: string) => void;
  expanded: Record<string, boolean>;
  onToggle: (taskId: string) => void;
  taskTypes: TaskType[];
  className?: string;
}

const TaskTree: React.FC<TaskTreeProps> = ({
  tasks,
  selectedTask,
  onSelect,
  onCreateTask,
  onDeleteTask,
  onDuplicateTask,
  expanded,
  onToggle,
  taskTypes,
  className = '',
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    task: Task | null;
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

  const handleCreateTask = (parentId: string | null, taskType: TaskType) => {
    onCreateTask(parentId, taskType);
    closeContextMenu();
  };

  const handleDeleteTask = (taskId: string) => {
    onDeleteTask(taskId);
    closeContextMenu();
  };

  const handleDuplicateTask = (taskId: string) => {
    onDuplicateTask(taskId);
    closeContextMenu();
  };

  return (
    <div className={`${className}`}>
      {/* Root level actions */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={e => handleContextMenu(e, null)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded w-full"
        >
          <Plus size={16} />
          Nouvelle tâche
        </button>
      </div>

      {/* Task tree */}
      <div className="overflow-y-auto flex-1">
        {tasks.map(task => (
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
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            {/* Create task submenu */}
            <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
              Nouvelle tâche
            </div>
            {taskTypes.map(taskType => (
              <button
                key={taskType.id}
                onClick={() => handleCreateTask(contextMenu.task?.id || null, taskType)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <TaskTypeIcon icon={taskType.icon} color={taskType.color} name={taskType.name} />
                <span>{taskType.name}</span>
              </button>
            ))}

            {contextMenu.task && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                
                <button
                  onClick={() => handleDuplicateTask(contextMenu.task!.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Copy size={16} />
                  Dupliquer
                </button>

                <button
                  onClick={() => handleDeleteTask(contextMenu.task!.id)}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
              </>
            )}
          </div>
        </>
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

        {/* More options */}
        <button
          onClick={e => {
            e.stopPropagation();
            onContextMenu(e, task);
          }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          <MoreVertical size={14} className="text-gray-600 dark:text-gray-400" />
        </button>
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

