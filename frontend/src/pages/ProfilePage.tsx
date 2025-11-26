import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Lock, Save, Users, FolderTree, Shield, Eye, Edit } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface WorkspacePermission {
  workspace_id: string;
  workspace_name: string;
  workspace_description?: string;
  permission_level: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspacePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroupsAndPermissions();
  }, []);

  const loadGroupsAndPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users/me/groups', { credentials: 'include' });
      const data = await response.json();
      
      if (data.success) {
        setGroups(data.groups || []);
        setWorkspaces(data.workspaces || []);
      }
    } catch (error) {
      console.error('Error loading groups and permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case 'admin': return <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'write': return <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'read': return <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
      default: return null;
    }
  };

  const getPermissionLabel = (level: string) => {
    switch (level) {
      case 'admin': return 'Admin';
      case 'write': return 'Read/Write';
      case 'read': return 'Read Only';
      default: return 'None';
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
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
        }),
      });

      if (response.ok) {
        toast.success('Profil mis à jour avec succès');
      } else {
        toast.error('Échec de la mise à jour du profil');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 10) {
      return 'Le mot de passe doit contenir au moins 10 caractères';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Le mot de passe doit contenir au moins 1 majuscule (A-Z)';
    }
    if (!/[a-z]/.test(password)) {
      return 'Le mot de passe doit contenir au moins 1 minuscule (a-z)';
    }
    if (!/[0-9]/.test(password)) {
      return 'Le mot de passe doit contenir au moins 1 chiffre (0-9)';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Le mot de passe doit contenir au moins 1 symbole (!@#$%^&*...)';
    }
    return null;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    const passwordError = validatePassword(formData.newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      if (response.ok) {
        toast.success('Mot de passe modifié avec succès');
        setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error('Échec de la modification du mot de passe');
      }
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'rights'>('profile');

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Mon Profil</h2>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Informations personnelles
                </div>
              </button>
              <button
                onClick={() => setActiveTab('rights')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'rights'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Mes droits et accès
                </div>
              </button>
            </nav>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
          {/* Profile Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-800 dark:text-white" />
                  Informations personnelles
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-800 dark:text-white" />
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Change Password
              </button>
            </form>
          </div>
          </div>
          )}

          {/* Rights Tab */}
          {activeTab === 'rights' && (
            <div className="space-y-6">
              {/* My Groups */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-800 dark:text-white" />
                  Mes groupes
                </h3>
                {loading ? (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">Chargement...</div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">Vous n'êtes membre d'aucun groupe</div>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{group.name}</div>
                        {group.description && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{group.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Workspace Permissions */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-gray-800 dark:text-white" />
                  Accès aux workspaces
                </h3>
                {loading ? (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">Chargement...</div>
                ) : workspaces.length === 0 ? (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">Vous n'avez accès à aucun workspace</div>
                ) : (
                  <div className="space-y-3">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.workspace_id}
                        className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white mb-1">{ws.workspace_name}</div>
                            {ws.workspace_description && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{ws.workspace_description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-md border text-sm font-medium ${getPermissionColor(ws.permission_level)}`}>
                              {getPermissionLabel(ws.permission_level)}
                            </span>
                            {getPermissionIcon(ws.permission_level)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
