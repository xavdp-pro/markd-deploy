import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { X, Crown, Search } from 'lucide-react';

interface UserMultiSelectProps {
  selectedUserIds: number[];
  responsibleUserId?: number | null;
  onSelectionChange: (userIds: number[], responsibleId?: number) => void;
  workspaceId: string;
  className?: string;
}

const UserMultiSelect: React.FC<UserMultiSelectProps> = ({
  selectedUserIds,
  responsibleUserId,
  onSelectionChange,
  workspaceId,
  className = '',
}) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [workspaceId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/users`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedUsers = allUsers.filter(u => selectedUserIds.includes(u.id));
  const availableUsers = allUsers.filter(
    u => !selectedUserIds.includes(u.id) && u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddUser = (userId: number) => {
    const newUserIds = [...selectedUserIds, userId];
    onSelectionChange(newUserIds, responsibleUserId || undefined);
    setSearchQuery('');
  };

  const handleRemoveUser = (userId: number) => {
    const newUserIds = selectedUserIds.filter(id => id !== userId);
    const newResponsibleId = responsibleUserId === userId ? undefined : responsibleUserId || undefined;
    onSelectionChange(newUserIds, newResponsibleId);
  };

  const handleSetResponsible = (userId: number) => {
    onSelectionChange(selectedUserIds, userId);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selected users */}
      <div className="mb-2">
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Assignees
        </label>
        <div className="flex flex-wrap gap-2">
          {selectedUsers.length === 0 ? (
            <span className="text-sm text-gray-400">No assignees</span>
          ) : (
            selectedUsers.map(user => (
              <div
                key={user.id}
                className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded text-sm"
              >
                <span>{user.username}</span>
                {responsibleUserId === user.id && (
                  <Crown size={14} className="text-yellow-500" title="Responsible" />
                )}
                {responsibleUserId !== user.id && (
                  <button
                    onClick={() => handleSetResponsible(user.id)}
                    className="text-gray-500 hover:text-yellow-500"
                    title="Set as responsible"
                  >
                    <Crown size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleRemoveUser(user.id)}
                  className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Search and add */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Add users
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search a user..."
            className="w-full px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
          />
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        </div>

        {/* Dropdown */}
        {isOpen && availableUsers.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {availableUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    handleAddUser(user.id);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{user.username}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {loading && (
        <div className="mt-2 text-sm text-gray-400">Loading users...</div>
      )}
    </div>
  );
};

export default UserMultiSelect;

