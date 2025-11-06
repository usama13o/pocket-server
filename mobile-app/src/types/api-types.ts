/**
 * Pocket Server - TypeScript Type Definitions for Mobile Clients
 * 
 * Copy these types into your React Native project for type-safe API access.
 * These types match the server's API exactly.
 * 
 * Source: https://github.com/yayasoumah/pocket-server
 * Version: 1.0
 */

// ============================================================================
// WebSocket Protocol Types
// ============================================================================

/**
 * Standard WebSocket message envelope used by all messages
 */
export interface WebSocketMessage<T = any> {
  v: number;              // Protocol version (currently 1)
  id: string;             // Message UUID
  correlationId?: string; // Optional request/response linking
  sessionId: string;      // Session or client ID
  ts: string;             // ISO 8601 timestamp
  type: string;           // Message type (term:*, agent:*, etc.)
  payload: T;             // Type-specific payload
  timestamp: number;      // Unix timestamp in milliseconds
}

/**
 * Connected event payload (server sends on successful WebSocket connection)
 */
export interface ConnectedPayload {
  clientId: string;
  publicBaseUrl: string | null;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface PairStatusResponse {
  active: boolean;
  mode: 'local' | 'remote';
  expiresAt: string | null;
  secondsLeft: number;
}

export interface DeviceStatusResponse {
  registered: boolean;
}

export interface PairRequest {
  deviceId: string;
  pin: string;
  platform?: 'ios' | 'android';
  name?: string;
  reset?: boolean;
  pairToken?: string;
}

export interface PairResponse {
  success: boolean;
  alreadyPaired?: boolean;
  data?: {
    deviceId: string;
    secret: string; // Store securely!
  };
  error?: string;
}

export interface ChallengeRequest {
  deviceId: string;
}

export interface ChallengeResponse {
  nonce: string; // Base64url-encoded
  expiresAt: string;
  error?: string;
}

export interface TokenRequest {
  deviceId: string;
  nonce: string;
  signature: string; // Hex-encoded SHA-256
}

export interface TokenResponse {
  token: string; // JWT
  expiresAt: string;
  error?: string;
}

// ============================================================================
// Server Health & Stats Types
// ============================================================================

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
}

export interface StatsResponse {
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
  connections: number;
  terminals: number;
}

export interface PublicBaseUrlResponse {
  url: string | null;
}

// ============================================================================
// Agent Session Types
// ============================================================================

export interface AgentSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  lastActivity: string;
  messageCount: number;
  workingDir: string;
  maxMode: boolean;
  phase?: string;
}

export interface CreateSessionRequest {
  id?: string;
  workingDir?: string;
  maxMode?: boolean;
  title?: string;
}

export interface CreateSessionResponse {
  id: string;
}

export interface AgentSessionDetail {
  id: string;
  title: string;
  createdAt: string;
  lastActivity: string;
  messageCount: number;
  workingDir: string;
  maxMode: boolean;
}

export interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  content?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface AgentSessionSnapshot {
  id: string;
  title: string;
  createdAt: string;
  lastActivity: string;
  messageCount: number;
  workingDir: string;
  maxMode: boolean;
  phase?: string;
  conversation: {
    messages: ConversationMessage[];
  };
  streamingState?: {
    currentMessage: any;
    contentBlocks: any[];
    activeBlockIndex: number | null;
    activeBlockContent: string;
    isStreaming: boolean;
    error: string | null;
  };
}

export interface UpdateTitleRequest {
  id: string;
  title: string;
}

// ============================================================================
// File System Types
// ============================================================================

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  lastModified?: string;
  permissions?: string;
}

export interface DirectoryListingResponse {
  path: string;
  entries: FileInfo[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  encoding: string;
  size: number;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  encoding?: string;
}

export interface WriteFileResponse {
  success: boolean;
  path: string;
  size: number;
}

export interface SearchResult {
  path: string;
  line: number;
  column: number;
  match: string;
  preview: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface TelescopeResult {
  path: string;
  score: number;
  highlight: string;
}

export interface TelescopeResponse {
  results: TelescopeResult[];
}

export interface FileMetadata extends FileInfo {
  isReadable?: boolean;
  isWritable?: boolean;
  isExecutable?: boolean;
}

export interface ExecuteCommandRequest {
  command: string;
  cwd?: string;
  timeout?: number;
}

export interface ExecuteCommandResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface HomeDirectoryResponse {
  path: string;
}

// ============================================================================
// Terminal Session Types
// ============================================================================

export interface TerminalSessionInfo {
  id: string;
  title?: string;
  cwd: string;
  createdAt: number;
  cols?: number;
  rows?: number;
  active: boolean;
  ownerClientId?: string;
  ownerDeviceId?: string;
  lastAttachedAt?: number;
}

export interface TerminalSessionsResponse {
  sessions: TerminalSessionInfo[];
}

// ============================================================================
// Terminal WebSocket Message Payloads
// ============================================================================

export interface TermOpenOrAttachPayload {
  id: string;
  cwd?: string;
  rows?: number;
  cols?: number;
  title?: string;
}

export interface TermOpenPayload {
  id: string;
  cwd?: string;
  rows?: number;
  cols?: number;
}

export interface TermAttachPayload {
  id: string;
}

export interface TermOpenedPayload {
  id: string;
  cols: number;
  rows: number;
}

export interface TermInputPayload {
  id: string;
  data: string;
  seq?: number;
}

export interface TermFramePayload {
  id: string;
  seq: number;
  ts: number;
  data: string;
}

export interface TermResizePayload {
  id: string;
  cols: number;
  rows: number;
  seq?: number;
}

export interface TermResizedPayload {
  id: string;
  cols: number;
  rows: number;
  seq?: number;
}

export interface TermTitlePayload {
  id: string;
  title: string;
}

export interface TermClosePayload {
  id: string;
}

export interface TermExitPayload {
  id: string;
  code: number;
}

// ============================================================================
// Agent WebSocket Message Payloads
// ============================================================================

export interface AgentMessagePayload {
  content: string;
  workingDir?: string;
  maxMode?: boolean;
}

export interface AgentStreamPayload {
  delta: string;
  messageId?: string;
  event?: string;
}

export interface AgentToolUsePayload {
  toolId: string;
  toolName: string;
  toolInput: Record<string, any>;
  requiresApproval: boolean;
}

export interface AgentToolResultPayload {
  toolId: string;
  toolName: string;
  success: boolean;
  output: string;
}

export interface AgentCompletePayload {
  messageId?: string;
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence';
}

export interface AgentErrorPayload {
  error: string;
  code?: string;
  retryable?: boolean;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface PushDevice {
  deviceId: string;
  expoPushToken: string;
  platform: 'ios' | 'android';
  subscriptions?: string[];
  lastSeen: string;
}

export interface RegisterPushRequest {
  deviceId: string;
  expoPushToken: string;
  platform: 'ios' | 'android';
  subscriptions?: string[];
}

export interface RegisterPushResponse {
  success: boolean;
  data?: PushDevice;
  error?: string;
}

export interface UnregisterPushRequest {
  deviceId: string;
}

export interface UnregisterPushResponse {
  success: boolean;
  data?: {
    removed: boolean;
  };
  error?: string;
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, any>;
}

// ============================================================================
// Message Type Discriminators
// ============================================================================

/**
 * All possible WebSocket message types
 */
export type MessageType =
  // Connection
  | 'connected'
  | 'ping'
  | 'pong'
  // Terminal
  | 'term:open_or_attach'
  | 'term:open'
  | 'term:attach'
  | 'term:opened'
  | 'term:input'
  | 'term:frame'
  | 'term:resize'
  | 'term:resized'
  | 'term:title'
  | 'term:close'
  | 'term:exit'
  // Agent
  | 'agent:message'
  | 'agent:stop'
  | 'agent:stream'
  | 'agent:tool_use'
  | 'agent:tool_result'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:title'
  | 'agent:status'
  | 'agent:turn'
  | 'agent:tool_output'
  | 'agent:stream_complete'
  // File system (if added)
  | 'fs:list'
  | 'fs:read'
  | 'fs:write'
  // Echo (unknown messages)
  | 'echo';

/**
 * Typed WebSocket messages (discriminated union)
 */
export type TypedWebSocketMessage =
  | WebSocketMessage<ConnectedPayload> & { type: 'connected' }
  | WebSocketMessage<null> & { type: 'ping' }
  | WebSocketMessage<null> & { type: 'pong' }
  | WebSocketMessage<TermOpenOrAttachPayload> & { type: 'term:open_or_attach' }
  | WebSocketMessage<TermOpenPayload> & { type: 'term:open' }
  | WebSocketMessage<TermAttachPayload> & { type: 'term:attach' }
  | WebSocketMessage<TermOpenedPayload> & { type: 'term:opened' }
  | WebSocketMessage<TermInputPayload> & { type: 'term:input' }
  | WebSocketMessage<TermFramePayload> & { type: 'term:frame' }
  | WebSocketMessage<TermResizePayload> & { type: 'term:resize' }
  | WebSocketMessage<TermResizedPayload> & { type: 'term:resized' }
  | WebSocketMessage<TermTitlePayload> & { type: 'term:title' }
  | WebSocketMessage<TermClosePayload> & { type: 'term:close' }
  | WebSocketMessage<TermExitPayload> & { type: 'term:exit' }
  | WebSocketMessage<AgentMessagePayload> & { type: 'agent:message' }
  | WebSocketMessage<null> & { type: 'agent:stop' }
  | WebSocketMessage<AgentStreamPayload> & { type: 'agent:stream' }
  | WebSocketMessage<AgentToolUsePayload> & { type: 'agent:tool_use' }
  | WebSocketMessage<AgentToolResultPayload> & { type: 'agent:tool_result' }
  | WebSocketMessage<AgentCompletePayload> & { type: 'agent:complete' }
  | WebSocketMessage<AgentErrorPayload> & { type: 'agent:error' };

// ============================================================================
// Utility Types
// ============================================================================

/**
 * API Result type for operations that can fail
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

/**
 * Common request options
 */
export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}
