import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  Eye,
  Folder,
  FolderOpen,
  GripVertical,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
  Maximize2,
  Minimize2,
  PanelLeftClose,
} from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Task, TaskTag } from '../types';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';
import InputModal from './InputModal';
import TagFilter from './TagFilter';

interface TaskTreeProps {
  tree: Task[];
  expanded: Record<string, boolean>;
  selected: Task[];
  onToggleExpand: (id: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onSelect: (task: Task, event?: React.MouseEvent) => void;
  onSelectAll?: () => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onCopy: (id: string) => void;
  userPermission?: string;
  workspaceSelector?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onClearSearch?: () => void;
  statusFilter?: 'all' | 'todo' | 'doing' | 'done';
  onStatusFilterChange?: (value: 'all' | 'todo' | 'doing' | 'done') => void;
  priorityFilter?: 'all' | 'low' | 'medium' | 'high';
  onPriorityFilterChange?: (value: 'all' | 'low' | 'medium' | 'high') => void;
  allTags?: TaskTag[];
  selectedTags?: string[];
  onTagFilterChange?: (tagIds: string[]) => void;
  width?: number;
  readOnly?: boolean;
  onCollapseSidebar?: () => void;
}

interface ContextMenuData {
  x: number;
  y: number;
  node: Task;
}

interface RootContextMenuData {
  x: number;
  y: number;
}

interface ContextMenuProps {
  data: ContextMenuData;
  onClose: () => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onCopy: (id: string) => void;
  setConfirmModal: (modal: {
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  data,
  onClose,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onCopy,
  setConfirmModal,
}) => {
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  const [inputModal, setInputModal] = useState<{
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

  const currentUserId = (() => {
    try {
      const stored = localStorage.getItem('markd_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.id ? String(parsed.id) : null;
    } catch {
      return null;
    }
  })();

  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        style={{ left: data.x, top: data.y }}
      >
        {data.node.type === 'folder' && (
          <>
            {onCreate && (
              <button
                type="button"
                onClick={() => {
                  setInputModal({
                    title: 'New task',
                    label: 'Task name',
                    onConfirm: (value) => {
                      onCreate(data.node.id, value);
                      setInputModal(null);
                      onClose();
                    },
                  });
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Plus size={14} />
                Add task
              </button>
            )}
            {onCreateFolder && (
              <button
                type="button"
                onClick={() => {
                  setInputModal({
                    title: 'New folder',
                    label: 'Folder name',
                    onConfirm: (value) => {
                      onCreateFolder(data.node.id, value);
                      setInputModal(null);
                      onClose();
                    },
                  });
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Folder size={14} />
                Create folder
              </button>
            )}
            <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          </>
        )}

        {data.node.id !== 'root' && (
          <>
            {onRename && (
              <button
                type="button"
                onClick={() => {
                  setInputModal({
                    title: 'Rename',
                    label: 'New name',
                    defaultValue: data.node.name,
                    onConfirm: (value) => {
                      onRename(data.node.id, value);
                      setInputModal(null);
                      onClose();
                    },
                  });
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Edit2 size={14} />
                Rename
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onCopy(data.node.id);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Copy size={14} />
              Duplicate
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const taskId = data.node.id;
                  const taskName = data.node.name;
                  setConfirmModal({
                    title: 'Delete task',
                    message: `Do you want to delete "${taskName}"?`,
                    variant: 'danger',
                    onConfirm: () => {
                      onDelete(taskId);
                      setConfirmModal(null);
                    },
                  });
                  onClose(); // Close context menu after setting modal
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <Trash2 size={14} />
              Delete
              </button>
            )}

          </>
        )}
      </div>

      {inputModal && (
        <InputModal
          isOpen
          title={inputModal.title}
          label={inputModal.label}
          defaultValue={inputModal.defaultValue}
          onConfirm={inputModal.onConfirm}
          onCancel={() => setInputModal(null)}
        />
      )}

    </>
  );
};

interface TaskTreeNodeProps {
  node: Task;
  level: number;
  expanded: Record<string, boolean>;
  selected: Task[];
  onToggleExpand: (id: string) => void;
  onSelect: (task: Task, event?: React.MouseEvent) => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onCopy: (id: string) => void;
  readOnly?: boolean;
  setConfirmModal: (modal: {
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null) => void;
}

const TaskTreeNode: React.FC<TaskTreeNodeProps> = ({
  node,
  level,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onCopy,
  readOnly,
  setConfirmModal,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

  const isExpanded = expanded[node.id];
  const isSelected = selected.some(s => s.id === node.id);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging, transform } = useDraggable({
    id: node.id,
    disabled: node.id === 'root',
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: node.type !== 'folder',
  });

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (readOnly) return;
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  };

  const nodeStyle: React.CSSProperties = {
    paddingLeft: `${level * 16 + 8}px`,
  };

  if (transform) {
    nodeStyle.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
  }

  if (isDragging) {
    nodeStyle.opacity = 0.6;
  }

  const statusBadge =
    node.type === 'task' && node.status ? (
      <span className="rounded-md bg-gray-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        {node.status}
      </span>
    ) : null;


  return (
    <div
      ref={(element) => {
        setDragRef(element);
        setDropRef(element);
      }}
    >
      <div
        className={`flex items-center gap-2 px-2 py-1.5 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500' : ''
        } ${
          isOver && node.type === 'folder'
            ? 'bg-blue-100/60 dark:bg-blue-800/40 ring-1 ring-blue-300 dark:ring-blue-600'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        style={nodeStyle}
        onContextMenu={handleContextMenu}
        onClick={(e) => {
          if (node.type === 'task') {
            onSelect(node, e);
          } else {
            // For folders, only toggle expand on simple click, but allow selection with Ctrl/Shift
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
              onSelect(node, e);
            } else {
              onToggleExpand(node.id);
            }
          }
        }}
      >
        {node.id !== 'root' && (
          <div
            className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:text-gray-500 dark:hover:text-gray-300"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </div>
        )}

        {node.type === 'folder' && (
          <button
            type="button"
            className="p-0 text-gray-600 dark:text-gray-300"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {node.type === 'folder' ? (
            isExpanded ? (
              <FolderOpen size={16} className="text-yellow-600 dark:text-yellow-500" />
            ) : (
              <Folder size={16} className="text-yellow-600 dark:text-yellow-500" />
            )
          ) : (
            <CheckSquare size={16} className="text-green-600 dark:text-green-400" />
          )}

          <span className="truncate text-sm text-gray-900 dark:text-gray-100">{node.name}</span>

          <div className="ml-auto flex items-center gap-2 pl-2">
            {statusBadge}
          </div>
        </div>
      </div>

      {node.type === 'folder' && isExpanded &&
        node.children?.map((child) => (
          <TaskTreeNode
            key={child.id}
            node={child}
            level={level + 1}
            expanded={expanded}
            selected={selected}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            onCreate={onCreate}
            onCreateFolder={onCreateFolder}
            onDelete={onDelete}
            onRename={onRename}
            onCopy={onCopy}
            readOnly={readOnly}
            setConfirmModal={setConfirmModal}
          />
        ))}

      {contextMenu && (
        <ContextMenu
          data={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreate={onCreate}
          onCreateFolder={onCreateFolder}
          onDelete={onDelete}
          onRename={onRename}
          onCopy={onCopy}
          setConfirmModal={setConfirmModal}
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
  onExpandAll,
  onCollapseAll,
  onSelect,
  onSelectAll,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onCopy,
  userPermission,
  workspaceSelector,
  searchQuery = '',
  onSearchChange,
  onClearSearch,
  statusFilter: _statusFilter = 'all',
  onStatusFilterChange: _onStatusFilterChange,
  priorityFilter: _priorityFilter = 'all',
  onPriorityFilterChange: _onPriorityFilterChange,
  allTags = [],
  selectedTags = [],
  onTagFilterChange,
  width = 320,
  readOnly,
  onCollapseSidebar,
}) => {
  const { user } = useAuth();
  const currentUserId = useMemo(() => {
    if (user?.id) {
      return String(user.id);
    }
    try {
      const stored = localStorage.getItem('markd_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.id ? String(parsed.id) : null;
    } catch {
      return null;
    }
  }, [user]);

  const [rootContextMenu, setRootContextMenu] = useState<RootContextMenuData | null>(null);
  const [rootInputModal, setRootInputModal] = useState<{
    title: string;
    label: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);
  
  // Flatten tree for Ctrl+A selection
  const flattenTree = useCallback((nodes: Task[], result: Task[] = []): Task[] => {
    for (const node of nodes) {
      if (node.id !== 'root') {
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        flattenTree(node.children, result);
      }
    }
    return result;
  }, []);

  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: 'root-drop-zone',
  });

  const canWrite = !readOnly && (userPermission === 'write' || userPermission === 'admin');
  const clampedWidth = Math.min(Math.max(width, 200), 600);

  const handleRootContext = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!canWrite) return;
    setRootContextMenu({ x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!rootContextMenu) return;
    const close = () => setRootContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [rootContextMenu]);

  // Handle F2 key for renaming, Delete key for deletion, and Ctrl+A for select all
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') ||
        target.closest('.w-md-editor') || // MDEditor wrapper
        target.closest('.w-md-editor-text') || // MDEditor text area
        target.closest('.w-md-editor-text-pre') || // MDEditor pre element
        target.closest('.w-md-editor-text-input') || // MDEditor input
        target.closest('[role="textbox"]') || // Any textbox role
        target.closest('form') // Any form element
      ) {
        return;
      }

      // Ctrl+A: Select all
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        event.stopPropagation();
        if (onSelectAll) {
          onSelectAll();
        }
        return;
      }
      
      // Check if F2 is pressed and at least one element is selected
      if (event.key === 'F2' && selected.length > 0 && onRename) {
        const firstSelected = selected[0];
        if (firstSelected.id !== 'root') {
          event.preventDefault();
          event.stopPropagation();
          setRootInputModal({
            title: 'Renommer',
            label: 'Nouveau nom',
            defaultValue: firstSelected.name,
            onConfirm: (newName) => {
              if (newName.trim()) {
                onRename(firstSelected.id, newName.trim());
              }
              setRootInputModal(null);
            },
          });
        }
      }
      // Check if Delete is pressed and at least one element is selected
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected.length > 0 && onDelete) {
        const firstSelected = selected[0];
        if (firstSelected.id !== 'root') {
          event.preventDefault();
          event.stopPropagation();
          const itemName = firstSelected.name;
          const itemType = firstSelected.type === 'folder' ? 'folder' : 'task';
          const count = selected.length;
          const message = count > 1 
            ? `Are you sure you want to delete ${count} items?`
            : `Are you sure you want to delete "${itemName}"?${firstSelected.type === 'folder' ? ' This will also delete all items inside this folder.' : ''}`;
          setConfirmModal({
            title: count > 1 ? `Delete ${count} items` : `Delete ${itemType}`,
            message,
            variant: 'danger',
            onConfirm: () => {
              // Delete all selected items
              selected.forEach(item => {
                if (item.id !== 'root') {
                  onDelete(item.id);
                }
              });
              setConfirmModal(null);
            },
          });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selected, onRename, onDelete, onSelectAll]);

  return (
    <div
      className="flex h-full flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      style={{ width: `${clampedWidth}px`, minWidth: 200, maxWidth: 600 }}
    >
      <div className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tasks</h2>
          <div className="flex items-center gap-2">
          {userPermission && (
            <span className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium">
              {userPermission === 'admin' ? (
                <>
                  <Shield className="h-3.5 w-3.5 text-red-500 dark:text-red-300" />
                  <span className="text-red-600 dark:text-red-300">Admin</span>
                </>
              ) : userPermission === 'write' ? (
                <>
                  <Edit2 className="h-3.5 w-3.5 text-blue-500 dark:text-blue-300" />
                  <span className="text-blue-600 dark:text-blue-300">Write</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-gray-500 dark:text-gray-300" />
                  <span className="text-gray-600 dark:text-gray-300">Read</span>
                </>
              )}
            </span>
          )}
          {onCollapseSidebar && (
            <button
              onClick={onCollapseSidebar}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title="Hide sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
          </div>
        </div>

        {workspaceSelector && <div className="px-4 pb-3">{workspaceSelector}</div>}

        {onSearchChange && (
          <div className="px-4 pb-3 space-y-3">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search..."
                className="w-full rounded border border-gray-300 px-9 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              />
              {searchQuery && onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="absolute right-2 rounded p-1 text-gray-400 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 relative">
        {/* Expand/Collapse buttons - positioned top right of the tree area */}
        {onExpandAll && onCollapseAll && (
          <div className="absolute top-[14px] right-2 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={onExpandAll}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
              title="Expand all"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
              title="Collapse all"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        )}
        <div className="py-2">
          {tree.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No tasks yet. Right-click or use the button to create one.
            </div>
          ) : (
            tree.map((node) => (
              <TaskTreeNode
                key={node.id}
                node={node}
                level={0}
                expanded={expanded}
                selected={selected}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                onCreate={onCreate}
                onCreateFolder={onCreateFolder}
                onDelete={onDelete}
                onRename={onRename}
                onCopy={onCopy}
                readOnly={!canWrite}
                setConfirmModal={setConfirmModal}
              />
            ))
          )}
        </div>

        <div
          ref={setRootDropRef}
          className={`mx-2 mb-3 flex min-h-[100px] cursor-context-menu flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-center text-sm text-gray-400 transition-colors dark:border-gray-600 dark:text-gray-500 ${
            isRootOver ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-900'
          }`}
          onContextMenu={handleRootContext}
        >
          {isRootOver ? (
            <>
              <div className="mb-1 font-medium">Drop at root</div>
              <div className="text-xs text-blue-500 dark:text-blue-300">The task will be moved here</div>
            </>
          ) : (
            <>
              <div className="mb-1 font-medium">Right-click to create</div>
              <div className="text-xs">task or folder</div>
            </>
          )}
        </div>
      </div>

      {/* Tag filter - sticky at the bottom */}
      {onTagFilterChange && (
        <TagFilter
          allTags={allTags}
          selectedTags={selectedTags}
          onTagFilterChange={onTagFilterChange}
        />
      )}

      {rootContextMenu && (
        <div
          className="fixed z-50 min-w-[170px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          style={{ left: rootContextMenu.x, top: rootContextMenu.y }}
        >
          {onCreate && (
            <button
              type="button"
              onClick={() => {
                setRootInputModal({
                  title: 'New task',
                  label: 'Task name',
                  onConfirm: (value) => {
                    onCreate('root', value);
                    setRootInputModal(null);
                  },
                });
                setRootContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Plus size={14} />
              Add task
            </button>
          )}
          {onCreateFolder && (
            <button
              type="button"
              onClick={() => {
                setRootInputModal({
                  title: 'New folder',
                  label: 'Folder name',
                  onConfirm: (value) => {
                    onCreateFolder('root', value);
                    setRootInputModal(null);
                  },
                });
                setRootContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Folder size={14} />
              Create folder
            </button>
          )}
        </div>
      )}

      {rootInputModal && (
        <InputModal
          isOpen
          title={rootInputModal.title}
          label={rootInputModal.label}
          defaultValue={rootInputModal.defaultValue}
          onConfirm={(value) => {
            rootInputModal.onConfirm(value);
          }}
          onCancel={() => setRootInputModal(null)}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          isOpen
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};

export default TaskTree;

