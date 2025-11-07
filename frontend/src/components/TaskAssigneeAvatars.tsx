import React from 'react';
import { User } from '../types';
import { Crown, User as UserIcon } from 'lucide-react';

interface TaskAssigneeAvatarsProps {
  assignedUsers: User[];
  responsibleUserId?: number | null;
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TaskAssigneeAvatars: React.FC<TaskAssigneeAvatarsProps> = ({
  assignedUsers,
  responsibleUserId,
  maxDisplay = 3,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const sizeClass = sizeClasses[size];

  if (assignedUsers.length === 0) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className={`${sizeClass} rounded-full bg-gray-200 flex items-center justify-center`}>
          <UserIcon size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} className="text-gray-400" />
        </div>
        <span className="text-xs text-gray-400">Non assigné</span>
      </div>
    );
  }

  const displayUsers = assignedUsers.slice(0, maxDisplay);
  const remainingCount = assignedUsers.length - maxDisplay;

  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (username: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
    ];
    const index = username.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex -space-x-2">
        {displayUsers.map(user => {
          const isResponsible = user.id === responsibleUserId;
          return (
            <div
              key={user.id}
              className={`${sizeClass} rounded-full ${getAvatarColor(
                user.username
              )} flex items-center justify-center text-white font-medium relative ${
                isResponsible ? 'ring-2 ring-yellow-400' : ''
              }`}
              title={`${user.username}${isResponsible ? ' (Responsable)' : ''}`}
            >
              {getInitials(user.username)}
              {isResponsible && (
                <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5">
                  <Crown size={10} className="text-white" />
                </div>
              )}
            </div>
          );
        })}
        {remainingCount > 0 && (
          <div
            className={`${sizeClass} rounded-full bg-gray-300 flex items-center justify-center text-gray-700 font-medium`}
            title={`+${remainingCount} autres`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskAssigneeAvatars;

