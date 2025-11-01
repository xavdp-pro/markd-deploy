import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Document } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import { sessionStorageService } from './services/sessionStorage';
import DocumentTree from './components/DocumentTree';
import DocumentViewer from './components/DocumentViewer';
import DocumentEditor from './components/DocumentEditor';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useAuth } from './contexts/AuthContext';
import { File, Folder } from 'lucide-react';

// Get user info from auth context
function getUserInfo() {
  const storedUser = localStorage.getItem('markd_user');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    return { id: user.id, name: user.username };
  }
  // Fallback for non-authenticated users
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
  const [tree, setTree] = useState<Document[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selected, setSelected] = useState<Document | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem('markd_tree_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('default');
  const [workspaceName, setWorkspaceName] = useState<string>('Documents');
  const [userPermission, setUserPermission] = useState<string>('read');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Filter tree based on search query - Show results in their hierarchy
  const filterTree = useCallback((nodes: Document[], query: string): Document[] => {
    if (!query.trim()) return nodes;
    
    const lowerQuery = query.toLowerCase();
    
    const filterNode = (node: Document): Document | null => {
      const nameMatches = node.name.toLowerCase().includes(lowerQuery);
      
      if (node.type === 'folder' && node.children) {
        // Filter children recursively
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter((child): child is Document => child !== null);
        
        // Keep folder if it matches OR has matching children
        if (nameMatches || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren
          };
        }
      } else if (nameMatches) {
        // Keep file if it matches
        return node;
      }
      
      return null;
    };
    
    return nodes
      .map(node => filterNode(node))
      .filter((node): node is Document => node !== null);
  }, []);
  
  // Auto-expand folders when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const expandAll = (nodes: Document[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
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
  
  // Clear search and collapse tree
  const handleClearSearch = () => {
    setSearchQuery('');
    setExpanded({ root: true }); // Collapse all except root
  };
  
  // Get user info dynamically
  const getUserId = useCallback(() => {
    const storedUser = localStorage.getItem('markd_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        console.log('User ID from localStorage:', user.id);
        return String(user.id);
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
    const fallbackId = `user-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Using fallback user ID:', fallbackId);
    return fallbackId;
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

  // Load workspaces
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const response = await fetch('/api/workspaces', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setWorkspaces(data.workspaces);
          // Set permission for current workspace
          const currentWs = data.workspaces.find((ws: Workspace) => ws.id === currentWorkspace);
          if (currentWs) {
            setUserPermission(currentWs.user_permission || 'read');
          }
        }
      } catch (err) {
        console.error('Error loading workspaces:', err);
      }
    };
    loadWorkspaces();
  }, [currentWorkspace]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load tree from API with workspace
        const result = await api.getTree(currentWorkspace);
        setTree(result.tree);
        if (result.workspace_name) {
          setWorkspaceName(result.workspace_name);
        }

        // Load session state
        const sessionState = sessionStorageService.loadState();
        if (sessionState) {
          setExpanded(sessionState.expandedNodes);
          
          // Restore tree width if exists
          const savedWidth = localStorage.getItem('markd_tree_width');
          if (savedWidth) {
            setTreeWidth(parseInt(savedWidth, 10));
          }
          
          // Restore selected document if exists
          if (sessionState.selectedId) {
            const docResult = await api.getDocument(sessionState.selectedId);
            if (docResult.success) {
              setSelected(docResult.document);
              setEditContent(docResult.document.content || '');
            }
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentWorkspace]);

  // Setup WebSocket connection
  useEffect(() => {
    websocket.connect();

    const unsubscribeTreeChanged = websocket.onTreeChanged(async () => {
      // Reload current workspace when tree changes
      try {
        const result = await api.getTree(currentWorkspace);
        setTree(result.tree);
        if (result.workspace_name) {
          setWorkspaceName(result.workspace_name);
        }
      } catch (err) {
        console.error('Error reloading tree:', err);
      }
    });

    const unsubscribeLock = websocket.onLockUpdate((documentId, lockInfo) => {
      // Update tree with new lock info
      setTree(prevTree => {
        const updateLock = (docs: Document[]): Document[] => {
          return docs.map(doc => {
            if (doc.id === documentId) {
              return { ...doc, locked_by: lockInfo };
            }
            if (doc.children) {
              return { ...doc, children: updateLock(doc.children) };
            }
            return doc;
          });
        };
        return updateLock(prevTree);
      });

      // Update selected document if it's the one being locked/unlocked
      if (selected?.id === documentId) {
        setSelected(prev => prev ? { ...prev, locked_by: lockInfo } : null);
      }
    });

    return () => {
      unsubscribeTreeChanged();
      unsubscribeLock();
      websocket.disconnect();
    };
  }, [currentWorkspace, selected]);

  // Save session state when it changes
  useEffect(() => {
    sessionStorageService.saveState({
      expandedNodes: expanded,
      selectedId: selected?.id || null,
    });
  }, [expanded, selected]);

  // Handle resizing
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setTreeWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save width to localStorage when resizing ends
      localStorage.setItem('markd_tree_width', treeWidth.toString());
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, treeWidth]);

  // Handlers
  const handleToggleExpand = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSelectDocument = useCallback(async (doc: Document) => {
    if (doc.type === 'file') {
      try {
        // If currently in edit mode, unlock the previous document
        if (editMode && selected) {
          const userId = getUserId();
          await api.unlockDocument(selected.id, userId);
          setEditMode(false);
        }

        // Get full document with latest content
        const result = await api.getDocument(doc.id);
        if (result.success) {
          setSelected(result.document);
          setEditContent(result.document.content || '');
          setEditMode(false);
        }
      } catch (err) {
        console.error('Error loading document:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
      }
    }
  }, [editMode, selected, getUserId]);

  const handleCreateDocument = useCallback(async (parentId: string, name: string) => {
    try {
      await api.createDocument({
        name: name.endsWith('.md') ? name : `${name}.md`,
        type: 'file',
        parent_id: parentId,
        content: `# ${name}\n\nNew document.`,
        workspace_id: currentWorkspace,
      });
    } catch (err) {
      console.error('Error creating document:', err);
      setError(err instanceof Error ? err.message : 'Failed to create document');
    }
  }, [currentWorkspace]);

  const handleCreateFolder = useCallback(async (parentId: string, name: string) => {
    try {
      await api.createDocument({
        name,
        type: 'folder',
        parent_id: parentId,
        workspace_id: currentWorkspace,
      });
    } catch (err) {
      console.error('Error creating folder:', err);
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  }, [currentWorkspace]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.deleteDocument(id);
      if (selected?.id === id) {
        setSelected(null);
        setEditMode(false);
      }
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [selected]);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try {
      await api.updateDocument(id, { name: newName });
    } catch (err) {
      console.error('Error renaming:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  }, []);

  const handleCopy = useCallback(async (id: string) => {
    try {
      await api.copyDocument(id);
    } catch (err) {
      console.error('Error copying:', err);
      setError(err instanceof Error ? err.message : 'Failed to copy');
    }
  }, []);

  const handleDownload = useCallback((doc: Document) => {
    if (doc.type === 'file' && doc.content) {
      const blob = new Blob([doc.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleUpload = useCallback(async (parentId: string, file: File) => {
    try {
      const content = await file.text();
      await api.createDocument({
        name: file.name,
        type: 'file',
        parent_id: parentId,
        content,
      });
    } catch (err) {
      console.error('Error uploading:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload');
    }
  }, []);

  const handleStartEdit = useCallback(async () => {
    if (!selected) return;

    try {
      const userId = getUserId();
      const userName = getUserName();
      
      // Check if document is already locked by current user
      if (selected.locked_by && String(selected.locked_by.user_id) === String(userId)) {
        // User already owns the lock, allow editing
        console.log('Document already locked by current user, allowing edit');
        setEditMode(true);
        setEditContent(selected.content || '');
        websocket.notifyEditing(selected.id, userName);
        return;
      }
      
      // Try to lock the document
      console.log('Locking document with:', { userId, userName, documentId: selected.id });
      const result = await api.lockDocument(selected.id, userId, userName);
      
      if (result.success) {
        setEditMode(true);
        setEditContent(selected.content || '');
        websocket.notifyEditing(selected.id, userName);
      } else {
        toast.error(`Document verrouillé par ${result.locked_by?.user_name || 'un autre utilisateur'}`);
      }
    } catch (err) {
      console.error('Error locking document:', err);
      setError(err instanceof Error ? err.message : 'Failed to lock document');
    }
  }, [selected, getUserId, getUserName]);

  const handleSaveEdit = useCallback(async () => {
    if (!selected) return;

    try {
      await api.updateDocument(selected.id, { content: editContent });
      const userId = getUserId();
      await api.unlockDocument(selected.id, userId);
      
      setSelected(prev => prev ? { ...prev, content: editContent, locked_by: null } : null);
      setEditMode(false);
    } catch (err) {
      console.error('Error saving document:', err);
      setError(err instanceof Error ? err.message : 'Failed to save document');
    }
  }, [selected, editContent, getUserId]);

  const handleCancelEdit = useCallback(async () => {
    if (!selected) return;

    try {
      const userId = getUserId();
      await api.unlockDocument(selected.id, userId);
      setEditContent(selected.content || '');
      setEditMode(false);
    } catch (err) {
      console.error('Error canceling edit:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }, [selected, getUserId]);

  const handleForceUnlock = useCallback(async (id: string) => {
    try {
      await api.forceUnlockDocument(id);
      
      // Update tree to remove lock
      setTree(prevTree => {
        const updateLock = (docs: Document[]): Document[] => {
          return docs.map(doc => {
            if (doc.id === id) {
              return { ...doc, locked_by: null };
            }
            if (doc.children) {
              return { ...doc, children: updateLock(doc.children) };
            }
            return doc;
          });
        };
        return updateLock(prevTree);
      });

      // Update selected document if it's the one being unlocked
      if (selected?.id === id) {
        setSelected(prev => prev ? { ...prev, locked_by: null } : null);
      }
      
      toast.success('Document déverrouillé avec succès');
    } catch (err) {
      console.error('Error force unlocking:', err);
      toast.error('Échec du déverrouillage du document');
    }
  }, [selected]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    try {
      // Check if dropping on a folder
      const findNode = (nodes: Document[], id: string): Document | null => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const activeNode = findNode(tree, active.id as string);
      
      // Check if dropping on root zone
      if (over.id === 'root-drop-zone' && activeNode) {
        const result = await api.moveDocument(active.id as string, 'root');
        if (result.success) {
          toast.success(`"${activeNode.name}" déplacé à la racine`);
          // Refresh tree with current workspace
          const treeResult = await api.getTree(currentWorkspace);
          setTree(treeResult.tree);
        } else {
          toast.error('Impossible de déplacer le document');
        }
        return;
      }
      
      // Check if dropping on a folder
      const targetNode = findNode(tree, over.id as string);
      if (targetNode && targetNode.type === 'folder' && activeNode) {
        const result = await api.moveDocument(active.id as string, targetNode.id);
        if (result.success) {
          toast.success(`"${activeNode.name}" déplacé vers "${targetNode.name}"`);
          // Refresh tree with current workspace
          const treeResult = await api.getTree(currentWorkspace);
          setTree(treeResult.tree);
        } else {
          toast.error('Impossible de déplacer le document');
        }
      }
    } catch (err) {
      console.error('Error moving document:', err);
      toast.error('Erreur lors du déplacement');
    }
  }, [tree, currentWorkspace]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  // Get active node for drag overlay
  const findNode = (nodes: Document[], id: string): Document | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  
  const activeNode = activeId ? findNode(tree, activeId) : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div 
        className="flex h-full bg-gray-50 dark:bg-gray-900" 
        style={{ 
          cursor: isResizing ? 'col-resize' : (activeId ? 'grabbing' : 'default') 
        }}
      >
        <div className="flex flex-col" style={{ width: treeWidth }}>
          <DocumentTree
            tree={filteredTree}
            expanded={expanded}
            selected={selected}
            onToggleExpand={handleToggleExpand}
            onSelect={handleSelectDocument}
            onCreate={userPermission !== 'read' ? handleCreateDocument : undefined}
            onCreateFolder={userPermission !== 'read' ? handleCreateFolder : undefined}
            onDelete={userPermission !== 'read' ? handleDelete : undefined}
            onRename={userPermission !== 'read' ? handleRename : undefined}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onUpload={userPermission !== 'read' ? handleUpload : undefined}
            onUnlock={userPermission === 'admin' ? handleForceUnlock : undefined}
            width={treeWidth}
            readOnly={userPermission === 'read'}
            userPermission={userPermission}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={handleClearSearch}
            workspaceSelector={
              <select
                value={currentWorkspace}
                onChange={(e) => setCurrentWorkspace(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            }
          />
        </div>
        
        {/* Resizer handle */}
        <div
          className="w-1 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors relative group"
          onMouseDown={handleMouseDown}
          style={{ userSelect: 'none' }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 group-hover:opacity-20" />
        </div>

        {selected ? (
          editMode ? (
            <>
              <div className="flex-1 flex flex-col border-r">
                <DocumentViewer
                  document={{...selected, content: editContent}}
                  onEdit={handleStartEdit}
                  currentUserId={getUserId()}
                />
              </div>
              <div className="flex-1 flex flex-col">
                <DocumentEditor
                  document={selected}
                  content={editContent}
                  onContentChange={setEditContent}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <DocumentViewer
                document={selected}
                onEdit={handleStartEdit}
                currentUserId={getUserId()}
              />
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <p className="text-lg">Select a document to view</p>
            </div>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl px-4 py-2 flex items-center gap-2 cursor-grabbing">
            {activeNode.type === 'folder' ? (
              <Folder size={16} className="text-yellow-600 dark:text-yellow-500" />
            ) : (
              <File size={16} className="text-blue-600 dark:text-blue-400" />
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{activeNode.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;