"""
MCP (Model Context Protocol) Server for AI Agents
Allows AI agents to document their actions automatically
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
from database import db
import json
from datetime import datetime

# MCP Server
mcp_app = FastAPI(title="MarkD MCP Server for AI Agents")

# ===== Pydantic Models =====

class MCPDocumentRequest(BaseModel):
    agent_id: str
    agent_name: str
    title: str
    content: str
    parent_folder: Optional[str] = 'root'
    tags: Optional[List[str]] = []

class MCPAppendRequest(BaseModel):
    agent_id: str
    document_id: str
    content: str

class MCPSearchRequest(BaseModel):
    query: str
    document_type: Optional[str] = None

# ===== Helper Functions =====

def log_mcp_action(agent_id: str, action: str, document_id: Optional[str] = None, details: Optional[Dict] = None):
    """Log MCP agent activity"""
    query = """
        INSERT INTO mcp_activity_log (agent_id, action, document_id, details)
        VALUES (%s, %s, %s, %s)
    """
    db.execute_update(query, (
        agent_id,
        action,
        document_id,
        json.dumps(details) if details else None
    ))

# ===== MCP API Endpoints =====

@mcp_app.get("/")
async def mcp_root():
    return {
        "server": "MarkD MCP Server",
        "version": "1.0.0",
        "description": "Model Context Protocol server for AI agent documentation",
        "endpoints": {
            "create_document": "POST /mcp/documents - Create new document",
            "append_content": "POST /mcp/documents/{id}/append - Append to document",
            "search": "POST /mcp/search - Search documents",
            "activity": "GET /mcp/activity - Get agent activity log"
        }
    }

@mcp_app.post("/mcp/documents")
async def mcp_create_document(request: MCPDocumentRequest):
    """
    Create a new document via MCP
    AI agents use this to document their work
    """
    try:
        import uuid
        
        # Generate document ID
        doc_id = f"mcp-{uuid.uuid4()}"
        
        # Add MCP metadata to content
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        full_content = f"""# {request.title}

**Created by AI Agent**: {request.agent_name} (ID: {request.agent_id})  
**Created at**: {timestamp}  
**Tags**: {', '.join(request.tags) if request.tags else 'None'}

---

{request.content}
"""
        
        # Insert document
        query = """
            INSERT INTO documents (id, name, type, parent_id, content)
            VALUES (%s, %s, %s, %s, %s)
        """
        db.execute_update(query, (
            doc_id,
            f"{request.title}.md",
            'file',
            request.parent_folder,
            full_content
        ))
        
        # Log activity
        log_mcp_action(
            request.agent_id,
            'create_document',
            doc_id,
            {
                'agent_name': request.agent_name,
                'title': request.title,
                'tags': request.tags
            }
        )
        
        return {
            "success": True,
            "document_id": doc_id,
            "message": f"Document '{request.title}' created successfully",
            "agent_id": request.agent_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@mcp_app.post("/mcp/documents/{document_id}/append")
async def mcp_append_content(document_id: str, request: MCPAppendRequest):
    """
    Append content to existing document
    Useful for agents documenting ongoing work
    """
    try:
        # Get current document
        query = "SELECT content FROM documents WHERE id = %s AND type = 'file'"
        docs = db.execute_query(query, (document_id,))
        
        if not docs:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Append new content with timestamp
        current_content = docs[0]['content'] or ''
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        appended_content = f"""

---

**Updated by AI Agent**: {request.agent_id} at {timestamp}

{request.content}
"""
        
        new_content = current_content + appended_content
        
        # Update document
        update_query = "UPDATE documents SET content = %s WHERE id = %s"
        db.execute_update(update_query, (new_content, document_id))
        
        # Log activity
        log_mcp_action(
            request.agent_id,
            'append_content',
            document_id,
            {'appended_length': len(request.content)}
        )
        
        return {
            "success": True,
            "message": "Content appended successfully",
            "document_id": document_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@mcp_app.post("/mcp/search")
async def mcp_search_documents(request: MCPSearchRequest):
    """
    Search documents by content
    Agents can use this to find existing documentation
    """
    try:
        query = """
            SELECT id, name, type, parent_id, 
                   LEFT(content, 200) as content_preview,
                   created_at, updated_at
            FROM documents
            WHERE type = 'file'
            AND (name LIKE %s OR content LIKE %s)
        """
        
        search_pattern = f"%{request.query}%"
        results = db.execute_query(query, (search_pattern, search_pattern))
        
        return {
            "success": True,
            "query": request.query,
            "count": len(results),
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@mcp_app.get("/mcp/activity")
async def mcp_get_activity(agent_id: Optional[str] = None, limit: int = 50):
    """
    Get MCP activity log
    Filter by agent_id if provided
    """
    try:
        if agent_id:
            query = """
                SELECT * FROM mcp_activity_log
                WHERE agent_id = %s
                ORDER BY created_at DESC
                LIMIT %s
            """
            activities = db.execute_query(query, (agent_id, limit))
        else:
            query = """
                SELECT * FROM mcp_activity_log
                ORDER BY created_at DESC
                LIMIT %s
            """
            activities = db.execute_query(query, (limit,))
        
        return {
            "success": True,
            "count": len(activities),
            "activities": activities
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@mcp_app.get("/mcp/folders")
async def mcp_get_folders():
    """
    Get all folders for document organization
    Agents can query this to know where to place documents
    """
    try:
        query = """
            SELECT id, name, parent_id
            FROM documents
            WHERE type = 'folder'
            ORDER BY name
        """
        folders = db.execute_query(query)
        
        return {
            "success": True,
            "count": len(folders),
            "folders": folders
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@mcp_app.post("/mcp/folders")
async def mcp_create_folder(agent_id: str, name: str, parent_id: str = 'root'):
    """
    Create a new folder via MCP
    Agents can organize documentation into folders
    """
    try:
        import uuid
        
        folder_id = f"mcp-folder-{uuid.uuid4()}"
        
        query = """
            INSERT INTO documents (id, name, type, parent_id)
            VALUES (%s, %s, 'folder', %s)
        """
        db.execute_update(query, (folder_id, name, parent_id))
        
        # Log activity
        log_mcp_action(
            agent_id,
            'create_folder',
            folder_id,
            {'name': name, 'parent_id': parent_id}
        )
        
        return {
            "success": True,
            "folder_id": folder_id,
            "message": f"Folder '{name}' created successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Run MCP Server =====

if __name__ == "__main__":
    uvicorn.run(
        mcp_app,
        host="127.0.0.1",
        port=4568,  # Different port from main API
        log_level="info"
    )