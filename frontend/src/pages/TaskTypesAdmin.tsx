import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import { TaskType } from '../types';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, GripVertical, Save, X } from 'lucide-react';
import TaskTypeIcon from '../components/TaskTypeIcon';

interface Workspace {
  id: string;
  name: string;
  user_permission?: string;
}

const TaskTypesAdmin: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('default');
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    color: '#6b7280',
    position: 0,
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      loadTaskTypes();
    }
  }, [currentWorkspace]);

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        const adminWorkspaces = data.workspaces.filter((ws: any) => ws.user_permission === 'admin');
        setWorkspaces(adminWorkspaces);
        if (adminWorkspaces.length > 0) {
          setCurrentWorkspace(adminWorkspaces[0].id);
        }
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des workspaces');
    }
  };

  const loadTaskTypes = async () => {
    setLoading(true);
    try {
      const response = await api.getTaskTypes(currentWorkspace);
      setTaskTypes(response.task_types);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTaskType(formData, currentWorkspace);
      toast.success('Type de tâche créé');
      loadTaskTypes();
      setShowCreateForm(false);
      setFormData({ name: '', icon: '', color: '#6b7280', position: 0 });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const type = taskTypes.find(t => t.id === id);
      if (!type) return;
      
      await api.updateTaskType(id, {
        name: type.name,
        icon: type.icon,
        color: type.color,
        position: type.position,
      });
      
      toast.success('Type de tâche mis à jour');
      setEditingId(null);
      loadTaskTypes();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce type de tâche ?')) return;
    
    try {
      await api.deleteTaskType(id);
      toast.success('Type de tâche supprimé');
      loadTaskTypes();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const updateTaskType = (id: number, updates: Partial<TaskType>) => {
    setTaskTypes(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const commonIcons = ['🎯', '📖', '✓', '→', '⚡', '🔧', '🐛', '✨', '📝', '🚀'];
  const commonColors = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Types de tâches
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configurez les types de tâches disponibles pour ce workspace (Epic, Story, Task, etc.)
          </p>
        </div>

        {/* Workspace selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Workspace
          </label>
          <select
            value={currentWorkspace}
            onChange={e => setCurrentWorkspace(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
          >
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        {/* Create button */}
        <button
          onClick={() => setShowCreateForm(true)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={18} />
          Nouveau type
        </button>

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Créer un nouveau type</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Icône</label>
                <div className="flex gap-2 mb-2">
                  {commonIcons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`px-3 py-2 border rounded ${formData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={e => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="Ou entrez un emoji..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Couleur</label>
                <div className="flex gap-2 mb-2">
                  {commonColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded border-2 ${formData.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 rounded"
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Task types list */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : taskTypes.length === 0 ? (
            <div className="text-center text-gray-400 py-8">Aucun type de tâche</div>
          ) : (
            taskTypes.map(type => (
              <div
                key={type.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-4"
              >
                <GripVertical size={20} className="text-gray-400 cursor-move" />
                
                <TaskTypeIcon icon={type.icon} color={type.color} name={type.name} size="text-2xl" />

                {editingId === type.id ? (
                  <>
                    <input
                      type="text"
                      value={type.name}
                      onChange={e => updateTaskType(type.id, { name: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      value={type.icon || ''}
                      onChange={e => updateTaskType(type.id, { icon: e.target.value })}
                      placeholder="Icône"
                      className="w-20 px-3 py-2 border rounded-lg dark:bg-gray-700"
                    />
                    <input
                      type="color"
                      value={type.color || '#6b7280'}
                      onChange={e => updateTaskType(type.id, { color: e.target.value })}
                      className="w-16 h-10 rounded"
                    />
                    <button
                      onClick={() => handleUpdate(type.id)}
                      className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        loadTaskTypes();
                      }}
                      className="p-2 bg-gray-300 dark:bg-gray-700 rounded hover:bg-gray-400"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{type.name}</div>
                      <div className="text-sm text-gray-500">Position: {type.position}</div>
                    </div>
                    <button
                      onClick={() => setEditingId(type.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Edit2 size={18} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(type.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Trash2 size={18} className="text-red-500" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskTypesAdmin;

