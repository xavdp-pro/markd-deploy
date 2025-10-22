import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FolderTree, Save, X, Users, Shield, Eye, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

interface Workspace {
  id: string;
  name: string;
  description?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  user_count: number;
}

interface GroupPermission {
  [groupId: string]: 'none' | 'read' | 'write' | 'admin';
}

const WorkspacesAdmin: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [permissions, setPermissions] = useState<{ [wsId: string]: GroupPermission }>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load workspaces
      const wsRes = await fetch('/api/workspaces', { credentials: 'include' });
      const wsData = await wsRes.json();

      // Load groups
      const groupsRes = await fetch('/api/groups', { credentials: 'include' });
      const groupsData = await groupsRes.json();

      if (wsData.success && groupsData.success) {
        setWorkspaces(wsData.workspaces);
        setGroups(groupsData.groups);

        // Load permissions for all workspaces
        const permsMap: { [wsId: string]: GroupPermission } = {};

        await Promise.all(
          wsData.workspaces.map(async (ws: Workspace) => {
            const wsPerms: GroupPermission = {};

            // Initialize all groups to 'none'
            groupsData.groups.forEach((g: Group) => {
              wsPerms[g.id] = 'none';
            });

            // Load actual permissions for each group
            await Promise.all(
              groupsData.groups.map(async (group: Group) => {
                const res = await fetch(`/api/groups/${group.id}/workspaces`, {
                  credentials: 'include'
                });
                const data = await res.json();

                if (data.success) {
                  const hasAccess = data.workspaces.find((w: any) => w.id === ws.id);
                  if (hasAccess) {
                    wsPerms[group.id] = hasAccess.permission_level;
                  }
                }
              })
            );

            permsMap[ws.id] = wsPerms;
          })
        );

        setPermissions(permsMap);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Workspace créé');
        setCreating(false);
        setFormData({ name: '', description: '' });
        loadData();
      }
    } catch (err) {
      console.error('Error creating workspace:', err);
      toast.error('Erreur lors de la création');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Workspace modifié');
        setEditing(null);
        setFormData({ name: '', description: '' });
        loadData();
      }
    } catch (err) {
      console.error('Error updating workspace:', err);
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer "${name}" ?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Workspace supprimé');
        loadData();
      }
    } catch (err) {
      console.error('Error deleting workspace:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handlePermissionChange = async (
    workspaceId: string,
    groupId: string,
    newLevel: 'none' | 'read' | 'write' | 'admin'
  ) => {
    const currentLevel = permissions[workspaceId]?.[groupId] || 'none';

    try {
      if (newLevel === 'none') {
        // Remove permission
        if (currentLevel !== 'none') {
          await fetch(`/api/groups/${groupId}/workspaces/${workspaceId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          toast.success('Accès retiré');
        }
      } else if (currentLevel === 'none') {
        // Add permission
        await fetch(`/api/groups/${groupId}/workspaces`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, permission_level: newLevel }),
        });
        toast.success('Accès accordé');
      } else {
        // Update permission
        await fetch(`/api/groups/${groupId}/workspaces/${workspaceId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, permission_level: newLevel }),
        });
        toast.success('Permission modifiée');
      }

      // Update local state
      setPermissions(prev => ({
        ...prev,
        [workspaceId]: {
          ...prev[workspaceId],
          [groupId]: newLevel
        }
      }));
    } catch (err) {
      console.error('Error updating permission:', err);
      toast.error('Erreur lors de la modification');
    }
  };

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case 'admin': return <Shield className="w-3.5 h-3.5 text-red-600" />;
      case 'write': return <Edit className="w-3.5 h-3.5 text-blue-600" />;
      case 'read': return <Eye className="w-3.5 h-3.5 text-gray-600" />;
      default: return <span className="text-gray-300 text-xs">—</span>;
    }
  };

  const getPermissionColor = (level: string) => {
    switch (level) {
      case 'admin': return 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-900 dark:text-red-300';
      case 'write': return 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-300';
      case 'read': return 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100';
      default: return 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300';
    }
  };

  const startEdit = (workspace: Workspace) => {
    setEditing(workspace.id);
    setFormData({ name: workspace.name, description: workspace.description || '' });
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreating(false);
    setFormData({ name: '', description: '' });
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 min-h-screen">Chargement...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des Workspaces</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configurez les permissions par groupe métier</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouveau Workspace
        </button>
      </div>

      {/* Info Box */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-300">
          <strong>Principe :</strong> Les utilisateurs font partie de groupes métier (ALL, Developers, etc.). 
          Pour chaque workspace, choisissez le niveau d'accès de chaque groupe.
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-400 mt-2">
          <strong>Aucun</strong> = pas d'accès • <strong>RO</strong> = lecture seule • <strong>RW</strong> = lecture + écriture • <strong>Admin</strong> = accès complet
        </p>
      </div>

      {/* Create Form */}
      {creating && (
        <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Créer un workspace</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du workspace *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Documentation Produit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Description du workspace..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Créer
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspaces List */}
      <div className="space-y-6">
        {workspaces.map((workspace) => {
          const wsPerms = permissions[workspace.id] || {};

          return (
            <div key={workspace.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              {editing === workspace.id ? (
                <div className="p-6 space-y-4">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(workspace.id)}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Enregistrer
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FolderTree className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{workspace.name}</h3>
                        </div>
                        {workspace.description && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm">{workspace.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(workspace)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(workspace.id, workspace.name)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Permissions Table */}
                  <div className="p-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-900 dark:text-white" />
                      Permissions par groupe
                    </h4>
                    <div className="grid gap-2">
                      {groups.map((group) => {
                        const level = wsPerms[group.id] || 'none';
                        return (
                          <div
                            key={group.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <Users className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">{group.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {group.user_count} membre{group.user_count !== 1 ? 's' : ''}
                                  {group.description && ` • ${group.description}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={level}
                                onChange={(e) => handlePermissionChange(
                                  workspace.id,
                                  group.id,
                                  e.target.value as any
                                )}
                                className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${getPermissionColor(level)}`}
                              >
                                <option value="none">Aucun</option>
                                <option value="read">RO (Lecture)</option>
                                <option value="write">RW (Écriture)</option>
                                <option value="admin">Admin</option>
                              </select>
                              {getPermissionIcon(level)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {workspaces.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <FolderTree className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Aucun workspace créé</p>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Créer le premier workspace
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkspacesAdmin;
