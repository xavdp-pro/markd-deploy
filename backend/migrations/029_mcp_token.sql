-- Migration 029: Replace MCP username/password with single token
-- Remove mcp_username and mcp_password_hash, add mcp_token_hash

-- Remove old columns
ALTER TABLE mcp_configs 
    DROP COLUMN IF EXISTS mcp_username,
    DROP COLUMN IF EXISTS mcp_password_hash;

-- Add new token column
ALTER TABLE mcp_configs 
    ADD COLUMN mcp_token_hash VARCHAR(128) UNIQUE AFTER api_secret;

-- Add index for token lookup
CREATE INDEX idx_mcp_token_hash ON mcp_configs(mcp_token_hash);

