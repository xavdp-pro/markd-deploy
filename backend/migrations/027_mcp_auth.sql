-- Migration 027: MCP Authentication
-- Add auto-generated API credentials for MCP access
-- Make source_path optional (can be set later)

-- Add API key column for MCP authentication
ALTER TABLE mcp_configs 
    ADD COLUMN api_key VARCHAR(64) UNIQUE AFTER destination_path,
    ADD COLUMN api_secret VARCHAR(128) AFTER api_key,
    MODIFY COLUMN source_path VARCHAR(500) DEFAULT NULL;

-- Add index for API key lookup
CREATE INDEX idx_mcp_api_key ON mcp_configs(api_key);


