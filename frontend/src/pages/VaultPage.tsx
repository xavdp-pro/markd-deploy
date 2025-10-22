import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import { Key, Plus, Eye, EyeOff, Copy, Edit2, Trash2, Search, Lock, Shield, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

interface Password {
  id: string;
  title: string;
  username: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
}

interface PasswordDetail extends Password {
  password: string;
  notes: string | null;
  workspace_id: string;
  created_by: number;
}

const VaultPage: React.FC = () => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('');
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [selectedPassword, setSelectedPassword] = useState<PasswordDetail | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('vaultSidebarWidth');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('vaultSidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: ''
  });

  // Fetch workspaces
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Fetch passwords when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      // Réinitialiser la sélection et le formulaire lors du changement de workspace
      setSelectedPassword(null);
      setShowForm(false);
      setEditingId(null);
      resetForm();
      // Passer explicitement le workspace pour éviter les problèmes de closure
      fetchPasswords(currentWorkspace);
    }
  }, [currentWorkspace]);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      const data = await response.json();
      if (data.success) {
        // Filtrer les workspaces pour ne garder que ceux avec permission read, write ou admin
        const accessibleWorkspaces = data.workspaces.filter((ws: any) => 
          ws.user_permission && ws.user_permission !== 'none'
        );
        
        setWorkspaces(accessibleWorkspaces);
        if (accessibleWorkspaces.length > 0) {
          setCurrentWorkspace(accessibleWorkspaces[0].id);
        } else {
          toast.error('Aucun workspace accessible pour le vault');
        }
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des workspaces');
    }
  };

  const fetchPasswords = async (workspaceId?: string) => {
    const wsId = workspaceId || currentWorkspace;
    if (!wsId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/vault/passwords?workspace_id=${wsId}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Accès refusé à ce workspace');
          setPasswords([]);
        } else {
          toast.error('Erreur lors du chargement des mots de passe');
        }
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setPasswords(data.passwords);
      }
    } catch (error) {
      console.error('Fetch passwords error:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPasswordDetail = async (id: string) => {
    try {
      const response = await fetch(`/api/vault/passwords/${id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedPassword(data.password);
        setShowPassword(false);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement du mot de passe');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/vault/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          workspace_id: currentWorkspace
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Mot de passe créé avec succès');
        setShowForm(false);
        resetForm();
        await fetchPasswords();
        
        // Afficher automatiquement le mot de passe créé
        if (data.id) {
          fetchPasswordDetail(data.id);
        }
      } else {
        toast.error(data.detail || 'Erreur lors de la création');
      }
    } catch (error) {
      toast.error('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    setIsLoading(true);
    try {
      // N'envoyer que les champs non vides
      const updateData: any = {
        title: formData.title,
        username: formData.username,
        url: formData.url,
        notes: formData.notes
      };
      
      // N'inclure le mot de passe que s'il a été modifié
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/vault/passwords/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Mot de passe modifié avec succès');
        setShowForm(false);
        const modifiedId = editingId;
        setEditingId(null);
        resetForm();
        await fetchPasswords();
        
        // Afficher automatiquement le mot de passe modifié
        if (modifiedId) {
          fetchPasswordDetail(modifiedId);
        }
      } else {
        toast.error(data.detail || 'Erreur lors de la modification');
      }
    } catch (error) {
      toast.error('Erreur de connexion au serveur');
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
          toast.error('Permission refusée : vous devez avoir les droits d\'écriture ou admin');
        } else {
          toast.error(data.detail || 'Erreur lors de la suppression');
        }
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success('Mot de passe supprimé');
        fetchPasswords();
        if (selectedPassword?.id === id) {
          setSelectedPassword(null);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur de connexion au serveur');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié dans le presse-papier`);
  };

  const generatePassword = () => {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password });
  };

  const startEdit = async (password: Password) => {
    setEditingId(password.id);
    
    // Fetch full password details including notes
    try {
      const response = await fetch(`/api/vault/passwords/${password.id}`);
      const data = await response.json();
      
      if (data.success && data.password) {
        setFormData({
          title: data.password.title,
          username: data.password.username || '',
          password: '', // Don't pre-fill password for security
          url: data.password.url || '',
          notes: data.password.notes || ''
        });
      } else {
        // Fallback if fetch fails
        setFormData({
          title: password.title,
          username: password.username || '',
          password: '',
          url: password.url || '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error fetching password details:', error);
      // Fallback if fetch fails
      setFormData({
        title: password.title,
        username: password.username || '',
        password: '',
        url: password.url || '',
        notes: ''
      });
    }
    
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      username: '',
      password: '',
      url: '',
      notes: ''
    });
    setEditingId(null);
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

  const filteredPasswords = passwords.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (p.username && p.username.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });


  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 overflow-hidden flex" style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
        {/* Sidebar */}
        <div className="bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col" style={{ width: `${sidebarWidth}px`, minWidth: '250px', maxWidth: '600px' }}>
          {/* Header */}
          <div className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Passwords</h2>
              </div>
              
              {/* Permission Badge */}
              {currentWorkspace && workspaces.find(ws => ws.id === currentWorkspace)?.user_permission && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded">
                  {workspaces.find(ws => ws.id === currentWorkspace)?.user_permission === 'admin' ? (
                    <>
                      <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      <span className="font-medium text-red-900 dark:text-red-300">Admin</span>
                    </>
                  ) : workspaces.find(ws => ws.id === currentWorkspace)?.user_permission === 'write' ? (
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
            
            {/* Workspace selector */}
            <div className="px-4 pb-4">
              <select
                value={currentWorkspace}
                onChange={(e) => setCurrentWorkspace(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search and filters */}
          <div className="p-4 border-b dark:border-gray-700 space-y-3">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau mot de passe
            </button>
          </div>

          {/* Password list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">Chargement...</div>
            ) : filteredPasswords.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">Aucun mot de passe</div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {filteredPasswords.map((password) => (
                  <div
                    key={password.id}
                    onClick={() => fetchPasswordDetail(password.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedPassword?.id === password.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🔐</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{password.title}</h3>
                        {password.username && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{password.username}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resizer handle */}
        <div
          className="w-1 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors relative group"
          onMouseDown={handleMouseDown}
          style={{ userSelect: 'none' }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 group-hover:opacity-20" />
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900">
          {showForm ? (
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
                {editingId ? 'Modifier le mot de passe' : 'Nouveau mot de passe'}
              </h3>
              
              <form onSubmit={editingId ? handleUpdate : handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Titre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: MariaDB Production"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom d'utilisateur
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: admin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mot de passe {!editingId && '*'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required={!editingId}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={editingId ? "Laisser vide pour ne pas modifier" : "Mot de passe"}
                    />
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Générer
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL
                  </label>
                  <input
                    type="text"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Notes additionnelles..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          ) : selectedPassword ? (
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔐</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">{selectedPassword.title}</h3>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(selectedPassword)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Modifier"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: selectedPassword.id, title: selectedPassword.title })}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {selectedPassword.username && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nom d'utilisateur
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={selectedPassword.username}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={() => copyToClipboard(selectedPassword.username!, 'Nom d\'utilisateur')}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mot de passe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={selectedPassword.password}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded font-mono text-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(selectedPassword.password, 'Mot de passe')}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {selectedPassword.url && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={selectedPassword.url}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={() => copyToClipboard(selectedPassword.url!, 'URL')}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {selectedPassword.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={selectedPassword.notes}
                      readOnly
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}

                <div className="pt-4 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <p>Créé le : {new Date(selectedPassword.created_at).toLocaleString('fr-FR')}</p>
                  <p>Modifié le : {new Date(selectedPassword.updated_at).toLocaleString('fr-FR')}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <Lock className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <p className="text-lg">Sélectionnez un mot de passe pour voir les détails</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Supprimer le mot de passe"
        message={`Voulez-vous vraiment supprimer "${deleteConfirm?.title}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default VaultPage;
