import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getCaretCoordinates, lineColumnToPosition } from '../utils/textareaCaretPosition';

export interface RemoteUser {
  client_id: number;
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
  localClientId?: number;
  textareaElement: HTMLTextAreaElement | null;
  content: string;
}

export default function CollaborativeCursors({ users, localClientId, textareaElement, content }: CollaborativeCursorsProps) {
  const [positions, setPositions] = useState<Map<number, { top: number; left: number; height: number }>>(new Map());

  // Filter users with valid cursor data - dedupe by client_id
  const allUsers = useMemo(() => {
    const seen = new Set<number>();
    return users.filter(u => {
      if (u.cursor_line === undefined || u.cursor_line <= 0) return false;
      if (seen.has(u.client_id)) return false;
      seen.add(u.client_id);
      return true;
    });
  }, [users]);

  const update = useCallback(() => {
    if (!textareaElement) return;

    const next = new Map<number, { top: number; left: number; height: number }>();

    allUsers.forEach(u => {
      try {
        // Convert line/column to absolute position
        const position = lineColumnToPosition(content, u.cursor_line!, u.cursor_column || 0);

        // Get pixel coordinates using the proven library
        const coords = getCaretCoordinates(textareaElement, position);

        // Adjust for textarea scroll
        const top = coords.top - textareaElement.scrollTop;
        const left = coords.left - textareaElement.scrollLeft;

        console.log(`[Cursor Debug] ${u.username}: line=${u.cursor_line}, col=${u.cursor_column}, pos=${position}, top=${top}, left=${left}, height=${coords.height}`);

        // Only show if within visible bounds
        if (top >= -20 && top <= textareaElement.clientHeight + 20) {
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
    const interval = setInterval(update, 100);
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
            {/* Name label */}
            <div
              className="absolute px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap shadow-md flex items-center gap-1"
              style={{
                backgroundColor: user.color,
                top: `-22px`,
                left: '0px',
                transform: 'translateX(-2px)'
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
