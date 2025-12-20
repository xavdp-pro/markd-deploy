import React, { useState, useEffect } from 'react';
import { X, Copy, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

interface MCPConfigModalProps {
  folderId: string;
  config: any | null;
  workspaceId: string;
  folderPath?: string;
  onClose: () => void;
}

const MCPConfigModal: React.FC<MCPConfigModalProps> = ({ folderId, config, workspaceId, folderPath = '/', onClose }) => {
  const [formData, setFormData] = useState({
    source_path: '',
    destination_path: '',
    is_active: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    if (config) {
      // Ensure destination_path starts with "/"
      let destPath = config.destination_path || '';
      if (destPath && !destPath.startsWith('/')) {
        destPath = '/' + destPath;
      } else if (!destPath) {
        destPath = folderId === 'root' ? '/' : '';
      }
      
      setFormData({
        source_path: config.source_path || '',
        destination_path: destPath,
        is_active: config.is_active !== false
      });
      
      // Load token from config (from API/BDD)
      if (config.mcp_token) {
        setMcpToken(config.mcp_token);
      } else {
        setMcpToken(null);
      }
    } else {
      // For new config, set destination_path based on folder_path
      setFormData({
        source_path: '',
        destination_path: folderPath || (folderId === 'root' ? '/' : ''),
        is_active: true
      });
      setMcpToken(null);
    }
  }, [config, folderId, folderPath]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Ensure destination_path starts with "/"
      let destPath = formData.destination_path || '';
      if (destPath && !destPath.startsWith('/')) {
        destPath = '/' + destPath;
      } else if (!destPath || folderId === 'root') {
        destPath = '/';
      }
      
      if (config) {
        // Update existing config
        const response = await fetch(`/api/mcp/configs/${config.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            source_path: formData.source_path || null,
            destination_path: destPath,
            is_active: formData.is_active
          })
        });

        const data = await response.json();
        if (data.success) {
          toast.success('Configuration mise à jour');
          onClose();
        } else {
          toast.error(data.detail || 'Erreur lors de la mise à jour');
        }
      } else {
        // Create new config
        const response = await fetch('/api/mcp/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            workspace_id: workspaceId,
            folder_id: folderId,
            source_path: formData.source_path || null,
            destination_path: destPath,
            enabled: true,
            is_active: formData.is_active
          })
        });

        const data = await response.json();
        if (data.success) {
          toast.success('Configuration créée avec succès');
          // Token is stored in BDD and returned by API
          if (data.config.mcp_token) {
            setMcpToken(data.config.mcp_token);
          }
        } else {
          toast.error(data.detail || 'Erreur lors de la création');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateCredentials = () => {
    if (!config) return;
    setConfirmModal({
      isOpen: true,
      title: 'Régénérer les credentials',
      message: '⚠️ Régénérer les credentials invalidera les anciens. Continuer ?',
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          const response = await fetch(`/api/mcp/configs/${config.id}/regenerate`, {
            method: 'POST',
            credentials: 'include'
          });

          const data = await response.json();
          if (data.success && config) {
            // Token is stored in BDD and returned by API
            setMcpToken(data.mcp_token);
            toast.success('Token régénéré');
          } else {
            toast.error(data.detail || 'Erreur lors de la régénération');
          }
        } catch (error) {
          console.error('Error regenerating credentials:', error);
          toast.error('Erreur lors de la régénération');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié !`);
  };

  const handleToggleActive = async () => {
    if (!config) return;
    
    const newStatus = !formData.is_active;
    setFormData({ ...formData, is_active: newStatus });
    
    try {
      const response = await fetch(`/api/mcp/configs/${config.id}/toggle-active`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Configuration ${newStatus ? 'activée' : 'désactivée'}`);
      } else {
        // Revert on error
        setFormData({ ...formData, is_active: !newStatus });
        toast.error(data.detail || 'Erreur lors de la modification');
      }
    } catch (error) {
      console.error('Error toggling active:', error);
      setFormData({ ...formData, is_active: !newStatus });
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDelete = () => {
    if (!config) return;
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer la configuration MCP',
      message: 'Êtes-vous sûr de vouloir supprimer cette configuration MCP ? Cette action est irréversible.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const response = await fetch(`/api/mcp/configs/${config.id}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          const data = await response.json();
          if (data.success) {
            toast.success('Configuration supprimée');
            onClose();
          } else {
            toast.error(data.detail || 'Erreur lors de la suppression');
          }
        } catch (error) {
          console.error('Error deleting config:', error);
          toast.error('Erreur lors de la suppression');
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Configuration MCP
          </h2>
          <div className="flex items-center gap-2">
            {config && (
              <button
                onClick={handleDelete}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Supprimer la configuration"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Active/Inactive Switch */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Statut
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Activer ou désactiver cette configuration MCP
              </p>
            </div>
            <button
              onClick={handleToggleActive}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_active
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Source Path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chemin source (local)
            </label>
            <input
              type="text"
              value={formData.source_path}
              onChange={(e) => setFormData({ ...formData, source_path: e.target.value })}
              placeholder="/chemin/vers/dossier/local"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Chemin local vers le dossier à synchroniser (optionnel)
            </p>
          </div>

          {/* Destination Path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chemin destination (workspace)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">/</span>
              <input
                type="text"
                value={formData.destination_path.startsWith('/') ? formData.destination_path.substring(1) : formData.destination_path}
                onChange={(e) => {
                  const value = e.target.value;
                  // Ensure it starts with "/"
                  const newPath = value ? '/' + value.replace(/^\//, '') : '/';
                  setFormData({ ...formData, destination_path: newPath });
                }}
                placeholder={folderId === 'root' ? '(racine)' : 'dossier/sous-dossier'}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Chemin dans l'arbre du workspace (commence toujours par /)
            </p>
          </div>

          {/* MCP Token */}
          {config && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Token MCP
                </h3>
                <button
                  onClick={handleRegenerateCredentials}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-md"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Régénérer
                </button>
              </div>
              
              {mcpToken ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
                  <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                    MCP Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={mcpToken}
                      readOnly
                      className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 rounded-md"
                      title={showPassword ? 'Masquer le token' : 'Afficher le token'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(mcpToken, 'Token')}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 rounded-md"
                      title="Copier le token"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    Utilisez ce token pour vous authentifier à l'API MCP via <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/api/mcp/token-auth</code>
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-md">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    ⚠️ Le token n'est pas disponible. Il sera affiché après la création ou la régénération.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
            >
              {config ? 'Fermer' : 'Annuler'}
            </button>
            {!config && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Créer'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          variant={confirmModal.variant || "warning"}
          confirmText={confirmModal.variant === 'danger' ? 'Supprimer' : 'Continuer'}
          cancelText="Annuler"
        />
      )}
    </div>
  );
};

export default MCPConfigModal;

