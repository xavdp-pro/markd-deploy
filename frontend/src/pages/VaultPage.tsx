import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import { Key, Lock, Folder, X, Trash2, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import PasswordTree from '../components/PasswordTree';
import PasswordForm, { PasswordFormData } from '../components/PasswordForm';
import PasswordDetailView from '../components/PasswordDetailView';
import { api } from '../services/api';
import { websocket } from '../services/websocket';
import { Tag as TagType, PasswordItem, PasswordDetail } from '../types';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { getHashSelection, setHashSelection, onHashChange } from '../utils/urlHash';

const VaultPage: React.FC = () => {
  const { user } = useAuth();
  const { currentWorkspace, userPermission } = useWorkspace();
  const [tree, setTree] = useState<PasswordItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedPassword, setSelectedPassword] = useState<PasswordDetail | null>(null);
  const [selected, setSelected] = useState<PasswordItem[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('vaultSidebarWidth');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('markd_vault_sidebar_collapsed') === 'true';
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('markd_vault_sidebar_collapsed', String(next));
      return next;
    });
  }, []);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [passwordTags, setPasswordTags] = useState<Record<string, TagType[]>>({});
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, Array<{ id: string; username: string }>>>({});
  const prevTreeRef = React.useRef<PasswordItem[] | null>(null);
  const lastLocalChangeAtRef = React.useRef<number>(0);
  const processingHashRef = React.useRef<boolean>(false);

  // WebSocket lock listener
  useEffect(() => {
    const unsubscribe = websocket.onVaultLockUpdate((passwordId, lockInfo) => {
        // Update tree state to show lock
        setTree(prevTree => {
            const updateNode = (nodes: PasswordItem[]): PasswordItem[] => {
                return nodes.map(node => {
                    if (node.id === passwordId) {
                        return { ...node, locked_by: lockInfo };
                    }
                    if (node.children) {
                        return { ...node, children: updateNode(node.children) };
                    }
                    return node;
                });
            };
            const newTree = updateNode(prevTree);
            
            // Notify if locked by someone else
            if (lockInfo && user && String(lockInfo.user_id) !== String(user.id)) {
                const findName = (nodes: PasswordItem[]): string | null => {
                    for (const n of nodes) {
                        if (n.id === passwordId) return n.name;
                        if (n.children) {
                            const found = findName(n.children);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const name = findName(prevTree);
                if (name) toast(`${lockInfo.user_name} is editing "${name}"`, { icon: '🔒' });
            }
            return newTree;
        });
    });
    return unsubscribe;
  }, [user]);

  // WebSocket presence listener
  useEffect(() => {
    const unsubscribe = websocket.onPresenceUpdate((documentId, users) => {
      setPresence(prev => ({
        ...prev,
        [documentId]: users
      }));
    });
    return unsubscribe;
  }, []);

  // Emit presence events when selection changes
  useEffect(() => {
    if (!user) return;

    // Leave previous document if any
    const prevPasswordId = selectedPassword?.id;
    if (prevPasswordId) {
      websocket.leaveDocument(prevPasswordId);
    }

    // Join new document if any
    const currentPasswordId = selectedPassword?.id;
    if (currentPasswordId) {
      websocket.joinDocument(currentPasswordId);
    }

    // Cleanup on unmount
    return () => {
      if (selectedPassword?.id) {
        websocket.leaveDocument(selectedPassword.id);
      }
    };
  }, [selectedPassword?.id, user]);

  // Heartbeat loop
  useEffect(() => {
    if (!editingId || !user) return;
    
    api.heartbeatPassword(editingId).catch(console.error);
    
    const interval = setInterval(() => {
        api.heartbeatPassword(editingId).catch(console.error);
      }, 120000);
    
    return () => clearInterval(interval);
  }, [editingId, user]);

  const handleStartEditing = async () => {
    if (!selectedPassword || !user) return;
    
    // Check lock in tree
    const findNode = (nodes: PasswordItem[], id: string): PasswordItem | null => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };
    const node = findNode(tree, selectedPassword.id);
    
    if (node?.locked_by && String(node.locked_by.user_id) !== String(user.id)) {
        // Check if lock is expired client-side or assume server handles it?
        // Server handles it, but we might want to block UI.
        // Let's try to lock anyway, server will reject if valid lock exists.
    }

    try {
        const res = await api.lockPassword(selectedPassword.id, { id: String(user.id), username: user.username });
        if (!res.success) {
            toast.error(res.message);
            return;
        }
        setEditingId(selectedPassword.id);
        setShowForm(true);
    } catch (e) {
        console.error(e);
        toast.error("Failed to lock password");
    }
  };

  const handleCancelEditing = async () => {
    if (editingId && user) {
        await api.unlockPassword(editingId, String(user.id));
    }
    setShowForm(false);
    if (editingId) {
        setEditingId(null);
    } else {
        setSelectedPassword(null);
    }
  };

  const handleUnlock = async () => {
    if (!selectedPassword || !user) return;
    
    try {
      await api.unlockPassword(selectedPassword.id, String(user.id));
      toast.success('Lock removed');
      // Tree will be updated via WebSocket
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove lock");
    }
  };

  // Helper to find lock info for current password
  const findPasswordLockInfo = (passwordId: string) => {
    const findNode = (nodes: PasswordItem[]): PasswordItem | null => {
      for (const node of nodes) {
        if (node.id === passwordId) return node;
        if (node.children) {
          const found: PasswordItem | null = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(tree);
    return node?.locked_by || null;
  };

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('vaultSidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // Save selected passwords to sessionStorage (all selected items)
  const prevSelectedIdsRef = React.useRef<string>('');
  const isRestoringRef = React.useRef<boolean>(false);
  const saveSelectedPasswords = useCallback((selectedIds: string[]) => {
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
        console.log('VaultPage: Saving selected IDs:', selectedIds);
        setHashSelection('password', selectedIds);
        sessionStorage.setItem('markd_passwords_selected_ids', JSON.stringify(selectedIds));
      } else {
        console.log('VaultPage: Clearing selected IDs');
        setHashSelection('password', []);
        sessionStorage.removeItem('markd_passwords_selected_ids');
      }
    } catch (error) {
      console.error('Error saving selected passwords:', error);
    }
  }, []);

  // Load selected passwords from sessionStorage (restore all selected items)
  const loadSelectedPasswords = useCallback(async (selectedIds: string[], treeData: PasswordItem[]) => {
    try {
      // Find item in tree
      const findItem = (nodes: PasswordItem[], targetId: string): PasswordItem | null => {
        for (const node of nodes) {
          if (node.id === targetId) return node;
          if (node.children) {
            const found = findItem(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };
      
      // Find all items in tree
      const foundItems: PasswordItem[] = [];
      const pathsToExpand: string[][] = [];
      
      const findItemWithPath = (nodes: PasswordItem[], targetId: string, path: string[] = []): PasswordItem | null => {
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
        saveSelectedPasswords([]);
        return;
      }
      
      // Expand all parent folders first
      const newExpanded: Record<string, boolean> = {};
      pathsToExpand.forEach(path => {
        for (let i = 0; i < path.length - 1; i++) {
          newExpanded[path[i]] = true;
        }
      });
      setExpanded(prev => ({ ...prev, ...newExpanded }));
      
      // Set flag to prevent saving during restoration
      isRestoringRef.current = true;
      
      // Wait a bit for expansion to render, then select
      setTimeout(async () => {
        setSelected(foundItems);
        
        // Load details for the first password (if any)
        const firstPassword = foundItems.find(item => item.type === 'password');
        if (firstPassword) {
          await fetchPasswordDetail(firstPassword.id);
        }
        
        // Reset flag after a short delay
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 200);
      }, 100);
    } catch (err) {
      console.error('Error loading selected passwords:', err);
      saveSelectedPasswords([]);
    }
  }, [saveSelectedPasswords]);

  const fetchTree = useCallback(async (workspaceId: string) => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      console.log('Fetching password tree for workspace:', workspaceId);
      const result = await api.getPasswordTree(workspaceId);
      console.log('Tree result:', result);
      if (result.success) {
        const treeData = result.tree || [];
        setTree(treeData);
        prevTreeRef.current = treeData;
        console.log('Tree set:', treeData);
        
        // Restore selected passwords (try URL hash first, then sessionStorage)
        let selectedIds: string[] = getHashSelection('password');
        console.log('VaultPage: Restoring from hash:', selectedIds, 'treeData.length:', treeData.length);
        
        // Fallback to sessionStorage if no hash
        if (selectedIds.length === 0) {
          const savedSelectedIdsJson = sessionStorage.getItem('markd_passwords_selected_ids');
          console.log('VaultPage: Restoring from sessionStorage, savedSelectedIdsJson:', savedSelectedIdsJson);
          
          if (savedSelectedIdsJson && treeData.length > 0) {
            try {
              selectedIds = JSON.parse(savedSelectedIdsJson);
              console.log('VaultPage: Parsed selectedIds:', selectedIds);
              // Update hash with sessionStorage value
              setHashSelection('password', selectedIds);
            } catch (e) {
              console.error('Error parsing saved selected IDs:', e);
            }
          }
        }
        
        if (selectedIds.length > 0 && treeData.length > 0) {
          console.log('VaultPage: Restoring', selectedIds.length, 'items');
          await loadSelectedPasswords(selectedIds, treeData);
        }
      } else {
        console.error('Failed to load tree:', result);
        setTree([]);
      }
    } catch (error) {
      console.error('Error loading tree:', error);
      toast.error('Error loading passwords: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTree([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadSelectedPasswords]);

  // Load all tags for filter
  const loadAllTags = useCallback(async () => {
    try {
      const result = await api.getPasswordTagSuggestions('', 100);
      if (result.success) {
        setAllTags(result.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, []);

  // Fetch tree when workspace changes or when workspaces are loaded
  useEffect(() => {
    if (currentWorkspace && currentWorkspace !== '') {
      setSelectedPassword(null);
      setShowForm(false);
      setEditingId(null);
      setSelectedTags([]);
      fetchTree(currentWorkspace);
      loadAllTags();
    }
  }, [currentWorkspace, fetchTree, loadAllTags]);
  
  // Listen to hash changes (when navigating back to this module)
  useEffect(() => {
    const handleHashRestore = (hashIds: string[]) => {
      if (hashIds.length > 0 && tree.length > 0) {
        // Check if selection is already correct to avoid loop
        const currentIds = selected.map(s => s.id).sort().join(',');
        const hashIdsString = hashIds.sort().join(',');
        if (currentIds === hashIdsString) {
          return; // Already selected, no need to restore
        }
        
        // Prevent processing if already restoring
        if (isRestoringRef.current || processingHashRef.current) {
          return;
        }
        
        // Set flag to prevent saving during restoration
        isRestoringRef.current = true;
        processingHashRef.current = true;
        loadSelectedPasswords(hashIds, tree).then(() => {
          // Reset flag after restoration
          setTimeout(() => {
            isRestoringRef.current = false;
            processingHashRef.current = false;
          }, 200);
        });
      }
    };
    
    const cleanup = onHashChange((selections) => {
      handleHashRestore(selections.password);
    });
    
    // Also check on visibility change (when returning to module)
    const handleVisibilityChange = () => {
      if (!document.hidden && tree.length > 0) {
        const hashIds = getHashSelection('password');
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
  }, [tree, loadSelectedPasswords, selected]);

  // Load tags for a password
  const loadPasswordTags = useCallback(async (passwordId: string) => {
    if (passwordTags[passwordId]) return; // Already loaded
    try {
      const result = await api.getPasswordTags(passwordId);
      if (result.success) {
        setPasswordTags(prev => ({ ...prev, [passwordId]: result.tags }));
      }
    } catch (error) {
      console.error('Error loading password tags:', error);
    }
  }, [passwordTags]);

  const fetchPasswordDetail = async (id: string) => {
    try {
      const result = await api.getPassword(id);
      if (result.success) {
        setSelectedPassword(result.password);
        loadPasswordTags(id);
      } else {
        toast.error('Error loading password details');
      }
    } catch (error) {
      console.error('Error fetching password details:', error);
      toast.error('Error loading password details');
    }
  };

  // Flatten tree to get all nodes in order (for Shift+Click range selection)
  const flattenTree = useCallback((nodes: PasswordItem[], result: PasswordItem[] = []): PasswordItem[] => {
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

  const handleSelectAll = useCallback(() => {
    const allNodes = flattenTree(tree);
    setSelected(allNodes);
    if (allNodes.length > 0) {
      const lastIndex = allNodes.length - 1;
      setLastSelectedIndex(lastIndex);
    }
  }, [tree, flattenTree]);

  const handleSelectPassword = useCallback((item: PasswordItem, event?: React.MouseEvent) => {
    const allNodes = flattenTree(tree);
    const currentIndex = allNodes.findIndex(n => n.id === item.id);

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
        const isSelected = selected.some(s => s.id === item.id);
        if (isSelected) {
          setSelected(prev => prev.filter(s => s.id !== item.id));
        } else {
          setSelected(prev => [...prev, item]);
        }
        setLastSelectedIndex(currentIndex);
      } else {
        // Simple click: single selection
        setSelected([item]);
        setLastSelectedIndex(currentIndex);
      }
    } else {
      // Called without event (programmatic): single selection
      setSelected([item]);
      setLastSelectedIndex(currentIndex);
    }

    // If it's a password, load it for viewing (only if single selection)
    if (item.type === 'password' && (!event || (!event.ctrlKey && !event.metaKey && !event.shiftKey))) {
      // Set URL hash (skip if already processing from hash)
      if (!processingHashRef.current) {
        window.location.hash = `password=${item.id}`;
      }
      fetchPasswordDetail(item.id);
    }
    
    // Save selection to sessionStorage (all selected items)
    saveSelectedPasswords(selected.map(s => s.id));
  }, [tree, flattenTree, lastSelectedIndex, selected, fetchPasswordDetail, saveSelectedPasswords]);

  const expandToAndSelect = useCallback(async (id: string, treeDataLocal: PasswordItem[]) => {
    const findPath = (nodes: PasswordItem[], targetId: string, path: string[] = []): string[] | null => {
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
        const walk = (nodes: PasswordItem[]): PasswordItem | null => {
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
      if (node) handleSelectPassword(node);
    }
  }, [handleSelectPassword]);

  // Handle URL hash
  useEffect(() => {
    if (tree.length === 0) return;
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#password=')) {
        const passwordId = hash.replace('#password=', '');
        if (passwordId && selectedPassword?.id === passwordId) {
          // Already selected, skip to avoid loop
          return;
        }
        if (passwordId) {
          processingHashRef.current = true;
          await expandToAndSelect(passwordId, tree);
          processingHashRef.current = false;
        }
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [tree, expandToAndSelect, selectedPassword]);

  // Setup WebSocket connection for password tree changes
  useEffect(() => {
    websocket.connect();

    const unsubscribeTreeChanged = websocket.onVaultTreeChanged(async () => {
      // Reload current workspace when tree changes
      try {
        const result = await api.getPasswordTree(currentWorkspace);

        // Build quick lookup maps to detect changes
        const flatten = (
          nodes: PasswordItem[],
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
        const nextMap = flatten(result.tree || []);

        const created: Array<{ id: string; name: string; type: string }> = [];
        const movedOrRenamed: Array<{ id: string; name: string; type: string }> = [];
        const contentUpdated: Array<{ id: string; name: string; type: string }> = [];
        const deleted: Array<{ id: string; name: string; type: string; path: string }> = [];

        // Helper to build full path for an item
        const buildPath = (itemId: string, treeData: PasswordItem[], parentPath: string = ''): string | null => {
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
              // Detect content/timestamp changes for passwords
              if (nxt.type === 'password' && prev.updated_at !== nxt.updated_at) {
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
                  <Key size={16} />
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

        // Helper: expand path to node and select it
        const expandToAndSelect = async (id: string, treeData: PasswordItem[]) => {
          const findPath = (nodes: PasswordItem[], targetId: string, path: string[] = []): string[] | null => {
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
            const findNode = (nodes: PasswordItem[], targetId: string): PasswordItem | null => {
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
              await handleSelectPassword(node);
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
                title={`New ${ch.type === 'folder' ? 'folder' : 'password'}: ${ch.name}`}
                onView={() => expandToAndSelect(ch.id, result.tree || [])}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(movedOrRenamed)) {
            toast.custom(
              <ToastChange
                title={`${ch.type === 'folder' ? 'Folder' : 'Password'} updated: ${ch.name}`}
                subtitle="Renamed or moved"
                onView={() => expandToAndSelect(ch.id, result.tree || [])}
              />,
              { duration: 25000 }
            );
          }
          for (const ch of showLimited(contentUpdated)) {
            toast.custom(
              <ToastChange
                title={`Password updated: ${ch.name}`}
                subtitle="Content saved"
                onView={() => expandToAndSelect(ch.id, result.tree || [])}
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
                title={`${del.type === 'folder' ? 'Folder' : 'Password'} deleted: ${del.name}`}
                path={del.path}
              />,
              { duration: 25000 }
            );
          }
        }

        // Preserve current selection before updating tree
        const selectedIds = selected.map(s => s.id);
        
        setTree(result.tree || []);
        prevTreeRef.current = result.tree || [];
        
        // Restore selection after tree update
        if (selectedIds.length > 0 && (result.tree || []).length > 0) {
          const findItem = (nodes: PasswordItem[], targetId: string): PasswordItem | null => {
            for (const node of nodes) {
              if (node.id === targetId) return node;
              if (node.children) {
                const found = findItem(node.children, targetId);
                if (found) return found;
              }
            }
            return null;
          };
          
          const foundItems: PasswordItem[] = [];
          for (const id of selectedIds) {
            const item = findItem(result.tree || [], id);
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
      } catch (err) {
        console.error('Error reloading tree:', err);
      }
    });

    return () => {
      unsubscribeTreeChanged();
      websocket.disconnect();
    };
  }, [currentWorkspace, handleSelectPassword]);



  const handleToggleExpand = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleExpandAll = useCallback(() => {
    const expandAllNodes = (nodes: PasswordItem[], acc: Record<string, boolean> = {}): Record<string, boolean> => {
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

  // Auto-select pending folder/password after tree is updated
  useEffect(() => {
    if (pendingSelection && tree.length > 0) {
      const findAndSelectItem = (nodes: PasswordItem[], targetId: string): boolean => {
        for (const node of nodes) {
          if (node.id === targetId) {
            handleSelectPassword(node); // This will set selected
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
  }, [pendingSelection, tree, handleSelectPassword]);

  const handleCreatePassword = useCallback(async (parentId: string, name: string) => {
    setEditingId(null);
    setShowForm(true);
    // Set initial data for form
    setSelectedPassword({ 
      id: 'new',
      name: name,
      type: 'password',
      parent_id: parentId === 'root' ? null : parentId,
      password: '',
      created_by: 0,
      title: name // Map name to title for form
    } as any);
  }, []);

  const handleCreateFolder = useCallback(async (parentId: string, name: string) => {
    if (!name || !name.trim()) {
      toast.error('Folder name cannot be empty');
      return;
    }

    try {
      lastLocalChangeAtRef.current = Date.now();
      const result = await api.createPassword({
        workspace_id: currentWorkspace,
        title: name.trim(),
        type: 'folder',
        parent_id: parentId === 'root' ? null : parentId,
        username: '', // Empty for folders
        password: '' // Empty for folders
      });

      if (result.success) {
        const newFolderId = result.id;
        toast.success(`Folder "${name.trim()}" created`);
        await fetchTree(currentWorkspace);

        // Auto-expand parent folder if created inside a folder
        if (parentId && parentId !== 'root') {
          setExpanded(prev => ({ ...prev, [parentId]: true }));
        }

        // Mark folder for auto-selection after tree refresh
        if (newFolderId) {
          setPendingSelection(newFolderId);
        }
      } else {
        toast.error((result as any).detail || 'Failed to create folder');
      }
    } catch (error: any) {
      console.error('Error creating folder:', error);
      const errorMessage = error.detail || error.message || error.toString() || 'Failed to create folder';
      toast.error(errorMessage);
    }
  }, [currentWorkspace, fetchTree]);

  const handleDelete = useCallback(async (id: string) => {
    setSelected(prev => prev.filter(s => s.id !== id));
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.deletePassword(id);
      toast.success('Deleted');
      await fetchTree(currentWorkspace);
      if (selectedPassword?.id === id) {
        setSelectedPassword(null);
      }
    } catch (error) {
      toast.error('Error deleting');
    }
  }, [currentWorkspace, selectedPassword]);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      await api.renamePassword(id, newName);
      toast.success('Renamed');
      await fetchTree(currentWorkspace);
    } catch (error) {
      toast.error('Error renaming');
    }
  }, [currentWorkspace]);

  const handleMove = useCallback(async (id: string, newParentId: string | null) => {
    try {
      lastLocalChangeAtRef.current = Date.now();
      const result = await api.updatePassword(id, {
        parent_id: newParentId === 'root' ? null : newParentId,
      });
      if (result.success) {
        const findNode = (nodes: PasswordItem[], targetId: string): PasswordItem | null => {
          for (const node of nodes) {
            if (node.id === targetId) return node;
            if (node.children) {
              const found = findNode(node.children, targetId);
              if (found) return found;
            }
          }
          return null;
        };
        const activeNode = findNode(tree, id);
        if (activeNode) {
          toast.success(`"${activeNode.name}" moved`);
        }
        await fetchTree(currentWorkspace);
      }
    } catch (error) {
      toast.error('Error moving');
    }
  }, [tree, currentWorkspace]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    try {
      const findNode = (nodes: PasswordItem[], targetId: string): PasswordItem | null => {
        for (const node of nodes) {
          if (node.id === targetId) return node;
          if (node.children) {
            const found: PasswordItem | null = findNode(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      // Determine items to move
      const activeIdStr = active.id as string;
      const isMultiSelect = selected.some(item => item.id === activeIdStr);
      const itemsToMove = isMultiSelect ? selected : [findNode(tree, activeIdStr)].filter((n): n is PasswordItem => n !== null);

      if (itemsToMove.length === 0) return;

      // Determine target
      const targetId = over.id === 'root-drop-zone' ? 'root' : over.id as string;
      let targetNode: PasswordItem | null = null;
      
      // Check if dropping on root zone or a folder
      if (targetId === 'root') {
        // Root drop
      } else {
        targetNode = findNode(tree, targetId);
        if (!targetNode || targetNode.type !== 'folder') return;
      }

      // Execute moves
      let successCount = 0;
      const errors: string[] = [];

      for (const item of itemsToMove) {
        // Skip if moving into itself or if parent is already target
        if (item.id === targetId) continue;
        if (item.parent_id === targetId || (item.parent_id === null && targetId === 'root')) continue;

        try {
          await handleMove(item.id, targetId === 'root' ? null : targetId);
          successCount++;
        } catch (err) {
          errors.push(item.name);
        }
      }

      if (successCount > 0) {
        const targetName = targetId === 'root' ? 'root' : `"${targetNode?.name}"`;
        const message = itemsToMove.length === 1 
          ? `"${itemsToMove[0].name}" moved to ${targetName}`
          : `${successCount} items moved to ${targetName}`;
        toast.success(message);
      }

      if (errors.length > 0) {
        toast.error(`Failed to move: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }

    } catch (error) {
      console.error('Error in drag end:', error);
    }
  }, [tree, handleMove, selected]);

  const handleAddPasswordTag = async (passwordId: string, name: string) => {
    try {
      const currentTags = passwordTags[passwordId] || [];
      const newTags = [...currentTags.map(t => t.name), name];
      lastLocalChangeAtRef.current = Date.now(); // Prevent echo
      const result = await api.updatePasswordTags(passwordId, newTags);
      if (result.success) {
        setPasswordTags(prev => ({ ...prev, [passwordId]: result.tags }));
        await loadAllTags();
        toast.success('Tag added');
      }
    } catch (error) {
      toast.error('Failed to add tag');
      throw error;
    }
  };

  const handleRemovePasswordTag = async (passwordId: string, tagId: string) => {
    try {
      const currentTags = passwordTags[passwordId] || [];
      const newTags = currentTags.filter(t => t.id !== tagId).map(t => t.name);
      lastLocalChangeAtRef.current = Date.now(); // Prevent echo
      const result = await api.updatePasswordTags(passwordId, newTags);
      if (result.success) {
        setPasswordTags(prev => ({ ...prev, [passwordId]: result.tags }));
        toast.success('Tag removed');
      }
    } catch (error) {
      toast.error('Failed to remove tag');
      throw error;
    }
  };

  const handleCreate = async (formData: PasswordFormData, formTags: TagType[]) => {
    setIsLoading(true);

    try {
      // Get parent_id from selectedPassword if it's a new password created from context menu
      const parentId = selectedPassword && selectedPassword.id === 'new' 
        ? selectedPassword.parent_id 
        : null;

      const result = await api.createPassword({
        workspace_id: currentWorkspace,
        title: formData.title,
        username: formData.username,
        password: formData.password,
        url: formData.url || undefined,
        notes: formData.notes || undefined,
        type: 'password',
        parent_id: parentId
      });

      if (result.success) {
        // Add tags if any were selected
        if (formTags.length > 0 && result.id) {
          try {
            const tagNames = formTags.map(t => t.name);
            await api.updatePasswordTags(result.id, tagNames);
          } catch (error) {
            console.error('Error adding tags:', error);
            // Don't fail the creation if tags fail
          }
        }

        toast.success('Password created');
        setShowForm(false);
        setSelectedPassword(null);
        await fetchTree(currentWorkspace);

        if (result.id) {
          fetchPasswordDetail(result.id);
        }
      }
    } catch (error: any) {
      toast.error(error.detail || 'Error creating password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (formData: PasswordFormData, formTags: TagType[]) => {
    if (!editingId) return;

    setIsLoading(true);
    try {
      const result = await api.updatePassword(editingId, {
        title: formData.title,
        username: formData.username,
        password: formData.password,
        url: formData.url || undefined,
        notes: formData.notes || undefined
      });

      if (result.success) {
        // Update tags if they were changed in the form
        if (editingId) {
          try {
            const currentTags = passwordTags[editingId] || [];
            const currentTagNames = currentTags.map(t => t.name.toLowerCase()).sort();
            const formTagNames = formTags.map(t => t.name.toLowerCase()).sort();

            // Only update if tags changed
            if (JSON.stringify(currentTagNames) !== JSON.stringify(formTagNames)) {
              const tagNames = formTags.map(t => t.name);
              await api.updatePasswordTags(editingId, tagNames);
            }
          } catch (error) {
            console.error('Error updating tags:', error);
            // Don't fail the update if tags fail
          }
        }

        toast.success('Password updated');
        setShowForm(false);
        const modifiedId = editingId;
        
        // Unlock
        if (modifiedId && user) {
            await api.unlockPassword(modifiedId, String(user.id));
        }
        
        setEditingId(null);
        await fetchTree(currentWorkspace);

        if (modifiedId) {
          fetchPasswordDetail(modifiedId);
        }
      } else {
        toast.error((result as any).detail || 'Failed to update password');
      }
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.detail || 'Server connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    const { id } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      const response = await fetch(`/api/vault/passwords/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403) {
          toast.error('Permission denied: write or admin access required');
        } else {
          toast.error(data.detail || 'Failed to delete');
        }
        return;
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Password deleted');
        fetchTree(currentWorkspace);
        if (selectedPassword?.id === id) {
          setSelectedPassword(null);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Server connection error');
    }
  };

  // Resizing handlers
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Filter tree function (similar to DocumentsApp)
  const filterTree = useCallback((nodes: PasswordItem[], query: string, tagIds: string[]): PasswordItem[] => {
    const lowerQuery = query.trim().toLowerCase();
    const hasTagFilter = tagIds.length > 0;
    
    const filterNode = (node: PasswordItem): PasswordItem | null => {
      const nameMatches = !lowerQuery || node.name.toLowerCase().includes(lowerQuery);
      
      let tagMatches = true;
      if (hasTagFilter && node.type === 'password') {
        const nodeTagIds = (passwordTags[node.id] || []).map(t => t.id);
        tagMatches = tagIds.some(tagId => nodeTagIds.includes(tagId));
        if (!passwordTags[node.id]) {
          loadPasswordTags(node.id);
        }
      }
      
      if (node.type === 'folder') {
        // For folders, check children if they exist
        if (node.children && node.children.length > 0) {
          const filteredChildren = node.children
            .map(child => filterNode(child))
            .filter((child): child is PasswordItem => child !== null);
          
          // Show folder if name matches OR if it has matching children
          if (nameMatches || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
        } else {
          // Folder without children: show if name matches
          if (nameMatches) {
            return { ...node, children: [] };
          }
        }
      } else if (nameMatches && tagMatches) {
        // For passwords, both name and tag must match
        return node;
      }
      
      return null;
    };
    
    return nodes
      .map(node => filterNode(node))
      .filter((node): node is PasswordItem => node !== null);
  }, [passwordTags, loadPasswordTags]);
  
  const filteredTree = filterTree(tree, searchQuery, selectedTags);

  return (
    <React.Fragment>
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 overflow-hidden flex" style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
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
        {/* Password Tree */}
        <div className="flex flex-col" style={{ width: sidebarWidth }}>
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <PasswordTree
              tree={filteredTree}
              expanded={expanded}
              selected={selected}
              onToggleExpand={handleToggleExpand}
              onExpandAll={handleExpandAll}
              onCollapseAll={handleCollapseAll}
              onSelect={handleSelectPassword}
              onSelectAll={handleSelectAll}
              onCreate={userPermission !== 'read' ? handleCreatePassword : undefined}
              onCreateFolder={userPermission !== 'read' ? handleCreateFolder : undefined}
              onDelete={userPermission !== 'read' ? handleDelete : undefined}
              onRename={userPermission !== 'read' ? handleRename : undefined}
              width={sidebarWidth}
              readOnly={userPermission === 'read'}
              userPermission={userPermission}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              allTags={allTags}
              selectedTags={selectedTags}
              onTagFilterChange={setSelectedTags}
              onCollapseSidebar={toggleSidebar}
            />
            <DragOverlay dropAnimation={null}>
              {activeId ? (() => {
                const findNode = (nodes: PasswordItem[], id: string): PasswordItem | null => {
                  for (const node of nodes) {
                    if (node.id === id) return node;
                    if (node.children) {
                      const found = findNode(node.children, id);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                const activeNode = findNode(tree, activeId);
                return activeNode ? (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl px-4 py-2 flex items-center gap-2 cursor-grabbing">
                    {activeNode.type === 'folder' ? (
                      <Folder size={16} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Key size={16} className="text-gray-600 dark:text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{activeNode.name}</span>
                  </div>
                ) : null;
              })() : null}
            </DragOverlay>
          </DndContext>
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

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900">
          {showForm ? (
            <PasswordForm
              isEditing={!!editingId}
              workspaceId={currentWorkspace}
              initialData={editingId && selectedPassword ? {
                title: selectedPassword.name,
                username: selectedPassword.username || '',
                password: selectedPassword.password || '',
                url: selectedPassword.url || '',
                notes: selectedPassword.notes || ''
              } : selectedPassword ? {
                title: selectedPassword.name,
                username: '',
                password: '',
                url: '',
                notes: ''
              } : undefined}
              initialTags={editingId && selectedPassword ? passwordTags[selectedPassword.id] || [] : []}
              allTags={allTags}
              onSubmit={editingId ? handleUpdate : handleCreate}
              onCancel={handleCancelEditing}
              isLoading={isLoading}
            />
          ) : selectedPassword ? (
            <PasswordDetailView
              password={selectedPassword}
              tags={passwordTags[selectedPassword.id] || []}
              allTags={allTags}
              onEdit={handleStartEditing}
              onDelete={() => setDeleteConfirm({ id: selectedPassword.id, title: selectedPassword.name })}
              onAddTag={(name) => handleAddPasswordTag(selectedPassword.id, name)}
              onRemoveTag={(tagId) => handleRemovePasswordTag(selectedPassword.id, tagId)}
              readOnly={userPermission === 'read'}
              presenceUsers={presence[selectedPassword.id]}
              lockedBy={findPasswordLockInfo(selectedPassword.id)}
              currentUserId={user?.id ? String(user.id) : undefined}
              onUnlock={handleUnlock}
              isEditing={editingId === selectedPassword.id}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <Lock className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <p className="text-lg">Select a password to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Confirm Delete Modal */}
    <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Delete password"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </React.Fragment>
  );
};

export default VaultPage;
