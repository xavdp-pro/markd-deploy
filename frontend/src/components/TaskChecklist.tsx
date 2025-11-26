import React, { useState } from 'react';
import { Check, Plus, Trash2, GripVertical, Loader2, ListChecks } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskChecklistItem } from '../types';

interface TaskChecklistProps {
  items: TaskChecklistItem[];
  loading?: boolean;
  canEdit?: boolean;
  onAddItem?: (text: string) => Promise<void>;
  onToggleItem?: (itemId: string, completed: boolean) => Promise<void>;
  onDeleteItem?: (itemId: string) => Promise<void>;
  onUpdateItem?: (itemId: string, text: string) => Promise<void>;
  onReorderItems?: (items: TaskChecklistItem[]) => Promise<void>;
}

// Sortable Item Component
interface SortableItemProps {
  item: TaskChecklistItem;
  canEdit: boolean;
  editingId: string | null;
  editingText: string;
  submitting: boolean;
  onToggle: (itemId: string, completed: boolean) => void;
  onDelete: (itemId: string) => void;
  onStartEdit: (item: TaskChecklistItem) => void;
  onSaveEdit: (itemId: string) => void;
  onCancelEdit: () => void;
  setEditingText: (text: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  canEdit,
  editingId,
  editingText,
  submitting,
  onToggle,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  setEditingText,
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
      className={`group flex items-start gap-3 rounded-lg border p-3 transition-all ${
        item.completed
          ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
          : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800'
      }`}
    >
      {/* Drag Handle */}
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-300 opacity-0 transition-opacity hover:text-gray-400 group-hover:opacity-100 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-500"
          title="Réorganiser"
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
        {item.completed && <Check size={14} strokeWidth={3} />}
      </button>

      {/* Text */}
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
              Annuler
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {/* Delete Button */}
      {canEdit && editingId !== item.id && (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={submitting}
          className="rounded-md p-1 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Supprimer"
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
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localItems, setLocalItems] = useState<TaskChecklistItem[]>(items);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update local items when props change
  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

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
          // Revert on error
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

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p>Chargement de la checklist...</p>
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
            {localItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
                  <ListChecks size={24} className="text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Aucune sous-tâche</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {canEdit ? 'Ajoutez des sous-tâches pour décomposer cette tâche.' : 'Aucune sous-tâche pour cette tâche.'}
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localItems.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {localItems
                      .sort((a, b) => a.order - b.order)
                      .map((item) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          canEdit={canEdit}
                          editingId={editingId}
                          editingText={editingText}
                          submitting={submitting}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onStartEdit={handleStartEdit}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={handleCancelEdit}
                          setEditingText={setEditingText}
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
              placeholder="Ajouter une sous-tâche..."
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-500"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={!newItemText.trim() || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Ajouter
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TaskChecklist;
