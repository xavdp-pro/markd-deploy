import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Edit2, Search, X } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface TagItem {
  id: string;
  name: string;
  created_at: string;
}

const TagsAdmin: React.FC = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [filteredTags, setFilteredTags] = useState<TagItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{tagId: string, tagName: string} | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
  });

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateModal || editingTag) {
          setShowCreateModal(false);
          setEditingTag(null);
          setFormData({ name: '' });
        }
        if (deleteConfirm) {
          setDeleteConfirm(null);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, editingTag, deleteConfirm]);

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchTags();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = tags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags(tags);
    }
  }, [searchQuery, tags]);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/admin/tags', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setTags(data.tags || []);
        setFilteredTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('Erreur lors du chargement des tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Le nom du tag ne peut pas être vide');
      return;
    }

    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Tag créé avec succès');
        setShowCreateModal(false);
        setFormData({ name: '' });
        fetchTags();
      } else {
        toast.error(data.detail || 'Erreur lors de la création du tag');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Erreur lors de la création du tag');
    }
  };

  const handleUpdate = async () => {
    if (!editingTag || !formData.name.trim()) {
      toast.error('Le nom du tag ne peut pas être vide');
      return;
    }

    try {
      const response = await fetch(`/api/admin/tags/${editingTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Tag modifié avec succès');
        setEditingTag(null);
        setFormData({ name: '' });
        fetchTags();
      } else {
        toast.error(data.detail || 'Erreur lors de la modification du tag');
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Erreur lors de la modification du tag');
    }
  };

  const handleDeleteClick = (tagId: string, tagName: string) => {
    setDeleteConfirm({ tagId, tagName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    const { tagId } = deleteConfirm;
    
    try {
      const response = await fetch(`/api/admin/tags/${tagId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Tag supprimé avec succès');
        setDeleteConfirm(null);
        fetchTags();
      } else {
        toast.error(data.detail || 'Erreur lors de la suppression du tag');
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Erreur lors de la suppression du tag');
    }
  };

  const handleEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setFormData({ name: tag.name });
  };

  const handleCancel = () => {
    setShowCreateModal(false);
    setEditingTag(null);
    setFormData({ name: '' });
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Gestion des Tags</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Gérer les tags communs aux documents, tâches et mots de passe</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Ajouter un tag
            </button>
          </div>

          {/* Search bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher un tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Tags list */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {filteredTags.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {searchQuery ? 'Aucun tag trouvé' : 'Aucun tag pour le moment'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{tag.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Créé le {new Date(tag.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(tag)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tag.id, tag.name)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTag) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingTag ? 'Modifier le tag' : 'Nouveau tag'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom du tag
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: important, urgent, documentation"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingTag ? handleUpdate : handleCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  {editingTag ? 'Modifier' : 'Créer'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Êtes-vous sûr de vouloir supprimer le tag <strong>"{deleteConfirm.tagName}"</strong> ?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Cette action supprimera le tag de tous les documents, tâches et mots de passe qui l'utilisent.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagsAdmin;

