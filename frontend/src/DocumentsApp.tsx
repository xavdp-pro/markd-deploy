import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Document, Tag } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import { sessionStorageService } from './services/sessionStorage';
import { useWorkspace } from './contexts/WorkspaceContext';
import DocumentTree from './components/DocumentTree';
import DocumentViewer from './components/DocumentViewer';
import DocumentEditor from './components/DocumentEditor';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { File, Folder, X, Trash2 } from 'lucide-react';

function App() {
  const { currentWorkspace, userPermission, loading: workspaceLoading } = useWorkspace();
  const [tree, setTree] = useState<Document[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selected, setSelected] = useState<Document[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [documentTags, setDocumentTags] = useState<Record<string, Tag[]>>({});
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const prevTreeRef = React.useRef<Document[] | null>(null);
  const lastLocalChangeAtRef = React.useRef<number>(0);
  
  // Load all tags for filter
  const loadAllTags = useCallback(async () => {
    try {
      const result = await api.getDocumentTagSuggestions('', 100);
      if (result.success) {
        setAllTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, []);
  
  // Load tags for a document
  const loadDocumentTags = useCallback(async (documentId: string) => {
    if (documentTags[documentId]) return; // Already loaded
    try {
      const result = await api.getDocumentTags(documentId);
      if (result.success) {
        setDocumentTags(prev => ({ ...prev, [documentId]: result.tags }));
      }
    } catch (error) {
      console.error('Error loading document tags:', error);
    }
  }, [documentTags]);
  
  // Filter tree based on search query and tags - Show results in their hierarchy
  const filterTree = useCallback((nodes: Document[], query: string, tagIds: string[]): Document[] => {
    const lowerQuery = query.trim().toLowerCase();
    const hasTagFilter = tagIds.length > 0;
    
    const filterNode = (node: Document): Document | null => {
      const nameMatches = !lowerQuery || node.name.toLowerCase().includes(lowerQuery);
      
      // Check tag filter for files
      let tagMatches = true;
      if (hasTagFilter && node.type === 'file') {
        const tagsLoaded = documentTags[node.id] !== undefined;
        if (tagsLoaded) {
          const nodeTagIds = (documentTags[node.id] || []).map(t => t.id);
          tagMatches = tagIds.some(tagId => nodeTagIds.includes(tagId));
        } else {
          // Tags not loaded yet, load them and include the file temporarily
          // This prevents hiding files before their tags are loaded
          loadDocumentTags(node.id);
          tagMatches = true; // Include until tags are loaded
        }
      }
      
      if (node.type === 'folder' && node.children) {
        // Filter children recursively
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter((child): child is Document => child !== null);
        
        // Keep folder if it matches OR has matching children
        if (nameMatches && filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren
          };
        }
      } else if (nameMatches && tagMatches) {
        // Keep file if it matches search and tags
        return node;
      }
      
      return null;
    };
    
    return nodes
      .map(node => filterNode(node))
      .filter((node): node is Document => node !== null);
  }, [documentTags, loadDocumentTags]);
  
  // Auto-expand folders when searching or filtering by tags
  useEffect(() => {
    if (searchQuery.trim() || selectedTags.length > 0) {
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
      
      const filteredTree = filterTree(tree, searchQuery, selectedTags);
      setExpanded({ root: true, ...expandAll(filteredTree) });
    }
  }, [searchQuery, selectedTags, tree, filterTree]);
  
  const filteredTree = filterTree(tree, searchQuery, selectedTags);
  
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

  // Load tags when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadAllTags();
      setSelectedTags([]);
    }
  }, [currentWorkspace, loadAllTags]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load tree from API with workspace
        const result = await api.getTree(currentWorkspace);
        setTree(result.tree);
        prevTreeRef.current = result.tree;

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
              setSelected([docResult.document]);
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

  // Flatten tree to get all nodes in order (for Shift+Click range selection)
  const flattenTree = useCallback((nodes: Document[], result: Document[] = []): Document[] => {
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

  // Auto-select pending folder after tree is updated
  useEffect(() => {
    if (pendingSelection && tree.length > 0) {
      const findAndSelectItem = (nodes: Document[], targetId: string): boolean => {
        for (const node of nodes) {
          if (node.id === targetId) {
            // Select the folder (single selection for auto-select)
            setSelected([node]);
            setPendingSelection(null);
            return true;
          }
          if (node.children) {
            // Expand parent to show the item
            if (node.type === 'folder') {
              setExpanded(prev => ({ ...prev, [node.id]: true }));
            }
            if (findAndSelectItem(node.children, targetId)) {
              return true;
            }
          }
        }
        return false;
      };
      findAndSelectItem(tree, pendingSelection);
    }
  }, [pendingSelection, tree]);

  // Setup WebSocket connection
  useEffect(() => {
    websocket.connect();

    const unsubscribeTreeChanged = websocket.onTreeChanged(async () => {
      // Reload current workspace when tree changes
      try {
        const result = await api.getTree(currentWorkspace);

        // Build quick lookup maps to detect changes
        const flatten = (
          nodes: Document[],
          parentId: string | null = 'root',
          acc: Record<string, { id: string; name: string; parent_id: string | null; type: string; updated_at?: string | null }> = {}
        ) => {
          for (const n of nodes) {
            acc[n.id] = { id: n.id, name: n.name, parent_id: (n as any).parent_id ?? parentId, type: n.type, updated_at: (n as any).updated_at ?? null };
            if (n.children && n.children.length) flatten(n.children, n.id, acc);
          }
          return acc;
        };

        const prevMap = prevTreeRef.current ? flatten(prevTreeRef.current) : {};
        const nextMap = flatten(result.tree);

        const created: Array<{ id: string; name: string; type: string }> = [];
        const movedOrRenamed: Array<{ id: string; name: string; type: string }> = [];
        const contentUpdated: Array<{ id: string; name: string; type: string }> = [];
        const deleted: Array<{ id: string; name: string; type: string; path: string }> = [];

        // Helper to build full path for an item
        const buildPath = (itemId: string, treeData: Document[], parentPath: string = ''): string | null => {
          for (const node of treeData) {
            const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
            if (node.id === itemId) {
              return currentPath;
            }
            if (node.children && node.children.length > 0) {
              const found = buildPath(itemId, node.children, currentPath);
              if (found) return found;
            }
          }
          return null;
        };

        // Detect deletions (present in prevMap but not in nextMap)
        for (const id in prevMap) {
          if (!nextMap[id]) {
            const prev = prevMap[id];
            // Build path from previous tree
            const path = prevTreeRef.current ? buildPath(id, prevTreeRef.current) : prev.name;
            deleted.push({ 
              id, 
              name: prev.name, 
              type: prev.type, 
              path: path || prev.name 
            });
          }
        }

        // Detect creations, moves, renames, and content updates
        for (const id in nextMap) {
          if (!prevMap[id]) {
            created.push({ id, name: nextMap[id].name, type: nextMap[id].type });
          } else {
            const prev = prevMap[id];
            const nxt = nextMap[id];
            if (prev.parent_id !== nxt.parent_id || prev.name !== nxt.name) {
              movedOrRenamed.push({ id, name: nxt.name, type: nxt.type });
            } else {
              // Detect content/timestamp changes for files
              if (nxt.type === 'file' && prev.updated_at !== nxt.updated_at) {
                contentUpdated.push({ id, name: nxt.name, type: nxt.type });
              }
            }
          }
        }

        // Toast component with 25s progress and action button
        const ToastChange: React.FC<{ title: string; subtitle?: string; onView: () => void }> = ({ title, subtitle, onView }) => {
          const [start, setStart] = React.useState(false);
          React.useEffect(() => {
            const t = setTimeout(() => setStart(true), 10);
            return () => clearTimeout(t);
          }, []);
          return (
            <div className="pointer-events-auto w-[360px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                  <Folder size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</div>
                  {subtitle ? (
                    <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{subtitle}</div>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={onView}
                      className="rounded border border-blue-600 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    >
                      Voir
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => toast.dismiss()}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full bg-blue-600 transition-[width] dark:bg-blue-400"
                  style={{
                    width: start ? '0%' : '100%',
                    transitionDuration: '25s',
                    transitionTimingFunction: 'linear',
                  }}
                />
              </div>
            </div>
          );
        };

        // Helper: expand path to node and select it
        const expandToAndSelect = async (id: string, treeData: Document[]) => {
          const findPath = (nodes: Document[], targetId: string, path: string[] = []): string[] | null => {
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
          const path = findPath(treeData, id);
          if (path) {
            setExpanded(prev => {
              const next: Record<string, boolean> = { ...prev };
              // Expand all parents in path except the item itself
              for (let i = 0; i < path.length - 1; i++) {
                next[path[i]] = true;
              }
              return next;
            });
            // Find node object to pass to selection
            const findNode = (nodes: Document[], targetId: string): Document | null => {
              for (const n of nodes) {
                if (n.id === targetId) return n;
                if (n.children) {
                  const f = findNode(n.children, targetId);
                  if (f) return f;
                }
              }
              return null;
            };
            const node = findNode(treeData, id);
            if (node) {
              await handleSelectDocument(node);
            }
          }
        };

        // Show up to 5 toasts to prevent flooding. Skip if this client just performed a local change.
        const justDidLocalChange = Date.now() - lastLocalChangeAtRef.current < 2000;
        if (!justDidLocalChange) {
        const showLimited = <T,>(arr: T[]) => arr.slice(0, 5);

          for (const ch of showLimited(created)) {
            toast.custom(
              <ToastChange
                title={`Nouveau ${ch.type === 'folder' ? 'dossier' : 'document'} : ${ch.name}`}
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(movedOrRenamed)) {
            toast.custom(
              <ToastChange
                title={`${ch.type === 'folder' ? 'Dossier' : 'Document'} mis à jour : ${ch.name}`}
                subtitle="Renommé ou déplacé"
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(contentUpdated)) {
            toast.custom(
              <ToastChange
                title={`Document mis à jour : ${ch.name}`}
                subtitle="Contenu enregistré"
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          
          // Toast for deletions (without "Voir" button)
          for (const del of showLimited(deleted)) {
            const ToastDelete: React.FC<{ title: string; path: string }> = ({ title, path }) => {
              const [start, setStart] = React.useState(false);
              React.useEffect(() => {
                const t = setTimeout(() => setStart(true), 10);
                return () => clearTimeout(t);
              }, []);
              return (
                <div className="pointer-events-auto w-[360px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-red-600 dark:text-red-400">
                      <Trash2 size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</div>
                      <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{path}</div>
                    </div>
                    <button
                      onClick={() => toast.dismiss()}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-red-600 transition-[width] dark:bg-red-400"
                      style={{
                        width: start ? '0%' : '100%',
                        transitionDuration: '25s',
                        transitionTimingFunction: 'linear',
                      }}
                    />
                  </div>
                </div>
              );
            };
            toast.custom(
              <ToastDelete
                title={`${del.type === 'folder' ? 'Dossier' : 'Document'} supprimé : ${del.name}`}
                path={del.path}
              />,
              { duration: 25000 }
            );
          }
        }

        setTree(result.tree);
        prevTreeRef.current = result.tree;
      } catch (err) {
        console.error('Error reloading tree:', err);
      }
    });

    const unsubscribeLock = websocket.onLockUpdate((documentId, lockInfo) => {
      // Update tree with new lock info
      setTree(prevTree => {
        // Notify if someone else locked it
        if (lockInfo && String(lockInfo.user_id) !== getUserId()) {
          const findName = (nodes: Document[]): string | null => {
            for (const n of nodes) {
              if (n.id === documentId) return n.name;
              if (n.children) {
                const found = findName(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          const name = findName(prevTree);
          if (name) {
            toast(`${lockInfo.user_name} édite "${name}"`, { icon: '🔒', duration: 3000 });
          }
        }

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

      // Update selected documents if one is being locked/unlocked
      setSelected(prev => prev.map(doc => 
        doc.id === documentId ? { ...doc, locked_by: lockInfo } : doc
      ));
    });

    return () => {
      unsubscribeTreeChanged();
      unsubscribeLock();
      websocket.disconnect();
    };
  }, [currentWorkspace, selected, getUserId]);

  // Heartbeat loop for locked documents
  useEffect(() => {
    if (!editMode || selected.length !== 1) return;
    
    const activeDoc = selected[0];
    const currentUserId = getUserId();
    
    // Only heartbeat if we own the lock
    if (activeDoc.locked_by?.user_id && String(activeDoc.locked_by.user_id) === currentUserId) {
      // Send initial heartbeat
      api.heartbeatDocument(activeDoc.id).catch(console.error);

      const interval = setInterval(() => {
        api.heartbeatDocument(activeDoc.id).catch(console.error);
      }, 60000); // Every minute
      
      return () => clearInterval(interval);
    }
  }, [editMode, selected, getUserId]);

  // Toast on content updates coming from other users

  // Save session state when it changes
  useEffect(() => {
    sessionStorageService.saveState({
      expandedNodes: expanded,
      selectedId: selected.length > 0 ? selected[0].id : null,
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

  const handleExpandAll = useCallback(() => {
    const expandAllNodes = (nodes: Document[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
      nodes.forEach(node => {
        if (node.type === 'folder' && node.children) {
          acc[node.id] = true;
          expandAllNodes(node.children, acc);
        }
      });
      return acc;
    };
    setExpanded({ root: true, ...expandAllNodes(tree) });
  }, [tree]);

  const handleCollapseAll = useCallback(() => {
    setExpanded({});
  }, []);

  const handleSelectAll = useCallback(() => {
    const allNodes = flattenTree(tree);
    setSelected(allNodes);
    if (allNodes.length > 0) {
      const lastIndex = allNodes.length - 1;
      setLastSelectedIndex(lastIndex);
    }
  }, [tree, flattenTree]);

  const handleSelectDocument = useCallback(async (doc: Document, event?: React.MouseEvent) => {
    const allNodes = flattenTree(tree);
    const currentIndex = allNodes.findIndex(n => n.id === doc.id);
    
    if (event) {
      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;
      
      if (isShift && lastSelectedIndex !== null && currentIndex !== -1) {
        // Shift+Click: select range
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);
        const range = allNodes.slice(start, end + 1);
        setSelected(range);
        setLastSelectedIndex(currentIndex);
      } else if (isCtrl && currentIndex !== -1) {
        // Ctrl+Click: toggle selection
        const isSelected = selected.some(s => s.id === doc.id);
        if (isSelected) {
          setSelected(prev => prev.filter(s => s.id !== doc.id));
        } else {
          setSelected(prev => [...prev, doc]);
        }
        setLastSelectedIndex(currentIndex);
      } else {
        // Simple click: single selection
        setSelected([doc]);
        setLastSelectedIndex(currentIndex);
      }
    } else {
      // Called without event (programmatic): single selection
      setSelected([doc]);
      setLastSelectedIndex(currentIndex);
    }
    
    // If it's a file, load it for editing (only if single selection)
    if (doc.type === 'file' && (!event || (!event.ctrlKey && !event.metaKey && !event.shiftKey))) {
      try {
        // If currently in edit mode, unlock the previous document
        if (editMode && selected.length > 0) {
          const userId = getUserId();
          await api.unlockDocument(selected[0].id, userId);
          setEditMode(false);
        }

        // Get full document with latest content
        const result = await api.getDocument(doc.id);
        if (result.success) {
          setEditContent(result.document.content || '');
          setEditMode(false);
        }
      } catch (err) {
        console.error('Error loading document:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
      }
    }
  }, [editMode, selected, getUserId, tree, flattenTree, lastSelectedIndex]);

  const handleCreateDocument = useCallback(async (parentId: string, name: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
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
      lastLocalChangeAtRef.current = Date.now();
      const result = await api.createDocument({
        name,
        type: 'folder',
        parent_id: parentId,
        workspace_id: currentWorkspace,
      });
      // Store the created folder ID for auto-selection after tree update
      if (result.success && result.document) {
        setPendingSelection(result.document.id);
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  }, [currentWorkspace]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.deleteDocument(id);
      setSelected(prev => {
        const filtered = prev.filter(s => s.id !== id);
        if (filtered.length === 0) {
          setEditMode(false);
        }
        return filtered;
      });
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, []);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.updateDocument(id, { name: newName });
    } catch (err) {
      console.error('Error renaming:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  }, []);

  const handleCopy = useCallback(async (id: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
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

  // Toast on content updates coming from other users (placed after handleSelectDocument definition)
  useEffect(() => {
    const unsubscribeUpdated = websocket.onDocumentUpdated(async (data) => {
      const justDidLocalChange = Date.now() - lastLocalChangeAtRef.current < 2000;
      if (justDidLocalChange) return;
      try {
        const docId = data.document_id;
        // Try to use provided name, otherwise fetch
        let docName = data.name || '';
        if (!docName) {
          const detail = await api.getDocument(docId);
          if (detail.success) docName = detail.document.name;
        }
        const result = await api.getTree(currentWorkspace);
        const treeData = result.tree;

        const ToastUpdated: React.FC<{ title: string; onView: () => void }> = ({ title, onView }) => {
          const [start, setStart] = React.useState(false);
          React.useEffect(() => {
            const t = setTimeout(() => setStart(true), 10);
            return () => clearTimeout(t);
          }, []);
          return (
            <div className="pointer-events-auto w-[360px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                  <File size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={onView}
                      className="rounded border border-blue-600 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    >
                      Voir
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => toast.dismiss()}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full bg-blue-600 transition-[width] dark:bg-blue-400"
                  style={{
                    width: start ? '0%' : '100%',
                    transitionDuration: '25s',
                    transitionTimingFunction: 'linear',
                  }}
                />
              </div>
            </div>
          );
        };

        const expandToAndSelect = async (id: string, treeDataLocal: Document[]) => {
          const findPath = (nodes: Document[], targetId: string, path: string[] = []): string[] | null => {
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
              const walk = (nodes: Document[]): Document | null => {
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
            if (node) await handleSelectDocument(node);
          }
        };

        toast.custom(
          <ToastUpdated
            title={`Document mis à jour : ${docName || data.document_id}`}
            onView={() => expandToAndSelect(docId, treeData)}
          />,
          { duration: 25000 }
        );
      } catch (e) {
        // ignore toast errors
      }
    });
    return () => {
      unsubscribeUpdated();
    };
  }, [currentWorkspace, handleSelectDocument]);

  const handleUpload = useCallback(async (parentId: string, file: File) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
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
    if (selected.length === 0) return;
    const doc = selected[0];

    try {
      const userId = getUserId();
      const userName = getUserName();
      
      // Check if document is already locked by current user
      if (doc.locked_by && String(doc.locked_by.user_id) === String(userId)) {
        // User already owns the lock, allow editing
        console.log('Document already locked by current user, allowing edit');
        setEditMode(true);
        setEditContent(doc.content || '');
        websocket.notifyEditing(doc.id, userName);
        return;
      }
      
      // Try to lock the document
      console.log('Locking document with:', { userId, userName, documentId: doc.id });
      const result = await api.lockDocument(doc.id, userId, userName);
      
      if (result.success) {
        setEditMode(true);
        setEditContent(doc.content || '');
        websocket.notifyEditing(doc.id, userName);
      } else {
        toast.error(`Document verrouillé par ${result.locked_by?.user_name || 'un autre utilisateur'}`);
      }
    } catch (err) {
      console.error('Error locking document:', err);
      setError(err instanceof Error ? err.message : 'Failed to lock document');
    }
  }, [selected, getUserId, getUserName]);

  const handleSaveEdit = useCallback(async () => {
    if (selected.length === 0) return;
    const doc = selected[0];

    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.updateDocument(doc.id, { content: editContent });
      const userId = getUserId();
      await api.unlockDocument(doc.id, userId);
      // Inform others via websocket as redundancy (server also emits)
      websocket.notifyDocumentUpdated(doc.id, doc.name);
      
      setSelected(prev => prev.length > 0 ? [{ ...prev[0], content: editContent, locked_by: null }] : []);
      setEditMode(false);
      
      // Reload all tags after saving (tags may have been extracted from markdown)
      await loadAllTags();
      // Reload tags for the current document
      await loadDocumentTags(doc.id);
    } catch (err) {
      console.error('Error saving document:', err);
      setError(err instanceof Error ? err.message : 'Failed to save document');
    }
  }, [selected, editContent, getUserId, loadAllTags, loadDocumentTags]);

  const handleCancelEdit = useCallback(async () => {
    if (selected.length === 0) return;
    const doc = selected[0];

    try {
      const userId = getUserId();
      await api.unlockDocument(doc.id, userId);
      setEditContent(doc.content || '');
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
      if (selected.length > 0 && selected[0].id === id) {
        setSelected(prev => prev.length > 0 ? [{ ...prev[0], locked_by: null }] : []);
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

      // Determine items to move
      const activeIdStr = active.id as string;
      const isMultiSelect = selected.some(doc => doc.id === activeIdStr);
      const itemsToMove = isMultiSelect ? selected : [findNode(tree, activeIdStr)].filter((n): n is Document => n !== null);

      if (itemsToMove.length === 0) return;

      // Check target
      const targetId = over.id === 'root-drop-zone' ? 'root' : over.id as string;
      let targetNode: Document | null = null;
      
      if (targetId !== 'root') {
        targetNode = findNode(tree, targetId);
        if (!targetNode || targetNode.type !== 'folder') return;
      }

      lastLocalChangeAtRef.current = Date.now();
      
      let successCount = 0;
      const errors: string[] = [];

      for (const item of itemsToMove) {
        // Skip if moving into itself or if parent is already target
        if (item.id === targetId) continue;
        
        const result = await api.moveDocument(item.id, targetId);
        if (result.success) {
          successCount++;
        } else {
          errors.push(item.name);
        }
      }

      if (successCount > 0) {
        const targetName = targetId === 'root' ? 'la racine' : `"${targetNode?.name}"`;
        const message = itemsToMove.length === 1 
          ? `"${itemsToMove[0].name}" déplacé vers ${targetName}`
          : `${successCount} documents déplacés vers ${targetName}`;
        
        toast.success(message);
        
        // Refresh tree
        const treeResult = await api.getTree(currentWorkspace);
        setTree(treeResult.tree);
      }
      
      if (errors.length > 0) {
        toast.error(`Erreur lors du déplacement de : ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }

    } catch (err) {
      console.error('Error moving document:', err);
      toast.error('Erreur lors du déplacement');
    }
  }, [tree, selected, currentWorkspace]);

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
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onSelect={handleSelectDocument}
            onSelectAll={handleSelectAll}
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
            allTags={allTags}
            selectedTags={selectedTags}
            onTagFilterChange={setSelectedTags}
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

        {selected.length > 0 ? (
          editMode ? (
            <>
              <div className="flex-1 flex flex-col border-r">
                <DocumentViewer
                  document={{...selected[0], content: editContent}}
                  onEdit={handleStartEdit}
                  currentUserId={getUserId()}
                />
              </div>
              <div className="flex-1 flex flex-col">
                <DocumentEditor
                  document={selected[0]}
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
                document={selected[0]}
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