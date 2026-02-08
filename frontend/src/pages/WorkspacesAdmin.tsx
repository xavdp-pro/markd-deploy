import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, FolderTree, Save, X, Users, Shield, Eye, Edit, ChevronDown, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  user_permission?: string;
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

const PERMISSION_OPTIONS: Array<{ value: 'none' | 'read' | 'write' | 'admin'; label: string; shortLabel: string; description: string; icon: React.ReactNode; color: string; bg: string }> = [
  {
    value: 'none',
    label: 'No access',
    shortLabel: '—',
    description: 'Cannot see this workspace',
    icon: <span className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 text-xs font-bold">—</span>,
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600',
  },
  {
    value: 'read',
    label: 'RO (Read)',
    shortLabel: 'RO',
    description: 'Read only access',
    icon: <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700',
  },
  {
    value: 'write',
    label: 'RW (Write)',
    shortLabel: 'RW',
    description: 'Read & write access',
    icon: <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
  },
  {
    value: 'admin',
    label: 'Admin',
    shortLabel: 'Admin',
    description: 'Full control',
    icon: <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />,
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700',
  },
];

const PermissionSelect: React.FC<{
  value: string;
  onChange: (value: 'none' | 'read' | 'write' | 'admin') => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const current = PERMISSION_OPTIONS.find(o => o.value === value) || PERMISSION_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium
          transition-all cursor-pointer select-none min-w-[130px]
          ${current.bg} ${current.color}
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40
        `}
      >
        {current.icon}
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800 animate-in fade-in slide-in-from-top-1 duration-150">
          {PERMISSION_OPTIONS.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={`
                  flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors
                  ${isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const WorkspacesAdmin: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
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

      // Always set workspaces, even if groups fail to load
      if (wsData.success) {
        setWorkspaces(wsData.workspaces || []);
      }

      // Only load groups and permissions if user is admin
      if (isAdmin) {
        const groupsRes = await fetch('/api/groups', { credentials: 'include' });
        const groupsData = await groupsRes.json();

      if (groupsData.success) {
        setGroups(groupsData.groups || []);
      }

      // Load permissions for all workspaces only if both workspaces and groups loaded successfully
      if (wsData.success && groupsData.success && wsData.workspaces && groupsData.groups) {
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
                try {
                  const res = await fetch(`/api/groups/${group.id}/workspaces`, {
                    credentials: 'include'
                  });
                  const data = await res.json();

                  if (data.success && data.workspaces) {
                    const hasAccess = data.workspaces.find((w: any) => w.id === ws.id);
                    if (hasAccess) {
                      wsPerms[group.id] = hasAccess.permission_level;
                    }
                  }
                } catch (err) {
                  console.error(`Error loading permissions for group ${group.id}:`, err);
                }
              })
            );

            permsMap[ws.id] = wsPerms;
          })
        );

        setPermissions(permsMap);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
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
        toast.success('Workspace created');
        setCreating(false);
        setFormData({ name: '', description: '' });
        loadData();
      }
    } catch (err) {
      console.error('Error creating workspace:', err);
      toast.error('Error creating workspace');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
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
        toast.success('Workspace updated');
        setEditing(null);
        setFormData({ name: '', description: '' });
        loadData();
      }
    } catch (err) {
      console.error('Error updating workspace:', err);
      toast.error('Error updating workspace');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Workspace deleted');
        loadData();
      }
    } catch (err) {
      console.error('Error deleting workspace:', err);
      toast.error('Error deleting workspace');
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
          toast.success('Access removed');
        }
      } else if (currentLevel === 'none') {
        // Add permission
        await fetch(`/api/groups/${groupId}/workspaces`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, permission_level: newLevel }),
        });
        toast.success('Access granted');
      } else {
        // Update permission
        await fetch(`/api/groups/${groupId}/workspaces/${workspaceId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, permission_level: newLevel }),
        });
        toast.success('Permission updated');
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
      toast.error('Error updating permission');
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

  const getPermissionLabel = (perm: string | undefined) => {
    switch (perm) {
      case 'admin': return 'Admin';
      case 'write': return 'Write (RW)';
      case 'read': return 'Read (RO)';
      default: return 'No access';
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 min-h-screen">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isAdmin ? 'Workspace Management' : 'My Workspaces'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isAdmin ? 'Configure permissions per business group' : 'Your workspaces and access rights'}
          </p>
        </div>
        {isAdmin && (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Workspace
        </button>
        )}
      </div>

      {/* Info Box */}
      {isAdmin && (
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-300">
          <strong>Principle:</strong> Users belong to business groups (ALL, Developers, etc.). 
          For each workspace, choose the access level for each group.
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-400 mt-2">
          <strong>None</strong> = no access • <strong>RO</strong> = read only • <strong>RW</strong> = read + write • <strong>Admin</strong> = full access
        </p>
      </div>
      )}

      {/* Create Form */}
      {isAdmin && creating && (
        <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create a workspace</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workspace name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Product Documentation"
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
                placeholder="Workspace description..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Create
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspaces List */}
      <div className="space-y-6">
        {workspaces.map((workspace) => {
          const wsPerms = permissions[workspace.id] || {};
          const userPermission = workspace.user_permission || 'none';

          return (
            <div key={workspace.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              {isAdmin && editing === workspace.id ? (
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
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
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
                      <div className="flex items-center gap-4">
                        {/* Display user permission for non-admins */}
                        {!isAdmin && (
                          <div className={`px-3 py-1.5 rounded-md border text-sm font-medium ${getPermissionColor(userPermission)}`}>
                            {getPermissionLabel(userPermission)}
                          </div>
                        )}
                        {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(workspace)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(workspace.id, workspace.name)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Permissions Table - Only for admins */}
                  {isAdmin && (
                  <div className="p-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-900 dark:text-white" />
                      Permissions per group
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
                                  {group.user_count} member{group.user_count !== 1 ? 's' : ''}
                                  {group.description && ` • ${group.description}`}
                                </div>
                              </div>
                            </div>
                            <PermissionSelect
                              value={level}
                              onChange={(newLevel) => handlePermissionChange(
                                workspace.id,
                                group.id,
                                newLevel
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                  
                  {/* User permission info for non-admins */}
                  {!isAdmin && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Your rights on this workspace</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {userPermission === 'admin' && 'You have full access to this workspace'}
                            {userPermission === 'write' && 'You can read and edit documents in this workspace'}
                            {userPermission === 'read' && 'You can only read documents in this workspace'}
                            {userPermission === 'none' && 'You do not have access to this workspace'}
                          </p>
                        </div>
                        <div className={`px-4 py-2 rounded-md border text-sm font-medium ${getPermissionColor(userPermission)}`}>
                          {getPermissionLabel(userPermission)}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {workspaces.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <FolderTree className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {isAdmin ? 'No workspaces created' : 'No accessible workspaces'}
          </p>
          {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Create the first workspace
          </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspacesAdmin;
