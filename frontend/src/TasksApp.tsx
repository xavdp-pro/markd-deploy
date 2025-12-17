import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { CheckSquare, Folder, LayoutGrid } from 'lucide-react';
import { Task, SessionState, TaskTimelineItem, TaskComment, TaskTag, TaskAssignee, TaskFile, TaskChecklistItem } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import { useWorkspace } from './contexts/WorkspaceContext';
import { useAuth } from './contexts/AuthContext';
import TaskTree from './components/TaskTree';
import TaskViewer from './components/TaskViewer';
import TaskEditor from './components/TaskEditor';
import TaskKanbanModal from './components/TaskKanbanModal';
import { getHashSelection, setHashSelection, onHashChange } from './utils/urlHash';

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
  const { user } = useAuth();
  const { currentWorkspace, userPermission } = useWorkspace();
  const canWrite = userPermission === 'write' || userPermission === 'admin';

  const [tree, setTree] = useState<Task[]>([]);
  const [presence, setPresence] = useState<Record<string, Array<{ id: string; username: string }>>>({});
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
  const [checklistLoading, _setChecklistLoading] = useState(false);
  const [isKanbanModalOpen, setIsKanbanModalOpen] = useState(false);
  const [taskTagsMap, setTaskTagsMap] = useState<Record<string, TaskTag[]>>({});
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const prevTreeRef = React.useRef<Task[] | null>(null);
  const processingHashRef = React.useRef<boolean>(false);
  const prevSelectedIdsRef = React.useRef<string>('');
  const isRestoringRef = React.useRef<boolean>(false);
  const treeRef = React.useRef<Task[]>([]);
  const selectedRef = React.useRef<Task[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

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

  const refreshTaskChecklist = useCallback(async (taskId: string) => {
    try {
      const r = await api.getTaskChecklist(taskId);
      if (r.success) {
        setChecklistItems(r.items);
      }
    } catch (e) {
      console.error('Error loading checklist:', e);
      setChecklistItems([]);
    }
  }, []);

  // Save selected tasks to sessionStorage and URL hash
  const saveSelectedTasks = useCallback((selectedIds: string[]) => {
    // Don't save if we're currently restoring from hash
    if (isRestoringRef.current) {
      return;
    }
    
    try {
      const idsString = selectedIds.sort().join(',');
      // Avoid saving if selection hasn't changed
      if (prevSelectedIdsRef.current === idsString) {
        return;
      }
      prevSelectedIdsRef.current = idsString;
      
      if (selectedIds.length > 0) {
        setHashSelection('task', selectedIds);
        sessionStorage.setItem('markd_tasks_selected_ids', JSON.stringify(selectedIds));
      } else {
        setHashSelection('task', []);
        sessionStorage.removeItem('markd_tasks_selected_ids');
      }
    } catch (error) {
      console.error('Error saving selected tasks:', error);
    }
  }, []);

  const refreshTree = useCallback(async () => {
    try {
      // Preserve current selection before refresh
      const selectedIds = selectedRef.current.map(s => s.id);
      
      const r = await api.getTasksTree(currentWorkspace);
      setTree(r.tree);
      prevTreeRef.current = r.tree;
      treeRef.current = r.tree;
      
      // Restore selection after refresh
      if (selectedIds.length > 0 && r.tree.length > 0) {
        const findItem = (nodes: Task[], targetId: string): Task | null => {
          for (const node of nodes) {
            if (node.id === targetId) return node;
            if (node.children) {
              const found = findItem(node.children, targetId);
              if (found) return found;
            }
          }
          return null;
        };
        
        const foundItems: Task[] = [];
        for (const id of selectedIds) {
          const item = findItem(r.tree, id);
          if (item) foundItems.push(item);
        }
        
        // Only update selection if we found at least one item
        if (foundItems.length > 0) {
          setSelected(foundItems);
        } else if (selectedIds.length > 0) {
          // Items were deleted, clear selection
          setSelected([]);
        }
      }
    } catch (e) { 
      console.error(e); 
    }
  }, [currentWorkspace]);

  // Load selected tasks from sessionStorage or hash
  const loadSelectedTasks = useCallback(async (selectedIds: string[], treeData: Task[]) => {
    if (selectedIds.length === 0 || treeData.length === 0) {
      return;
    }
    
    // Find all selected items
    const foundItems: Task[] = [];
    const pathsToExpand: string[][] = [];
    
    const findItemWithPath = (nodes: Task[], targetId: string, path: string[] = []): Task | null => {
      for (const node of nodes) {
        const newPath = [...path, node.id];
        if (node.id === targetId) {
          pathsToExpand.push(newPath);
          return node;
        }
        if (node.children) {
          const found = findItemWithPath(node.children, targetId, newPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Find all selected items
    for (const id of selectedIds) {
      const item = findItemWithPath(treeData, id);
      if (item) {
        foundItems.push(item);
      }
    }
    
    if (foundItems.length === 0) {
      // No items found, clear saved selection
      saveSelectedTasks([]);
      return;
    }
    
    // Expand all parent folders first
    const sessionState = loadTaskSessionState();
    const newExpanded: Record<string, boolean> = sessionState?.expandedNodes || { root: true };
    pathsToExpand.forEach(path => {
      for (let i = 0; i < path.length - 1; i++) {
        newExpanded[path[i]] = true;
      }
    });
    setExpanded(newExpanded);
    
    // Set flag to prevent saving during restoration
    isRestoringRef.current = true;
    
    // Wait a bit for expansion to render, then select
    setTimeout(async () => {
      const firstTask = foundItems.find(item => item.type === 'task');
      if (firstTask) {
        setSelected([firstTask]);
        setEditContent(firstTask.content || '');
        await Promise.all([
          refreshTaskActivity(firstTask.id),
          refreshTaskTags(firstTask.id),
          refreshTaskAssignees(firstTask.id),
          refreshTaskFiles(firstTask.id),
          refreshTaskChecklist(firstTask.id)
        ]);
      } else {
        setSelected(foundItems);
      }
      
      // Reset flag after a short delay
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 200);
    }, 100);
  }, [refreshTaskActivity, refreshTaskTags, refreshTaskAssignees, refreshTaskFiles, refreshTaskChecklist, saveSelectedTasks]);

  useEffect(() => {
    const loadData = async () => {
      await refreshTree();
      const ss = loadTaskSessionState();
      if (ss && (!ss.workspaceId || ss.workspaceId === currentWorkspace)) {
        setExpanded(ss.expandedNodes || { root: true });
      }
      
      // Restore selected tasks (try URL hash first, then sessionStorage, then fallback)
      let selectedIds: string[] = getHashSelection('task');
      
      // Fallback to sessionStorage if no hash
      if (selectedIds.length === 0) {
        const savedSelectedIdsJson = sessionStorage.getItem('markd_tasks_selected_ids');
        
        if (savedSelectedIdsJson) {
          try {
            selectedIds = JSON.parse(savedSelectedIdsJson);
            // Update hash with sessionStorage value (only if different)
            const currentHashIds = getHashSelection('task');
            if (JSON.stringify(currentHashIds.sort()) !== JSON.stringify(selectedIds.sort())) {
              setHashSelection('task', selectedIds);
            }
          } catch (e) {
            console.error('Error parsing saved selected IDs:', e);
          }
        }
      }
      
      // Fallback to single selection if no multi-selection saved
      if (selectedIds.length === 0 && ss?.selectedId) {
        selectedIds = [ss.selectedId];
        const currentHashIds = getHashSelection('task');
        if (JSON.stringify(currentHashIds) !== JSON.stringify(selectedIds)) {
          setHashSelection('task', selectedIds);
        }
      }
      
      if (selectedIds.length > 0) {
        // Use ref to get latest tree value without causing re-renders
        await loadSelectedTasks(selectedIds, treeRef.current);
      }
    };
    loadData();
  }, [currentWorkspace, refreshTree, loadSelectedTasks]);

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
      // Save to hash and sessionStorage (skip if already processing from hash)
      if (!processingHashRef.current && !isRestoringRef.current) {
        saveSelectedTasks([task.id]);
      }
      setEditContent(task.content || '');
      refreshTaskActivity(task.id); refreshTaskTags(task.id); refreshTaskAssignees(task.id); refreshTaskFiles(task.id); refreshTaskChecklist(task.id);
    }
  }, [refreshTaskActivity, refreshTaskTags, refreshTaskAssignees, refreshTaskFiles, refreshTaskChecklist, saveSelectedTasks]);

  const handleSelectAll = useCallback(() => { setSelected(tree); }, [tree]);

  const expandToAndSelect = useCallback(async (id: string, treeDataLocal: Task[]) => {
    const findPath = (nodes: Task[], targetId: string, path: string[] = []): string[] | null => {
      for (const n of nodes) {
        const newPath = [...path, n.id];
        if (n.id === targetId) return newPath;
        if (n.children) {
          const p = findPath(n.children, targetId, newPath);
          if (p) return p;
        }
      }
      return null;
    };
    const path = findPath(treeDataLocal, id);
    if (path) {
      setExpanded(prev => {
        const next: Record<string, boolean> = { ...prev };
        for (let i = 0; i < path.length - 1; i++) {
          next[path[i]] = true;
        }
        return next;
      });
      const node = (() => {
        const walk = (nodes: Task[]): Task | null => {
          for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
              const f = walk(n.children);
              if (f) return f;
            }
          }
          return null;
        };
        return walk(treeDataLocal);
      })();
      if (node) handleSelectTask(node);
    }
  }, [handleSelectTask]);

  // Listen to hash changes (when navigating back to this module)
  useEffect(() => {
    const cleanup = onHashChange((selections) => {
      const hashIds = selections.task;
      // Use refs to get latest values without causing re-renders
      const currentTree = treeRef.current;
      const currentSelected = selectedRef.current;
      
      if (hashIds.length > 0 && currentTree.length > 0) {
        // Check if selection is already correct to avoid loop
        const currentIds = currentSelected.map(s => s.id).sort().join(',');
        const hashIdsString = hashIds.sort().join(',');
        if (currentIds === hashIdsString) {
          return; // Already selected, no need to restore
        }
        
        // Set flag to prevent saving during restoration
        isRestoringRef.current = true;
        processingHashRef.current = true;
        loadSelectedTasks(hashIds, currentTree).then(() => {
          // Reset flags after restoration
          setTimeout(() => {
            isRestoringRef.current = false;
            processingHashRef.current = false;
          }, 200);
        });
      }
    });
    
    return cleanup;
  }, [loadSelectedTasks]);
  
  // Save selected tasks when selection changes
  useEffect(() => {
    if (selected.length > 0) {
      const taskIds = selected.filter(t => t.type === 'task').map(t => t.id);
      if (taskIds.length > 0) {
        saveSelectedTasks(taskIds);
      }
    } else {
      saveSelectedTasks([]);
    }
  }, [selected, saveSelectedTasks]);

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

  const handleUnlock = useCallback(async () => {
    if (selected.length !== 1) return;
    const task = selected[0];
    
    // Use user from context or fallback to local helper
    const userId = user?.id ? String(user.id) : getUserId();
    
    try {
      await api.unlockTask(task.id, userId);
      toast.success('Verrou retiré');
    } catch (e) {
      console.error(e);
      toast.error('Impossible de retirer le verrou');
    }
  }, [selected, user, getUserId]);

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
  const handleAssignmentsChange = async (assigneeIds: number[], respId?: number) => {
    if (selected.length === 0) return;
    try { const r = await api.updateTaskAssignees(selected[0].id, { assignee_ids: assigneeIds, responsible_id: respId ?? null }); setAssignees(r.assignees); setResponsibleId(r.responsible_id ?? null); toast.success('Assignations mises à jour'); } catch (e) { toast.error('Erreur mise à jour assignations'); }
  };
  const handleAddTimelineEntry = async (entry: { title: string; description?: string }) => {
    if (selected.length === 0) return;
    try {
      const r = await api.addTaskTimelineEntry(selected[0].id, entry);
      setTimeline(p => [r.entry, ...p]);
      toast.success('Note ajoutée');
      return r; // Return the result so TaskTimeline can access entry.id
    } catch (e) {
      toast.error('Erreur ajout note');
      throw e;
    }
  };
  const handleAddComment = async (content: string) => {
    if (selected.length === 0) return;
    try {
      // Create comment with content (file links should already be included in content)
      const r = await api.addTaskComment(selected[0].id, { content });
      setComments(p => [...p, r.comment]);
      toast.success('Commentaire ajouté');
    } catch (e) {
      toast.error('Erreur ajout commentaire');
      throw e;
    }
  };
  const handleUpdateComment = async (commentId: string, content: string) => {
    if (selected.length === 0) return;
    try {
      const r = await api.updateTaskComment(selected[0].id, commentId, { content });
      setComments(p => p.map(c => c.id === commentId ? r.comment : c));
      toast.success('Commentaire modifié');
    } catch (e) {
      toast.error('Erreur modification commentaire');
      throw e;
    }
  };
  const handleUpdateTimelineEntry = async (entryId: string, data: { title?: string; description?: string }) => {
    if (selected.length === 0) return;
    try {
      const r = await api.updateTaskTimelineEntry(selected[0].id, entryId, data);
      setTimeline(p => p.map(t => t.id === entryId ? r.entry : t));
      toast.success('Note modifiée');
    } catch (e) {
      toast.error('Erreur modification note');
      throw e;
    }
  };
  const handleDeleteComment = async (commentId: string) => {
    if (selected.length === 0) return;
    try {
      await api.deleteTaskComment(selected[0].id, commentId);
      setComments(p => p.filter(c => c.id !== commentId));
      toast.success('Commentaire supprimé');
    } catch (e) {
      toast.error('Erreur suppression commentaire');
      throw e;
    }
  };
  const handleDeleteTimelineEntry = async (entryId: string) => {
    if (selected.length === 0) return;
    try {
      await api.deleteTaskTimelineEntry(selected[0].id, entryId);
      setTimeline(p => p.filter(t => t.id !== entryId));
      toast.success('Entrée supprimée');
    } catch (e) {
      toast.error('Erreur suppression entrée');
      throw e;
    }
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

    const unsubPresence = websocket.onPresenceUpdate((docId, users) => {
      setPresence(prev => ({ ...prev, [docId]: users }));
    });

    const unsub1 = websocket.onTaskTreeChanged(async () => { await refreshTree(); });
    const unsub2 = websocket.onTaskLockUpdate((taskId, lockInfo) => {
      setTree(p => { const upd = (nodes: Task[]): Task[] => nodes.map(n => n.id === taskId ? { ...n, locked_by: lockInfo } : n.children ? { ...n, children: upd(n.children) } : n); return upd(p); });
      setSelected(p => p.map(t => t.id === taskId ? { ...t, locked_by: lockInfo } : t));
    });
    const unsub3 = websocket.onTaskActivityUpdate((taskId) => {
      // Use ref to check selection without causing re-renders
      if (selectedRef.current.some(s => s.id === taskId)) {
        refreshTaskActivity(taskId);
        refreshTaskTags(taskId);
        refreshTaskAssignees(taskId);
        refreshTaskFiles(taskId);
        refreshTaskChecklist(taskId);
      }
    });
    return () => { unsubPresence(); unsub1(); unsub2(); unsub3(); websocket.disconnect(); };
  }, [refreshTree, refreshTaskActivity, refreshTaskTags, refreshTaskAssignees, refreshTaskFiles, refreshTaskChecklist]);

  // Presence join/leave
  useEffect(() => {
    if (!user) return;
    // Use ref to check selection without causing re-renders
    const taskId = selectedRef.current.length === 1 ? selectedRef.current[0].id : null;
    if (taskId) websocket.joinDocument(taskId); // Reusing document logic for tasks presence
    return () => { if (taskId) websocket.leaveDocument(taskId); };
  }, [user]);

  // Heartbeat
  useEffect(() => {
    // Use ref to check selection without causing re-renders
    if (!editMode || selectedRef.current.length !== 1) return;
    const task = selectedRef.current[0];
    const userId = user?.id ? String(user.id) : getUserId();
    if (task.locked_by?.user_id && String(task.locked_by.user_id) === userId) {
      api.heartbeatTask(task.id).catch(console.error);
      const i = setInterval(() => api.heartbeatTask(task.id).catch(console.error), 120000);
      return () => clearInterval(i);
    }
  }, [editMode, user, getUserId]);

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
              <TaskViewer task={selected[0]} onEdit={handleEdit} canEdit={selected[0].type === 'task' && canWrite} lockedByOther={Boolean(selected[0].locked_by && selected[0].locked_by.user_id !== getUserId())} onStatusChange={handleStatusChange} onPriorityChange={handlePriorityChange} onDueDateChange={handleDueDateChange} tags={taskTags} availableTags={availableTags} onAddTag={canWrite ? handleAddTag : undefined} onRemoveTag={canWrite ? handleRemoveTag : undefined} assignees={assignees} responsibleId={responsibleId} onAssigneesChange={canWrite ? handleAssignmentsChange : undefined} workspaceId={currentWorkspace} timeline={timeline} timelineLoading={timelineLoading} onAddTimelineEntry={canWrite ? handleAddTimelineEntry : undefined} comments={comments} commentsLoading={commentsLoading} onAddComment={canWrite ? handleAddComment : undefined} canCollaborate={canWrite} files={files} filesLoading={filesLoading} onUploadFile={canWrite ? handleUploadFile : undefined} onDeleteFile={canWrite ? handleDeleteFile : undefined} onUpdateFileNote={canWrite ? handleUpdateFileNote : undefined} checklistItems={checklistItems} checklistLoading={checklistLoading} onAddChecklistItem={canWrite ? handleAddChecklistItem : undefined} onToggleChecklistItem={canWrite ? handleToggleChecklistItem : undefined} onDeleteChecklistItem={canWrite ? handleDeleteChecklistItem : undefined}                 onUpdateChecklistItem={canWrite ? handleUpdateChecklistItem : undefined}
                presenceUsers={presence[selected[0].id]}
                onUnlock={handleUnlock}
                isEditing={false}
                currentUserId={user?.id || null}
                taskId={selected[0].id}
                onUpdateTimelineEntry={canWrite ? handleUpdateTimelineEntry : undefined}
                onDeleteTimelineEntry={canWrite ? handleDeleteTimelineEntry : undefined}
                onUpdateComment={canWrite ? handleUpdateComment : undefined}
                onDeleteComment={canWrite ? handleDeleteComment : undefined}
              />
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
