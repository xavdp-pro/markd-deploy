import React, { useState, useEffect, useRef } from 'react';
import { Check, Plus, Trash2, GripVertical, Loader2, ListChecks, User as UserIcon, X, ChevronRight, CornerDownRight } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskChecklistItem, User } from '../types';

interface TaskChecklistProps {
  items: TaskChecklistItem[];
  loading?: boolean;
  canEdit?: boolean;
  onAddItem?: (text: string, assignedTo?: number | null, parentId?: string | null) => Promise<void>;
  onToggleItem?: (itemId: string, completed: boolean) => Promise<void>;
  onDeleteItem?: (itemId: string) => Promise<void>;
  onUpdateItem?: (itemId: string, text: string) => Promise<void>;
  onReorderItems?: (items: TaskChecklistItem[]) => Promise<void>;
  onUpdateAssignee?: (itemId: string, userId: number | null) => Promise<void>;
  onUpdateParent?: (itemId: string, parentId: string | null) => Promise<void>;
  workspaceId?: string;
}

// Inline assignee picker (compact dropdown)
const AssigneePicker: React.FC<{
  currentUserId: number | null;
  currentUsername: string | null;
  users: User[];
  onSelect: (userId: number | null) => void;
  disabled?: boolean;
}> = ({ currentUserId, currentUsername, users, onSelect, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        disabled={disabled}
        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
          currentUserId
            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800'
        } ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
        title={currentUserId ? `Assigned to ${currentUsername}` : 'Assign to...'}
      >
        <UserIcon size={12} />
        {currentUsername ? <span className="max-w-[80px] truncate">{currentUsername}</span> : null}
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {/* Unassign option */}
          {currentUserId && (
            <button
              type="button"
              onClick={() => { onSelect(null); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X size={12} /> Unassign
            </button>
          )}
          {users.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onSelect(u.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                u.id === currentUserId
                  ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <UserIcon size={12} />
              <span className="truncate">{u.username}</span>
              {u.id === currentUserId && <Check size={12} className="ml-auto text-blue-500" />}
            </button>
          ))}
          {users.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No users available</div>
          )}
        </div>
      )}
    </div>
  );
};

// Sortable Item Component
interface SortableItemProps {
  item: TaskChecklistItem;
  isChild: boolean;
  canEdit: boolean;
  editingId: string | null;
  editingText: string;
  submitting: boolean;
  users: User[];
  rootItems: TaskChecklistItem[];
  onToggle: (itemId: string, completed: boolean) => void;
  onDelete: (itemId: string) => void;
  onStartEdit: (item: TaskChecklistItem) => void;
  onSaveEdit: (itemId: string) => void;
  onCancelEdit: () => void;
  setEditingText: (text: string) => void;
  onAssigneeChange?: (itemId: string, userId: number | null) => void;
  onMakeChild?: (itemId: string, parentId: string) => void;
  onMakeRoot?: (itemId: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  isChild,
  canEdit,
  editingId,
  editingText,
  submitting,
  users,
  rootItems,
  onToggle,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  setEditingText,
  onAssigneeChange,
  onMakeChild,
  onMakeRoot,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-lg border p-3 transition-all ${
        isChild ? 'ml-8' : ''
      } ${
        item.completed
          ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
          : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800'
      }`}
    >
      {/* Child indicator */}
      {isChild && (
        <CornerDownRight size={14} className="mt-1 flex-shrink-0 text-gray-300 dark:text-gray-600" />
      )}

      {/* Drag Handle */}
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-300 opacity-0 transition-opacity hover:text-gray-400 group-hover:opacity-100 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-500"
          title="Reorder"
        >
          <GripVertical size={16} />
        </button>
      )}

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(item.id, item.completed)}
        disabled={!canEdit}
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
          item.completed
            ? 'border-blue-500 bg-blue-500 text-white'
            : 'border-gray-300 bg-white hover:border-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-blue-500'
        } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {item.completed ? <Check size={14} strokeWidth={3} /> : null}
      </button>

      {/* Text + Assignee */}
      <div className="min-w-0 flex-1">
        {editingId === item.id ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(item.id);
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="flex-1 rounded border border-blue-500 bg-white px-2 py-1 text-sm text-gray-900 outline-none dark:bg-gray-700 dark:text-gray-100"
              autoFocus
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => onSaveEdit(item.id)}
              disabled={submitting}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={submitting}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p
              onClick={() => canEdit && onStartEdit(item)}
              className={`text-sm ${
                item.completed
                  ? 'text-gray-400 line-through dark:text-gray-500'
                  : 'text-gray-900 dark:text-gray-100'
              } ${canEdit ? 'cursor-text' : ''}`}
            >
              {item.text}
            </p>
            {/* Assignee badge */}
            {onAssigneeChange && canEdit ? (
              <AssigneePicker
                currentUserId={item.assigned_to}
                currentUsername={item.assigned_username}
                users={users}
                onSelect={(userId) => onAssigneeChange(item.id, userId)}
              />
            ) : item.assigned_username ? (
              <span className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <UserIcon size={10} /> {item.assigned_username}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Indent / Unindent buttons */}
      {canEdit && editingId !== item.id && !isChild && rootItems.length > 0 && (
        <button
          type="button"
          onClick={() => {
            // Find previous root item to make this a child of
            const rootIdx = rootItems.findIndex(r => r.id === item.id);
            if (rootIdx > 0 && onMakeChild) {
              onMakeChild(item.id, rootItems[rootIdx - 1].id);
            }
          }}
          disabled={submitting || rootItems.findIndex(r => r.id === item.id) === 0}
          className="rounded-md p-1 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 disabled:opacity-0 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title="Make sub-item"
        >
          <ChevronRight size={14} />
        </button>
      )}
      {canEdit && editingId !== item.id && isChild && onMakeRoot && (
        <button
          type="button"
          onClick={() => onMakeRoot(item.id)}
          disabled={submitting}
          className="rounded-md p-1 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title="Move to root level"
        >
          <CornerDownRight size={14} className="rotate-180" />
        </button>
      )}

      {/* Delete Button */}
      {canEdit && editingId !== item.id && (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={submitting}
          className="rounded-md p-1 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

const TaskChecklist: React.FC<TaskChecklistProps> = ({
  items,
  loading = false,
  canEdit = false,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onUpdateItem,
  onReorderItems,
  onUpdateAssignee,
  onUpdateParent,
  workspaceId = 'demo',
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localItems, setLocalItems] = useState<TaskChecklistItem[]>(items);
  const [users, setUsers] = useState<User[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load workspace users for assignee picker
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/users`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Error loading users:', err);
      }
    };
    loadUsers();
  }, [workspaceId]);

  // Update local items when props change
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Build tree: root items + their children
  const rootItems = localItems.filter(i => !i.parent_id).sort((a, b) => a.order - b.order);
  const childrenOf = (parentId: string) =>
    localItems.filter(i => i.parent_id === parentId).sort((a, b) => a.order - b.order);

  // Flat ordered list for rendering: parent then its children
  const orderedItems: Array<{ item: TaskChecklistItem; isChild: boolean }> = [];
  for (const root of rootItems) {
    orderedItems.push({ item: root, isChild: false });
    for (const child of childrenOf(root.id)) {
      orderedItems.push({ item: child, isChild: true });
    }
  }
  // Also include orphaned children (parent deleted) as root
  const allChildIds = new Set(localItems.filter(i => i.parent_id).map(i => i.id));
  const parentIds = new Set(rootItems.map(i => i.id));
  for (const item of localItems) {
    if (item.parent_id && !parentIds.has(item.parent_id)) {
      orderedItems.push({ item, isChild: false });
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(localItems, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order: index,
      }));
      setLocalItems(newItems);
      if (onReorderItems) {
        try {
          await onReorderItems(newItems);
        } catch (err) {
          console.error('Failed to reorder items:', err);
          setLocalItems(items);
        }
      }
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !onAddItem) return;
    try {
      setSubmitting(true);
      await onAddItem(newItemText.trim());
      setNewItemText('');
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (itemId: string, completed: boolean) => {
    if (!onToggleItem) return;
    try {
      await onToggleItem(itemId, !completed);
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!onDeleteItem) return;
    try {
      setSubmitting(true);
      await onDeleteItem(itemId);
    } catch (err) {
      console.error('Failed to delete checklist item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item: TaskChecklistItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!editingText.trim() || !onUpdateItem) {
      setEditingId(null);
      return;
    }
    try {
      setSubmitting(true);
      await onUpdateItem(itemId, editingText.trim());
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update checklist item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleAssigneeChange = async (itemId: string, userId: number | null) => {
    if (!onUpdateAssignee) return;
    try {
      await onUpdateAssignee(itemId, userId);
    } catch (err) {
      console.error('Failed to update assignee:', err);
    }
  };

  const handleMakeChild = async (itemId: string, parentId: string) => {
    if (!onUpdateParent) return;
    try {
      await onUpdateParent(itemId, parentId);
    } catch (err) {
      console.error('Failed to set parent:', err);
    }
  };

  const handleMakeRoot = async (itemId: string) => {
    if (!onUpdateParent) return;
    try {
      await onUpdateParent(itemId, null);
    } catch (err) {
      console.error('Failed to unset parent:', err);
    }
  };

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Loading checklist...</p>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            {totalCount > 0 && (
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Progression
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {completedCount}/{totalCount} ({Math.round(progressPercentage)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Checklist Items */}
            {orderedItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
                  <ListChecks size={24} className="text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">No subtasks</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {canEdit ? 'Add subtasks to break down this task.' : 'No subtasks for this task.'}
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedItems.map(o => o.item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {orderedItems.map(({ item, isChild }) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        isChild={isChild}
                        canEdit={canEdit}
                        editingId={editingId}
                        editingText={editingText}
                        submitting={submitting}
                        users={users}
                        rootItems={rootItems}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onStartEdit={handleStartEdit}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit}
                        setEditingText={setEditingText}
                        onAssigneeChange={onUpdateAssignee ? handleAssigneeChange : undefined}
                        onMakeChild={onUpdateParent ? handleMakeChild : undefined}
                        onMakeRoot={onUpdateParent ? handleMakeRoot : undefined}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </div>

      {/* Add New Item */}
      {canEdit && onAddItem && (
        <div className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add a subtask..."
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-500"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={!newItemText.trim() || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TaskChecklist;
