import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { SchemaItem, Tag, SchemaDetail, Device, Connection } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import { sessionStorageService } from './services/sessionStorage';
import { useWorkspace } from './contexts/WorkspaceContext';
import SchemaTree from './components/SchemaTree';
import SchemaCanvas from './components/SchemaCanvas';
import DevicePropertiesPanel from './components/DevicePropertiesPanel';
import CustomTemplateEditor from './components/CustomTemplateEditor';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { Network, Folder, X, Trash2 } from 'lucide-react';
import { DeviceTemplate, CustomDeviceTemplate } from './types';

function SchemaApp() {
  const { currentWorkspace, userPermission } = useWorkspace();
  const [tree, setTree] = useState<SchemaItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selected, setSelected] = useState<SchemaItem[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem('markd_schemas_tree_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [schemaTags, setSchemaTags] = useState<Record<string, Tag[]>>({});
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<SchemaDetail | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showDevicePanel, setShowDevicePanel] = useState(false);
  const [deviceTemplates, setDeviceTemplates] = useState<DeviceTemplate[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeviceTemplate | CustomDeviceTemplate | null>(null);
  const prevTreeRef = React.useRef<SchemaItem[] | null>(null);
  const lastLocalChangeAtRef = React.useRef<number>(0);
  const processingHashRef = React.useRef<boolean>(false);
  
  // Load all tags for filter
  const loadAllTags = useCallback(async () => {
    try {
      const result = await api.getSchemaTagSuggestions('', 100);
      if (result.success) {
        setAllTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, []);
  
  // Load tags for a schema
  const loadSchemaTags = useCallback(async (schemaId: string) => {
    if (schemaTags[schemaId]) return; // Already loaded
    try {
      const result = await api.getSchemaTags(schemaId);
      if (result.success) {
        setSchemaTags(prev => ({ ...prev, [schemaId]: result.tags }));
      }
    } catch (error) {
      console.error('Error loading schema tags:', error);
    }
  }, [schemaTags]);
  
  // Filter tree based on search query and tags - Show results in their hierarchy
  const filterTree = useCallback((nodes: SchemaItem[], query: string, tagIds: string[]): SchemaItem[] => {
    const lowerQuery = query.trim().toLowerCase();
    const hasTagFilter = tagIds.length > 0;
    
    const filterNode = (node: SchemaItem): SchemaItem | null => {
      const nameMatches = !lowerQuery || node.name.toLowerCase().includes(lowerQuery);
      
      // Check tag filter for schemas
      let tagMatches = true;
      if (hasTagFilter && node.type === 'schema') {
        const tagsLoaded = schemaTags[node.id] !== undefined;
        if (tagsLoaded) {
          const nodeTagIds = (schemaTags[node.id] || []).map(t => t.id);
          tagMatches = tagIds.some(tagId => nodeTagIds.includes(tagId));
        } else {
          // Tags not loaded yet, load them and include the schema temporarily
          loadSchemaTags(node.id);
          tagMatches = true; // Include until tags are loaded
        }
      }
      
      if (node.type === 'folder' && node.children) {
        // Filter children recursively
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter((child): child is SchemaItem => child !== null);
        
        // Keep folder if it matches OR has matching children
        if (nameMatches && filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren
          };
        }
      } else if (nameMatches && tagMatches) {
        // Keep schema if it matches search and tags
        return node;
      }
      
      return null;
    };
    
    return nodes
      .map(node => filterNode(node))
      .filter((node): node is SchemaItem => node !== null);
  }, [schemaTags, loadSchemaTags]);
  
  // Auto-expand folders when searching or filtering by tags
  useEffect(() => {
    if (searchQuery.trim() || selectedTags.length > 0) {
      const expandAll = (nodes: SchemaItem[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
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
  
  // Files don't need getUserName like documents

  // Load tags when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadAllTags();
      setSelectedTags([]);
    }
  }, [currentWorkspace, loadAllTags]);

  // Load initial data
  // Save selected schema to sessionStorage
  const saveSelectedSchema = useCallback((schemaId: string | null) => {
    try {
      sessionStorage.setItem('markd_schemas_selected_id', schemaId || '');
    } catch (error) {
      console.error('Error saving selected schema:', error);
    }
  }, []);

  // Load selected schema from sessionStorage
  const loadSelectedSchema = useCallback(async (schemaId: string, treeData: SchemaItem[]) => {
    try {
      // First, find the item in the tree to see if it's a schema or folder
      const findItem = (nodes: SchemaItem[], targetId: string): SchemaItem | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return node;
          }
          if (node.children) {
            const found = findItem(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };
      
      const item = findItem(treeData, schemaId);
      if (!item) {
        // Item not found, clear saved selection
        saveSelectedSchema(null);
        return;
      }
      
      // Expand parent folders to show the selected item
      const findAndExpand = (nodes: SchemaItem[], targetId: string, path: string[] = []): boolean => {
        for (const node of nodes) {
          const newPath = [...path, node.id];
          if (node.id === targetId) {
            // Expand all parents
            setExpanded(prev => {
              const next = { ...prev };
              for (let i = 0; i < newPath.length - 1; i++) {
                next[newPath[i]] = true;
              }
              return next;
            });
            return true;
          }
          if (node.children) {
            if (findAndExpand(node.children, targetId, newPath)) {
              return true;
            }
          }
        }
        return false;
      };
      findAndExpand(treeData, schemaId);
      
      // Select the item
      setSelected([item]);
      
      // If it's a schema, load full details
      if (item.type === 'schema') {
        const schemaResult = await api.getSchema(schemaId);
        if (schemaResult.success) {
          setSelectedSchema(schemaResult.schema);
          setDevices(schemaResult.schema.devices || []);
          setConnections(schemaResult.schema.connections || []);
        }
      } else {
        // It's a folder, just select it
        setSelectedSchema(null);
        setDevices([]);
        setConnections([]);
      }
    } catch (err) {
      console.error('Error loading selected schema:', err);
      // Clear saved selection if schema doesn't exist anymore
      saveSelectedSchema(null);
    }
  }, [saveSelectedSchema]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load tree from API with workspace
        const result = await api.getSchemasTree(currentWorkspace);
        setTree(result.tree);
        prevTreeRef.current = result.tree;

        // Load session state for expanded nodes
        const sessionState = sessionStorageService.loadState();
        if (sessionState) {
          setExpanded(sessionState.expandedNodes);
        }
        
        // Restore tree width if exists
        const savedWidth = localStorage.getItem('markd_schemas_tree_width');
        if (savedWidth) {
          setTreeWidth(parseInt(savedWidth, 10));
        }
        
        // Restore selected schema from sessionStorage (after tree is loaded)
        const savedSelectedId = sessionStorage.getItem('markd_schemas_selected_id');
        if (savedSelectedId && result.tree.length > 0) {
          // Load selected schema immediately with the tree data we just loaded
          await loadSelectedSchema(savedSelectedId, result.tree);
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
  }, [currentWorkspace, loadSelectedSchema]);

  // Flatten tree to get all nodes in order (for Shift+Click range selection)
  const flattenTree = useCallback((nodes: SchemaItem[], result: SchemaItem[] = []): SchemaItem[] => {
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
      const findAndSelectItem = (nodes: SchemaItem[], targetId: string): boolean => {
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


  // Files don't use presence like documents

  // Files don't need heartbeat loop like documents

  const handleSelectSchema = useCallback(async (schema: SchemaItem, event?: React.MouseEvent) => {
    const allNodes = flattenTree(tree);
    const currentIndex = allNodes.findIndex(n => n.id === schema.id);
    
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
        const isSelected = selected.some(s => s.id === schema.id);
        if (isSelected) {
          setSelected(prev => prev.filter(s => s.id !== schema.id));
        } else {
          setSelected(prev => [...prev, schema]);
        }
        setLastSelectedIndex(currentIndex);
      } else {
        // Simple click: single selection
        setSelected([schema]);
        setLastSelectedIndex(currentIndex);
      }
    } else {
      // Called without event (programmatic): single selection
      setSelected([schema]);
      setLastSelectedIndex(currentIndex);
    }
    
    // If it's a schema, load it for editing (only if single selection)
    if (schema.type === 'schema' && (!event || (!event.ctrlKey && !event.metaKey && !event.shiftKey))) {
      try {
        // Get full schema details with devices and connections
        const result = await api.getSchema(schema.id);
        if (result.success) {
          setSelectedSchema(result.schema);
          setDevices(result.schema.devices || []);
          setConnections(result.schema.connections || []);
          // Save selected schema to sessionStorage
          saveSelectedSchema(schema.id);
        }
      } catch (err) {
        console.error('Error loading schema:', err);
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      }
    } else if (schema.type === 'folder') {
      // Save folder selection too
      saveSelectedSchema(schema.id);
    }
  }, [selected, tree, flattenTree, lastSelectedIndex, saveSelectedSchema]);

  const expandToAndSelect = useCallback(async (id: string, treeDataLocal: SchemaItem[]) => {
    const findPath = (nodes: SchemaItem[], targetId: string, path: string[] = []): string[] | null => {
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
        const walk = (nodes: SchemaItem[]): SchemaItem | null => {
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
      if (node) await handleSelectSchema(node);
    }
  }, [handleSelectSchema]);

  // Toast on content updates coming from other users

  // Save session state when it changes (for expanded nodes and selected item)
  useEffect(() => {
    sessionStorageService.saveState({
      expandedNodes: expanded,
      selectedId: selected.length > 0 ? selected[0].id : null,
    });
    
    // Also save selected schema ID separately for Schema module (for cross-module navigation)
    if (selected.length > 0) {
      saveSelectedSchema(selected[0].id);
    } else {
      saveSelectedSchema(null);
    }
  }, [expanded, selected, saveSelectedSchema]);

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
      localStorage.setItem('markd_files_tree_width', treeWidth.toString());
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
    const expandAllNodes = (nodes: SchemaItem[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
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

  const handleCreateSchema = useCallback(async (parentId: string, name: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      const result = await api.createSchema({
        name,
        type: 'schema',
        parent_id: parentId === 'root' ? null : parentId,
        workspace_id: currentWorkspace,
      });
      // Store the created schema ID for auto-selection after tree update
      if (result.success && result.schema) {
        setPendingSelection(result.schema.id);
      }
    } catch (err) {
      console.error('Error creating schema:', err);
      setError(err instanceof Error ? err.message : 'Failed to create schema');
    }
  }, [currentWorkspace]);

  const handleCreateFolder = useCallback(async (parentId: string, name: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      const result = await api.createSchema({
        name,
        type: 'folder',
        parent_id: parentId === 'root' ? null : parentId,
        workspace_id: currentWorkspace,
      });
      // Store the created folder ID for auto-selection after tree update
      if (result.success && result.schema) {
        setPendingSelection(result.schema.id);
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  }, [currentWorkspace]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.deleteSchema(id);
      setSelected(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, []);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.updateSchema(id, { name: newName });
    } catch (err) {
      console.error('Error renaming:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  }, []);


  // Toast on content updates coming from other users (placed after handleSelectDocument definition)
  // Moved to main websocket useEffect below


  // Files don't have edit mode - they use upload instead

  // handleUnlock is not currently used but kept for future use
  // const handleUnlock = useCallback(async () => {
  //   if (selected.length !== 1) return;
  //   const file = selected[0];
  //   const userIdStr = getUserId();
  //   const userId = userIdStr ? parseInt(userIdStr, 10) : 0;

  //   try {
  //     await api.unlockFile(file.id, userId);
  //     toast.success('Verrou retiré');
  //   } catch (err) {
  //     console.error('Error unlocking:', err);
  //     toast.error('Impossible de retirer le verrou');
  //   }
  // }, [selected, getUserId]);

  const handleForceUnlock = useCallback(async (id: string) => {
    try {
      await api.forceUnlockSchema(id);
      
      // Update tree to remove lock
      setTree(prevTree => {
        const updateLock = (schemas: SchemaItem[]): SchemaItem[] => {
          return schemas.map(schema => {
            if (schema.id === id) {
              return { ...schema, locked_by: null };
            }
            if (schema.children) {
              return { ...schema, children: updateLock(schema.children) };
            }
            return schema;
          });
        };
        return updateLock(prevTree);
      });

      // Update selected file if it's the one being unlocked
      if (selected.length > 0 && selected[0].id === id) {
        setSelected(prev => prev.length > 0 ? [{ ...prev[0], locked_by: null }] : []);
      }
      
      toast.success('Fichier déverrouillé avec succès');
    } catch (err) {
      console.error('Error force unlocking:', err);
      toast.error('Échec du déverrouillage du fichier');
    }
  }, [selected]);

  // Handle URL hash for deep linking
  useEffect(() => {
    if (loading || tree.length === 0) return;

    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#schema=')) {
        const schemaId = hash.replace('#schema=', '');
        if (schemaId && selected.length > 0 && selected[0].id === schemaId) {
          // Already selected, skip to avoid loop
          return;
        }
        if (schemaId) {
          processingHashRef.current = true;
          await expandToAndSelect(schemaId, tree);
          processingHashRef.current = false;
        }
      }
    };

    // Check initial hash
    handleHashChange();

    // Listen for changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [loading, tree, expandToAndSelect, selected]);

  // Setup WebSocket connection
  useEffect(() => {
    websocket.connect();

    // Files don't use presence like documents

    // Toast on content updates coming from other users
    const unsubscribeContentUpdated = websocket.onSchemaContentUpdated(async (data) => {
      const justDidLocalChange = Date.now() - lastLocalChangeAtRef.current < 2000;
      if (justDidLocalChange) return;
      try {
        const schemaId = data.schema_id;
        // Try to use provided name, otherwise fetch
        let schemaName = '';
        try {
          const detail = await api.getSchema(schemaId);
          if (detail.success) schemaName = detail.schema.name;
        } catch (e) {
          schemaName = schemaId;
        }
        const result = await api.getSchemasTree(currentWorkspace);
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
                  <Network size={16} />
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

        toast.custom(
          <ToastUpdated
            title={`Schéma mis à jour : ${schemaName || schemaId}`}
            onView={() => expandToAndSelect(schemaId, treeData)}
          />,
          { duration: 25000 }
        );
      } catch (e) {
        // ignore toast errors
      }
    });

    const unsubscribeTreeChanged = websocket.onSchemaTreeChanged(async () => {
      // Reload current workspace when tree changes
      try {
        const result = await api.getSchemasTree(currentWorkspace);
        
        // Update tree immediately
        setTree(result.tree);

        // Build quick lookup maps to detect changes
        const flatten = (
          nodes: SchemaItem[],
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
        const buildPath = (itemId: string, treeData: SchemaItem[], parentPath: string = ''): string | null => {
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
              // Detect content/timestamp changes for schemas
              if (nxt.type === 'schema' && prev.updated_at !== nxt.updated_at) {
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

        // Update tree state
        setTree(result.tree);
        prevTreeRef.current = result.tree;

        // Show up to 5 toasts to prevent flooding. Skip if this client just performed a local change.
        const justDidLocalChange = Date.now() - lastLocalChangeAtRef.current < 2000;
        if (!justDidLocalChange) {
        const showLimited = <T,>(arr: T[]) => arr.slice(0, 5);

          for (const ch of showLimited(created)) {
            toast.custom(
              <ToastChange
                title={`Nouveau ${ch.type === 'folder' ? 'dossier' : 'fichier'} : ${ch.name}`}
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(movedOrRenamed)) {
            toast.custom(
              <ToastChange
                title={`${ch.type === 'folder' ? 'Dossier' : 'Fichier'} mis à jour : ${ch.name}`}
                subtitle="Renommé ou déplacé"
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(contentUpdated)) {
            toast.custom(
              <ToastChange
                title={`Fichier mis à jour : ${ch.name}`}
                subtitle="Contenu modifié"
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
                title={`${del.type === 'folder' ? 'Dossier' : 'Fichier'} supprimé : ${del.name}`}
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

    const unsubscribeLock = websocket.onSchemaLockUpdated((schemaId, lockInfo) => {
      // Update tree with new lock info
      setTree(prevTree => {
        // Notify if someone else locked it
        if (lockInfo && String(lockInfo.user_id) !== getUserId()) {
          const findName = (nodes: SchemaItem[]): string | null => {
            for (const n of nodes) {
              if (n.id === schemaId) return n.name;
              if (n.children) {
                const found = findName(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          const name = findName(prevTree);
          if (name) {
            toast(`${lockInfo.user_name} verrouille "${name}"`, { icon: '🔒', duration: 3000 });
          }
        }

        const updateLock = (schemas: SchemaItem[]): SchemaItem[] => {
          return schemas.map(schema => {
            if (schema.id === schemaId) {
              return { ...schema, locked_by: lockInfo };
            }
            if (schema.children) {
              return { ...schema, children: updateLock(schema.children) };
            }
            return schema;
          });
        };
        return updateLock(prevTree);
      });

      // Update selected schemas if one is being locked/unlocked
      setSelected(prev => prev.map(schema => 
        schema.id === schemaId ? { ...schema, locked_by: lockInfo } : schema
      ));
    });

    return () => {
      unsubscribeTreeChanged();
      unsubscribeContentUpdated();
      unsubscribeLock();
      websocket.disconnect();
    };
  }, [currentWorkspace, selected, expandToAndSelect]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    try {
      const findNode = (nodes: SchemaItem[], id: string): SchemaItem | null => {
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
      const isMultiSelect = selected.some(schema => schema.id === activeIdStr);
      const itemsToMove = isMultiSelect ? selected : [findNode(tree, activeIdStr)].filter((n): n is SchemaItem => n !== null);

      if (itemsToMove.length === 0) return;

      // Check target
      const targetId = over.id === 'root-drop-zone' ? 'root' : over.id as string;
      let targetNode: SchemaItem | null = null;
      
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
        
        const result = await api.updateSchema(item.id, { parent_id: targetId === 'root' ? null : targetId });
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
          : `${successCount} fichiers déplacés vers ${targetName}`;
        
        toast.success(message);
        
        // Refresh tree
        const treeResult = await api.getSchemasTree(currentWorkspace);
        setTree(treeResult.tree);
      }
      
      if (errors.length > 0) {
        toast.error(`Erreur lors du déplacement de : ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }

    } catch (err) {
      console.error('Error moving file:', err);
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
  const findNodeForOverlay = (nodes: SchemaItem[], id: string): SchemaItem | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeForOverlay(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeNode = activeId ? findNodeForOverlay(tree, activeId) : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div 
        className="flex h-full bg-gray-50 dark:bg-gray-900" 
        style={{ 
          cursor: isResizing ? 'col-resize' : (activeId ? 'grabbing' : 'default') 
        }}
      >
        <div className="flex flex-col" style={{ width: treeWidth }}>
          <SchemaTree
            tree={filteredTree}
            expanded={expanded}
            selected={selected}
            onToggleExpand={handleToggleExpand}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onSelect={handleSelectSchema}
            onSelectAll={handleSelectAll}
            onCreate={userPermission !== 'read' ? handleCreateSchema : undefined}
            onCreateFolder={userPermission !== 'read' ? handleCreateFolder : undefined}
            onDelete={userPermission !== 'read' ? handleDelete : undefined}
            onRename={userPermission !== 'read' ? handleRename : undefined}
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

        {selected.length > 0 && selected[0].type === 'schema' && selectedSchema ? (
          <div className="flex-1 flex flex-col relative">
            <SchemaCanvas
              schema={selectedSchema}
              devices={devices}
              connections={connections}
              onDevicesChange={(newDevices) => {
                setDevices(newDevices);
                // Update selected device if it still exists
                if (selectedDevice) {
                  const updated = newDevices.find(d => d.id === selectedDevice.id);
                  if (updated) {
                    setSelectedDevice(updated);
                  } else {
                    setSelectedDevice(null);
                    setShowDevicePanel(false);
                  }
                }
              }}
              onConnectionsChange={setConnections}
              onDeviceSelect={(device) => {
                setSelectedDevice(device);
                setShowDevicePanel(device !== null);
              }}
              onTemplatesLoaded={setDeviceTemplates}
            />
            
            {/* Device Properties Panel */}
            {showDevicePanel && selectedDevice && (
              <div className="absolute right-0 top-0 bottom-0 z-10">
                <DevicePropertiesPanel
                  device={selectedDevice}
                  template={deviceTemplates.find(t => t.device_type === selectedDevice.device_type)}
                  schemaId={selectedSchema.id}
                  onClose={() => {
                    setShowDevicePanel(false);
                    setSelectedDevice(null);
                  }}
                  onUpdate={(updatedDevice) => {
                    setDevices(devices.map(d => d.id === updatedDevice.id ? updatedDevice : d));
                    setSelectedDevice(updatedDevice);
                  }}
                  onDelete={(deviceId) => {
                    setDevices(devices.filter(d => d.id !== deviceId));
                    setSelectedDevice(null);
                    setShowDevicePanel(false);
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <p className="text-lg">Sélectionnez un schéma pour l'éditer</p>
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
              <Network size={16} className="text-blue-600 dark:text-blue-400" />
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{activeNode.name}</span>
          </div>
        ) : null}
      </DragOverlay>

    </DndContext>
  );
}

export default SchemaApp;