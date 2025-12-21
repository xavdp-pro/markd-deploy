import React from 'react';
import { User, Bot } from 'lucide-react';

export interface PresenceUser {
  user_id: string;
  username: string;
  color: string;
  is_agent: boolean;
  agent_name?: string;
  cursor_position?: number;
  cursor_line?: number;
  cursor_column?: number;
}

interface PresenceBarProps {
  users: PresenceUser[];
  currentUserId?: string;
  documentName?: string;
}

const PresenceBar: React.FC<PresenceBarProps> = ({ 
  users, 
  currentUserId,
  documentName 
}) => {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
      {documentName && (
        <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
          📄 {documentName}
        </span>
      )}
      
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Connectés:</span>
      </div>
      
      <div className="flex items-center gap-1 flex-wrap">
        {users.map((user) => (
          <PresenceAvatar 
            key={user.user_id} 
            user={user} 
            isCurrentUser={user.user_id === currentUserId}
          />
        ))}
      </div>
    </div>
  );
};

interface PresenceAvatarProps {
  user: PresenceUser;
  isCurrentUser: boolean;
}

const PresenceAvatar: React.FC<PresenceAvatarProps> = ({ user, isCurrentUser }) => {
  const initials = user.username
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div 
      className="group relative flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-200 hover:scale-105"
      style={{ 
        backgroundColor: `${user.color}20`,
        border: `2px solid ${user.color}`,
      }}
    >
      {/* Type badge (WEB or MCP) */}
      <span 
        className={`text-[9px] font-bold px-1 py-0.5 rounded ${
          user.is_agent 
            ? 'bg-purple-500 text-white' 
            : 'bg-blue-500 text-white'
        }`}
      >
        {user.is_agent ? 'MCP' : 'WEB'}
      </span>
      
      {/* Avatar */}
      <div 
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: user.color }}
      >
        {user.is_agent ? (
          <Bot size={14} />
        ) : (
          initials || <User size={14} />
        )}
      </div>
      
      {/* Name */}
      <span 
        className="text-xs font-medium max-w-[100px] truncate"
        style={{ color: user.color }}
      >
        {user.is_agent ? user.agent_name || 'AI' : user.username}
        {isCurrentUser && ' (vous)'}
      </span>
      
      {/* Tooltip with more info */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        <div className="font-semibold">
          {user.is_agent ? '🤖 ' : '👤 '}
          {user.username}
        </div>
        <div className="text-gray-300 text-[10px] mt-0.5">
          {user.is_agent ? `Agent MCP: ${user.agent_name || 'AI Agent'}` : 'Utilisateur Web'}
        </div>
        {user.cursor_line !== undefined && (
          <div className="text-gray-400 mt-1">
            Ligne {user.cursor_line}, Col {user.cursor_column || 0}
          </div>
        )}
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
};

export default PresenceBar;

