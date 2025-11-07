import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Task } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import TaskTree from './components/TaskTree';
import TaskViewer from './components/TaskViewer';
import TaskEditor from './components/TaskEditor';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { useAuth } from './contexts/AuthContext';
import { CheckSquare, Folder } from 'lucide-react';

function getUserInfo() {
  const storedUser = localStorage.getItem('markd_user');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    return { id: user.id, name: user.username };
  }
  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    name: `User-${Math.random().toString(36).substr(2, 5)}`
  };
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  user_permission?: string;
}

function App() {
  const [tree, setTree] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selected, setSelected] = useState<Task | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem('markd_tasks_tree_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('default');
  const [workspaceName, setWorkspaceName] = useState<string>('Tasks');
  const [userPermission, setUserPermission] = useState<string>('read');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const filterTree = useCallback((nodes: Task[], query: string): Task[] => {
    if (!query.trim()) return nodes;
    
    const lowerQuery = query.toLowerCase();
    
    const filterNode = (node: Task): Task | null => {
      const nameMatches = node.name.toLowerCase().includes(lowerQuery);
      
      if (node.type === 'folder' && node.children) {
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter((child): child is Task => child !== null);
        
        if (nameMatches || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren
          };
        }
      } else if (nameMatches) {
        return node;
      }
      
      return null;
    };
    
    return nodes
      .map(node => filterNode(node))
      .filter((node): node is Task => node !== null);
  }, []);
  
  useEffect(() => {
    if (searchQuery.trim()) {
      const expandAll = (nodes: Task[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
        nodes.forEach(node => {
          if (node.type === 'folder') {
            acc[node.id] = true;
            if (node.children) {
              expandAll(node.children, acc);
            }
          }
        });
        return acc;
      };
      
      const filteredTree = filterTree(tree, searchQuery);
      setExpanded({ root: true, ...expandAll(filteredTree) });
    }
  }, [searchQuery, tree, filterTree]);
  
  const filteredTree = filterTree(tree, searchQuery);
  
  const getUserId = useCallback(() => {
    const storedUser = localStorage.getItem('markd_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return String(user.id);
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
    return `user-${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  const getUserName = useCallback(() => {
    const storedUser = localStorage.getItem('markd_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return user.username || `User-${Math.random().toString(36).substr(2, 5)}`;
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
    return `User-${Math.random().toString(36).substr(2, 5)}`;
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      loadTree();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    websocket.connect();

    const unsubscribeTreeChanged = websocket.onTreeChanged(() => {
      loadTree();
    });

    const unsubscribeLockUpdate = websocket.onLockUpdate((taskId, lockInfo) => {
      setTree(prevTree => {
        const updateLock = (nodes: Task[]): Task[] => {
          return nodes.map(node => {
            if (node.id === taskId) {
              return { ...node, locked_by: lockInfo };
            }
            if (node.children) {
              return { ...node, children: updateLock(node.children) };
            }
            return node;
          });
        };
        return updateLock(prevTree);
      });
    });

    return () => {
      unsubscribeTreeChanged();
      unsubscribeLockUpdate();
    };
  }, []);

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        const accessible = data.workspaces.filter((ws: any) => ws.user_permission && ws.user_permission !== 'none');
        setWorkspaces(accessible);
        if (accessible.length > 0) {
          setCurrentWorkspace(accessible[0].id);
          setWorkspaceName(accessible[0].name);
          setUserPermission(accessible[0].user_permission);
        }
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des workspaces');
    }
  };

  const loadTree = async () => {
    setLoading(true);
    try {
      const response = await api.getTasksTree(currentWorkspace);
      setTree(response.tree);
      if (response.workspace_name) {
        setWorkspaceName(response.workspace_name);
      }
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (parentId: string, name: string) => {
    try {
      await api.createTask({
        name,
        type: 'task',
        parent_id: parentId,
        content: '',
        workspace_id: currentWorkspace,
        status: 'todo',
        priority: 'medium'
      });
      
      toast.success('Tâche créée');
      loadTree();
      if (parentId !== 'root') {
        setExpanded(prev => ({ ...prev, [parentId]: true }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleCreateFolder = async (parentId: string, name: string) => {
    try {
      await api.createTask({
        name,
        type: 'folder',
        parent_id: parentId,
        workspace_id: currentWorkspace
      });
      
      toast.success('Dossier créé');
      loadTree();
      if (parentId !== 'root') {
        setExpanded(prev => ({ ...prev, [parentId]: true }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTask(id);
      toast.success('Tâche supprimée');
      loadTree();
      if (selected?.id === id) {
        setSelected(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      await api.updateTask(id, { name: newName });
      toast.success('Renommé');
      loadTree();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await api.copyTask(id);
      toast.success('Tâche dupliquée');
      loadTree();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    try {
      await api.moveTask(active.id as string, over.id as string);
      loadTree();
      toast.success('Tâche déplacée');
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const handleToggle = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (task: Task) => {
    setSelected(task);
    setEditMode(false);
  };

  const handleEdit = async () => {
    if (!selected || selected.type === 'folder') return;

    try {
      const userId = getUserId();
      const userName = getUserName();
      
      const result = await api.lockTask(selected.id, userId, userName);
      
      if (result.success) {
        setEditMode(true);
        setEditContent(selected.content || '');
      } else {
        toast.error(result.message || 'Impossible de verrouiller');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const handleSave = async () => {
    if (!selected) return;

    try {
      await api.updateTask(selected.id, { content: editContent });
      
      const userId = getUserId();
      await api.unlockTask(selected.id, userId);
      
      setEditMode(false);
      toast.success('Sauvegardé');
      loadTree();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const handleCancel = async () => {
    if (!selected) return;

    try {
      const userId = getUserId();
      await api.unlockTask(selected.id, userId);
      setEditMode(false);
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const handleUnlock = async (id: string) => {
    try {
      const userId = getUserId();
      await api.unlockTask(id, userId);
      toast.success('Déverrouillé');
      loadTree();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const workspaceSelector = (
    <select
      value={currentWorkspace}
      onChange={e => {
        const ws = workspaces.find(w => w.id === e.target.value);
        if (ws) {
          setCurrentWorkspace(ws.id);
          setWorkspaceName(ws.name);
          setUserPermission(ws.user_permission || 'read');
          setSelected(null);
          setEditMode(false);
        }
      }}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 text-sm"
    >
      {workspaces.map(ws => (
        <option key={ws.id} value={ws.id}>{ws.name}</option>
      ))}
    </select>
  );

  const handleResize = useCallback((e: MouseEvent) => {
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 600) {
      setTreeWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleResize, handleMouseUp]);

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      <DndContext onDragEnd={handleDragEnd}>
        {/* Task Tree */}
        <div
          style={{ width: `${treeWidth}px` }}
          className="flex-shrink-0 relative"
        >
          <TaskTree
            tree={filteredTree}
            expanded={expanded}
            selected={selected}
            onToggleExpand={handleToggle}
            onSelect={handleSelect}
            onCreate={handleCreate}
            onCreateFolder={handleCreateFolder}
            onDelete={handleDelete}
            onRename={handleRename}
            onCopy={handleCopy}
            onUnlock={handleUnlock}
            readOnly={userPermission === 'read'}
            userPermission={userPermission}
            workspaceSelector={workspaceSelector}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={() => {
              setSearchQuery('');
              setExpanded({ root: true });
            }}
          />
          
          {/* Resize handle */}
          <div
            onMouseDown={() => setIsResizing(true)}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 ${
              isResizing ? 'bg-blue-500' : ''
            }`}
          />
        </div>

        {/* Task Viewer/Editor */}
        <div className="flex-1 overflow-hidden">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <CheckSquare size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg">Sélectionnez une tâche</p>
              </div>
            </div>
          ) : editMode ? (
            <TaskEditor
              task={selected}
              content={editContent}
              onContentChange={setEditContent}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          ) : (
            <TaskViewer
              task={selected}
              onEdit={handleEdit}
              canEdit={selected.type === 'task' && userPermission !== 'read'}
              lockedByOther={selected.locked_by && selected.locked_by.user_id !== getUserId()}
            />
          )}
        </div>
      </DndContext>
    </div>
  );
}

export default App;
