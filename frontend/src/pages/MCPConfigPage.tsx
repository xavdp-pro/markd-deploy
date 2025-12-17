import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/layout/Header';
import { Plus, Trash2, Edit, Save, X, Folder, FolderTree, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MCPConfig {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  source_path: string;
  destination_path: string;
  enabled: boolean;
  user_permission?: string;
  mcp_allowed?: boolean;
  created_at?: string;
  updated_at?: string;
}

const MCPConfigPage: React.FC = () => {
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
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

  useEffect(() => {
    fetchConfigs();
  }, []);

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
      toast.error('Erreur lors du chargement des configurations');
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
    if (!formData.workspace_id || !formData.source_path) {
      toast.error('Workspace et chemin source sont requis');
      return;
    }

    // Vérifier les permissions
    const permissionCheck = await checkWorkspacePermission(formData.workspace_id);
    if (!permissionCheck.mcp_allowed) {
      toast.error(`Permissions insuffisantes. Le MCP nécessite 'write' ou 'admin' sur le workspace. Permission actuelle: ${permissionCheck.user_permission}`);
      return;
    }

    try {
      const response = await fetch('/api/mcp/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Configuration créée avec succès');
        setShowCreateModal(false);
        setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
        fetchConfigs();
      } else {
        toast.error(data.detail || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Error creating config:', error);
      toast.error('Erreur lors de la création');
    }
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
        toast.success('Configuration mise à jour');
        setEditingConfig(null);
        setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
        fetchConfigs();
      } else {
        toast.error(data.detail || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/mcp/configs/${configId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Configuration supprimée');
        fetchConfigs();
      } else {
        toast.error(data.detail || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getWorkspaceName = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    return ws?.name || workspaceId;
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
                Configuration MCP
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Configurez les chemins et workspaces autorisés pour le serveur MCP local
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle configuration
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Chargement...</div>
          ) : configs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <FolderTree className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Aucune configuration MCP
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Créer une configuration
              </button>
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
                      Chemin source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Chemin destination
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Permissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Statut
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
                          {config.workspace_id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                          <Folder className="w-4 h-4 text-gray-400" />
                          {config.source_path}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                          <FolderTree className="w-4 h-4 text-gray-400" />
                          {config.destination_path || '(root)'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getPermissionBadge(config.user_permission, config.mcp_allowed)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          config.enabled
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {config.enabled ? 'Activé' : 'Désactivé'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingConfig(config);
                              setFormData({
                                workspace_id: config.workspace_id,
                                source_path: config.source_path,
                                destination_path: config.destination_path,
                                enabled: config.enabled
                              });
                            }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(config.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Supprimer"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Nouvelle configuration MCP
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workspace *
                </label>
                <select
                  value={formData.workspace_id}
                  onChange={(e) => setFormData({ ...formData, workspace_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Sélectionner un workspace</option>
                  {workspaces
                    .filter(ws => {
                      // Filtrer seulement les workspaces avec write/admin
                      // On vérifiera côté serveur
                      return true;
                    })
                    .map(ws => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name} ({ws.id})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chemin source (local) *
                </label>
                <input
                  type="text"
                  value={formData.source_path}
                  onChange={(e) => setFormData({ ...formData, source_path: e.target.value })}
                  placeholder="/path/to/docs ou ./docs"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Chemin local où se trouvent les fichiers Markdown
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chemin destination (workspace)
                </label>
                <input
                  type="text"
                  value={formData.destination_path}
                  onChange={(e) => setFormData({ ...formData, destination_path: e.target.value })}
                  placeholder="projects/documentation"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Chemin dans l'arbre du workspace (vide = root)
                </p>
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
                  Configuration activée
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Modifier la configuration
              </h3>
              <button
                onClick={() => {
                  setEditingConfig(null);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
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
                  Chemin source (local) *
                </label>
                <input
                  type="text"
                  value={formData.source_path}
                  onChange={(e) => setFormData({ ...formData, source_path: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chemin destination (workspace)
                </label>
                <input
                  type="text"
                  value={formData.destination_path}
                  onChange={(e) => setFormData({ ...formData, destination_path: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
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
                  Configuration activée
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setEditingConfig(null);
                  setFormData({ workspace_id: '', source_path: '', destination_path: '', enabled: true });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPConfigPage;

