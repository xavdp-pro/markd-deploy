"""
MCP Streaming API for MarkD
Provides endpoints for AI agents to stream content in real-time
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import hashlib
from datetime import datetime

from database import db
from collaborative import (
    start_streaming,
    stream_chunk,
    end_streaming,
    broadcast_content_change,
    get_document_presence,
    join_document,
    leave_document,
    update_cursor_position
)

router = APIRouter(prefix="/api/mcp", tags=["MCP Streaming"])


# ===== Pydantic Models =====

class MCPStreamStartRequest(BaseModel):
    mcp_token: str
    document_id: str
    position: int = 0  # Where to start writing
    agent_name: str = "MCP Agent"


class MCPStreamChunkRequest(BaseModel):
    mcp_token: str
    session_id: str
    text: str
    position: Optional[int] = None  # Optional: override position


class MCPStreamEndRequest(BaseModel):
    mcp_token: str
    session_id: str


class MCPJoinDocumentRequest(BaseModel):
    mcp_token: str
    document_id: str
    agent_name: str = "MCP Agent"


class MCPCursorUpdateRequest(BaseModel):
    mcp_token: str
    document_id: str
    position: int
    line: Optional[int] = None
    column: Optional[int] = None


class MCPContentWriteRequest(BaseModel):
    mcp_token: str
    document_id: str
    content: str
    position: Optional[int] = None  # If None, append at end
    replace_all: bool = False  # If True, replace entire content


class MCPPresenceRequest(BaseModel):
    mcp_token: str
    document_id: str


# ===== Helper Functions =====

async def verify_mcp_token(mcp_token: str) -> Dict:
    """Verify MCP token and return config info"""
    token_hash = hashlib.sha256(mcp_token.encode()).hexdigest()
    
    query = """
        SELECT mc.id, mc.user_id, mc.workspace_id, mc.folder_id, mc.destination_path,
               mc.enabled, mc.is_active, u.username
        FROM mcp_configs mc
        JOIN users u ON mc.user_id = u.id
        WHERE mc.mcp_token_hash = %s AND mc.enabled = TRUE AND mc.is_active = TRUE
    """
    config = db.execute_query(query, (token_hash,))
    
    if not config:
        raise HTTPException(status_code=401, detail="Invalid MCP token or configuration disabled")
    
    return config[0]


async def verify_document_access(config: Dict, document_id: str) -> Dict:
    """Verify that the MCP config has access to the document"""
    # Get document info
    query = "SELECT id, workspace_id, parent_id, name, type, content FROM documents WHERE id = %s"
    doc = db.execute_query(query, (document_id,))
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc = doc[0]
    
    # Verify workspace matches
    if doc['workspace_id'] != config['workspace_id']:
        raise HTTPException(status_code=403, detail="Document not in authorized workspace")
    
    # If folder_id is set, verify document is within that folder hierarchy
    if config['folder_id']:
        # Check if document is in the allowed folder tree
        if not is_document_in_folder(document_id, config['folder_id']):
            raise HTTPException(status_code=403, detail="Document not in authorized folder")
    
    return doc


def is_document_in_folder(document_id: str, folder_id: str) -> bool:
    """Check if a document is within a folder hierarchy"""
    if document_id == folder_id:
        return True
    
    # Traverse up the tree
    current_id = document_id
    max_depth = 50  # Prevent infinite loops
    
    for _ in range(max_depth):
        query = "SELECT parent_id FROM documents WHERE id = %s"
        result = db.execute_query(query, (current_id,))
        
        if not result:
            return False
        
        parent_id = result[0]['parent_id']
        
        if parent_id == folder_id:
            return True
        
        if parent_id == 'root' or parent_id is None:
            return False
        
        current_id = parent_id
    
    return False


# ===== API Endpoints =====

@router.post("/stream/start")
async def mcp_stream_start(request: MCPStreamStartRequest):
    """
    Start a streaming session for an AI agent.
    The agent can then send chunks of text that will be displayed in real-time.
    """
    try:
        # Verify token
        config = await verify_mcp_token(request.mcp_token)
        
        # Verify document access
        doc = await verify_document_access(config, request.document_id)
        
        if doc['type'] != 'file':
            raise HTTPException(status_code=400, detail="Can only stream to files, not folders")
        
        # Start streaming session
        session_id = await start_streaming(
            document_id=request.document_id,
            user_id=str(config['user_id']),
            username=config['username'],
            agent_name=request.agent_name,
            start_position=request.position
        )
        
        return {
            "success": True,
            "session_id": session_id,
            "document_id": request.document_id,
            "message": "Streaming session started"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream/chunk")
async def mcp_stream_chunk(request: MCPStreamChunkRequest):
    """
    Send a chunk of text during a streaming session.
    This will be displayed in real-time to all users viewing the document.
    """
    try:
        # Verify token
        config = await verify_mcp_token(request.mcp_token)
        
        # Stream the chunk
        success = await stream_chunk(
            session_id=request.session_id,
            text=request.text,
            position=request.position
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Invalid or inactive streaming session")
        
        return {
            "success": True,
            "message": "Chunk streamed"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream/end")
async def mcp_stream_end(request: MCPStreamEndRequest):
    """
    End a streaming session and finalize the content.
    """
    try:
        # Verify token
        config = await verify_mcp_token(request.mcp_token)
        
        # End streaming
        success = await end_streaming(request.session_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Invalid streaming session")
        
        return {
            "success": True,
            "message": "Streaming session ended"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/presence/join")
async def mcp_join_document(request: MCPJoinDocumentRequest):
    """
    Join a document for collaborative presence.
    The agent will appear in the presence bar alongside human users.
    """
    try:
        # Verify token
        config = await verify_mcp_token(request.mcp_token)
        
        # Verify document access
        doc = await verify_document_access(config, request.document_id)
        
        # Generate a unique SID for this MCP session
        import uuid
        mcp_sid = f"mcp_{uuid.uuid4().hex[:8]}"
        
        # Join the document
        users = await join_document(
            sid=mcp_sid,
            document_id=request.document_id,
            user_info={
                'user_id': config['user_id'],
                'username': config['username'],
                'is_agent': True,
                'agent_name': request.agent_name
            }
        )
        
        return {
            "success": True,
            "mcp_sid": mcp_sid,
            "users": users,
            "message": "Joined document"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/presence/leave")
async def mcp_leave_document(request: Dict[str, Any]):
    """
    Leave a document's collaborative presence.
    """
    try:
        mcp_token = request.get('mcp_token')
        document_id = request.get('document_id')
        mcp_sid = request.get('mcp_sid')
        
        if not mcp_token or not document_id or not mcp_sid:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify token
        config = await verify_mcp_token(mcp_token)
        
        # Leave the document
        await leave_document(mcp_sid, document_id)
        
        return {
            "success": True,
            "message": "Left document"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/presence/cursor")
async def mcp_update_cursor(request: MCPCursorUpdateRequest):
    """
    Update the agent's cursor position.
    This will be displayed to other users in real-time.
    """
    try:
        # Verify token
        config = await verify_mcp_token(request.mcp_token)
        
        # Note: This requires the MCP client to maintain its SID
        # For simplicity, we broadcast directly
        from collaborative import sio
        if sio:
            await sio.emit('presence:cursor', {
                'document_id': request.document_id,
                'user_id': str(config['user_id']),
                'username': config['username'],
                'is_agent': True,
                'cursor_position': request.position,
                'cursor_line': request.line,
                'cursor_column': request.column
            }, room=f"doc_{request.document_id}")
        
        return {
            "success": True,
            "message": "Cursor position updated"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/presence/{document_id}")
async def mcp_get_presence(document_id: str, mcp_token: str):
    """
    Get the list of users currently viewing/editing a document.
    """
    try:
        # Verify token
        config = await verify_mcp_token(mcp_token)
        
        # Verify document access
        doc = await verify_document_access(config, document_id)
        
        # Get presence
        users = await get_document_presence(document_id)
        
        return {
            "success": True,
            "document_id": document_id,
            "users": users
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/write")
async def mcp_write_content(request: MCPContentWriteRequest):
    """
    Write content to a document (non-streaming).
    Use this for quick updates or when streaming is not needed.
    """
    try:
        # Verify token
        config = await verify_mcp_token(request.mcp_token)
        
        # Verify document access
        doc = await verify_document_access(config, request.document_id)
        
        if doc['type'] != 'file':
            raise HTTPException(status_code=400, detail="Can only write to files, not folders")
        
        # Get current content
        current_content = doc['content'] or ''
        
        # Determine new content
        if request.replace_all:
            new_content = request.content
        elif request.position is not None:
            # Insert at position
            new_content = current_content[:request.position] + request.content + current_content[request.position:]
        else:
            # Append at end
            new_content = current_content + request.content
        
        # Update document
        query = "UPDATE documents SET content = %s, updated_at = NOW() WHERE id = %s"
        db.execute_update(query, (new_content, request.document_id))
        
        # Broadcast content change
        await broadcast_content_change(
            document_id=request.document_id,
            user_id=str(config['user_id']),
            username=config['username'],
            change_type='replace' if request.replace_all else 'insert',
            position=request.position or len(current_content),
            text=request.content,
            is_agent=True
        )
        
        return {
            "success": True,
            "document_id": request.document_id,
            "content_length": len(new_content),
            "message": "Content written"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/document/{document_id}")
async def mcp_get_document(document_id: str, mcp_token: str):
    """
    Get document content and metadata.
    """
    try:
        # Verify token
        config = await verify_mcp_token(mcp_token)
        
        # Verify document access
        doc = await verify_document_access(config, document_id)
        
        return {
            "success": True,
            "document": {
                "id": doc['id'],
                "name": doc['name'],
                "type": doc['type'],
                "content": doc['content'],
                "workspace_id": doc['workspace_id'],
                "parent_id": doc['parent_id']
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tree")
async def mcp_get_tree(mcp_token: str, folder_id: Optional[str] = None):
    """
    Get the document tree for the authorized workspace/folder.
    """
    try:
        # Verify token
        config = await verify_mcp_token(mcp_token)
        
        workspace_id = config['workspace_id']
        root_folder = folder_id or config['folder_id'] or 'root'
        
        # Build tree
        def build_tree_recursive(parent_id: str, depth: int = 0) -> list:
            if depth > 20:
                return []
            
            query = """
                SELECT id, name, type, parent_id
                FROM documents
                WHERE parent_id = %s AND workspace_id = %s AND id != 'root'
                ORDER BY type DESC, name ASC
            """
            docs = db.execute_query(query, (parent_id, workspace_id))
            
            result = []
            for doc in docs:
                item = {
                    'id': doc['id'],
                    'name': doc['name'],
                    'type': doc['type'],
                    'parent_id': doc['parent_id']
                }
                if doc['type'] == 'folder':
                    item['children'] = build_tree_recursive(doc['id'], depth + 1)
                result.append(item)
            
            return result
        
        tree = build_tree_recursive(root_folder)
        
        return {
            "success": True,
            "workspace_id": workspace_id,
            "root_folder": root_folder,
            "tree": tree
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/document")
async def mcp_create_document(request: Dict[str, Any]):
    """
    Create a new document or folder.
    """
    try:
        mcp_token = request.get('mcp_token')
        name = request.get('name')
        doc_type = request.get('type', 'file')
        parent_id = request.get('parent_id', 'root')
        content = request.get('content', '')
        
        if not mcp_token or not name:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify token
        config = await verify_mcp_token(mcp_token)
        
        # Verify parent access if not root
        if parent_id != 'root':
            parent_doc = await verify_document_access(config, parent_id)
            if parent_doc['type'] != 'folder':
                raise HTTPException(status_code=400, detail="Parent must be a folder")
        elif config['folder_id']:
            # If config has a folder restriction, use that as parent
            parent_id = config['folder_id']
        
        # Create document
        import uuid
        doc_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO documents (id, name, type, parent_id, content, workspace_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            doc_id,
            name,
            doc_type,
            parent_id,
            content if doc_type == 'file' else None,
            config['workspace_id']
        ))
        
        # Broadcast tree update
        from websocket_broadcasts import broadcast_document_tree_update
        await broadcast_document_tree_update()
        
        return {
            "success": True,
            "document": {
                "id": doc_id,
                "name": name,
                "type": doc_type,
                "parent_id": parent_id,
                "workspace_id": config['workspace_id']
            },
            "message": "Document created"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/document/{document_id}")
async def mcp_delete_document(document_id: str, mcp_token: str):
    """
    Delete a document.
    """
    try:
        # Verify token
        config = await verify_mcp_token(mcp_token)
        
        # Verify document access
        doc = await verify_document_access(config, document_id)
        
        # Delete document
        query = "DELETE FROM documents WHERE id = %s"
        db.execute_update(query, (document_id,))
        
        # Broadcast tree update
        from websocket_broadcasts import broadcast_document_tree_update
        await broadcast_document_tree_update()
        
        return {
            "success": True,
            "message": "Document deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

