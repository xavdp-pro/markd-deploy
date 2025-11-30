import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Download,
  Shield,
  Eye,
  Upload,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
  GripVertical,
  Search,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { FileItem, Tag as TagType } from '../types';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';
import InputModal from './InputModal';
import TagFilter from './TagFilter';

interface FileTreeProps {
  tree: FileItem[];
  expanded: Record<string, boolean>;
  selected: FileItem[];
  onToggleExpand: (id: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  onSelect: (file: FileItem, event?: React.MouseEvent) => void;
  onSelectAll?: () => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onDownload?: (file: FileItem) => void;
  onUpload?: (parentId: string, file: File) => void;
  onOpenUploadModal?: (parentId: string | null) => void;
  onUnlock?: (id: string) => void;
  width?: number;
  readOnly?: boolean;
  userPermission?: string;
  workspaceSelector?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onClearSearch?: () => void;
  allTags?: TagType[];
  selectedTags?: string[];
  onTagFilterChange?: (tagIds: string[]) => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileItem;
  onClose: () => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onDownload?: (file: FileItem) => void;
  onUpload?: (parentId: string, file: File) => void;
  onOpenUploadModal?: (parentId: string | null) => void;
  onUnlock?: (id: string) => void;
  readOnly?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onDownload,
  onUpload,
  onOpenUploadModal,
  onUnlock,
}) => {
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {node.type === 'folder' && (
        <>
          <button
            onClick={() => {
              setInputModal({
                isOpen: true,
                title: 'Nouveau document',
                label: 'Nom du document',
                defaultValue: '',
                onConfirm: (name) => {
                  if (onCreate) onCreate(node.id, name);
                  setInputModal(null);
                  onClose();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Plus size={14} />
            Ajouter un document
          </button>
          <button
            onClick={() => {
              setInputModal({
                isOpen: true,
                title: 'Nouveau dossier',
                label: 'Nom du dossier',
                defaultValue: '',
                onConfirm: (name) => {
                  if (onCreateFolder) onCreateFolder(node.id, name);
                  setInputModal(null);
                  onClose();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Folder size={14} />
            Créer un dossier
          </button>
          {onOpenUploadModal ? (
            <button
              onClick={() => {
                onOpenUploadModal(node.id);
                onClose();
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Upload size={14} />
              Importer un fichier
            </button>
          ) : onUpload ? (
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.md,.txt';
                input.onchange = (event) => {
                  const file = (event.target as HTMLInputElement).files?.[0];
                  if (file && onUpload) onUpload(node.id, file);
                };
                input.click();
                onClose();
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Upload size={14} />
              Importer un fichier
            </button>
          ) : null}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
        </>
      )}
      
      {node.id !== 'root' && (
        <>
          <button
            onClick={() => {
              setInputModal({
                isOpen: true,
                title: 'Renommer',
                label: 'Nouveau nom',
                defaultValue: node.name,
                onConfirm: (name) => {
                  if (onRename) onRename(node.id, name);
                  setInputModal(null);
                  onClose();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Edit2 size={14} />
            Renommer
          </button>
          {node.type === 'file' && onDownload && (
            <button
              onClick={() => handleAction(() => onDownload(node))}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Download size={14} />
              Télécharger
            </button>
          )}
          {node.type === 'file' && node.locked_by && onUnlock && (() => {
            const storedUser = localStorage.getItem('markd_user');
            const currentUserId = storedUser ? JSON.parse(storedUser).id : null;
            const isOwner = node.locked_by?.user_id === currentUserId;
            const isAdmin = user?.role === 'admin';
            
            if (isAdmin) {
              return (
                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Déverrouiller le document',
                      message: `Voulez-vous déverrouiller "${node.name}" (verrouillé par ${node.locked_by?.user_name}) ?`,
                      onConfirm: () => {
                        if (onUnlock) onUnlock(node.id);
                        setConfirmModal(null);
                        onClose();
                      }
                    });
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 text-orange-600 flex items-center gap-2"
                >
                  <Unlock size={14} />
                  Unlock (Admin)
                </button>
              );
            } else if (isOwner) {
              return (
                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Débloquer le document',
                      message: `Voulez-vous débloquer "${node.name}" ?`,
                      onConfirm: () => {
                        if (onUnlock) onUnlock(node.id);
                        setConfirmModal(null);
                        onClose();
                      }
                    });
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 text-orange-600 flex items-center gap-2"
                >
                  <Unlock size={14} />
                  Débloquer mon fichier
                </button>
              );
            } else {
              return (
                <button
                  onClick={async () => {
                    try {
                      // Fetch admins
                      const res = await fetch('/api/admin/users?role=admin', { credentials: 'include' });
                      let admins: Array<{ username: string; email?: string }> = [];
                      if (res.ok) {
                        const data = await res.json();
                        if (data && data.success && Array.isArray(data.users)) {
                          admins = data.users.map((u: any) => ({ username: u.username, email: u.email }));
                        }
                      }
                      const adminLines = admins.length
                        ? admins.map(a => `- ${a.username}${a.email ? ' (' + a.email + ')' : ''}`).join('\n')
                        : '- Aucun administrateur trouvé';
                      const lockedBy = node.locked_by?.user_name || 'Utilisateur inconnu';
                      const lockedAt = (node.locked_by as any)?.locked_at || null;
                      const when = lockedAt ? `\nHeure du verrou: ${lockedAt}` : '';
                      setConfirmModal({
                        isOpen: true,
                        title: 'Déverrouillage non autorisé',
                        message: `Ce document est en cours d’édition par ${lockedBy}.${when}\n\nVeuillez contacter un administrateur pour le déverrouiller:\n${adminLines}`,
                        onConfirm: () => {
                          setConfirmModal(null);
                          onClose();
                        }
                      });
                    } catch (e) {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Déverrouillage non autorisé',
                        message: 'Ce document est verrouillé. Veuillez contacter un administrateur.',
                        onConfirm: () => {
                          setConfirmModal(null);
                          onClose();
                        }
                      });
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 text-orange-600 flex items-center gap-2"
                >
                  <Unlock size={14} />
                  Déverrouiller (contacter admin)
                </button>
              );
            }
            return null;
          })()}
        <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
        <button
          onClick={() => {
            setConfirmModal({
              isOpen: true,
              title: 'Supprimer le document',
              message: `Voulez-vous vraiment supprimer "${node.name}" ?`,
              onConfirm: () => {
                if (onDelete) onDelete(node.id);
                setConfirmModal(null);
                onClose();
              }
            });
          }}
          className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
        >
          <Trash2 size={14} />
          Supprimer
        </button>
      </>
    )}
    
    {confirmModal && (
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(null)}
        variant="warning"
      />
    )}
    
    {inputModal && (
      <InputModal
        isOpen={inputModal.isOpen}
        title={inputModal.title}
        label={inputModal.label}
        defaultValue={inputModal.defaultValue}
        onConfirm={inputModal.onConfirm}
        onCancel={() => setInputModal(null)}
      />
    )}
  </div>
);
};

interface TreeNodeProps {
  node: FileItem;
  level: number;
  expanded: Record<string, boolean>;
  selected: FileItem[];
  onToggleExpand: (id: string) => void;
  onSelect: (file: FileItem, event?: React.MouseEvent) => void;
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  onDownload?: (file: FileItem) => void;
  onUpload?: (parentId: string, file: File) => void;
  onOpenUploadModal?: (parentId: string | null) => void;
  onUnlock?: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onDownload,
  onUpload,
  onOpenUploadModal,
  onUnlock,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const isExpanded = expanded[node.id];
  const isSelected = selected.some(s => s.id === node.id);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    disabled: node.id === 'root',
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: node.type !== 'folder',
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
    >
      <div
        className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500' : ''
        } ${isDragging ? 'opacity-50 cursor-grabbing' : ''} ${isOver && node.type === 'folder' ? 'bg-green-50 dark:bg-green-900/30 ring-2 ring-green-300 dark:ring-green-600' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onContextMenu={handleContextMenu}
      >
        {node.id !== 'root' && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          >
            <GripVertical size={14} />
          </div>
        )}
        
        {node.type === 'folder' && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
            className="p-0 text-gray-600 dark:text-gray-400"
            type="button"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}

        <div
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (node.type === 'file') {
              onSelect(node, e);
            } else {
              // For folders, only toggle expand on simple click, but allow selection with Ctrl/Shift
              if (e.ctrlKey || e.metaKey || e.shiftKey) {
                onSelect(node, e);
              } else {
                onToggleExpand(node.id);
              }
            }
          }}
        >
          {node.type === 'folder' ? (
            isExpanded ? (
              <FolderOpen size={16} className="text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
            ) : (
              <Folder size={16} className="text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
            )
          ) : (
            <File size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
          )}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 text-sm">
            <span className="truncate text-gray-900 dark:text-gray-100">{node.name}</span>
            {node.locked_by && (
              <span className="flex items-center gap-0.5 text-red-600 text-[10px] whitespace-nowrap flex-shrink-0 font-medium">
                <Lock size={10} className="flex-shrink-0" />
                <span>by {node.locked_by.user_name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={node}
          onClose={closeContextMenu}
          onCreate={onCreate}
          onCreateFolder={onCreateFolder}
          onDelete={onDelete}
          onRename={onRename}
          onDownload={onDownload}
          onUpload={onUpload}
          onOpenUploadModal={onOpenUploadModal}
          onUnlock={onUnlock}
        />
      )}

      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              selected={selected}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onCreate={onCreate}
              onCreateFolder={onCreateFolder}
              onDelete={onDelete}
              onRename={onRename}
              onDownload={onDownload}
              onUpload={onUpload}
              onOpenUploadModal={onOpenUploadModal}
              onUnlock={onUnlock}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({
  tree,
  expanded,
  selected,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  onSelect,
  onSelectAll,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onDownload,
  onUpload,
  onOpenUploadModal,
  onUnlock,
  width = 320,
  userPermission,
  workspaceSelector,
  searchQuery = '',
  onSearchChange,
  onClearSearch,
  allTags = [],
  selectedTags = [],
  onTagFilterChange,
}) => {
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  // Flatten tree for Ctrl+A selection
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
  
  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: 'root-drop-zone',
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle F2 key for renaming, Delete key for deletion, and Ctrl+A for select all
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') ||
        target.closest('.w-md-editor') || // MDEditor wrapper
        target.closest('.w-md-editor-text') || // MDEditor text area
        target.closest('.w-md-editor-text-pre') || // MDEditor pre element
        target.closest('.w-md-editor-text-input') || // MDEditor input
        target.closest('[role="textbox"]') || // Any textbox role
        target.closest('form') // Any form element
      ) {
        return;
      }

      // Ctrl+A: Select all
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        event.stopPropagation();
        if (onSelectAll) {
          onSelectAll();
        }
        return;
      }
      
      // Check if F2 is pressed and at least one element is selected
      if (event.key === 'F2' && selected.length > 0 && onRename) {
        const firstSelected = selected[0];
        if (firstSelected.id !== 'root') {
          event.preventDefault();
          event.stopPropagation();
          setInputModal({
            isOpen: true,
            title: 'Renommer',
            label: 'Nouveau nom',
            defaultValue: firstSelected.name,
            onConfirm: (newName) => {
              if (newName.trim()) {
                onRename(firstSelected.id, newName.trim());
              }
              setInputModal(null);
            },
          });
        }
      }
      // Check if Delete is pressed and at least one element is selected
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected.length > 0 && onDelete) {
        const firstSelected = selected[0];
        if (firstSelected.id !== 'root') {
          event.preventDefault();
          event.stopPropagation();
          const itemName = firstSelected.name;
          const itemType = firstSelected.type === 'folder' ? 'dossier' : 'document';
          const count = selected.length;
          const message = count > 1 
            ? `Êtes-vous sûr de vouloir supprimer ${count} éléments ?`
            : `Êtes-vous sûr de vouloir supprimer "${itemName}" ?${firstSelected.type === 'folder' ? ' Cette action supprimera également tous les éléments contenus dans ce dossier.' : ''}`;
          setConfirmModal({
            isOpen: true,
            title: count > 1 ? `Supprimer ${count} éléments` : `Supprimer le ${itemType}`,
            message,
            onConfirm: () => {
              // Delete all selected items
              selected.forEach(item => {
                if (item.id !== 'root') {
                  onDelete(item.id);
                }
              });
              setConfirmModal(null);
            },
          });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selected, onRename, onDelete, tree, flattenTree, onSelect]);

  return (
    <div className="bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col h-full" style={{ width: `${width}px`, minWidth: '200px', maxWidth: '600px' }}>
      <div className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
        <div className="p-4 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">Files</h2>
          
          {/* Permission Badge */}
          {userPermission && (
            <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded">
              {userPermission === 'admin' ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span className="font-medium text-red-900 dark:text-red-300">Admin</span>
                </>
              ) : userPermission === 'write' ? (
                <>
                  <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-900 dark:text-blue-300">RW</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">RO</span>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Workspace Selector */}
        {workspaceSelector && (
          <div className="px-4 pb-4">
            {workspaceSelector}
          </div>
        )}
        
        {/* Search Bar */}
        {onSearchChange && (
          <div className="px-4 pb-4">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && onClearSearch && (
                <button
                  onClick={onClearSearch}
                  className="absolute right-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 relative">
        {/* Expand/Collapse buttons - positioned top right of the tree area, aligned with tree items */}
        {onExpandAll && onCollapseAll && (
          <div className="absolute top-[14px] right-2 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={onExpandAll}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-sm"
              title="Développer tout l'arbre"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={onCollapseAll}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-sm"
              title="Réduire tout l'arbre"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        )}
        <div className="py-2">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              expanded={expanded}
              selected={selected}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onCreate={onCreate}
              onCreateFolder={onCreateFolder}
              onDelete={onDelete}
              onRename={onRename}
              onDownload={onDownload}
              onUpload={onUpload}
              onOpenUploadModal={onOpenUploadModal}
              onUnlock={onUnlock}
            />
          ))}
        </div>
        <div 
          ref={setRootDropRef}
          className={`flex-1 min-h-[100px] cursor-context-menu transition-colors flex items-center justify-center ${
            isRootOver ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-600 ring-inset' : 'hover:bg-gray-50 dark:hover:bg-gray-900'
          }`}
          onContextMenu={handleContextMenu}
        >
          <div className={`text-sm text-center px-4 ${isRootOver ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
            {isRootOver ? (
              <>
                <div className="mb-1">📁 Déposer à la racine</div>
                <div className="text-xs">Le fichier/dossier sera déplacé ici</div>
              </>
            ) : (
              <>
              <div className="mb-1">Clic droit pour créer</div>
              <div className="text-xs">fichier ou dossier</div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Tag filter - sticky at the bottom */}
      {onTagFilterChange && (
        <TagFilter
          allTags={allTags}
          selectedTags={selectedTags}
          onTagFilterChange={onTagFilterChange}
        />
      )}
      
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onOpenUploadModal ? (
            <button
              onClick={() => {
                onOpenUploadModal('root');
                closeContextMenu();
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Plus size={14} />
              Ajouter un fichier
            </button>
          ) : (
            <button
              onClick={() => {
                if (!onCreate) return;
                setInputModal({
                  isOpen: true,
                  title: 'Nouveau document',
                  label: 'Nom du document',
                  defaultValue: '',
                  onConfirm: (name) => {
                    onCreate('root', name);
                    setInputModal(null);
                    closeContextMenu();
                  }
                });
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              disabled={!onCreate}
            >
              <Plus size={14} />
              Ajouter un fichier
            </button>
          )}
          <button
            onClick={() => {
              if (!onCreateFolder) return;
              setInputModal({
                isOpen: true,
                title: 'Nouveau dossier',
                label: 'Nom du dossier',
                defaultValue: '',
                onConfirm: (name) => {
                  onCreateFolder('root', name);
                  setInputModal(null);
                  closeContextMenu();
                }
              });
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Folder size={14} />
            Créer un dossier
          </button>
        </div>
      )}
      
      {inputModal && (
        <InputModal
          isOpen={inputModal.isOpen}
          title={inputModal.title}
          label={inputModal.label}
          defaultValue={inputModal.defaultValue}
          onConfirm={inputModal.onConfirm}
          onCancel={() => setInputModal(null)}
        />
      )}
      
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          variant="danger"
        />
      )}
    </div>
  );
};

export default FileTree;