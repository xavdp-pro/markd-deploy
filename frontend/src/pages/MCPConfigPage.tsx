import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/layout/Header';
import ConfirmModal from '../components/ConfirmModal';
import { Plus, Trash2, Edit, Save, X, Folder, FolderTree, AlertCircle, CheckCircle2, ChevronRight, ChevronDown, Key, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Document } from '../types';

interface MCPConfig {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  source_path: string | null;
  destination_path: string;
  enabled: boolean;
  user_permission?: string;
  mcp_allowed?: boolean;
  api_key?: string;
  created_at?: string;
  updated_at?: string;
}

interface NewCredentials {
  api_key: string;
  api_secret: string;
}

// Component to select a folder from the tree
interface TreeSelectorProps {
  tree: Document[];
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onSelect: (node: Document) => void;
  selectedNode: Document | null;
}

const TreeSelector: React.FC<TreeSelectorProps> = ({ tree, expanded, onToggleExpand, onSelect, selectedNode }) => {
  const renderNode = (node: Document, level: number = 0): React.ReactNode => {
    if (node.type === 'file') return null; // Only show folders
    
    const isExpanded = expanded[node.id] || false;
    const isSelected = selectedNode?.id === node.id;
    
    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
            isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => onSelect(node)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="flex items-center justify-center w-4 h-4"
          >
            {node.children && node.children.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-500" />
              )
            ) : (
              <div className="w-3 h-3" />
            )}
          </button>
          <Folder className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
          <span className="text-sm text-gray-900 dark:text-white">{node.name}</span>
        </div>
        {isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {tree.map(node => renderNode(node))}
    </div>
  );
};

const MCPConfigPage: React.FC = () => {
  const { user } = useAuth();
  const { workspaces, currentWorkspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<MCPConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MCPConfig | null>(null);
  const [formData, setFormData] = useState({
    workspace_id: '',
    source_path: '',
    destination_path: '',
    enabled: true
  });
  const [workspaceTree, setWorkspaceTree] = useState<Document[]>([]);
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({});
  const [showTreeSelector, setShowTreeSelector] = useState(false);
  const [selectedDestinationNode, setSelectedDestinationNode] = useState<Document | null>(null);
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Read URL parameters on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const workspaceId = params.get('workspace_id');
    const destinationPath = params.get('destination_path');
    
    if (workspaceId) {
      const decodedPath = destinationPath ? decodeURIComponent(destinationPath) : '';
      console.log('MCP Config - URL params:', { workspaceId, destinationPath: decodedPath });
      
      setFormData(prev => ({
        ...prev,
        workspace_id: workspaceId,
        destination_path: decodedPath
      }));
      // Automatically open the create modal
      setShowCreateModal(true);
      // Load the workspace tree
      loadWorkspaceTree(workspaceId);
    }
  }, [location.search]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const loadWorkspaceTree = async (workspaceId: string) => {
    try {
      const result = await api.getTree(workspaceId);
      if (result.success) {
        setWorkspaceTree(result.tree || []);
        // Expand root by default
        setTreeExpanded({ root: true });
      }
    } catch (error) {
      console.error('Error loading workspace tree:', error);
    }
  };

  // Load tree when workspace changes in the form
  useEffect(() => {
    if (formData.workspace_id) {
      loadWorkspaceTree(formData.workspace_id);
    }
  }, [formData.workspace_id]);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mcp/configs', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error fetching MCP configs:', error);
      toast.error('Error loading configurations');
    } finally {
      setLoading(false);
    }
  };

  const checkWorkspacePermission = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/mcp/configs/check?workspace_id=${workspaceId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking permission:', error);
      return { mcp_allowed: false, user_permission: 'none' };
    }
  };

  const handleCreate = async () => {
    if (!formData.workspace_id) {
      toast.error('Workspace is required');
      return;
    }

    // Check permissions
    const permissionCheck = await checkWorkspacePermission(formData.workspace_id);
    if (!permissionCheck.mcp_allowed) {
      toast.error(`Insufficient permissions. MCP requires 'write' or 'admin' on the workspace. Current permission: ${permissionCheck.user_permission}`);
      return;
    }

    try {
      const response = await fetch('/api/mcp/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          source_path: formData.source_path || null  // Send null if empty
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Configuration created successfully');
        setShowCreateModal(false);
        setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
        setSelectedDestinationNode(null);
        // Clean up the URL
        navigate('/mcp-config', { replace: true });
        
        // Show generated credentials
        if (data.config.api_key && data.config.api_secret) {
          setNewCredentials({
            api_key: data.config.api_key,
            api_secret: data.config.api_secret
          });
          setShowCredentialsModal(true);
        }
        
        fetchConfigs();
      } else {
        toast.error(data.detail || 'Error creating configuration');
      }
    } catch (error) {
      console.error('Error creating config:', error);
      toast.error('Error creating configuration');
    }
  };

  const handleRegenerateCredentials = (configId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Regenerate credentials',
      message: '⚠️ Regenerating credentials will invalidate the previous ones. Continue?',
      onConfirm: async () => {
        setConfirmModal(null);
        setRegeneratingId(configId);
        try {
          const response = await fetch(`/api/mcp/configs/${configId}/regenerate`, {
            method: 'POST',
            credentials: 'include'
          });

          const data = await response.json();
          if (data.success) {
            setNewCredentials({
              api_key: data.api_key,
              api_secret: data.api_secret
            });
            setShowCredentialsModal(true);
            fetchConfigs();
          } else {
            toast.error(data.detail || 'Error regenerating credentials');
          }
        } catch (error) {
          console.error('Error regenerating credentials:', error);
          toast.error('Error regenerating credentials');
        } finally {
          setRegeneratingId(null);
        }
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleUpdate = async () => {
    if (!editingConfig) return;

    try {
      const response = await fetch(`/api/mcp/configs/${editingConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source_path: formData.source_path,
          destination_path: formData.destination_path,
          enabled: formData.enabled
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Configuration updated');
        setEditingConfig(null);
        setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
        setSelectedDestinationNode(null);
        fetchConfigs();
      } else {
        toast.error(data.detail || 'Error updating configuration');
      }
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Error updating configuration');
    }
  };

  const handleDelete = (configId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete configuration',
      message: 'Are you sure you want to delete this configuration?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const response = await fetch(`/api/mcp/configs/${configId}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          const data = await response.json();
          if (data.success) {
            toast.success('Configuration deleted');
            fetchConfigs();
          } else {
            toast.error(data.detail || 'Error deleting configuration');
          }
        } catch (error) {
          console.error('Error deleting config:', error);
          toast.error('Error deleting configuration');
        }
      }
    });
  };

  const getWorkspaceName = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    return ws?.name || workspaceId;
  };

  // Helper: Get full path of a node in the tree
  const getNodePath = (nodeId: string, nodes: Document[] = workspaceTree, path: string[] = []): string | null => {
    if (!nodes || nodes.length === 0) return null;
    
    for (const n of nodes) {
      if (n.id === nodeId) {
        // If it's root, return empty string
        if (n.id === 'root') return '';
        // Otherwise, include the node's name in the path
        const fullPath = [...path, n.name];
        return fullPath.length > 0 ? fullPath.join('/') : '';
      }
      if (n.children && n.children.length > 0) {
        // Build path: skip root, include others
        const newPath = n.id === 'root' ? [] : [...path, n.name];
        const result = getNodePath(nodeId, n.children, newPath);
        if (result !== null) return result;
      }
    }
    return null;
  };

  const getPermissionBadge = (permission?: string, mcpAllowed?: boolean) => {
    if (!mcpAllowed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 text-xs font-medium rounded">
          <AlertCircle className="w-3 h-3" />
          {permission === 'read' ? 'Read only' : 'No access'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 text-xs font-medium rounded">
        <CheckCircle2 className="w-3 h-3" />
        {permission === 'admin' ? 'Admin' : 'Write'}
      </span>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                MCP Configuration
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Configure paths and authorized workspaces for the local MCP server
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                💡 To create a configuration, right-click on a folder in the document tree
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : configs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <FolderTree className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No MCP configuration
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Right-click on a folder in the document tree to create a configuration
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Workspace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      API Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Source Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Destination Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {configs.map((config) => (
                    <tr key={config.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {config.workspace_name || getWorkspaceName(config.workspace_id)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getPermissionBadge(config.user_permission, config.mcp_allowed)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {config.api_key ? (
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                              {config.api_key.substring(0, 12)}...
                            </code>
                            <button
                              onClick={() => copyToClipboard(config.api_key!, 'API Key')}
                              className="p-1 text-gray-500 hover:text-blue-600"
                              title="Copy API Key"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not generated</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                          <Folder className="w-4 h-4 text-gray-400" />
                          {config.source_path || (
                            <span className="text-gray-400 italic">To be configured</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                          <FolderTree className="w-4 h-4 text-gray-400" />
                          {config.destination_path || '(root)'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          config.enabled
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {config.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRegenerateCredentials(config.id)}
                            disabled={regeneratingId === config.id}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-50"
                            title="Regenerate credentials"
                          >
                            <RefreshCw className={`w-4 h-4 ${regeneratingId === config.id ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingConfig(config);
                              setFormData({
                                workspace_id: config.workspace_id,
                                source_path: config.source_path || '',
                                destination_path: config.destination_path,
                                enabled: config.enabled
                              });
                              loadWorkspaceTree(config.workspace_id);
                            }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(config.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                New MCP Configuration
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
                  setSelectedDestinationNode(null);
                  setShowTreeSelector(false);
                  navigate('/mcp-config', { replace: true });
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workspace
                </label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {workspaces.find(ws => ws.id === formData.workspace_id)?.name || formData.workspace_id}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source path (local) <span className="text-gray-400 font-normal">- optional</span>
                </label>
                <input
                  type="text"
                  value={formData.source_path}
                  onChange={(e) => setFormData({ ...formData, source_path: e.target.value })}
                  placeholder="/path/to/docs or ./docs"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Can be configured later in the local MCP client
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Destination path (workspace)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.destination_path}
                    onChange={(e) => setFormData({ ...formData, destination_path: e.target.value })}
                    placeholder="projects/documentation"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {formData.workspace_id && (
                    <button
                      type="button"
                      onClick={() => setShowTreeSelector(!showTreeSelector)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                      title="Select from tree"
                    >
                      <FolderTree className="w-4 h-4" />
                      {showTreeSelector ? 'Hide' : 'Tree'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Path in the workspace tree (empty = root)
                </p>
                
                {/* Tree selector */}
                {showTreeSelector && formData.workspace_id && workspaceTree.length > 0 && (
                  <div className="mt-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 max-h-64 overflow-auto p-2">
                    <TreeSelector
                      tree={workspaceTree}
                      expanded={treeExpanded}
                      onToggleExpand={(id) => setTreeExpanded(prev => ({ ...prev, [id]: !prev[id] }))}
                      onSelect={(node) => {
                        const path = getNodePath(node.id, workspaceTree);
                        console.log('MCP Config - Selected node:', node.name, 'Path:', path);
                        setFormData(prev => ({ ...prev, destination_path: path || '' }));
                        setSelectedDestinationNode(node);
                        setShowTreeSelector(false);
                      }}
                      selectedNode={selectedDestinationNode}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                  Configuration enabled
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
                  setSelectedDestinationNode(null);
                  setShowTreeSelector(false);
                  navigate('/mcp-config', { replace: true });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && newCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Key className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                  MCP Credentials Generated
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setNewCredentials(null);
                  setShowSecret(false);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Important:</strong> The API secret will never be shown again. Copy it now and store it safely.
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white overflow-x-auto">
                    {newCredentials.api_key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newCredentials.api_key, 'API Key')}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-lg"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Secret
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white overflow-x-auto">
                    {showSecret ? newCredentials.api_secret : '•'.repeat(32)}
                  </code>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-lg"
                    title={showSecret ? 'Hide' : 'Show'}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(newCredentials.api_secret, 'API Secret')}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-lg"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-800 dark:text-white mb-2">
                MCP Client Configuration
              </h4>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
{`# In your .env or config file
MCP_API_KEY=${newCredentials.api_key}
MCP_API_SECRET=${newCredentials.api_secret}`}
              </pre>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setNewCredentials(null);
                  setShowSecret(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                I've copied the credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Edit Configuration
              </h3>
              <button
                onClick={() => {
                  setEditingConfig(null);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
                  setSelectedDestinationNode(null);
                  setShowTreeSelector(false);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workspace
                </label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {editingConfig.workspace_name || editingConfig.workspace_id}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source path (local) <span className="text-gray-400 font-normal">- optional</span>
                </label>
                <input
                  type="text"
                  value={formData.source_path}
                  onChange={(e) => setFormData({ ...formData, source_path: e.target.value })}
                  placeholder="Can be configured in the MCP client"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Destination path (workspace)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.destination_path}
                    onChange={(e) => setFormData({ ...formData, destination_path: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {formData.workspace_id && (
                    <button
                      type="button"
                      onClick={() => setShowTreeSelector(!showTreeSelector)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                      title="Select from tree"
                    >
                      <FolderTree className="w-4 h-4" />
                      {showTreeSelector ? 'Hide' : 'Tree'}
                    </button>
                  )}
                </div>
                
                {/* Tree selector */}
                {showTreeSelector && formData.workspace_id && workspaceTree.length > 0 && (
                  <div className="mt-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 max-h-64 overflow-auto p-2">
                    <TreeSelector
                      tree={workspaceTree}
                      expanded={treeExpanded}
                      onToggleExpand={(id) => setTreeExpanded(prev => ({ ...prev, [id]: !prev[id] }))}
                      onSelect={(node) => {
                        const path = getNodePath(node.id, workspaceTree);
                        console.log('MCP Config - Selected node:', node.name, 'Path:', path);
                        setFormData(prev => ({ ...prev, destination_path: path || '' }));
                        setSelectedDestinationNode(node);
                        setShowTreeSelector(false);
                      }}
                      selectedNode={selectedDestinationNode}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled-edit"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="enabled-edit" className="text-sm text-gray-700 dark:text-gray-300">
                  Configuration enabled
                </label>
              </div>

              {/* Show existing API Key */}
              {editingConfig.api_key && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white overflow-x-auto">
                      {editingConfig.api_key}
                    </code>
                    <button
                      onClick={() => copyToClipboard(editingConfig.api_key!, 'API Key')}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-lg"
                      title="Copy"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRegenerateCredentials(editingConfig.id)}
                      disabled={regeneratingId === editingConfig.id}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                      title="Regenerate"
                    >
                      <RefreshCw className={`w-4 h-4 ${regeneratingId === editingConfig.id ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    The secret is no longer visible. Regenerate if you lost it.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setEditingConfig(null);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
                  setSelectedDestinationNode(null);
                  setShowTreeSelector(false);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          variant="warning"
          confirmText="Confirm"
          cancelText="Cancel"
        />
      )}
    </div>
  );
};

export default MCPConfigPage;
