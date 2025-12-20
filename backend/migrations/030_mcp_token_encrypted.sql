-- Migration 030: Add encrypted mcp_token column to store token in plain text (encrypted)
-- This allows the API to retrieve the token for MCP Document authentication

ALTER TABLE mcp_configs 
    ADD COLUMN mcp_token TEXT NULL AFTER mcp_token_hash;

-- Add index for token lookup (optional, but useful if we need to search by token)
-- Note: We can't index encrypted TEXT directly, so this is just for reference


