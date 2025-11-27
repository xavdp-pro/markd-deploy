import React from 'react';

interface PresenceAvatarsProps {
  users: Array<{ id: string; username: string }>;
  maxVisible?: number;
}

const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ users, maxVisible = 3 }) => {
  if (!users || users.length === 0) return null;

  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;

  const getInitials = (username: string) => {
    const parts = username.trim().split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return username.slice(0, 2).toUpperCase();
  };

  // Generate a consistent color based on username
  const getAvatarColor = (username: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-emerald-500',
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex items-center -space-x-2">
      {visibleUsers.map((user) => (
        <div
          key={user.id}
          className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-gray-800 ${getAvatarColor(
            user.username
          )}`}
          title={user.username}
        >
          {getInitials(user.username)}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className="relative w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-medium border-2 border-white dark:border-gray-800"
          title={`+${remainingCount} more`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export default PresenceAvatars;
