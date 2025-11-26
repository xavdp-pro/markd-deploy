import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { CheckSquare, Folder, LayoutGrid } from 'lucide-react';
import { Task, SessionState, TaskTimelineItem, TaskComment, TaskTag, TaskAssignee, TaskFile, TaskChecklistItem } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import { useWorkspace } from './contexts/WorkspaceContext';
import TaskTree from './components/TaskTree';
import TaskViewer from './components/TaskViewer';
import TaskEditor from './components/TaskEditor';
import TaskKanbanModal from './components/TaskKanbanModal';

const TASK_SESSION_KEY = 'markd_tasks_session_state';
const TREE_WIDTH_KEY = 'markd_tasks_tree_width';

interface TaskSessionState extends SessionState {
  workspaceId?: string;
}

const loadTaskSessionState = (): TaskSessionState | null => {
  try {
    const raw = window.sessionStorage.getItem(TASK_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Error loading task session state:', error);
    return null;
  }
};

function TasksApp() {
  const { currentWorkspace, userPermission } = useWorkspace();
  const canWrite = userPermission === 'write' || userPermission === 'admin';

  const [tree, setTree] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selected, setSelected] = useState<Task[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem(TREE_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  
  const [timeline, setTimeline] = useState<TaskTimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [taskTags, setTaskTags] = useState<TaskTag[]>([]);
  const [availableTags, setAvailableTags] = useState<TaskTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [responsibleId, setResponsibleId] = useState<number | null>(null);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [isKanbanModalOpen, setIsKanbanModalOpen] = useState(false);
  const [taskTagsMap, setTaskTagsMap] = useState<Record<string, TaskTag[]>>({});
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const prevTreeRef = React.useRef<Task[] | null>(null);

  const getUserId = useCallback((): string => {
    const stored = localStorage.getItem('markd_user');
    if (stored) {
      try { return String(JSON.parse(stored).id); } catch (e) { console.error(e); }
    }
    return `user-${Math.random().toString(36).slice(2, 11)}`;
  }, []);

  const getUserName = useCallback((): string => {
    const stored = localStorage.getItem('markd_user');
    if (stored) {
      try { return JSON.parse(stored).username; } catch (e) { console.error(e); }
    }
    return `User-${Math.random().toString(36).slice(2, 7)}`;
  }, []);

  const filterTree = useCallback(
    (nodes: Task[], query: string, tagIds: string[]): Task[] => {
      const lowered = query.trim().toLowerCase();
      const hasTagFilter = tagIds.length > 0;
      const matchesSearch = (name: string) => !lowered || name.toLowerCase().includes(lowered);
      const matchesStatus = (task: Task) => {
        if (task.type !== 'task') return true;
        const status = (task.status ?? 'todo') as 'todo' | 'doing' | 'done';
        return statusFilter === 'all' || statusFilter === status;
      };
      const matchesPriority = (task: Task) => {
        if (task.type !== 'task') return true;
        const priority = (task.priority ?? 'medium') as 'low' | 'medium' | 'high';
        return priorityFilter === 'all' || priorityFilter === priority;
      };
      const matchesTags = (task: Task) => {
        if (!hasTagFilter || task.type !== 'task') return true;
        const taskTagIds = (taskTagsMap[task.id] || []).map(t => t.id);
        return tagIds.some(tagId => taskTagIds.includes(tagId));
      };
      const applyFilter = (node: Task): Task | null => {
        const nameMatches = matchesSearch(node.name);
        const filtersMatch = matchesStatus(node) && matchesPriority(node) && matchesTags(node);
        if (node.type === 'folder' && node.children) {
          const filteredChildren = node.children.map(applyFilter).filter((c): c is Task => c !== null);
          if (filteredChildren.length > 0) return { ...node, children: filteredChildren };
          if (nameMatches && filtersMatch) return { ...node, children: [] };
        } else if (nameMatches && filtersMatch) {
          return node;
        }
        return null;
      };
      return nodes.map(applyFilter).filter((n): n is Task => n !== null);
    },
    [statusFilter, priorityFilter, taskTagsMap]
  );

  const filteredTree = useMemo(() => filterTree(tree, searchQuery, selectedTags), [tree, filterTree, searchQuery, selectedTags]);

  const activeNode = useMemo(() => {
    if (!activeId) return null;
    const findNode = (nodes: Task[]): Task | null => {
      for (const node of nodes) {
        if (node.id === activeId) return node;
        if (node.children) { const f = findNode(node.children); if (f) return f; }
      }
      return null;
    };
    return findNode(tree);
  }, [activeId, tree]);

  const refreshTaskActivity = useCallback(async (taskId: string) => {
    setTimelineLoading(true); setCommentsLoading(true);
    try {
      const [tl, cm] = await Promise.all([api.getTaskTimeline(taskId), api.getTaskComments(taskId)]);
      setTimeline(tl.timeline); setComments(cm.comments);
    } catch (e) { console.error(e); }
    finally { setTimelineLoading(false); setCommentsLoading(false); }
  }, []);

  const refreshTaskTags = useCallback(async (taskId: string) => {
    try { const r = await api.getTaskTags(taskId); setTaskTags(r.tags); } catch (e) { console.error(e); }
  }, []);

  const refreshTaskAssignees = useCallback(async (taskId: string) => {
    try { const r = await api.getTaskAssignees(taskId); setAssignees(r.assignees); setResponsibleId(r.responsible_id ?? null); } catch (e) { console.error(e); }
  }, []);

  const refreshTaskFiles = useCallback(async (taskId: string) => {
    setFilesLoading(true);
    try { const r = await api.getTaskFiles(taskId); setFiles(r.files); } catch (e) { console.error(e); }
    finally { setFilesLoading(false); }
  }, []);

  const refreshTaskChecklist = useCallback(async (_taskId: string) => { setChecklistItems([]); }, []);

  const refreshTree = useCallback(async () => {
    try { const r = await api.getTasksTree(currentWorkspace); setTree(r.tree); prevTreeRef.current = r.tree; } catch (e) { console.error(e); }
  }, [currentWorkspace]);

  useEffect(() => {
    const loadData = async () => {
      await refreshTree();
      const ss = loadTaskSessionState();
      if (ss && (!ss.workspaceId || ss.workspaceId === currentWorkspace)) {
        setExpanded(ss.expandedNodes || { root: true });
        if (ss.selectedId) {
          try {
            const r = await api.getTask(ss.selectedId);
            if (r.success) {
              setSelected([r.task]); setEditContent(r.task.content || '');
              await Promise.all([refreshTaskActivity(r.task.id), refreshTaskTags(r.task.id), refreshTaskAssignees(r.task.id), refreshTaskFiles(r.task.id), refreshTaskChecklist(r.task.id)]);
            }
          } catch (e) { setSelected([]); }
        }
      }
    };
    loadData();
  }, [currentWorkspace, refreshTree, refreshTaskActivity, refreshTaskTags, refreshTaskAssignees, refreshTaskFiles, refreshTaskChecklist]);

  const loadAllTaskTags = useCallback(async () => {
    try { const r = await api.getTaskTagSuggestions('', 100); if (r.success) setAvailableTags(r.tags); } catch (e) { console.error(e); }
  }, []);

  const loadTaskTags = useCallback(async (taskId: string) => {
    if (taskTagsMap[taskId]) return;
    try { const r = await api.getTaskTags(taskId); if (r.success) setTaskTagsMap(p => ({ ...p, [taskId]: r.tags })); } catch (e) { console.error(e); }
  }, [taskTagsMap]);

  useEffect(() => { if (currentWorkspace) { loadAllTaskTags(); setSelectedTags([]); } }, [currentWorkspace, loadAllTaskTags]);

  useEffect(() => {
    if (tree.length > 0) {
      const loadTagsForTasks = async (nodes: Task[]) => {
        for (const n of nodes) {
          if (n.type === 'task' && !taskTagsMap[n.id]) await loadTaskTags(n.id);
          if (n.children) await loadTagsForTasks(n.children);
        }
      };
      loadTagsForTasks(tree);
    }
  }, [tree, taskTagsMap, loadTaskTags]);

  const handleToggleExpand = useCallback((id: string) => { setExpanded(p => ({ ...p, [id]: !p[id] })); }, []);
  const handleExpandAll = useCallback(() => {
    const expandAll = (nodes: Task[], acc: Record<string, boolean> = {}) => { nodes.forEach(n => { if (n.type === 'folder' && n.children) { acc[n.id] = true; expandAll(n.children, acc); } }); return acc; };
    setExpanded({ root: true, ...expandAll(tree) });
  }, [tree]);
  const handleCollapseAll = useCallback(() => { setExpanded({ root: true }); }, []);

  const handleSelectTask = useCallback((task: Task) => {
    setSelected([task]);
    if (task.type === 'task') {
      setEditContent(task.content || '');
      refreshTaskActivity(task.id); refreshTaskTags(task.id); refreshTaskAssignees(task.id); refreshTaskFiles(task.id); refreshTaskChecklist(task.id);
    }
  }, [refreshTaskActivity, refreshTaskTags, refreshTaskAssignees, refreshTaskFiles, refreshTaskChecklist]);

  const handleSelectAll = useCallback(() => { setSelected(tree); }, [tree]);

  const handleCreateTask = useCallback(async (parentId: string, name: string) => {
    try {
      const r = await api.createTask({ name, type: 'task', parent_id: parentId, content: '', workspace_id: currentWorkspace, status: 'todo', priority: 'medium' });
      if (r.success) { toast.success('Tâche créée'); setPendingSelection(r.task.id); await refreshTree(); }
    } catch (e) { toast.error('Erreur création tâche'); }
  }, [currentWorkspace, refreshTree]);

  const handleCreateFolder = useCallback(async (parentId: string, name: string) => {
    try {
      const r = await api.createTask({ name, type: 'folder', parent_id: parentId, workspace_id: currentWorkspace });
      if (r.success) { toast.success('Dossier créé'); setPendingSelection(r.task.id); await refreshTree(); }
    } catch (e) { toast.error('Erreur création dossier'); }
  }, [currentWorkspace, refreshTree]);

  const handleDelete = useCallback(async (id: string) => {
    try { await api.deleteTask(id); toast.success('Supprimé'); setSelected(p => p.filter(t => t.id !== id)); await refreshTree(); } catch (e) { toast.error('Erreur suppression'); }
  }, [refreshTree]);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try { await api.updateTask(id, { name: newName }); toast.success('Renommé'); await refreshTree(); } catch (e) { toast.error('Erreur renommage'); }
  }, [refreshTree]);

  const handleCopy = useCallback(async (id: string) => {
    try { await api.copyTask(id); toast.success('Copié'); await refreshTree(); } catch (e) { toast.error('Erreur copie'); }
  }, [refreshTree]);

  const handleForceUnlock = useCallback(async (id: string) => {
    try { await api.unlockTask(id, 'force'); toast.success('Déverrouillé'); await refreshTree(); } catch (e) { toast.error('Erreur déverrouillage'); }
  }, [refreshTree]);

  const handleDragStart = useCallback((event: DragStartEvent) => { setActiveId(event.active.id as string); }, []);
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    try { await api.moveTask(active.id as string, over.id as string); toast.success('Déplacé'); await refreshTree(); } catch (e) { toast.error('Erreur déplacement'); }
  }, [refreshTree]);

  const handleClearSearch = useCallback(() => { setSearchQuery(''); setExpanded({ root: true }); }, []);
  const handleMouseDown = useCallback(() => { setIsResizing(true); }, []);

  const handleKanbanStatusChange = useCallback(async (taskId: string, status: string) => {
    try { await api.updateTask(taskId, { status }); await refreshTree(); toast.success('Statut mis à jour'); } catch (e) { toast.error('Erreur mise à jour statut'); }
  }, [refreshTree]);

  const handleSave = useCallback(async () => {
    if (selected.length === 0) return;
    try { await api.updateTask(selected[0].id, { content: editContent }); await api.unlockTask(selected[0].id, getUserId()); setEditMode(false); toast.success('Enregistré'); refreshTree(); } catch (e) { toast.error('Erreur enregistrement'); }
  }, [selected, editContent, getUserId, refreshTree]);

  const handleCancel = useCallback(async () => {
    if (selected.length === 0) return;
    try { await api.unlockTask(selected[0].id, getUserId()); setEditMode(false); setEditContent(selected[0].content || ''); } catch (e) { console.error(e); }
  }, [selected, getUserId]);

  const handleEdit = useCallback(async () => {
    if (selected.length === 0) return;
    try {
      const r = await api.lockTask(selected[0].id, getUserId(), getUserName());
      if (r.success) { setEditMode(true); setEditContent(selected[0].content || ''); } else { toast.error('Verrouillé par un autre utilisateur'); }
    } catch (e) { toast.error('Erreur verrouillage'); }
  }, [selected, getUserId, getUserName]);

  const updateTaskField = async (field: string, value: any) => {
    if (selected.length === 0) return;
    try { await api.updateTask(selected[0].id, { [field]: value }); setSelected(p => p.map(t => t.id === selected[0].id ? { ...t, [field]: value } : t)); refreshTree(); toast.success('Mis à jour'); } catch (e) { toast.error('Erreur mise à jour'); }
  };
  const handleStatusChange = (s: string) => updateTaskField('status', s);
  const handlePriorityChange = (p: string) => updateTaskField('priority', p);
  const handleDueDateChange = (d: string | null) => updateTaskField('due_date', d);

  const handleAddTag = async (name: string) => {
    if (selected.length === 0) return;
    try { const r = await api.updateTaskTags(selected[0].id, [...taskTags.map(t => t.name), name]); setTaskTags(r.tags); toast.success('Tag ajouté'); } catch (e) { toast.error('Erreur ajout tag'); }
  };
  const handleRemoveTag = async (tagId: string) => {
    if (selected.length === 0) return;
    try { const r = await api.updateTaskTags(selected[0].id, taskTags.filter(t => t.id !== tagId).map(t => t.name)); setTaskTags(r.tags); toast.success('Tag supprimé'); } catch (e) { toast.error('Erreur suppression tag'); }
  };
  const handleAssignmentsChange = async (assigneeIds: number[], respId: number | null) => {
    if (selected.length === 0) return;
    try { const r = await api.updateTaskAssignees(selected[0].id, { assignee_ids: assigneeIds, responsible_id: respId }); setAssignees(r.assignees); setResponsibleId(r.responsible_id ?? null); toast.success('Assignations mises à jour'); } catch (e) { toast.error('Erreur mise à jour assignations'); }
  };
  const handleAddTimelineEntry = async (entry: { title: string; description?: string }) => {
    if (selected.length === 0) return;
    try { const r = await api.addTaskTimelineEntry(selected[0].id, entry); setTimeline(p => [r.entry, ...p]); toast.success('Entrée ajoutée'); } catch (e) { toast.error('Erreur ajout entrée timeline'); }
  };
  const handleAddComment = async (content: string) => {
    if (selected.length === 0) return;
    try { const r = await api.addTaskComment(selected[0].id, { content }); setComments(p => [...p, r.comment]); toast.success('Commentaire ajouté'); } catch (e) { toast.error('Erreur ajout commentaire'); }
  };
  const handleUploadFile = async (file: File) => {
    if (selected.length === 0) return;
    try { const r = await api.uploadTaskFile(selected[0].id, file); setFiles(p => [r.file, ...p]); toast.success('Fichier uploadé'); } catch (e) { toast.error('Erreur upload'); }
  };
  const handleDeleteFile = async (fileId: string) => {
    if (selected.length === 0) return;
    try { await api.deleteTaskFile(selected[0].id, fileId); setFiles(p => p.filter(f => f.id !== fileId)); toast.success('Fichier supprimé'); } catch (e) { toast.error('Erreur suppression fichier'); }
  };
  const handleUpdateFileNote = async (fileId: string, note: string) => {
    if (selected.length === 0) return;
    try { await api.updateTaskFileNote(selected[0].id, fileId, note); setFiles(p => p.map(f => f.id === fileId ? { ...f, markdown_note: note } : f)); toast.success('Note mise à jour'); } catch (e) { toast.error('Erreur mise à jour note'); }
  };
  const handleAddChecklistItem = async (text: string) => {
    if (selected.length === 0) return;
    try { const r = await api.addTaskChecklistItem(selected[0].id, text); setChecklistItems(p => [...p, r.item]); toast.success('Item ajouté'); } catch (e) { toast.error('Erreur ajout item'); }
  };
  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    if (selected.length === 0) return;
    try { await api.updateTaskChecklistItem(selected[0].id, itemId, { completed }); setChecklistItems(p => p.map(i => i.id === itemId ? { ...i, completed } : i)); } catch (e) { toast.error('Erreur mise à jour item'); }
  };
  const handleDeleteChecklistItem = async (itemId: string) => {
    if (selected.length === 0) return;
    try { await api.deleteTaskChecklistItem(selected[0].id, itemId); setChecklistItems(p => p.filter(i => i.id !== itemId)); toast.success('Item supprimé'); } catch (e) { toast.error('Erreur suppression item'); }
  };
  const handleUpdateChecklistItem = async (itemId: string, text: string) => {
    if (selected.length === 0) return;
    try { await api.updateTaskChecklistItem(selected[0].id, itemId, { text }); setChecklistItems(p => p.map(i => i.id === itemId ? { ...i, text } : i)); toast.success('Item mis à jour'); } catch (e) { toast.error('Erreur mise à jour item'); }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { if (!isResizing) return; const w = e.clientX; if (w >= 200 && w <= 600) setTreeWidth(w); };
    const handleMouseUp = () => { setIsResizing(false); localStorage.setItem(TREE_WIDTH_KEY, treeWidth.toString()); };
    if (isResizing) { document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp); }
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizing, treeWidth]);

  useEffect(() => {
    websocket.connect();
    const unsub1 = websocket.onTaskTreeChanged(async () => { await refreshTree(); });
    const unsub2 = websocket.onTaskLockUpdate((taskId, lockInfo) => {
      setTree(p => { const upd = (nodes: Task[]): Task[] => nodes.map(n => n.id === taskId ? { ...n, locked_by: lockInfo } : n.children ? { ...n, children: upd(n.children) } : n); return upd(p); });
      setSelected(p => p.map(t => t.id === taskId ? { ...t, locked_by: lockInfo } : t));
    });
    const unsub3 = websocket.onTaskActivityUpdate((taskId) => { if (selected.some(s => s.id === taskId)) { refreshTaskActivity(taskId); refreshTaskTags(taskId); refreshTaskAssignees(taskId); refreshTaskFiles(taskId); refreshTaskChecklist(taskId); } });
    return () => { unsub1(); unsub2(); unsub3(); websocket.disconnect(); };
  }, [refreshTree, refreshTaskActivity, refreshTaskTags, refreshTaskAssignees, refreshTaskFiles, refreshTaskChecklist, selected]);

  // Auto-select pending item
  useEffect(() => {
    if (pendingSelection && tree.length > 0) {
      const find = (nodes: Task[], id: string): Task | null => { for (const n of nodes) { if (n.id === id) return n; if (n.children) { const f = find(n.children, id); if (f) return f; } } return null; };
      const node = find(tree, pendingSelection);
      if (node) { handleSelectTask(node); setPendingSelection(null); }
    }
  }, [pendingSelection, tree, handleSelectTask]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full bg-gray-50 dark:bg-gray-900" style={{ cursor: isResizing ? 'col-resize' : activeId ? 'grabbing' : 'default' }}>
        <div className="flex flex-col" style={{ width: treeWidth }}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <button onClick={() => setIsKanbanModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm font-medium text-blue-700 transition-all hover:from-blue-100 hover:to-indigo-100 hover:shadow-md dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-400 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30" title="Ouvrir la vue Kanban">
              <LayoutGrid size={18} /> Vue Kanban
            </button>
          </div>
          <TaskTree tree={filteredTree} expanded={expanded} selected={selected} onToggleExpand={handleToggleExpand} onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} onSelect={handleSelectTask} onSelectAll={handleSelectAll} onCreate={canWrite ? handleCreateTask : undefined} onCreateFolder={canWrite ? handleCreateFolder : undefined} onDelete={canWrite ? handleDelete : undefined} onRename={canWrite ? handleRename : undefined} onCopy={handleCopy} userPermission={userPermission} searchQuery={searchQuery} onSearchChange={setSearchQuery} onClearSearch={handleClearSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter} allTags={availableTags} selectedTags={selectedTags} onTagFilterChange={setSelectedTags} onUnlock={canWrite ? handleForceUnlock : undefined} width={treeWidth} readOnly={userPermission === 'read'} />
        </div>
        <div className="w-1 cursor-col-resize bg-gray-300 transition-colors hover:bg-blue-500 dark:bg-gray-700" onMouseDown={handleMouseDown} />
        {selected.length > 0 ? (
          editMode ? (
            <div className="flex flex-1 flex-col">
              <TaskEditor task={selected[0]} content={editContent} onContentChange={setEditContent} onSave={handleSave} onCancel={handleCancel} onStatusChange={handleStatusChange} onPriorityChange={handlePriorityChange} onDueDateChange={handleDueDateChange} tags={taskTags} availableTags={availableTags} onAddTag={canWrite ? handleAddTag : undefined} onRemoveTag={canWrite ? handleRemoveTag : undefined} assignees={assignees} responsibleId={responsibleId} onAssigneesChange={canWrite ? handleAssignmentsChange : undefined} workspaceId={currentWorkspace} />
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <TaskViewer task={selected[0]} onEdit={handleEdit} canEdit={selected[0].type === 'task' && canWrite} lockedByOther={Boolean(selected[0].locked_by && selected[0].locked_by.user_id !== getUserId())} onStatusChange={handleStatusChange} onPriorityChange={handlePriorityChange} onDueDateChange={handleDueDateChange} tags={taskTags} availableTags={availableTags} onAddTag={canWrite ? handleAddTag : undefined} onRemoveTag={canWrite ? handleRemoveTag : undefined} assignees={assignees} responsibleId={responsibleId} onAssigneesChange={canWrite ? handleAssignmentsChange : undefined} workspaceId={currentWorkspace} timeline={timeline} timelineLoading={timelineLoading} onAddTimelineEntry={canWrite ? handleAddTimelineEntry : undefined} comments={comments} commentsLoading={commentsLoading} onAddComment={canWrite ? handleAddComment : undefined} canCollaborate={canWrite} files={files} filesLoading={filesLoading} onUploadFile={canWrite ? handleUploadFile : undefined} onDeleteFile={canWrite ? handleDeleteFile : undefined} onUpdateFileNote={canWrite ? handleUpdateFileNote : undefined} checklistItems={checklistItems} checklistLoading={checklistLoading} onAddChecklistItem={canWrite ? handleAddChecklistItem : undefined} onToggleChecklistItem={canWrite ? handleToggleChecklistItem : undefined} onDeleteChecklistItem={canWrite ? handleDeleteChecklistItem : undefined} onUpdateChecklistItem={canWrite ? handleUpdateChecklistItem : undefined} />
            </div>
          )
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center"><CheckSquare size={48} className="mx-auto mb-3 opacity-60" /><p className="text-lg">Select a task to get started</p></div>
          </div>
        )}
      </div>
      <TaskKanbanModal isOpen={isKanbanModalOpen} onClose={() => setIsKanbanModalOpen(false)} tasks={filteredTree} onSelectTask={handleSelectTask} onStatusChange={canWrite ? handleKanbanStatusChange : undefined} />
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-xl dark:border-gray-600 dark:bg-gray-800">
            {activeNode.type === 'folder' ? <Folder size={16} className="text-yellow-600 dark:text-yellow-400" /> : <CheckSquare size={16} className="text-green-600 dark:text-green-400" />}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{activeNode.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default TasksApp;
