import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Bot, User } from 'lucide-react';

/**
 * Interface for a remote user's cursor
 */
export interface RemoteUser {
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

interface CollaborativeCursorsProps {
  users: RemoteUser[];
  currentUserId?: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  content: string;
}

/**
 * Get the pixel position of a cursor in a textarea
 */
function getCursorPixelPosition(
  textarea: HTMLTextAreaElement,
  line: number,
  column: number
): { top: number; left: number } | null {
  if (!textarea) return null;

  // Get textarea styles
  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || 22;
  const paddingTop = parseFloat(style.paddingTop) || 8;
  const paddingLeft = parseFloat(style.paddingLeft) || 12;
  const fontSize = parseFloat(style.fontSize) || 14;
  
  // Approximate character width (monospace)
  const charWidth = fontSize * 0.6;
  
  // Calculate position
  const top = paddingTop + (line - 1) * lineHeight - textarea.scrollTop;
  const left = paddingLeft + column * charWidth;
  
  return { top, left };
}

/**
 * Single remote cursor component
 */
const RemoteCursorLabel: React.FC<{
  user: RemoteUser;
  position: { top: number; left: number };
}> = ({ user, position }) => {
  const [blink, setBlink] = useState(true);
  
  // Blink animation
  useEffect(() => {
    const interval = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(interval);
  }, []);

  const displayName = user.is_agent ? user.agent_name || 'AI' : user.username;
  const typeLabel = user.is_agent ? 'MCP' : 'WEB';

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-75"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Cursor line */}
      <div
        className={`w-0.5 transition-opacity duration-100 ${blink ? 'opacity-100' : 'opacity-40'}`}
        style={{
          backgroundColor: user.color,
          height: '20px',
        }}
      />
      
      {/* User label */}
      <div
        className="absolute -top-6 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap shadow-lg"
        style={{ backgroundColor: user.color }}
      >
        <span className={`text-[8px] font-bold px-1 rounded ${user.is_agent ? 'bg-purple-800' : 'bg-blue-800'}`}>
          {typeLabel}
        </span>
        {user.is_agent ? <Bot size={10} /> : <User size={10} />}
        <span>{displayName}</span>
        {user.is_typing && (
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
 * CollaborativeCursors - Renders all remote user cursors as an overlay
 */
const CollaborativeCursors: React.FC<CollaborativeCursorsProps> = ({
  users,
  currentUserId,
  textareaRef,
  content,
}) => {
  const [cursorPositions, setCursorPositions] = useState<Map<string, { top: number; left: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter remote users with valid cursor positions
  const remoteUsers = users.filter(
    u => u.user_id !== currentUserId && u.cursor_line !== undefined && u.cursor_line > 0
  );

  // Update cursor positions when users or textarea changes
  const updatePositions = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const newPositions = new Map<string, { top: number; left: number }>();
    
    for (const user of remoteUsers) {
      if (user.cursor_line !== undefined) {
        const pos = getCursorPixelPosition(
          textarea,
          user.cursor_line,
          user.cursor_column || 0
        );
        if (pos) {
          newPositions.set(user.user_id, pos);
        }
      }
    }
    
    setCursorPositions(newPositions);
  }, [remoteUsers, textareaRef]);

  // Update on user changes
  useEffect(() => {
    updatePositions();
  }, [users, content, updatePositions]);

  // Update on scroll
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleScroll = () => updatePositions();
    textarea.addEventListener('scroll', handleScroll);
    
    return () => textarea.removeEventListener('scroll', handleScroll);
  }, [textareaRef, updatePositions]);

  // Update periodically to catch any changes
  useEffect(() => {
    const interval = setInterval(updatePositions, 500);
    return () => clearInterval(interval);
  }, [updatePositions]);

  if (remoteUsers.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 100 }}
    >
      {remoteUsers.map(user => {
        const pos = cursorPositions.get(user.user_id);
        if (!pos) return null;
        
        return (
          <RemoteCursorLabel
            key={user.user_id}
            user={user}
            position={pos}
          />
        );
      })}
    </div>
  );
};

export default CollaborativeCursors;


