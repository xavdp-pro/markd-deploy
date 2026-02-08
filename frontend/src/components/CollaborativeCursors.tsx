import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getCaretCoordinates, lineColumnToPosition } from '../utils/textareaCaretPosition';

// Helper function to determine if a color is light or dark
function getLuminance(color: string): number {
  // Remove # if present
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate relative luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Get contrast color (white or black) based on background color
function getContrastColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  // If background is light (luminance > 0.5), use dark text, otherwise use white
  return luminance > 0.5 ? '#000000' : '#ffffff';
}


export interface RemoteUser {
  client_id: string;
  username: string;
  color: string;
  is_agent: boolean;
  agent_name?: string;
  cursor_line?: number;
  cursor_column?: number;
  is_local?: boolean;
}

interface CollaborativeCursorsProps {
  users: RemoteUser[];
  localClientId?: string;
  textareaElement: HTMLTextAreaElement | null;
  content: string;
}

export default function CollaborativeCursors({ users, localClientId, textareaElement, content }: CollaborativeCursorsProps) {
  const [positions, setPositions] = useState<Map<string, { top: number; left: number; height: number }>>(new Map());

  // Filter users with valid cursor data - dedupe by client_id
  const allUsers = useMemo(() => {
    const seen = new Set<string>();
    const filtered = users.filter(u => {
      // Show cursor if line is defined and >= 0, or if column is defined
      // This allows showing cursors even if line is 0 or 1 (first line)
      if (u.cursor_line === undefined && u.cursor_column === undefined) return false;
      if (u.cursor_line !== undefined && u.cursor_line < 0) return false;
      if (seen.has(u.client_id)) return false;
      seen.add(u.client_id);
      return true;
    });
    return filtered;
  }, [users]);

  const update = useCallback(() => {
    if (!textareaElement) return;

    const next = new Map<string, { top: number; left: number; height: number }>();

    allUsers.forEach(u => {
      try {
        // Use line 1 if cursor_line is undefined or 0
        const line = u.cursor_line && u.cursor_line > 0 ? u.cursor_line : 1;
        const column = u.cursor_column || 0;
        
        // Convert line/column to absolute position
        const position = lineColumnToPosition(content, line, column);

        // Get pixel coordinates using the proven library
        const coords = getCaretCoordinates(textareaElement, position);

        // Adjust for textarea scroll
        const top = coords.top - textareaElement.scrollTop;
        const left = coords.left - textareaElement.scrollLeft;

        // Only show if within visible bounds (with larger margin for labels)
        if (top >= -30 && top <= textareaElement.clientHeight + 30) {
          next.set(u.client_id, { top, left, height: coords.height || 20 });
        }
      } catch (e) {
        console.error('[Cursor] Error calculating position for', u.username, e);
      }
    });

    setPositions(next);
  }, [textareaElement, content, allUsers]);

  // Fast update loop
  useEffect(() => {
    update();
    // Reduced update frequency to avoid forced reflows (500ms instead of 100ms)
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [update]);

  // Scroll/resize listeners
  useEffect(() => {
    if (!textareaElement) return;
    const sync = () => update();
    textareaElement.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      textareaElement.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [textareaElement, update]);

  if (!textareaElement) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 50 }}>
      {Array.from(positions.entries()).map(([cid, pos]) => {
        const user = allUsers.find(u => u.client_id === cid);
        if (!user) return null;

        const isLocal = !!user.is_local;
        const cursorHeight = Math.max(pos.height, 18);

        return (
          <div
            key={cid}
            className="absolute"
            style={{
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              transition: 'top 0.1s ease-out, left 0.1s ease-out'
            }}
          >
            {/* Cursor line */}
            <div
              className="w-[2px] rounded-sm"
              style={{
                height: `${cursorHeight}px`,
                backgroundColor: user.color,
                boxShadow: `0 0 4px ${user.color}`,
                opacity: isLocal ? 0.5 : 1
              }}
            />
            {/* Name label with better contrast for white text */}
            <div
              className="absolute px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shadow-lg flex items-center gap-1"
              style={{
                backgroundColor: user.color,
                color: getContrastColor(user.color), // Use contrast color instead of always white
                top: `-22px`,
                left: '0px',
                transform: 'translateX(-2px)',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)', // Add shadow for better readability
                border: '1px solid rgba(0,0,0,0.2)' // Add border for better visibility
              }}
            >
              <span className="text-[9px]">{isLocal ? '✏️' : user.is_agent ? '🤖' : '👤'}</span>
              <span>{user.username}{isLocal ? ' (Vous)' : ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
