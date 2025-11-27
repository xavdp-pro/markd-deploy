import React, { useState, useEffect, useRef } from 'react';
import {
  CheckSquare,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Copy,
  ChevronRight,
  ChevronDown,
  Lock,
  Search,
  X,
} from 'lucide-react';
import { Task } from '../types';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';
import InputModal from './InputModal';

interface TaskTreeProps {
  tree: Task[];
  expanded: Record<string, boolean>;
  selected: Task | null;
  onToggleExpand: (id: string) => void;
  onSelect: (task: Task) => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onCopy: (id: string) => void;
  onUnlock?: (id: string) => void;
  // width?: number;
  readOnly?: boolean;
  userPermission?: string;
  workspaceSelector?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onClearSearch?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  node: Task;
  onClose: () => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onCopy: (id: string) => void;
  onUnlock?: (id: string) => void;
  readOnly?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onCopy,
  onUnlock,
}) => {
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {node.type === 'folder' && (
        <>
          <button
            onClick={() => {
              setInputModal({
                isOpen: true,
                title: 'New task',
                label: 'Task name',
                defaultValue: '',
                onConfirm: (name) => {
                  onCreate?.(node.id, name);
                  setInputModal(null);
                  onClose();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Plus size={14} />
            Add task
          </button>
          <button
            onClick={() => {
              setInputModal({
                isOpen: true,
                title: 'New folder',
                label: 'Folder name',
                defaultValue: '',
                onConfirm: (name) => {
                  onCreateFolder?.(node.id, name);
                  setInputModal(null);
                  onClose();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Folder size={14} />
            Create folder
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
        </>
      )}
      
      {node.id !== 'root' && (
        <>
          <button
            onClick={() => {
              setInputModal({
                isOpen: true,
                title: 'Rename',
                label: 'New name',
                defaultValue: node.name,
                onConfirm: (newName) => {
                  if (newName.trim()) {
                    onRename?.(node.id, newName.trim());
                    setInputModal(null);
                  }
                  onClose();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Edit2 size={14} />
            Rename
          </button>
          
          <button
            onClick={() => handleAction(() => onCopy(node.id))}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Copy size={14} />
            Duplicate
          </button>

          <button
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                title: 'Delete task',
                message: `Are you sure you want to delete "${node.name}"?`,
                onConfirm: () => {
                  onDelete?.(node.id);
                  setConfirmModal(null);
                  onClose();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>

          {node.locked_by && node.locked_by.user_id !== user?.id?.toString() && (
            <button
              onClick={() => handleAction(() => onUnlock?.(node.id))}
              className="w-full px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
            >
              <Lock size={14} />
              Force unlock
            </button>
          )}
        </>
      )}

      {inputModal && (
        <InputModal
          isOpen={inputModal.isOpen}
          title={inputModal.title}
          label={inputModal.label}
          placeholder={inputModal.label}
          defaultValue={inputModal.defaultValue}
          onCancel={() => setInputModal(null)}
          onConfirm={inputModal.onConfirm}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onCancel={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
          variant="danger"
        />
      )}
    </div>
  );
};

const TaskTree: React.FC<TaskTreeProps> = ({
  tree,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onCopy,
  onUnlock,
  // width,
  readOnly = false,
  userPermission = 'read',
  workspaceSelector,
  searchQuery = '',
  onSearchChange,
  onClearSearch,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Task } | null>(null);
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    onConfirm: (value: string) => void;
  } | null>(null);

  const canWrite = userPermission === 'write' || userPermission === 'admin';

  const handleContextMenu = (e: React.MouseEvent, node: Task) => {
    e.preventDefault();
    if (readOnly) return;
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const renderNode = (node: Task, level: number = 0) => {
    const isExpanded = expanded[node.id];
    const isSelected = selected?.id === node.id;
    const hasChildren = node.children && node.children.length > 0;

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
      id: node.id,
      data: { node },
    });

    const { setNodeRef: setDropRef, isOver } = useDroppable({
      id: node.id,
      data: { node },
    });

    const style = transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
      : undefined;

    return (
      <div key={node.id}>
        <div
          ref={el => {
            setNodeRef(el);
            setDropRef(el);
          }}
          className={`group flex items-center gap-2 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
            isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          } ${isOver ? 'bg-blue-100 dark:bg-blue-800/30' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px`, ...style }}
          onClick={() => onSelect(node)}
          onContextMenu={e => handleContextMenu(e, node)}
          {...attributes}
          {...listeners}
        >
          {/* Expand/collapse */}
          <button
            onClick={e => {
              e.stopPropagation();
              if (hasChildren) onToggleExpand(node.id);
            }}
            className="w-4 h-4 flex items-center justify-center"
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

          {/* Icon */}
          {node.type === 'folder' ? (
            isExpanded ? (
              <FolderOpen size={16} className="text-blue-500 flex-shrink-0" />
            ) : (
              <Folder size={16} className="text-blue-500 flex-shrink-0" />
            )
          ) : (
            <CheckSquare size={16} className="text-green-500 flex-shrink-0" />
          )}

          {/* Name */}
          <span className="flex-1 text-sm truncate text-gray-900 dark:text-gray-100">
            {node.name}
          </span>

          {/* Status badge */}
          {node.type === 'task' && node.status && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {node.status}
            </span>
          )}

          {/* Lock indicator */}
          {node.locked_by && (
            <span title={`Locked by ${node.locked_by.user_name}`} className="flex items-center">
              <Lock size={14} className="text-orange-500 flex-shrink-0" />
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Header with search and workspace */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
        {workspaceSelector}
        
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-2 top-2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Create buttons */}
        {canWrite && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setInputModal({
                  isOpen: true,
                  title: 'New task',
                  label: 'Task name',
                  onConfirm: (name) => {
                    onCreate?.('root', name);
                    setInputModal(null);
                  }
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Plus size={14} />
              Task
            </button>
            <button
              onClick={() => {
                setInputModal({
                  isOpen: true,
                  title: 'Nouveau dossier',
                  label: 'Nom du dossier',
                  onConfirm: (name) => {
                    onCreateFolder?.('root', name);
                    setInputModal(null);
                  }
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              <Folder size={14} />
              Dossier
            </button>
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            No tasks yet. Click "Task" to create one.
          </div>
        ) : (
          tree.map(node => renderNode(node))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          onClose={closeContextMenu}
          onCreate={onCreate}
          onCreateFolder={onCreateFolder}
          onDelete={onDelete}
          onRename={onRename}
          onCopy={onCopy}
          onUnlock={onUnlock}
          readOnly={readOnly}
        />
      )}

      {/* Input Modal */}
      {inputModal && (
        <InputModal
          isOpen={inputModal.isOpen}
          title={inputModal.title}
          label={inputModal.label}
          placeholder={inputModal.label}
          onCancel={() => setInputModal(null)}
          onConfirm={inputModal.onConfirm}
        />
      )}
    </div>
  );
};

export default TaskTree;



