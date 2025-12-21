import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Document, Tag } from './types';
import { api } from './services/api';
import { websocket } from './services/websocket';
import { sessionStorageService } from './services/sessionStorage';
import { useWorkspace } from './contexts/WorkspaceContext';
import { useAuth } from './contexts/AuthContext';
import DocumentTree from './components/DocumentTree';
import DocumentViewer from './components/DocumentViewer';
import DocumentEditor from './components/DocumentEditor';
import MCPConfigModal from './components/MCPConfigModal';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { File, Folder, X, Trash2 } from 'lucide-react';
import { getHashSelection, setHashSelection, onHashChange } from './utils/urlHash';

function App() {
  const { user } = useAuth();
  const { currentWorkspace, userPermission } = useWorkspace();
  const [tree, setTree] = useState<Document[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selected, setSelected] = useState<Document[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, Array<{ id: string; username: string }>>>({});
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
  const pendingSelectionRef = useRef<string | null>(null);
  const expandedRef = useRef<Record<string, boolean>>({});
  
  // MCP Configuration state
  const [mcpConfigs, setMcpConfigs] = useState<Record<string, any>>({}); // folder_id -> config
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [mcpModalFolderId, setMcpModalFolderId] = useState<string | null>(null);
  const [mcpModalConfig, setMcpModalConfig] = useState<any | null>(null);
  const [mcpModalFolderPath, setMcpModalFolderPath] = useState<string | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    pendingSelectionRef.current = pendingSelection;
  }, [pendingSelection]);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);
  const prevTreeRef = React.useRef<Document[] | null>(null);
  const lastLocalChangeAtRef = React.useRef<number>(0);
  const processingHashRef = React.useRef<boolean>(false);
  const userInitiatedSelectionRef = React.useRef<boolean>(false);
  const treeRef = React.useRef<Document[]>([]);
  const selectedRef = React.useRef<Document[]>([]);
  
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
      
      if (node.type === 'folder') {
        // Filter children recursively
        const filteredChildren = (node.children || [])
          .map(child => filterNode(child))
          .filter((child): child is Document => child !== null);
        
        // Keep folder if:
        // 1. No search query (show all folders)
        // 2. Name matches search query
        // 3. Has matching children
        if (!lowerQuery || nameMatches || filteredChildren.length > 0) {
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
  
  // Keep refs in sync with state
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);
  
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  
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

  // Load MCP configs for current workspace
  const loadMcpConfigs = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const response = await fetch(`/api/mcp/configs/by-workspace/${currentWorkspace}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        // Create a map: folder_id -> config
        const configMap: Record<string, any> = {};
        data.configs.forEach((config: any) => {
          if (config.folder_id) {
            configMap[config.folder_id] = config;
            console.log(`📋 MCP Config mapped: folder_id=${config.folder_id}, is_active=${config.is_active}`);
          } else {
            console.warn('⚠️ MCP Config without folder_id:', config);
          }
        });
        console.log(`📋 MCP Configs loaded for workspace ${currentWorkspace}:`, configMap);
        console.log(`📋 Total configs: ${data.configs.length}, Mapped: ${Object.keys(configMap).length}`);
        setMcpConfigs(configMap);
      } else {
        console.error('❌ Failed to load MCP configs:', data);
      }
    } catch (error) {
      console.error('Error loading MCP configs:', error);
    }
  }, [currentWorkspace]);

  // Load tags when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadAllTags();
      loadMcpConfigs();
      setSelectedTags([]);
    }
  }, [currentWorkspace, loadAllTags, loadMcpConfigs]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load tree from API with workspace
        const result = await api.getTree(currentWorkspace);
        setTree(result.tree);
        prevTreeRef.current = result.tree;
        treeRef.current = result.tree;

        // Load session state
        const sessionState = sessionStorageService.loadState();
        if (sessionState) {
          setExpanded(sessionState.expandedNodes);
          
          // Restore tree width if exists
          const savedWidth = localStorage.getItem('markd_tree_width');
          if (savedWidth) {
            setTreeWidth(parseInt(savedWidth, 10));
          }
          
          // Restore selected documents (try URL hash first, then sessionStorage, then fallback)
          let selectedIds: string[] = getHashSelection('document');
          
          // Fallback to sessionStorage if no hash
          if (selectedIds.length === 0) {
            const savedSelectedIdsJson = sessionStorage.getItem('markd_documents_selected_ids');
            
            if (savedSelectedIdsJson) {
              try {
                selectedIds = JSON.parse(savedSelectedIdsJson);
                // Update hash with sessionStorage value (only if different)
                const currentHashIds = getHashSelection('document');
                if (JSON.stringify(currentHashIds.sort()) !== JSON.stringify(selectedIds.sort())) {
                  setHashSelection('document', selectedIds);
                }
              } catch (e) {
                console.error('Error parsing saved selected IDs:', e);
              }
            }
          }
          
          // Fallback to single selection if no multi-selection saved
          if (selectedIds.length === 0 && sessionState.selectedId) {
            selectedIds = [sessionState.selectedId];
            const currentHashIds = getHashSelection('document');
            if (JSON.stringify(currentHashIds) !== JSON.stringify(selectedIds)) {
              setHashSelection('document', selectedIds);
            }
          }
          
          if (selectedIds.length > 0) {
            // Find all items in tree
            const findItem = (nodes: Document[], targetId: string): Document | null => {
              for (const node of nodes) {
                if (node.id === targetId) return node;
                if (node.children) {
                  const found = findItem(node.children, targetId);
                  if (found) return found;
                }
              }
              return null;
            };
            
            const foundItems: Document[] = [];
            const pathsToExpand: string[][] = [];
            
            const findItemWithPath = (nodes: Document[], targetId: string, path: string[] = []): Document | null => {
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
                // Load content for the first file before setting selection to avoid visual jump
                const firstFile = foundItems.find(item => item.type === 'file');
                if (firstFile) {
                  api.getDocument(firstFile.id).then(docResult => {
                    if (docResult.success) {
                      setEditContent(docResult.document.content || '');
                      // Update the selected document with full content
                      const updatedItems = foundItems.map(item => 
                        item.id === firstFile.id 
                          ? { ...item, content: docResult.document.content || '' }
                          : item
                      );
                      setSelected(updatedItems);
                    } else {
                      setSelected(foundItems);
                    }
                  }).catch(err => {
                    console.error('Error loading document content:', err);
                    setSelected(foundItems);
                  });
                } else {
                  // No file selected, clear edit content
                  setEditContent('');
                  setSelected(foundItems);
                }
                
                // Reset flag after a short delay
                setTimeout(() => {
                  isRestoringRef.current = false;
                }, 200);
              }, 100);
            } else {
              // Items not found, clear selection
              sessionStorageService.saveState({
                expandedNodes: sessionState.expandedNodes,
                selectedId: null,
              });
              sessionStorage.removeItem('markd_documents_selected_ids');
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
    
    // Listen to hash changes (when navigating back to this module)
    const cleanup = onHashChange((selections) => {
      // Prevent processing if already restoring to avoid infinite loop
      if (isRestoringRef.current) {
        return;
      }
      
      // Don't restore if the change was initiated by user click
      if (userInitiatedSelectionRef.current) {
        return;
      }
      
      const hashIds = selections.document;
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
        
        // Restore selection from hash
        const findItemWithPath = (nodes: Document[], targetId: string, path: string[] = []): Document | null => {
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
        
        const foundItems: Document[] = [];
        for (const id of hashIds) {
          const item = findItemWithPath(currentTree, id);
          if (item) foundItems.push(item);
        }
        
        if (foundItems.length > 0) {
          const firstFile = foundItems.find(item => item.type === 'file');
          if (firstFile) {
            // Load content before setting selection to avoid visual jump
            api.getDocument(firstFile.id).then(docResult => {
              if (docResult.success) {
                setEditContent(docResult.document.content || '');
                // Update the selected document with full content
                const updatedItems = foundItems.map(item => 
                  item.id === firstFile.id 
                    ? { ...item, content: docResult.document.content || '' }
                    : item
                );
                setSelected(updatedItems);
              } else {
                setSelected(foundItems);
              }
            }).catch(() => {
              setSelected(foundItems);
            });
          } else {
            setSelected(foundItems);
          }
          // Reset flag after a short delay
          setTimeout(() => {
            isRestoringRef.current = false;
          }, 200);
        } else {
          isRestoringRef.current = false;
        }
      }
    });
    
    return cleanup;
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
      console.log('🟢 [PENDING SELECTION] Processing:', pendingSelection, 'Tree nodes:', tree.length);
      
      // Helper to find path to target node
      const findPathToNode = (nodes: Document[], targetId: string, path: string[] = []): string[] | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return path; // Return path to parent (not including target itself)
          }
          if (node.children) {
            const newPath = [...path, node.id];
            const result = findPathToNode(node.children, targetId, newPath);
            if (result) return result;
          }
        }
        return null;
      };

      // Find path to the target node
      const pathToNode = findPathToNode(tree, pendingSelection);
      console.log('🟢 [PENDING SELECTION] Path to node:', pathToNode);
      
      if (pathToNode) {
        // Expand only the path to the node (not the whole tree)
        setExpanded(prev => {
          const newExpanded = { ...prev };
          pathToNode.forEach(nodeId => {
            newExpanded[nodeId] = true;
          });
          console.log('🟢 [PENDING SELECTION] Expanded path:', pathToNode, 'all expanded:', Object.keys(newExpanded));
          return newExpanded;
        });
      } else {
        console.warn('🟡 [PENDING SELECTION] Path to node not found, node might be at root');
      }

      // Then find and select the item - also expand parent if needed
      const findAndSelectItem = (nodes: Document[], targetId: string, parentPath: string[] = []): Document | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            console.log('✅ [PENDING SELECTION] Found folder:', node.name, node.id, 'type:', node.type, 'parentPath:', parentPath);
            return node;
          }
          if (node.children) {
            const newPath = [...parentPath, node.id];
            const found = findAndSelectItem(node.children, targetId, newPath);
            if (found) return found;
          }
        }
        return null;
      };
      
      // Find the node first
      const foundNode = findAndSelectItem(tree, pendingSelection);
      
      if (foundNode) {
        // Calculate parent path
        const calculateParentPath = (nodes: Document[], targetId: string, path: string[] = []): string[] => {
          for (const node of nodes) {
            if (node.id === targetId) {
              return path;
            }
            if (node.children) {
              const newPath = [...path, node.id];
              const result = calculateParentPath(node.children, targetId, newPath);
              if (result.length >= 0 && (result.length > 0 || node.id === targetId)) {
                return result;
              }
            }
          }
          return [];
        };
        
        const parentPath = calculateParentPath(tree, pendingSelection);
        console.log('✅ [PENDING SELECTION] Parent path calculated:', parentPath);
        
        // Expand all parents in the path
        if (parentPath.length > 0) {
          setExpanded(prev => {
            const newExpanded = { ...prev };
            parentPath.forEach(parentId => {
              newExpanded[parentId] = true;
            });
            console.log('✅ [PENDING SELECTION] Expanded parent path:', parentPath);
            return newExpanded;
          });
        }
        
        // Select the folder (single selection for auto-select)
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          setSelected([foundNode]);
          setPendingSelection(null);
          pendingSelectionRef.current = null;
          console.log('✅ [PENDING SELECTION] Selected folder:', foundNode.name, foundNode.id);
        });
      } else {
        // Node not found in tree yet - this is expected when the folder was just created
        // The WebSocket handler will reload the tree and then process pendingSelection
        // So we just log and wait - don't clear pendingSelection here!
        console.log('🟡 [PENDING SELECTION] Node not found in tree yet, waiting for WebSocket reload:', pendingSelection);
        // DO NOT clear pendingSelection here - let the WebSocket handler process it
      }
    }
  }, [pendingSelection, tree]);


  // Emit presence events when selection changes
  useEffect(() => {
    if (!user) return;

    // Leave previous document(s)
    // For now, we only track presence on single selection
    
    // Join new document if single selection
    const currentDocumentId = selected.length === 1 ? selected[0].id : null;
    
    if (currentDocumentId) {
      websocket.joinDocument(currentDocumentId);
    }

    // Cleanup: leave when selection changes or unmount
    return () => {
      if (currentDocumentId) {
        websocket.leaveDocument(currentDocumentId);
      }
    };
  }, [selected, user]);

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
      }, 120000); // Every 2 minutes
      
      return () => clearInterval(interval);
    }
  }, [editMode, selected, getUserId]);

  const handleSelectDocument = useCallback(async (doc: Document, event?: React.MouseEvent) => {
    // Mark this as user-initiated selection to prevent hash-based restoration
    userInitiatedSelectionRef.current = true;
    
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
    
    // Reset flag after a short delay
    setTimeout(() => {
      userInitiatedSelectionRef.current = false;
    }, 500);
    
    // If it's a file, load it for editing (only if single selection)
    if (doc.type === 'file' && (!event || (!event.ctrlKey && !event.metaKey && !event.shiftKey))) {
      try {
        // Use setHashSelection instead of direct hash change to avoid triggering hashchange event
        setHashSelection('document', [doc.id]);

        // If currently in edit mode, unlock the previous document (only if different)
        if (editMode && selected.length > 0 && selected[0].id !== doc.id) {
          const userId = getUserId();
          await api.unlockDocument(selected[0].id, userId);
          setEditMode(false);
        }

        // Pre-load content before updating selection to avoid visual jump
        // Get full document with latest content first
        const result = await api.getDocument(doc.id);
        if (result.success) {
          // Update content before selection to ensure smooth transition
          setEditContent(result.document.content || '');
          
          // Update the selected document with the full content to avoid visual jump
          const updatedDoc = { ...doc, content: result.document.content || '' };
          setSelected([updatedDoc]);
          
          // Only close edit mode if selecting a different document
          if (selected.length === 0 || selected[0].id !== doc.id) {
            setEditMode(false);
          }
        } else {
          // If API call fails, still set selection but keep old content
          setSelected([doc]);
        }
      } catch (err) {
        console.error('Error loading document:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
        // Set selection anyway to show the document in the tree
        setSelected([doc]);
      }
    }
  }, [editMode, selected, getUserId, tree, flattenTree, lastSelectedIndex]);

  const expandToAndSelect = useCallback(async (id: string, treeDataLocal: Document[]) => {
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
  }, [handleSelectDocument]);

  // Toast on content updates coming from other users

  // Save session state when it changes (including all selected items)
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
        // Only update hash if different from current to avoid loop
        const currentHashIds = getHashSelection('document');
        if (JSON.stringify(currentHashIds.sort()) !== JSON.stringify(ids.sort())) {
          setHashSelection('document', ids);
        }
        sessionStorage.setItem('markd_documents_selected_ids', JSON.stringify(ids));
      } else {
        // Only clear hash if it's not already empty
        const currentHashIds = getHashSelection('document');
        if (currentHashIds.length > 0) {
          setHashSelection('document', []);
        }
        sessionStorage.removeItem('markd_documents_selected_ids');
      }
    } catch (error) {
      console.error('Error saving selected documents:', error);
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
    console.log('🔵 [CREATE FOLDER] Starting - name:', name, 'parentId:', parentId, 'workspace:', currentWorkspace);
    try {
      lastLocalChangeAtRef.current = Date.now();
      
      // Calculate path to parent before creating (to expand only this path)
      const findPathToNode = (nodes: Document[], targetId: string, path: string[] = []): string[] | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return path; // Return path to this node
          }
          if (node.children) {
            const newPath = [...path, node.id];
            const result = findPathToNode(node.children, targetId, newPath);
            if (result) return result;
          }
        }
        return null;
      };
      
      // Expand path to parent before creating
      if (parentId && parentId !== 'root') {
        const pathToParent = findPathToNode(tree, parentId);
        console.log('🔵 [CREATE FOLDER] Path to parent:', pathToParent);
        if (pathToParent) {
          // Update ref IMMEDIATELY (synchronous) before setExpanded (async)
          const newExpanded = { ...expandedRef.current };
          pathToParent.forEach(nodeId => {
            newExpanded[nodeId] = true;
          });
          // Also expand the parent itself
          newExpanded[parentId] = true;
          expandedRef.current = newExpanded; // Update ref synchronously
          setExpanded(newExpanded); // Update state
          console.log('🔵 [CREATE FOLDER] Expanded path:', Object.keys(newExpanded));
        } else {
          // If path not found, at least expand the parent
          console.log('🔵 [CREATE FOLDER] Path not found, expanding parent only:', parentId);
          expandedRef.current = { ...expandedRef.current, [parentId]: true }; // Update ref synchronously
          setExpanded(prev => ({ ...prev, [parentId]: true }));
        }
      }
      
      console.log('🔵 [CREATE FOLDER] Calling API with:', { name, type: 'folder', parent_id: parentId, workspace_id: currentWorkspace });
      
      const result = await api.createDocument({
        name,
        type: 'folder',
        parent_id: parentId,
        workspace_id: currentWorkspace,
      });
      
      console.log('🔵 [CREATE FOLDER] API Response:', result);
      
      // Store the created folder ID for auto-selection after tree update
      if (result.success && result.document) {
        const folderId = result.document.id;
        console.log('✅ [CREATE FOLDER] SUCCESS - Folder created:', result.document.name, 'ID:', folderId, 'Parent:', parentId);
        // Update both state and ref IMMEDIATELY with REAL ID (before WebSocket can arrive)
        // Use a synchronous update to ensure the ref is set before any async operations
        pendingSelectionRef.current = folderId;
        setPendingSelection(folderId);
        console.log('✅ [CREATE FOLDER] Set pendingSelection:', folderId, 'ref:', pendingSelectionRef.current);
        // Ensure parent is expanded immediately (before WebSocket reload)
        if (parentId && parentId !== 'root') {
          // Update ref synchronously to ensure WebSocket handler sees the latest state
          expandedRef.current = { ...expandedRef.current, [parentId]: true };
          setExpanded(prev => {
            const updated = { ...prev, [parentId]: true };
            console.log('✅ [CREATE FOLDER] Expanded parent:', parentId, 'expanded state:', Object.keys(updated));
            return updated;
          });
        } else if (parentId === 'root') {
          // For root, ensure root is expanded
          setExpanded(prev => ({ ...prev, root: true }));
        }
      } else {
        console.error('❌ [CREATE FOLDER] FAILED - API response:', result);
        pendingSelectionRef.current = null;
        toast.error('Échec de la création du dossier');
      }
    } catch (err) {
      console.error('❌ [CREATE FOLDER] ERROR:', err);
      setError(err instanceof Error ? err.message : 'Failed to create folder');
      toast.error('Erreur lors de la création du dossier');
    }
  }, [currentWorkspace, tree]);

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
  }, [currentWorkspace, expandToAndSelect]);

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

  const handleUnlock = useCallback(async () => {
    if (selected.length !== 1) return;
    const doc = selected[0];
    const userId = getUserId();

    try {
      await api.unlockDocument(doc.id, userId);
      toast.success('Verrou retiré');
    } catch (err) {
      console.error('Error unlocking:', err);
      toast.error('Impossible de retirer le verrou');
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

  // Handle URL hash for deep linking
  useEffect(() => {
    if (loading || tree.length === 0) return;

    const handleHashChange = async () => {
      // Don't restore if the change was initiated by user click
      if (userInitiatedSelectionRef.current) {
        return;
      }
      
      const hash = window.location.hash;
      if (hash.startsWith('#doc=')) {
        const docId = hash.replace('#doc=', '');
        if (docId && selected.length > 0 && selected[0].id === docId) {
          // Already selected, skip to avoid loop
          return;
        }
        if (docId) {
          processingHashRef.current = true;
          await expandToAndSelect(docId, tree);
          processingHashRef.current = false;
        }
      }
    };

    // Check initial hash only on mount
    const initialHash = window.location.hash;
    if (initialHash.startsWith('#doc=')) {
      const docId = initialHash.replace('#doc=', '');
      if (docId) {
        processingHashRef.current = true;
        expandToAndSelect(docId, tree).then(() => {
          processingHashRef.current = false;
        });
      }
    }

    // Listen for changes (only for navigation, not user-initiated)
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [loading, tree, expandToAndSelect]);

  // Setup WebSocket connection
  useEffect(() => {
    websocket.connect();

    const unsubscribePresence = websocket.onPresenceUpdate((documentId, users) => {
      setPresence(prev => ({
        ...prev,
        [documentId]: users
      }));
    });

    const unsubscribeTreeChanged = websocket.onTreeChanged(async () => {
      // Reload current workspace when tree changes
      try {
        // Preserve current expansion state and pending selection before reloading
        // Use ref to get the LATEST expanded state (may have been updated by handleCreateFolder)
        const currentExpanded = { ...expandedRef.current };
        // Use ref to get the latest pendingSelection value (may have been set after WebSocket event)
        // Skip if it's a temp ID (will be updated after API response)
        const currentPendingSelection = (pendingSelectionRef.current && !pendingSelectionRef.current.startsWith('temp-')) 
          ? pendingSelectionRef.current 
          : (pendingSelection && !pendingSelection.startsWith('temp-') ? pendingSelection : null);
        
        console.log('🟡 [WEBSOCKET] tree_changed received - currentExpanded:', Object.keys(currentExpanded), 'pendingSelection:', currentPendingSelection, 'ref:', pendingSelectionRef.current);
        
        const result = await api.getTree(currentWorkspace);
        console.log('🟡 [WEBSOCKET] Tree reloaded - nodes:', result.tree?.length || 0);
        
        // Debug: Check if pendingSelection node exists in the reloaded tree and log folder-guides children
        if (currentPendingSelection) {
          const checkNodeExists = (nodes: Document[], targetId: string): boolean => {
            for (const node of nodes) {
              if (node.id === targetId) return true;
              if (node.children && checkNodeExists(node.children, targetId)) return true;
            }
            return false;
          };
          const exists = checkNodeExists(result.tree, currentPendingSelection);
          console.log('🟡 [WEBSOCKET] PendingSelection exists in reloaded tree:', exists, 'ID:', currentPendingSelection);
          
          // Log the structure of folder-guides to see what's inside
          const findFolder = (nodes: Document[], folderId: string): Document | null => {
            for (const node of nodes) {
              if (node.id === folderId) return node;
              if (node.children) {
                const found = findFolder(node.children, folderId);
                if (found) return found;
              }
            }
            return null;
          };
          const parentFolder = findFolder(result.tree, 'folder-guides');
          if (parentFolder) {
            console.log('🟡 [WEBSOCKET] folder-guides found, children count:', parentFolder.children?.length || 0);
            console.log('🟡 [WEBSOCKET] folder-guides children:', parentFolder.children?.map(c => ({ id: c.id, name: c.name, type: c.type })) || []);
          } else {
            console.warn('🟡 [WEBSOCKET] folder-guides not found in tree');
          }
        }

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
        treeRef.current = result.tree;
        
        // If we have a pending selection, process it FIRST before preserving expansion
        if (currentPendingSelection && result.tree.length > 0) {
          console.log('🟡 [WEBSOCKET] Processing pendingSelection:', currentPendingSelection);
          
          // Helper to find and select the node
          const findAndSelectNode = (nodes: Document[], targetId: string, parentPath: string[] = []): Document | null => {
            for (const node of nodes) {
              if (node.id === targetId) {
                console.log('✅ [WEBSOCKET] Found pendingSelection node:', node.name, node.id, 'parentPath:', parentPath);
                return node;
              }
              if (node.children) {
                const newPath = [...parentPath, node.id];
                const found = findAndSelectNode(node.children, targetId, newPath);
                if (found) return found;
              }
            }
            return null;
          };
          
          const foundNode = findAndSelectNode(result.tree, currentPendingSelection);
          
          if (foundNode) {
            // Calculate path to node for expansion
            const findPathToNode = (nodes: Document[], targetId: string, path: string[] = []): string[] | null => {
              for (const node of nodes) {
                if (node.id === targetId) {
                  return path; // Return path to this node
                }
                if (node.children) {
                  const newPath = [...path, node.id];
                  const result = findPathToNode(node.children, targetId, newPath);
                  if (result) return result;
                }
              }
              return null;
            };
            
            const pathToNode = findPathToNode(result.tree, currentPendingSelection);
            console.log('🟡 [WEBSOCKET] Path to pendingSelection:', pathToNode);
            
            // Merge preserved expansion with path expansion
            setExpanded(prev => {
              const newExpanded = { ...prev, ...currentExpanded };
              // Expand path to node
              if (pathToNode !== null) {
                pathToNode.forEach(nodeId => {
                  newExpanded[nodeId] = true;
                });
              }
              // If path is empty, ensure root is expanded
              if (pathToNode === null || pathToNode.length === 0) {
                newExpanded.root = true;
              }
              console.log('🟡 [WEBSOCKET] Expanded path:', pathToNode, 'final expanded:', Object.keys(newExpanded));
              return newExpanded;
            });
            
            // Select the node after a short delay to ensure DOM is updated
            requestAnimationFrame(() => {
              setSelected([foundNode]);
              setPendingSelection(null);
              pendingSelectionRef.current = null;
              console.log('✅ [WEBSOCKET] Selected folder:', foundNode.name, foundNode.id);
            });
          } else {
            console.warn('🟡 [WEBSOCKET] pendingSelection node not found in tree:', currentPendingSelection);
            // Preserve expansion even if node not found
            setExpanded(currentExpanded);
            // Try to find parent and expand it
            const findParent = (nodes: Document[], targetId: string, parentId: string | null = null): string | null => {
              for (const node of nodes) {
                if (node.id === targetId) {
                  return parentId;
                }
                if (node.children) {
                  const found = findParent(node.children, targetId, node.id);
                  if (found !== null) return found;
                }
              }
              return null;
            };
            const parentId = findParent(result.tree, currentPendingSelection);
            if (parentId) {
              console.log('🟡 [WEBSOCKET] Found parent, expanding:', parentId);
              setExpanded(prev => ({ ...prev, [parentId]: true }));
            } else {
              console.warn('🟡 [WEBSOCKET] Node not found in tree yet, might need to wait');
            }
          }
        } else {
          // No pending selection, just preserve expansion
          setExpanded(currentExpanded);
          console.log('🟡 [WEBSOCKET] Preserved expansion:', Object.keys(currentExpanded));
        }
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
      unsubscribePresence();
      unsubscribeTreeChanged();
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
        treeRef.current = treeResult.tree;
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

  // Helper function to get folder path
  const getFolderPath = useCallback((folderId: string, treeData: Document[]): string => {
    if (folderId === 'root') {
      return '/';
    }
    
    const buildPath = (itemId: string, nodes: Document[], parentPath: string = ''): string | null => {
      for (const node of nodes) {
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
    
    const path = buildPath(folderId, treeData);
    return path ? `/${path}` : '/';
  }, []);

  // Handle MCP modal
  const handleOpenMcpModal = useCallback(async (folderId: string) => {
    setMcpModalFolderId(folderId);
    
    // Calculate folder path
    const folderPath = getFolderPath(folderId, tree);
    setMcpModalFolderPath(folderPath);
    
    // Try to load existing config
    try {
      const response = await fetch(`/api/mcp/configs/by-folder/${folderId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.config) {
        setMcpModalConfig(data.config);
      } else {
        // No config exists, create it automatically
        try {
          // Ensure destination_path starts with "/"
          let destPath = folderPath || '';
          if (destPath && !destPath.startsWith('/')) {
            destPath = '/' + destPath;
          } else if (!destPath || folderId === 'root') {
            destPath = '/';
          }
          
          const createResponse = await fetch('/api/mcp/configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              workspace_id: currentWorkspace,
              folder_id: folderId,
              source_path: null,
              destination_path: destPath,
              enabled: true,
              is_active: true
            })
          });
          
          const createData = await createResponse.json();
          if (createData.success && createData.config) {
            setMcpModalConfig(createData.config);
            // Reload MCP configs to update the badge
            loadMcpConfigs();
          } else {
            console.error('Error creating MCP config:', createData);
            setMcpModalConfig(null);
          }
        } catch (createError) {
          console.error('Error creating MCP config:', createError);
          setMcpModalConfig(null);
        }
      }
    } catch (error) {
      console.error('Error loading MCP config:', error);
      setMcpModalConfig(null);
    }
    
    setShowMcpModal(true);
  }, [tree, getFolderPath, loadMcpConfigs, currentWorkspace]);

  const handleCloseMcpModal = useCallback(() => {
    setShowMcpModal(false);
    setMcpModalFolderId(null);
    setMcpModalConfig(null);
    setMcpModalFolderPath(null);
    loadMcpConfigs(); // Reload configs after modal closes
  }, [loadMcpConfigs]);

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
            mcpConfigs={mcpConfigs}
            onOpenMcpModal={handleOpenMcpModal}
            workspaceId={currentWorkspace}
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

        {selected.length > 0 && selected[0].type === 'file' ? (
          editMode ? (
            <>
              <div className="flex-1 flex flex-col border-r">
                <DocumentViewer
                  document={{...selected[0], content: editContent}}
                  onEdit={handleStartEdit}
                  currentUserId={getUserId()}
                  presenceUsers={presence[selected[0].id]}
                  onUnlock={handleUnlock}
                  isEditing={true}
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
                document={{...selected[0], content: editContent || selected[0].content}}
                onEdit={handleStartEdit}
                currentUserId={getUserId()}
                presenceUsers={presence[selected[0].id]}
                onUnlock={handleUnlock}
                isEditing={false}
              />
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <p className="text-lg">
                {selected.length > 0 && selected[0].type === 'folder' 
                  ? 'Sélectionnez un fichier pour l\'éditer' 
                  : 'Sélectionnez un document pour l\'éditer'}
              </p>
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
      
      {/* MCP Configuration Modal */}
      {showMcpModal && mcpModalFolderId && (
        <MCPConfigModal
          folderId={mcpModalFolderId}
          config={mcpModalConfig}
          workspaceId={currentWorkspace}
          folderPath={mcpModalFolderPath || '/'}
          onClose={handleCloseMcpModal}
        />
      )}
    </DndContext>
  );
}

export default App;