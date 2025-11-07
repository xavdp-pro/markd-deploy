import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import { Workflow, WorkflowStatus } from '../types';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Save, X, Star, ArrowRight } from 'lucide-react';
import TaskStatusBadge from '../components/TaskStatusBadge';

interface Workspace {
  id: string;
  name: string;
  user_permission?: string;
}

const WorkflowsAdmin: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('default');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    is_default: false,
    statuses: [
      { key: 'todo', label: 'À faire', color: '#6b7280' },
      { key: 'doing', label: 'En cours', color: '#3b82f6' },
      { key: 'done', label: 'Terminé', color: '#10b981' },
    ] as WorkflowStatus[],
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      loadWorkflows();
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

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await api.getWorkflows(currentWorkspace);
      setWorkflows(response.workflows);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createWorkflow(formData, currentWorkspace);
      toast.success('Workflow créé');
      loadWorkflows();
      setShowCreateForm(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const workflow = workflows.find(w => w.id === id);
      if (!workflow) return;
      
      await api.updateWorkflow(id, {
        name: workflow.name,
        is_default: workflow.is_default,
        statuses: workflow.statuses,
      });
      
      toast.success('Workflow mis à jour');
      setEditingId(null);
      loadWorkflows();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce workflow ?')) return;
    
    try {
      await api.deleteWorkflow(id);
      toast.success('Workflow supprimé');
      loadWorkflows();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      is_default: false,
      statuses: [
        { key: 'todo', label: 'À faire', color: '#6b7280' },
        { key: 'doing', label: 'En cours', color: '#3b82f6' },
        { key: 'done', label: 'Terminé', color: '#10b981' },
      ],
    });
  };

  const addStatus = (workflowId?: number) => {
    const newStatus = { key: 'new_status', label: 'Nouveau statut', color: '#6b7280' };
    
    if (workflowId !== undefined) {
      setWorkflows(prev =>
        prev.map(w =>
          w.id === workflowId ? { ...w, statuses: [...w.statuses, newStatus] } : w
        )
      );
    } else {
      setFormData(prev => ({ ...prev, statuses: [...prev.statuses, newStatus] }));
    }
  };

  const removeStatus = (index: number, workflowId?: number) => {
    if (workflowId !== undefined) {
      setWorkflows(prev =>
        prev.map(w =>
          w.id === workflowId
            ? { ...w, statuses: w.statuses.filter((_, i) => i !== index) }
            : w
        )
      );
    } else {
      setFormData(prev => ({ ...prev, statuses: prev.statuses.filter((_, i) => i !== index) }));
    }
  };

  const updateStatus = (index: number, updates: Partial<WorkflowStatus>, workflowId?: number) => {
    if (workflowId !== undefined) {
      setWorkflows(prev =>
        prev.map(w =>
          w.id === workflowId
            ? {
                ...w,
                statuses: w.statuses.map((s, i) => (i === index ? { ...s, ...updates } : s)),
              }
            : w
        )
      );
    } else {
      setFormData(prev => ({
        ...prev,
        statuses: prev.statuses.map((s, i) => (i === index ? { ...s, ...updates } : s)),
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Workflows
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configurez les processus de travail (Simple, Avec validation, etc.)
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
          Nouveau workflow
        </button>

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Créer un nouveau workflow</h3>
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={e => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm">Workflow par défaut</label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Statuts</label>
                  <button
                    type="button"
                    onClick={() => addStatus()}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    + Ajouter statut
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.statuses.map((status, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={status.key}
                        onChange={e => updateStatus(index, { key: e.target.value })}
                        placeholder="Clé (ex: todo)"
                        className="w-32 px-2 py-1 border rounded dark:bg-gray-700 text-sm"
                      />
                      <input
                        type="text"
                        value={status.label}
                        onChange={e => updateStatus(index, { label: e.target.value })}
                        placeholder="Label (ex: À faire)"
                        className="flex-1 px-2 py-1 border rounded dark:bg-gray-700 text-sm"
                      />
                      <input
                        type="color"
                        value={status.color}
                        onChange={e => updateStatus(index, { color: e.target.value })}
                        className="w-12 h-8 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => removeStatus(index)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                      >
                        <X size={16} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Workflows list */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : workflows.length === 0 ? (
            <div className="text-center text-gray-400 py-8">Aucun workflow</div>
          ) : (
            workflows.map(workflow => (
              <div
                key={workflow.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {workflow.name}
                    </h3>
                    {workflow.is_default && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                        <Star size={12} />
                        Par défaut
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(workflow.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Edit2 size={18} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(workflow.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Trash2 size={18} className="text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Workflow statuses */}
                <div className="flex flex-wrap items-center gap-2">
                  {workflow.statuses.map((status, index) => (
                    <React.Fragment key={index}>
                      <TaskStatusBadge status={status.key} workflowStatuses={workflow.statuses} />
                      {index < workflow.statuses.length - 1 && (
                        <ArrowRight size={16} className="text-gray-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Edit mode */}
                {editingId === workflow.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nom</label>
                      <input
                        type="text"
                        value={workflow.name}
                        onChange={e =>
                          setWorkflows(prev =>
                            prev.map(w => (w.id === workflow.id ? { ...w, name: e.target.value } : w))
                          )
                        }
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={workflow.is_default}
                        onChange={e =>
                          setWorkflows(prev =>
                            prev.map(w => (w.id === workflow.id ? { ...w, is_default: e.target.checked } : w))
                          )
                        }
                        className="w-4 h-4"
                      />
                      <label className="text-sm">Workflow par défaut</label>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium">Statuts</label>
                        <button
                          type="button"
                          onClick={() => addStatus(workflow.id)}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          + Ajouter
                        </button>
                      </div>
                      <div className="space-y-2">
                        {workflow.statuses.map((status, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={status.key}
                              onChange={e => updateStatus(index, { key: e.target.value }, workflow.id)}
                              placeholder="Clé"
                              className="w-32 px-2 py-1 border rounded dark:bg-gray-700 text-sm"
                            />
                            <input
                              type="text"
                              value={status.label}
                              onChange={e => updateStatus(index, { label: e.target.value }, workflow.id)}
                              placeholder="Label"
                              className="flex-1 px-2 py-1 border rounded dark:bg-gray-700 text-sm"
                            />
                            <input
                              type="color"
                              value={status.color}
                              onChange={e => updateStatus(index, { color: e.target.value }, workflow.id)}
                              className="w-12 h-8 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => removeStatus(index, workflow.id)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                            >
                              <X size={16} className="text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(workflow.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                      >
                        <Save size={16} />
                        Enregistrer
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          loadWorkflows();
                        }}
                        className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowsAdmin;

