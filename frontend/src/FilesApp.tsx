import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FileItem, Tag } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import { sessionStorageService } from './services/sessionStorage';
import { useWorkspace } from './contexts/WorkspaceContext';
import FileTree from './components/FileTree';
import FileViewer from './components/FileViewer';
import FileUploadModal from './components/FileUploadModal';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { File, Folder, X, Trash2, PanelLeftOpen } from 'lucide-react';
import { getHashSelection, setHashSelection, onHashChange } from './utils/urlHash';

function FilesApp() {
  const { currentWorkspace, userPermission } = useWorkspace();
  const [tree, setTree] = useState<FileItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selected, setSelected] = useState<FileItem[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Files don't use presence like documents
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem('markd_files_tree_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('markd_files_sidebar_collapsed') === 'true';
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('markd_files_sidebar_collapsed', String(next));
      return next;
    });
  }, []);
  const [isResizing, setIsResizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [fileTags, setFileTags] = useState<Record<string, Tag[]>>({});
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadParentId, setUploadParentId] = useState<string | null>(null);
  const prevTreeRef = React.useRef<FileItem[] | null>(null);
  const lastLocalChangeAtRef = React.useRef<number>(0);
  const processingHashRef = React.useRef<boolean>(false);
  
  // Load all tags for filter
  const loadAllTags = useCallback(async () => {
    try {
      const result = await api.getFileTagSuggestions('', 100);
      if (result.success) {
        setAllTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, []);
  
  // Load tags for a file
  const loadFileTags = useCallback(async (fileId: string) => {
    if (fileTags[fileId]) return; // Already loaded
    try {
      const result = await api.getFileTags(fileId);
      if (result.success) {
        setFileTags(prev => ({ ...prev, [fileId]: result.tags }));
      }
    } catch (error) {
      console.error('Error loading file tags:', error);
    }
  }, [fileTags]);
  
  // Filter tree based on search query and tags - Show results in their hierarchy
  const filterTree = useCallback((nodes: FileItem[], query: string, tagIds: string[]): FileItem[] => {
    const lowerQuery = query.trim().toLowerCase();
    const hasTagFilter = tagIds.length > 0;
    
    const filterNode = (node: FileItem): FileItem | null => {
      const nameMatches = !lowerQuery || node.name.toLowerCase().includes(lowerQuery);
      
      // Check tag filter for files
      let tagMatches = true;
      if (hasTagFilter && node.type === 'file') {
        const tagsLoaded = fileTags[node.id] !== undefined;
        if (tagsLoaded) {
          const nodeTagIds = (fileTags[node.id] || []).map(t => t.id);
          tagMatches = tagIds.some(tagId => nodeTagIds.includes(tagId));
        } else {
          // Tags not loaded yet, load them and include the file temporarily
          // This prevents hiding files before their tags are loaded
          loadFileTags(node.id);
          tagMatches = true; // Include until tags are loaded
        }
      }
      
      if (node.type === 'folder' && node.children) {
        // Filter children recursively
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter((child): child is FileItem => child !== null);
        
        // Keep folder if:
        // - no active search/filter: always show (even if empty)
        // - active search/filter: only if name matches AND has matching children
        if (nameMatches && (!lowerQuery && !hasTagFilter || filteredChildren.length > 0)) {
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
      .filter((node): node is FileItem => node !== null);
  }, [fileTags, loadFileTags]);
  
  // Auto-expand folders when searching or filtering by tags
  useEffect(() => {
    if (searchQuery.trim() || selectedTags.length > 0) {
      const expandAll = (nodes: FileItem[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
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
        return String(user.id);
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
    const fallbackId = `user-${Math.random().toString(36).substr(2, 9)}`;
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

  // Load initial data (only when workspace changes)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load tree from API with workspace
        const result = await api.getFilesTree(currentWorkspace);
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
          
          // Restore selected files (try URL hash first, then sessionStorage, then fallback)
          let selectedIds: string[] = getHashSelection('file');
          
          // Fallback to sessionStorage if no hash
          if (selectedIds.length === 0) {
            const savedSelectedIdsJson = sessionStorage.getItem('markd_files_selected_ids');
            
            if (savedSelectedIdsJson) {
              try {
                selectedIds = JSON.parse(savedSelectedIdsJson);
                // Update hash with sessionStorage value
                setHashSelection('file', selectedIds);
              } catch (e) {
                console.error('Error parsing saved selected IDs:', e);
              }
            }
          }
          
          // Fallback to single selection if no multi-selection saved
          if (selectedIds.length === 0 && sessionState.selectedId) {
            selectedIds = [sessionState.selectedId];
            setHashSelection('file', selectedIds);
          }
          
          if (selectedIds.length > 0) {
            // Find all items in tree
            const foundItems: FileItem[] = [];
            const pathsToExpand: string[][] = [];
            
            const findItemWithPath = (nodes: FileItem[], targetId: string, path: string[] = []): FileItem | null => {
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
              const item = findItemWithPath(result.tree, id);
              if (item) {
                foundItems.push(item);
              }
            }
            
            if (foundItems.length > 0) {
              // Expand all parent folders first
              const newExpanded: Record<string, boolean> = { ...sessionState.expandedNodes };
              pathsToExpand.forEach(path => {
                for (let i = 0; i < path.length - 1; i++) {
                  newExpanded[path[i]] = true;
                }
              });
              setExpanded(newExpanded);
              
              // Set flag to prevent saving during restoration
              isRestoringRef.current = true;
              
              // Wait a bit for expansion to render, then select
              setTimeout(() => {
                setSelected(foundItems);
                // Reset flag after a short delay
                setTimeout(() => {
                  isRestoringRef.current = false;
                }, 200);
                // FileViewer will handle display based on selected[0].type === 'file'
              }, 100);
            } else {
              // Items not found, clear selection
              sessionStorageService.saveState({
                expandedNodes: sessionState.expandedNodes,
                selectedId: null,
              });
              sessionStorage.removeItem('markd_files_selected_ids');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace]);

  // Hash change listener (separate from data loading to avoid infinite loop)
  useEffect(() => {
    const handleHashRestore = (hashIds: string[]) => {
      // Prevent processing if already restoring to avoid infinite loop
      if (isRestoringRef.current || processingHashRef.current) {
        return;
      }
      
      if (hashIds.length > 0 && tree.length > 0) {
        // Check if selection is already correct to avoid loop
        const currentIds = selected.map(s => s.id).sort().join(',');
        const hashIdsString = hashIds.sort().join(',');
        if (currentIds === hashIdsString) {
          return; // Already selected, no need to restore
        }
        
        // Set flags to prevent saving during restoration
        isRestoringRef.current = true;
        processingHashRef.current = true;
        
        // Restore selection from hash
        const findItemWithPath = (nodes: FileItem[], targetId: string, path: string[] = []): FileItem | null => {
          for (const node of nodes) {
            const newPath = [...path, node.id];
            if (node.id === targetId) {
              return node;
            }
            if (node.children) {
              const found = findItemWithPath(node.children, targetId, newPath);
              if (found) return found;
            }
          }
          return null;
        };
        
        const foundItems: FileItem[] = [];
        for (const id of hashIds) {
          const item = findItemWithPath(tree, id);
          if (item) foundItems.push(item);
        }
        
        if (foundItems.length > 0) {
          setSelected(foundItems);
        }
        
        // Reset flags after a short delay
        setTimeout(() => {
          isRestoringRef.current = false;
          processingHashRef.current = false;
        }, 200);
      }
    };
    
    const cleanup = onHashChange((selections) => {
      handleHashRestore(selections.file);
    });
    
    // Also check on visibility change (when returning to module)
    const handleVisibilityChange = () => {
      if (!document.hidden && tree.length > 0) {
        const hashIds = getHashSelection('file');
        if (hashIds.length > 0) {
          handleHashRestore(hashIds);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, selected]);

  // Flatten tree to get all nodes in order (for Shift+Click range selection)
  const flattenTree = useCallback((nodes: FileItem[], result: FileItem[] = []): FileItem[] => {
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
      const findAndSelectItem = (nodes: FileItem[], targetId: string): boolean => {
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

  const handleSelectFile = useCallback(async (file: FileItem, event?: React.MouseEvent) => {
    const allNodes = flattenTree(tree);
    const currentIndex = allNodes.findIndex(n => n.id === file.id);
    
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
        const isSelected = selected.some(s => s.id === file.id);
        if (isSelected) {
          setSelected(prev => prev.filter(s => s.id !== file.id));
        } else {
          setSelected(prev => [...prev, file]);
        }
        setLastSelectedIndex(currentIndex);
      } else {
        // Simple click: single selection
        setSelected([file]);
        setLastSelectedIndex(currentIndex);
      }
    } else {
      // Called without event (programmatic): single selection
      setSelected([file]);
      setLastSelectedIndex(currentIndex);
    }
    
    // If it's a file, load it for editing (only if single selection)
    if (file.type === 'file' && (!event || (!event.ctrlKey && !event.metaKey && !event.shiftKey))) {
      try {
        // Set URL hash (skip if already processing from hash)
        if (!processingHashRef.current) {
          window.location.hash = `file=${file.id}`;
        }

        // Get full file details
        const result = await api.getFile(file.id);
        if (result.success) {
          // File selected, ready for viewing
        }
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      }
    }
  }, [selected, tree, flattenTree, lastSelectedIndex]);

  const expandToAndSelect = useCallback(async (id: string, treeDataLocal: FileItem[]) => {
    const findPath = (nodes: FileItem[], targetId: string, path: string[] = []): string[] | null => {
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
        const walk = (nodes: FileItem[]): FileItem | null => {
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
      if (node) await handleSelectFile(node);
    }
  }, [handleSelectFile]);

  // Toast on content updates coming from other users

  // Save session state when it changes
  const prevSelectedIdsRef = React.useRef<string>('');
  const isRestoringRef = React.useRef<boolean>(false);
  useEffect(() => {
    sessionStorageService.saveState({
      expandedNodes: expanded,
      selectedId: selected.length > 0 ? selected[0].id : null, // Keep for backward compatibility
    });
    
    // Don't save if we're currently restoring from hash
    if (isRestoringRef.current) {
      return;
    }
    
    // Save all selected IDs to both URL hash and sessionStorage
    try {
      const ids = selected.map(s => s.id);
      const idsString = ids.sort().join(',');
      // Avoid saving if selection hasn't changed
      if (prevSelectedIdsRef.current === idsString) {
        return;
      }
      prevSelectedIdsRef.current = idsString;
      
      if (selected.length > 0) {
        setHashSelection('file', ids);
        sessionStorage.setItem('markd_files_selected_ids', JSON.stringify(ids));
      } else {
        setHashSelection('file', []);
        sessionStorage.removeItem('markd_files_selected_ids');
      }
    } catch (error) {
      console.error('Error saving selected files:', error);
    }
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
    const expandAllNodes = (nodes: FileItem[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
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

  const handleCreateFile = useCallback(async (parentId: string, name: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      const result = await api.createFile({
        name,
        type: 'file',
        parent_id: parentId === 'root' ? null : parentId,
        workspace_id: currentWorkspace,
      });
      // Store the created file ID for auto-selection after tree update
      if (result.success && result.file) {
        setPendingSelection(result.file.id);
        toast.success(`File "${name}" created`);
        // Reload tree immediately (don't rely solely on Socket.IO broadcast)
        const treeResult = await api.getFilesTree(currentWorkspace);
        setTree(treeResult.tree);
        prevTreeRef.current = treeResult.tree;
      }
    } catch (err) {
      console.error('Error creating file:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create file');
    }
  }, [currentWorkspace]);

  const handleCreateFolder = useCallback(async (parentId: string, name: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      const result = await api.createFile({
        name,
        type: 'folder',
        parent_id: parentId === 'root' ? null : parentId,
        workspace_id: currentWorkspace,
      });
      // Store the created folder ID for auto-selection after tree update
      if (result.success && result.file) {
        setPendingSelection(result.file.id);
        toast.success(`Folder "${name}" created`);
        // Reload tree immediately (don't rely solely on Socket.IO broadcast)
        const treeResult = await api.getFilesTree(currentWorkspace);
        setTree(treeResult.tree);
        prevTreeRef.current = treeResult.tree;
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create folder');
    }
  }, [currentWorkspace]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.deleteFile(id);
      setSelected(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, []);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.updateFile(id, { name: newName });
    } catch (err) {
      console.error('Error renaming:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  }, []);

  const handleDownload = useCallback((file: FileItem) => {
    if (file.type === 'file') {
      api.downloadFile(file.id);
    }
  }, []);

  // Toast on content updates coming from other users (placed after handleSelectDocument definition)
  // Moved to main websocket useEffect below

  const handleUpload = useCallback(async (parentId: string, file: File) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      // First create the file entry
      const createResult = await api.createFile({
        name: file.name,
        type: 'file',
        parent_id: parentId === 'root' ? null : parentId,
        workspace_id: currentWorkspace,
      });
      
      if (createResult.success && createResult.file) {
        // Then upload the file content
        await api.uploadFileContent(createResult.file.id, file);
        setPendingSelection(createResult.file.id);
      }
    } catch (err) {
      console.error('Error uploading:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload');
      throw err; // Re-throw for FileUploadModal to handle
    }
  }, [currentWorkspace]);

  const handleOpenUploadModal = useCallback((parentId: string | null = null) => {
    setUploadParentId(parentId || 'root');
    setUploadModalOpen(true);
  }, []);

  const handleUploadComplete = useCallback(async () => {
    // Reload tree after upload
    try {
      const result = await api.getFilesTree(currentWorkspace);
      if (result.success) {
        setTree(result.tree);
        prevTreeRef.current = result.tree;
      }
    } catch (err) {
      console.error('Error reloading tree:', err);
    }
  }, [currentWorkspace]);

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
      await api.forceUnlockFile(id);
      
      // Update tree to remove lock
      setTree(prevTree => {
        const updateLock = (files: FileItem[]): FileItem[] => {
          return files.map(file => {
            if (file.id === id) {
              return { ...file, locked_by: null };
            }
            if (file.children) {
              return { ...file, children: updateLock(file.children) };
            }
            return file;
          });
        };
        return updateLock(prevTree);
      });

      // Update selected file if it's the one being unlocked
      if (selected.length > 0 && selected[0].id === id) {
        setSelected(prev => prev.length > 0 ? [{ ...prev[0], locked_by: null }] : []);
      }
      
      toast.success('File unlocked successfully');
    } catch (err) {
      console.error('Error force unlocking:', err);
      toast.error('Failed to unlock file');
    }
  }, [selected]);

  // Handle URL hash for deep linking
  useEffect(() => {
    if (loading || tree.length === 0) return;

    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#file=')) {
        const fileId = hash.replace('#file=', '');
        if (fileId && selected.length > 0 && selected[0].id === fileId) {
          // Already selected, skip to avoid loop
          return;
        }
        if (fileId) {
          processingHashRef.current = true;
          await expandToAndSelect(fileId, tree);
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
    const unsubscribeContentUpdated = websocket.onFileContentUpdated(async (data) => {
      const justDidLocalChange = Date.now() - lastLocalChangeAtRef.current < 2000;
      if (justDidLocalChange) return;
      try {
        const fileId = data.file_id;
        // Try to use provided name, otherwise fetch
        let fileName = data.name || '';
        if (!fileName) {
          const detail = await api.getFile(fileId);
          if (detail.success) fileName = detail.file.name;
        }
        const result = await api.getFilesTree(currentWorkspace);
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
                      View
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
            title={`File updated: ${fileName || data.file_id}`}
            onView={() => expandToAndSelect(fileId, treeData)}
          />,
          { duration: 25000 }
        );
      } catch (e) {
        // ignore toast errors
      }
    });

    const unsubscribeTreeChanged = websocket.onFileTreeChanged(async () => {
      // Reload current workspace when tree changes
      try {
        const result = await api.getFilesTree(currentWorkspace);
        
        // Preserve current selection before updating tree
        const selectedIds = selected.map(s => s.id);
        
        // Update tree immediately
        setTree(result.tree);
        
        // Restore selection after tree update
        if (selectedIds.length > 0 && result.tree.length > 0) {
          const findItem = (nodes: FileItem[], targetId: string): FileItem | null => {
            for (const node of nodes) {
              if (node.id === targetId) return node;
              if (node.children) {
                const found = findItem(node.children, targetId);
                if (found) return found;
              }
            }
            return null;
          };
          
          const foundItems: FileItem[] = [];
          for (const id of selectedIds) {
            const item = findItem(result.tree, id);
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

        // Build quick lookup maps to detect changes
        const flatten = (
          nodes: FileItem[],
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
        const buildPath = (itemId: string, treeData: FileItem[], parentPath: string = ''): string | null => {
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
                      View
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

        // Show up to 5 toasts to prevent flooding. Skip if this client just performed a local change.
        const showLimited = <T extends { id: string; name: string; type: string }>(arr: T[]) => arr.slice(0, 5);
        const justDidLocalChange = Date.now() - lastLocalChangeAtRef.current < 2000;
        if (!justDidLocalChange) {
          for (const ch of showLimited(created)) {
            toast.custom(
              <ToastChange
                title={`New ${ch.type === 'folder' ? 'folder' : 'file'}: ${ch.name}`}
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(movedOrRenamed)) {
            toast.custom(
              <ToastChange
                title={`${ch.type === 'folder' ? 'Folder' : 'File'} updated: ${ch.name}`}
                subtitle="Renamed or moved"
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(contentUpdated)) {
            toast.custom(
              <ToastChange
                title={`File updated: ${ch.name}`}
                subtitle="Content modified"
                onView={() => expandToAndSelect(ch.id, result.tree)}
              />,
              { duration: 25000 }
            );
          }
          
          // Toast for deletions (without "View" button)
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
                title={`${del.type === 'folder' ? 'Folder' : 'File'} deleted: ${del.name}`}
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

    const unsubscribeLock = websocket.onFileLockUpdate((fileId, lockInfo) => {
      // Update tree with new lock info
      setTree(prevTree => {
        // Notify if someone else locked it
        if (lockInfo && String(lockInfo.user_id) !== getUserId()) {
          const findName = (nodes: FileItem[]): string | null => {
            for (const n of nodes) {
              if (n.id === fileId) return n.name;
              if (n.children) {
                const found = findName(n.children);
                if (found) return found;
              }
            }
            return null;
          };
          const name = findName(prevTree);
          if (name) {
            toast(`${lockInfo.user_name} locked "${name}"`, { icon: '🔒', duration: 3000 });
          }
        }

        const updateLock = (files: FileItem[]): FileItem[] => {
          return files.map(file => {
            if (file.id === fileId) {
              return { ...file, locked_by: lockInfo };
            }
            if (file.children) {
              return { ...file, children: updateLock(file.children) };
            }
            return file;
          });
        };
        return updateLock(prevTree);
      });

      // Update selected files if one is being locked/unlocked
      setSelected(prev => prev.map(file => 
        file.id === fileId ? { ...file, locked_by: lockInfo } : file
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
      const findNode = (nodes: FileItem[], id: string): FileItem | null => {
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
      const isMultiSelect = selected.some(file => file.id === activeIdStr);
      const itemsToMove = isMultiSelect ? selected : [findNode(tree, activeIdStr)].filter((n): n is FileItem => n !== null);

      if (itemsToMove.length === 0) return;

      // Check target
      const targetId = over.id === 'root-drop-zone' ? 'root' : over.id as string;
      let targetNode: FileItem | null = null;
      
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
        
        const result = await api.updateFile(item.id, { parent_id: targetId === 'root' ? null : targetId });
        if (result.success) {
          successCount++;
        } else {
          errors.push(item.name);
        }
      }

      if (successCount > 0) {
        const targetName = targetId === 'root' ? 'root' : `"${targetNode?.name}"`;
        const message = itemsToMove.length === 1 
          ? `"${itemsToMove[0].name}" moved to ${targetName}`
          : `${successCount} files moved to ${targetName}`;
        
        toast.success(message);
        
        // Refresh tree
        const treeResult = await api.getFilesTree(currentWorkspace);
        setTree(treeResult.tree);
      }
      
      if (errors.length > 0) {
        toast.error(`Failed to move: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }

    } catch (err) {
      console.error('Error moving file:', err);
      toast.error('Failed to move');
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
  const findNode = (nodes: FileItem[], id: string): FileItem | null => {
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
        {/* Collapsed sidebar strip */}
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 border-r border-gray-200 bg-white py-3 px-1.5 dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title="Show sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
          </div>
        ) : (
          <>
        <div className="flex flex-col" style={{ width: treeWidth }}>
          <FileTree
            tree={filteredTree}
            expanded={expanded}
            selected={selected}
            onToggleExpand={handleToggleExpand}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onSelect={handleSelectFile}
            onSelectAll={handleSelectAll}
            onCreate={userPermission !== 'read' ? handleCreateFile : undefined}
            onCreateFolder={userPermission !== 'read' ? handleCreateFolder : undefined}
            onDelete={userPermission !== 'read' ? handleDelete : undefined}
            onRename={userPermission !== 'read' ? handleRename : undefined}
            onDownload={handleDownload}
            onUpload={userPermission !== 'read' ? handleUpload : undefined}
            onOpenUploadModal={userPermission !== 'read' ? handleOpenUploadModal : undefined}
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
            onCollapseSidebar={toggleSidebar}
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
          </>
        )}

        {selected.length > 0 && selected[0].type === 'file' ? (
          <div className="flex-1 flex flex-col">
            <FileViewer
              file={selected[0]}
              onClose={() => setSelected([])}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <p className="text-lg">Select a file to view</p>
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

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        parentId={uploadParentId}
        onUpload={handleUpload}
        onUploadComplete={handleUploadComplete}
      />
    </DndContext>
  );
}

export default FilesApp;