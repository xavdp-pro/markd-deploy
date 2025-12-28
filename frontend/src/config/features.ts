/**
 * Feature flags for MarkD application
 * Toggle features without code changes
 */

// Use Yjs collaborative editing instead of lock-based editing
// Set to true to enable real-time collaborative editing
// Set to false to use the traditional lock-based system
export const USE_COLLABORATIVE_EDITING = true;

// Yjs server URL
export const YJS_SERVER_URL = 'wss://markd-v2.c9.ooo.ovh/yjs';

// Debug mode for collaborative features  
export const COLLABORATIVE_DEBUG = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;
