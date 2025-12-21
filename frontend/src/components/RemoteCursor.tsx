import React, { useEffect, useState, useMemo } from 'react';
import { Bot, User } from 'lucide-react';

interface RemoteCursorProps {
  username: string;
  color: string;
  isAgent: boolean;
  agentName?: string;
  line: number;
  column: number;
  isTyping?: boolean;
}

/**
 * RemoteCursor displays another user's cursor position in the editor
 * Shows a colored cursor line with the user's name above it
 */
const RemoteCursor: React.FC<RemoteCursorProps> = ({
  username,
  color,
  isAgent,
  agentName,
  line,
  column,
  isTyping = false,
}) => {
  const [blink, setBlink] = useState(true);

  // Cursor blink animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(b => !b);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  const displayName = isAgent ? agentName || 'AI' : username;
  const typeLabel = isAgent ? 'MCP' : 'WEB';

  return (
    <div 
      className="absolute pointer-events-none z-40 transition-all duration-75"
      style={{
        left: `${column * 8.4 + 48}px`, // Approximate character width + line number gutter
        top: `${(line - 1) * 22 + 8}px`, // Approximate line height + padding
      }}
    >
      {/* Cursor line (blinking) */}
      <div 
        className={`w-0.5 h-5 transition-opacity duration-100 ${blink ? 'opacity-100' : 'opacity-40'}`}
        style={{ backgroundColor: color }}
      />
      
      {/* User label with type badge */}
      <div 
        className="absolute -top-6 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-lg animate-fade-in"
        style={{ backgroundColor: color }}
      >
        {/* Type badge */}
        <span className={`text-[8px] font-bold px-1 rounded ${isAgent ? 'bg-purple-800' : 'bg-blue-800'}`}>
          {typeLabel}
        </span>
        {isAgent ? <Bot size={10} /> : <User size={10} />}
        <span>{displayName}</span>
        {isTyping && (
          <span className="ml-1 flex gap-0.5">
            <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * StreamingIndicator shows when an AI agent is actively streaming content
 */
interface StreamingIndicatorProps {
  agentName: string;
  color: string;
  position?: number;
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  agentName,
  color,
}) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div 
        className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-white"
        style={{ backgroundColor: color }}
      >
        <Bot size={16} className="animate-bounce" />
        <span className="text-sm font-medium">{agentName} écrit...</span>
        <div className="flex gap-0.5">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};

/**
 * CursorUser interface for the overlay
 */
interface CursorUser {
  user_id: string;
  username: string;
  color: string;
  is_agent: boolean;
  agent_name?: string;
  cursor_line?: number;
  cursor_column?: number;
  cursor_position?: number;
  is_typing?: boolean;
}

interface CursorOverlayProps {
  users: CursorUser[];
  currentUserId?: string;
  content?: string;
}

/**
 * CursorOverlay manages multiple remote cursors
 * Positioned absolutely over the editor textarea
 */
export const CursorOverlay: React.FC<CursorOverlayProps> = ({ 
  users, 
  currentUserId,
  content = ''
}) => {
  // Filter out current user and users without cursor position
  const remoteCursors = useMemo(() => {
    return users.filter(
      u => u.user_id !== currentUserId && u.cursor_line !== undefined && u.cursor_line > 0
    );
  }, [users, currentUserId]);

  if (remoteCursors.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {remoteCursors.map(user => (
        <RemoteCursor
          key={user.user_id}
          username={user.username}
          color={user.color}
          isAgent={user.is_agent}
          agentName={user.agent_name}
          line={user.cursor_line!}
          column={user.cursor_column || 0}
          isTyping={user.is_typing}
        />
      ))}
    </div>
  );
};

/**
 * Inline cursor indicator shown in the presence bar or as a small badge
 */
interface InlineCursorIndicatorProps {
  user: CursorUser;
  isCurrentUser?: boolean;
}

export const InlineCursorIndicator: React.FC<InlineCursorIndicatorProps> = ({
  user,
  isCurrentUser = false,
}) => {
  const typeLabel = user.is_agent ? 'MCP' : 'WEB';
  
  return (
    <div 
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
      style={{ 
        backgroundColor: `${user.color}20`,
        border: `2px solid ${user.color}`,
        color: user.color,
      }}
    >
      <span className={`text-[8px] font-bold px-1 py-0.5 rounded text-white ${user.is_agent ? 'bg-purple-500' : 'bg-blue-500'}`}>
        {typeLabel}
      </span>
      {user.is_agent ? <Bot size={12} /> : <User size={12} />}
      <span>{user.is_agent ? user.agent_name || 'AI' : user.username}</span>
      {isCurrentUser && <span className="text-[10px] opacity-70">(vous)</span>}
      {user.cursor_line && (
        <span className="text-[10px] opacity-70">
          L{user.cursor_line}:{user.cursor_column || 0}
        </span>
      )}
    </div>
  );
};

export default RemoteCursor;
