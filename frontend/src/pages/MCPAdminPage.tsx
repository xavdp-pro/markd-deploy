import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import { Search, Filter, Trash2, Eye, EyeOff, CheckCircle2, XCircle, Folder, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

interface MCPConfig {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  folder_id: string | null;
  folder_name?: string;
  destination_path: string;
  source_path: string | null;
  enabled: boolean;
  is_active: boolean;
  api_key: string;
  mcp_token: string | null;
  created_at: string;
  updated_at: string;
  user_id: number;
  username?: string;
}

const MCPAdminPage: React.FC = () => {
  const { user } = useAuth();
  const { } = useWorkspace();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<MCPConfig[]>([]);
  const [filteredConfigs, setFilteredConfigs] = useState<MCPConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('');
  const [folderFilter, setFolderFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  
  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    loadConfigs();
  }, [user, navigate]);

  useEffect(() => {
    applyFilters();
  }, [configs, workspaceFilter, folderFilter, searchQuery]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/mcp/configs', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setConfigs(data.configs || []);
      } else {
        toast.error('Error loading configurations');
      }
    } catch (error) {
      console.error('Error loading MCP configs:', error);
      toast.error('Error loading configurations');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...configs];

    // Filter by workspace
    if (workspaceFilter) {
      filtered = filtered.filter(c => c.workspace_id === workspaceFilter);
    }

    // Filter by folder (search in destination_path or folder_name)
    if (folderFilter) {
      filtered = filtered.filter(c => 
        c.destination_path?.toLowerCase().includes(folderFilter.toLowerCase()) ||
        c.folder_name?.toLowerCase().includes(folderFilter.toLowerCase())
      );
    }

    // Search query (search in all fields)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.workspace_id?.toLowerCase().includes(query) ||
        c.workspace_name?.toLowerCase().includes(query) ||
        c.destination_path?.toLowerCase().includes(query) ||
        c.folder_name?.toLowerCase().includes(query) ||
        c.api_key?.toLowerCase().includes(query) ||
        c.username?.toLowerCase().includes(query)
      );
    }

    setFilteredConfigs(filtered);
  };

  const handleDelete = async (configId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete MCP configuration',
      message: 'Are you sure you want to delete this configuration? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/mcp/configs/${configId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          const data = await response.json();
          if (data.success) {
            toast.success('Configuration deleted');
            loadConfigs();
          } else {
            toast.error(data.detail || 'Error deleting configuration');
          }
        } catch (error) {
          console.error('Error deleting config:', error);
          toast.error('Error deleting configuration');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleToggleActive = async (configId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/mcp/configs/${configId}/toggle-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Configuration ${!currentStatus ? 'enabled' : 'disabled'}`);
        loadConfigs();
      } else {
        toast.error(data.detail || 'Error updating configuration');
      }
    } catch (error) {
      console.error('Error toggling active status:', error);
      toast.error('Error updating configuration');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Get unique workspaces for filter
  const uniqueWorkspaces = Array.from(new Set(configs.map(c => c.workspace_id)))
    .map(id => {
      const config = configs.find(c => c.workspace_id === id);
      return { id, name: config?.workspace_name || id };
    });

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              MCP Configuration Administration
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage all MCP configurations with workspace and folder filters
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Workspace filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={workspaceFilter}
                  onChange={(e) => setWorkspaceFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
                >
                  <option value="">All workspaces</option>
                  {uniqueWorkspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder filter */}
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filter by folder..."
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {filteredConfigs.length} configuration(s) found out of {configs.length} total
            </div>
          </div>

          {/* Configs table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Workspace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Folder
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Destination Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      API Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Token MCP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredConfigs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No configuration found
                      </td>
                    </tr>
                  ) : (
                    filteredConfigs.map((config) => (
                      <tr key={config.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {config.workspace_name || config.workspace_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {config.folder_name || config.folder_id || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {config.destination_path || '/'}
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {config.username || `User ${config.user_id}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                              {config.api_key?.substring(0, 20)}...
                            </code>
                            <button
                              onClick={() => copyToClipboard(config.api_key || '', 'API Key')}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              title="Copy API Key"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {config.mcp_token ? (
                            <div className="flex items-center gap-2">
                              {showToken[config.id] ? (
                                <>
                                  <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono max-w-xs truncate">
                                    {config.mcp_token}
                                  </code>
                                  <button
                                    onClick={() => setShowToken({ ...showToken, [config.id]: false })}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    title="Hide token"
                                  >
                                    <EyeOff className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(config.mcp_token || '', 'Token MCP')}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    title="Copy token"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                                    ••••••••••••••••
                                  </code>
                                  <button
                                    onClick={() => setShowToken({ ...showToken, [config.id]: true })}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    title="Show token"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(config.id, config.is_active)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                config.is_active
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {config.is_active ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Inactive
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(config.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant || 'danger'}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};

export default MCPAdminPage;

