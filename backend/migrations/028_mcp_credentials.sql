-- Migration 028: MCP User Credentials and Folder Link
-- Add MCP-specific username/password for authentication
-- Add folder_id to link config to a specific folder
-- Add is_active to enable/disable MCP configs

-- Add MCP user credentials
ALTER TABLE mcp_configs 
    ADD COLUMN folder_id VARCHAR(36) DEFAULT NULL AFTER destination_path,
    ADD COLUMN mcp_username VARCHAR(64) UNIQUE AFTER folder_id,
    ADD COLUMN mcp_password_hash VARCHAR(128) AFTER mcp_username,
    ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER mcp_password_hash;

-- Add index for folder_id lookup
CREATE INDEX idx_mcp_folder_id ON mcp_configs(folder_id);

-- Add index for mcp_username lookup
CREATE INDEX idx_mcp_username ON mcp_configs(mcp_username);

