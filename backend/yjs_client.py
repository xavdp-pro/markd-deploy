"""
MarkD Yjs Client for MCP Agents

This module provides a Python client for Yjs collaborative editing,
allowing MCP agents to participate in real-time document editing
alongside human users.

Usage:
    from yjs_client import YjsClient
    
    async with YjsClient(document_id="doc-123", agent_name="Documentation Agent") as client:
        # Read current content
        content = client.get_content()
        
        # Append text
        client.append_text("\n## New Section\nContent here...")
        
        # Insert at position
        client.insert_text(0, "# Title\n")
        
        # Replace all content
        client.set_content("New full content")
"""

import asyncio
import json
import struct
from typing import Optional, Callable, Dict, Any
import websockets
from dataclasses import dataclass
from enum import IntEnum
import hashlib


# Yjs message types
class MessageType(IntEnum):
    SYNC_STEP1 = 0
    SYNC_STEP2 = 1
    SYNC_UPDATE = 2
    AWARENESS = 1


@dataclass
class YjsDocument:
    """Simplified Y.Doc representation for Python"""
    content: str = ""
    
    def get_text(self) -> str:
        return self.content
    
    def set_text(self, text: str):
        self.content = text
    
    def insert(self, index: int, text: str):
        self.content = self.content[:index] + text + self.content[index:]
    
    def delete(self, index: int, length: int):
        self.content = self.content[:index] + self.content[index + length:]
    
    def append(self, text: str):
        self.content += text


class YjsClient:
    """
    Python client for Yjs WebSocket server.
    
    Allows MCP agents to collaborate on documents in real-time
    with human users.
    """
    
    def __init__(
        self,
        document_id: str,
        agent_id: Optional[str] = None,
        agent_name: str = "MCP Agent",
        color: str = "#9333ea",  # Purple for agents
        server_url: str = "ws://localhost:1234",
        on_content_change: Optional[Callable[[str], None]] = None,
        on_users_change: Optional[Callable[[list], None]] = None,
    ):
        self.document_id = document_id
        self.agent_id = agent_id or f"mcp-{hashlib.md5(agent_name.encode()).hexdigest()[:8]}"
        self.agent_name = agent_name
        self.color = color
        self.server_url = server_url
        self.on_content_change = on_content_change
        self.on_users_change = on_users_change
        
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.doc = YjsDocument()
        self.connected = False
        self.synced = False
        self.users: Dict[str, Dict[str, Any]] = {}
        
        self._receive_task: Optional[asyncio.Task] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
    
    @property
    def room_name(self) -> str:
        return f"doc-{self.document_id}"
    
    @property
    def ws_url(self) -> str:
        return f"{self.server_url}?room={self.room_name}"
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()
    
    async def connect(self):
        """Connect to the Yjs WebSocket server"""
        print(f"[YjsClient] Connecting to {self.ws_url}...")
        
        try:
            self.ws = await websockets.connect(self.ws_url)
            self.connected = True
            print(f"[YjsClient] Connected!")
            
            # Send initial sync request
            await self._send_sync_step1()
            
            # Send awareness (user presence)
            await self._send_awareness()
            
            # Start receive loop
            self._receive_task = asyncio.create_task(self._receive_loop())
            
            # Start heartbeat for awareness
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            
            # Wait a bit for initial sync
            await asyncio.sleep(0.5)
            
        except Exception as e:
            print(f"[YjsClient] Connection error: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from the server"""
        print(f"[YjsClient] Disconnecting...")
        
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        if self.ws:
            await self.ws.close()
            self.ws = None
        
        self.connected = False
        print(f"[YjsClient] Disconnected")
    
    async def _send_sync_step1(self):
        """Send sync step 1 (request for current document state)"""
        # This is a simplified version - real Yjs uses binary protocol
        pass
    
    async def _send_awareness(self):
        """Send awareness state (user presence)"""
        awareness_state = {
            "user": {
                "id": self.agent_id,
                "name": self.agent_name,
                "color": self.color,
                "isAgent": True,
                "agentName": self.agent_name,
            }
        }
        
        # Note: Real Yjs awareness uses binary encoding
        # This is a simplified JSON version for demonstration
        message = json.dumps({
            "type": "awareness",
            "state": awareness_state
        })
        
        if self.ws:
            await self.ws.send(message)
    
    async def _heartbeat_loop(self):
        """Send periodic awareness updates"""
        while self.connected:
            try:
                await asyncio.sleep(15)  # Every 15 seconds
                if self.connected:
                    await self._send_awareness()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[YjsClient] Heartbeat error: {e}")
    
    async def _receive_loop(self):
        """Receive and process messages from the server"""
        while self.connected and self.ws:
            try:
                message = await self.ws.recv()
                await self._handle_message(message)
            except asyncio.CancelledError:
                break
            except websockets.exceptions.ConnectionClosed:
                print("[YjsClient] Connection closed")
                self.connected = False
                break
            except Exception as e:
                print(f"[YjsClient] Receive error: {e}")
    
    async def _handle_message(self, message: bytes | str):
        """Handle incoming message from server"""
        # Note: Real Yjs uses binary protocol
        # This is simplified for demonstration
        try:
            if isinstance(message, str):
                data = json.loads(message)
                
                if data.get("type") == "sync":
                    # Received document content
                    self.doc.set_text(data.get("content", ""))
                    self.synced = True
                    if self.on_content_change:
                        self.on_content_change(self.doc.get_text())
                
                elif data.get("type") == "update":
                    # Received content update
                    self.doc.set_text(data.get("content", ""))
                    if self.on_content_change:
                        self.on_content_change(self.doc.get_text())
                
                elif data.get("type") == "awareness":
                    # Received user presence update
                    self.users = data.get("users", {})
                    if self.on_users_change:
                        self.on_users_change(list(self.users.values()))
        except Exception as e:
            print(f"[YjsClient] Error handling message: {e}")
    
    def get_content(self) -> str:
        """Get current document content"""
        return self.doc.get_text()
    
    async def set_content(self, content: str):
        """Replace all document content"""
        self.doc.set_text(content)
        await self._send_update()
    
    async def insert_text(self, index: int, text: str):
        """Insert text at a specific position"""
        self.doc.insert(index, text)
        await self._send_update()
    
    async def delete_text(self, index: int, length: int):
        """Delete text at a specific position"""
        self.doc.delete(index, length)
        await self._send_update()
    
    async def append_text(self, text: str):
        """Append text to the end of the document"""
        self.doc.append(text)
        await self._send_update()
    
    async def _send_update(self):
        """Send document update to server"""
        if not self.ws or not self.connected:
            raise RuntimeError("Not connected to server")
        
        message = json.dumps({
            "type": "update",
            "content": self.doc.get_text()
        })
        
        await self.ws.send(message)
    
    async def update_cursor(self, line: int, column: int):
        """Update cursor position (visible to other users)"""
        if not self.ws or not self.connected:
            return
        
        awareness_state = {
            "user": {
                "id": self.agent_id,
                "name": self.agent_name,
                "color": self.color,
                "isAgent": True,
                "agentName": self.agent_name,
            },
            "cursor": {
                "line": line,
                "column": column,
            }
        }
        
        message = json.dumps({
            "type": "awareness",
            "state": awareness_state
        })
        
        await self.ws.send(message)


# Convenience function for simple use cases
async def edit_document(
    document_id: str,
    operation: str,  # "read", "append", "insert", "replace"
    content: str = "",
    position: int = 0,
    agent_name: str = "MCP Agent",
    server_url: str = "ws://localhost:1234",
) -> str:
    """
    Simple function to edit a document.
    
    Args:
        document_id: The document ID to edit
        operation: One of "read", "append", "insert", "replace"
        content: The content for append/insert/replace operations
        position: The position for insert operation
        agent_name: Name displayed to other users
        server_url: Yjs WebSocket server URL
    
    Returns:
        The current document content after the operation
    """
    async with YjsClient(
        document_id=document_id,
        agent_name=agent_name,
        server_url=server_url,
    ) as client:
        if operation == "read":
            pass  # Just read
        elif operation == "append":
            await client.append_text(content)
        elif operation == "insert":
            await client.insert_text(position, content)
        elif operation == "replace":
            await client.set_content(content)
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        return client.get_content()


# Example usage
if __name__ == "__main__":
    async def main():
        # Example: Connect and edit a document
        async with YjsClient(
            document_id="test-doc",
            agent_name="Documentation Bot",
        ) as client:
            print(f"Current content: {client.get_content()}")
            
            # Append some content
            await client.append_text("\n\n## Added by MCP Agent\nThis section was added automatically.")
            
            print(f"Updated content: {client.get_content()}")
            
            # Keep connection open for a bit to show presence
            await asyncio.sleep(5)
    
    asyncio.run(main())
