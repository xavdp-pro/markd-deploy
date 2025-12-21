import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';

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

  // Calculate position (this would need to be integrated with the actual editor)
  // For now, we show it as an overlay indicator
  const displayName = isAgent ? agentName || 'AI' : username;

  return (
    <div 
      className="absolute pointer-events-none z-40"
      style={{
        // Position would be calculated based on line/column in actual implementation
        left: `${column * 8}px`, // Approximate character width
        top: `${(line - 1) * 20}px`, // Approximate line height
      }}
    >
      {/* Cursor line */}
      <div 
        className={`w-0.5 h-5 transition-opacity duration-100 ${blink ? 'opacity-100' : 'opacity-30'}`}
        style={{ backgroundColor: color }}
      />
      
      {/* User label */}
      <div 
        className="absolute -top-5 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
        style={{ backgroundColor: color }}
      >
        {isAgent && <Bot size={10} />}
        {displayName}
        {isTyping && (
          <span className="ml-1 animate-pulse">...</span>
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
  position: number;
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  agentName,
  color,
  position,
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
 * CursorOverlay manages multiple remote cursors
 */
interface CursorUser {
  user_id: string;
  username: string;
  color: string;
  is_agent: boolean;
  agent_name?: string;
  cursor_line?: number;
  cursor_column?: number;
}

interface CursorOverlayProps {
  users: CursorUser[];
  currentUserId?: string;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ 
  users, 
  currentUserId 
}) => {
  // Filter out current user and users without cursor position
  const remoteCursors = users.filter(
    u => u.user_id !== currentUserId && u.cursor_line !== undefined
  );

  if (remoteCursors.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {remoteCursors.map(user => (
        <RemoteCursor
          key={user.user_id}
          username={user.username}
          color={user.color}
          isAgent={user.is_agent}
          agentName={user.agent_name}
          line={user.cursor_line!}
          column={user.cursor_column || 0}
        />
      ))}
    </div>
  );
};

export default RemoteCursor;

