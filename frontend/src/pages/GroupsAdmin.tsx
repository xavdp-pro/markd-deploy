import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, UserPlus, X, Save, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface Group {
  id: string;
  name: string;
  description?: string;
  user_count: number;
  workspace_count: number;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface GroupUser {
  id: number;
  username: string;
  email: string;
  role: string;
  added_at: string;
}

const GroupsAdmin: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  
  // Members management
  const [managingMembers, setManagingMembers] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupUser[]>([]);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    loadGroups();
    loadAllUsers();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error('Error loading groups:', err);
      toast.error('Erreur lors du chargement des groupes');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setAllUsers(data.users);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Groupe créé avec succès');
        setCreating(false);
        setFormData({ name: '', description: '' });
        loadGroups();
      }
    } catch (err) {
      console.error('Error creating group:', err);
      toast.error('Erreur lors de la création');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Groupe modifié avec succès');
        setEditing(null);
        setFormData({ name: '', description: '' });
        loadGroups();
      }
    } catch (err) {
      console.error('Error updating group:', err);
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    // Prevent deleting only the ALL group
    if (id === 'all') {
      toast.error('Impossible de supprimer le groupe ALL');
      return;
    }

    if (!confirm(`Voulez-vous vraiment supprimer le groupe "${name}" ?\n\nCela supprimera aussi tous ses membres et permissions.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Groupe supprimé avec succès');
        loadGroups();
      } else {
        toast.error(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('Error deleting group:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const startEdit = (group: Group) => {
    setEditing(group.id);
    setFormData({ name: group.name, description: group.description || '' });
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreating(false);
    setFormData({ name: '', description: '' });
  };

  // Members management
  const handleManageMembers = async (groupId: string) => {
    setManagingMembers(groupId);
    await loadGroupMembers(groupId);
  };

  const loadGroupMembers = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/users`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setGroupMembers(data.users);
      }
    } catch (err) {
      console.error('Error loading group members:', err);
      toast.error('Erreur lors du chargement des membres');
    }
  };

  const handleAddMember = async (groupId: string, userId: number) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Membre ajouté');
        setAddingMember(false);
        loadGroupMembers(groupId);
        loadGroups();
      }
    } catch (err) {
      console.error('Error adding member:', err);
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleRemoveMember = async (groupId: string, userId: number) => {
    // Prevent removing users from ALL group
    if (groupId === 'all') {
      toast.error('Impossible de retirer un utilisateur du groupe ALL');
      return;
    }

    if (!confirm('Retirer cet utilisateur du groupe ?')) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Membre retiré');
        loadGroupMembers(groupId);
        loadGroups();
      }
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const isAllGroup = (id: string) => {
    return id === 'all';
  };

  const isBusinessGroup = (id: string) => {
    return ['all', 'developers', 'novice', 'visitor'].includes(id);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 min-h-screen">Chargement...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des Groupes</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Organisez les utilisateurs en groupes métier</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouveau Groupe
        </button>
      </div>

      {/* Info Box */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900 dark:text-blue-300">
          <p className="font-medium mb-1">Groupes métier :</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-400">
            <li><strong>ALL</strong> : Tous les utilisateurs (ajoutés automatiquement)</li>
            <li><strong>Developers, Novice, Visitor</strong> : Groupes métier prédéfinis</li>
            <li>Les permissions par workspace se configurent dans "Workspaces"</li>
          </ul>
        </div>
      </div>

      {/* Create Form */}
      {creating && (
        <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Créer un groupe</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom du groupe *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Équipe Marketing"
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
                placeholder="Description du groupe et de son rôle..."
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

      {/* Groups List */}
      <div className="grid gap-4">
        {groups.map((group) => (
          <div key={group.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            {editing === group.id ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={isBusinessGroup(group.id)}
                />
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(group.id)}
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
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                      {isBusinessGroup(group.id) && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">Métier</span>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{group.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(group)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!isAllGroup(group.id) && (
                      <button
                        onClick={() => handleDelete(group.id, group.name)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-6 mb-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{group.user_count} membre{group.user_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleManageMembers(group.id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Gérer les membres
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Members Modal */}
      {managingMembers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Membres du groupe</h2>
              {managingMembers === 'all' && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Tous les utilisateurs sont automatiquement dans ce groupe
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {!addingMember ? (
                <>
                  {managingMembers !== 'all' && (
                    <button
                      onClick={() => setAddingMember(true)}
                      className="mb-4 flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter un membre
                    </button>
                  )}
                  <div className="space-y-2">
                    {groupMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{member.username}</div>
                          <div className="text-sm text-gray-600">{member.email}</div>
                        </div>
                        {managingMembers !== 'all' && (
                          <button
                            onClick={() => handleRemoveMember(managingMembers, member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {groupMembers.length === 0 && (
                      <p className="text-center text-gray-500 py-8">Aucun membre dans ce groupe</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold">Ajouter un utilisateur</h3>
                  <div className="space-y-2">
                    {allUsers
                      .filter(u => !groupMembers.find(m => m.id === u.id))
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleAddMember(managingMembers, user.id)}
                          className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="font-medium">{user.username}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </button>
                      ))}
                  </div>
                  <button
                    onClick={() => setAddingMember(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
            <div className="p-6 border-t">
              <button
                onClick={() => {
                  setManagingMembers(null);
                  setAddingMember(false);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsAdmin;
