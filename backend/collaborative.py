"""
Collaborative editing module for MarkD
Handles real-time presence, cursor positions, and streaming from MCP agents
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
import asyncio
import json

# Socket.IO instance will be set by main.py
sio = None

def set_sio(sio_instance):
    """Set the Socket.IO instance (called from main.py)"""
    global sio
    sio = sio_instance


# ===== Data Structures =====

@dataclass
class UserPresence:
    """Represents a user's presence in a document"""
    user_id: str
    username: str
    color: str
    is_agent: bool = False  # True if this is an AI agent (MCP)
    agent_name: Optional[str] = None  # e.g., "Cursor", "Claude", "Windsurf"
    cursor_position: Optional[int] = None  # Character position in document
    cursor_line: Optional[int] = None  # Line number
    cursor_column: Optional[int] = None  # Column number
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None
    last_activity: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            'user_id': self.user_id,
            'username': self.username,
            'color': self.color,
            'is_agent': self.is_agent,
            'agent_name': self.agent_name,
            'cursor_position': self.cursor_position,
            'cursor_line': self.cursor_line,
            'cursor_column': self.cursor_column,
            'selection_start': self.selection_start,
            'selection_end': self.selection_end,
            'last_activity': self.last_activity.isoformat() if self.last_activity else None
        }


@dataclass
class StreamingSession:
    """Represents an active streaming session from an AI agent"""
    session_id: str
    document_id: str
    user_id: str
    username: str
    agent_name: str
    start_position: int  # Where the streaming started
    current_position: int  # Current cursor position
    started_at: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True
    
    def to_dict(self) -> Dict:
        return {
            'session_id': self.session_id,
            'document_id': self.document_id,
            'user_id': self.user_id,
            'username': self.username,
            'agent_name': self.agent_name,
            'start_position': self.start_position,
            'current_position': self.current_position,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'is_active': self.is_active
        }


# ===== Global State =====

# Document presence: document_id -> {sid: UserPresence}
document_presence: Dict[str, Dict[str, UserPresence]] = {}

# Active streaming sessions: session_id -> StreamingSession
streaming_sessions: Dict[str, StreamingSession] = {}

# User colors palette (for automatic color assignment)
USER_COLORS = [
    '#3B82F6',  # Blue
    '#10B981',  # Green
    '#F59E0B',  # Amber
    '#EF4444',  # Red
    '#8B5CF6',  # Purple
    '#EC4899',  # Pink
    '#06B6D4',  # Cyan
    '#F97316',  # Orange
    '#14B8A6',  # Teal
    '#6366F1',  # Indigo
]

# Agent colors (distinct from user colors)
AGENT_COLORS = {
    'cursor': '#A855F7',    # Purple for Cursor
    'claude': '#FF6B35',    # Orange for Claude
    'windsurf': '#00D4FF',  # Cyan for Windsurf
    'copilot': '#24292E',   # Dark for GitHub Copilot
    'default': '#9333EA',   # Default agent purple
}

# Track assigned colors per document
document_color_index: Dict[str, int] = {}


def get_user_color(document_id: str, user_id: str, is_agent: bool = False, agent_name: Optional[str] = None) -> str:
    """Get a consistent color for a user in a document"""
    if is_agent and agent_name:
        return AGENT_COLORS.get(agent_name.lower(), AGENT_COLORS['default'])
    
    # For regular users, assign colors based on order of joining
    if document_id not in document_color_index:
        document_color_index[document_id] = 0
    
    # Use user_id hash to get consistent color
    color_index = hash(user_id) % len(USER_COLORS)
    return USER_COLORS[color_index]


# ===== Presence Management =====

async def join_document(sid: str, document_id: str, user_info: Dict) -> List[Dict]:
    """
    User joins a document for collaborative editing
    Returns list of current users in the document (deduplicated by user_id)
    
    Note: MCP agents use REST API and don't have real Socket.IO connections,
    so we skip room operations for them (sid starts with 'mcp_')
    """
    global document_presence
    
    if document_id not in document_presence:
        document_presence[document_id] = {}
    
    user_id = str(user_info.get('user_id', user_info.get('id', sid)))
    username = user_info.get('username', 'Anonymous')
    is_agent = user_info.get('is_agent', False)
    agent_name = user_info.get('agent_name')
    is_mcp_agent = sid.startswith('mcp_')
    
    # Remove any existing sessions for this user_id in this document (deduplication)
    sids_to_remove = []
    for existing_sid, existing_presence in document_presence[document_id].items():
        if existing_presence.user_id == user_id and existing_sid != sid:
            sids_to_remove.append(existing_sid)
    
    for old_sid in sids_to_remove:
        del document_presence[document_id][old_sid]
        # Only try to leave room for real Socket.IO connections
        if sio and not old_sid.startswith('mcp_'):
            try:
                await sio.leave_room(old_sid, f"doc_{document_id}")
            except:
                pass  # Old session might already be disconnected
    
    color = get_user_color(document_id, user_id, is_agent, agent_name)
    
    presence = UserPresence(
        user_id=user_id,
        username=username,
        color=color,
        is_agent=is_agent,
        agent_name=agent_name
    )
    
    document_presence[document_id][sid] = presence
    
    # Join Socket.IO room (only for real Socket.IO connections)
    if sio and not is_mcp_agent:
        await sio.enter_room(sid, f"doc_{document_id}")
    
    # Broadcast to all users that someone joined
    if sio:
        await sio.emit('presence:join', {
            'document_id': document_id,
            'user': presence.to_dict()
        }, room=f"doc_{document_id}")
    
    # Return current users (deduplicated by user_id)
    return get_deduplicated_users(document_id)


async def leave_document(sid: str, document_id: str) -> None:
    """User leaves a document"""
    global document_presence
    
    if document_id in document_presence and sid in document_presence[document_id]:
        user = document_presence[document_id][sid]
        del document_presence[document_id][sid]
        
        # Clean up empty documents
        if not document_presence[document_id]:
            del document_presence[document_id]
            if document_id in document_color_index:
                del document_color_index[document_id]
        
        is_mcp_agent = sid.startswith('mcp_')
        
        # Leave Socket.IO room (only for real Socket.IO connections)
        if sio and not is_mcp_agent:
            await sio.leave_room(sid, f"doc_{document_id}")
        
        # Broadcast to others that someone left
        if sio:
            await sio.emit('presence:leave', {
                'document_id': document_id,
                'user_id': user.user_id,
                'username': user.username
            }, room=f"doc_{document_id}")


async def leave_all_documents(sid: str) -> None:
    """User disconnects - leave all documents"""
    global document_presence
    
    documents_to_leave = []
    for doc_id, users in document_presence.items():
        if sid in users:
            documents_to_leave.append(doc_id)
    
    for doc_id in documents_to_leave:
        await leave_document(sid, doc_id)


async def update_cursor_position(sid: str, document_id: str, position: Dict) -> None:
    """Update user's cursor position"""
    global document_presence
    
    if document_id in document_presence and sid in document_presence[document_id]:
        presence = document_presence[document_id][sid]
        presence.cursor_position = position.get('position')
        presence.cursor_line = position.get('line')
        presence.cursor_column = position.get('column')
        presence.selection_start = position.get('selection_start')
        presence.selection_end = position.get('selection_end')
        presence.last_activity = datetime.utcnow()
        
        # Broadcast cursor update to others
        if sio:
            await sio.emit('presence:cursor', {
                'document_id': document_id,
                'user_id': presence.user_id,
                'username': presence.username,
                'color': presence.color,
                'is_agent': presence.is_agent,
                'cursor_position': presence.cursor_position,
                'cursor_line': presence.cursor_line,
                'cursor_column': presence.cursor_column,
                'selection_start': presence.selection_start,
                'selection_end': presence.selection_end
            }, room=f"doc_{document_id}", skip_sid=sid)


def get_deduplicated_users(document_id: str) -> List[Dict]:
    """
    Get users deduplicated by unique key (user_id + is_agent).
    This allows the same user to appear both as web user and MCP agent.
    """
    if document_id not in document_presence:
        return []
    
    # Group by unique key (user_id + is_agent), keep the most recent (last added)
    users_by_key: Dict[str, UserPresence] = {}
    for presence in document_presence[document_id].values():
        # Create unique key: user_id for web users, user_id_agent for MCP agents
        key = f"{presence.user_id}_agent" if presence.is_agent else presence.user_id
        users_by_key[key] = presence
    
    return [p.to_dict() for p in users_by_key.values()]


async def get_document_presence(document_id: str) -> List[Dict]:
    """Get all users currently in a document (deduplicated)"""
    return get_deduplicated_users(document_id)


async def cleanup_stale_presence(max_age_seconds: int = 60) -> int:
    """
    Clean up stale presence entries (users who haven't updated in max_age_seconds)
    Returns number of cleaned entries
    """
    global document_presence
    
    now = datetime.utcnow()
    cleaned = 0
    
    for doc_id in list(document_presence.keys()):
        sids_to_remove = []
        for sid, presence in document_presence[doc_id].items():
            age = (now - presence.last_activity).total_seconds()
            if age > max_age_seconds:
                sids_to_remove.append(sid)
        
        for sid in sids_to_remove:
            user = document_presence[doc_id][sid]
            del document_presence[doc_id][sid]
            cleaned += 1
            
            # Notify others
            if sio:
                await sio.emit('presence:leave', {
                    'document_id': doc_id,
                    'user_id': user.user_id,
                    'username': user.username
                }, room=f"doc_{doc_id}")
        
        # Clean up empty documents
        if not document_presence[doc_id]:
            del document_presence[doc_id]
            if doc_id in document_color_index:
                del document_color_index[doc_id]
    
    return cleaned


# ===== Streaming Management (for AI agents) =====

async def start_streaming(
    document_id: str,
    user_id: str,
    username: str,
    agent_name: str,
    start_position: int
) -> str:
    """Start a streaming session for an AI agent"""
    import uuid
    
    session_id = str(uuid.uuid4())
    session = StreamingSession(
        session_id=session_id,
        document_id=document_id,
        user_id=user_id,
        username=username,
        agent_name=agent_name,
        start_position=start_position,
        current_position=start_position
    )
    
    streaming_sessions[session_id] = session
    
    # Broadcast streaming start
    if sio:
        await sio.emit('stream:start', {
            'document_id': document_id,
            'session_id': session_id,
            'user_id': user_id,
            'username': username,
            'agent_name': agent_name,
            'position': start_position,
            'color': AGENT_COLORS.get(agent_name.lower(), AGENT_COLORS['default'])
        }, room=f"doc_{document_id}")
    
    return session_id


async def stream_chunk(session_id: str, text: str, position: Optional[int] = None) -> bool:
    """Stream a chunk of text from an AI agent"""
    if session_id not in streaming_sessions:
        return False
    
    session = streaming_sessions[session_id]
    if not session.is_active:
        return False
    
    # Update position
    if position is not None:
        session.current_position = position
    else:
        session.current_position += len(text)
    
    # Broadcast chunk
    if sio:
        await sio.emit('stream:chunk', {
            'document_id': session.document_id,
            'session_id': session_id,
            'user_id': session.user_id,
            'text': text,
            'position': session.current_position,
            'agent_name': session.agent_name
        }, room=f"doc_{session.document_id}")
    
    return True


async def end_streaming(session_id: str) -> bool:
    """End a streaming session"""
    if session_id not in streaming_sessions:
        return False
    
    session = streaming_sessions[session_id]
    session.is_active = False
    
    # Broadcast streaming end
    if sio:
        await sio.emit('stream:end', {
            'document_id': session.document_id,
            'session_id': session_id,
            'user_id': session.user_id,
            'agent_name': session.agent_name,
            'final_position': session.current_position
        }, room=f"doc_{session.document_id}")
    
    # Clean up session after a delay
    async def cleanup():
        await asyncio.sleep(5)
        if session_id in streaming_sessions:
            del streaming_sessions[session_id]
    
    asyncio.create_task(cleanup())
    
    return True


# ===== Content Sync =====

async def broadcast_content_change(
    document_id: str,
    user_id: str,
    username: str,
    change_type: str,  # 'insert', 'delete', 'replace'
    position: int,
    text: Optional[str] = None,
    length: Optional[int] = None,
    is_agent: bool = False
) -> None:
    """Broadcast a content change to all users in a document"""
    if sio:
        await sio.emit('content:change', {
            'document_id': document_id,
            'user_id': user_id,
            'username': username,
            'change_type': change_type,
            'position': position,
            'text': text,
            'length': length,
            'is_agent': is_agent,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f"doc_{document_id}")


async def broadcast_full_sync(document_id: str, content: str, version: int) -> None:
    """Broadcast full document content for sync"""
    if sio:
        await sio.emit('content:sync', {
            'document_id': document_id,
            'content': content,
            'version': version,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f"doc_{document_id}")

