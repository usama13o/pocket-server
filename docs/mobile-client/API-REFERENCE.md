# Pocket Server - Mobile Client API Reference

Version: 1.0  
Last Updated: 2025-11-02  
Server Repository: https://github.com/yayasoumah/pocket-server

This document provides the complete API reference for building mobile clients that connect to pocket-server.

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [REST API Endpoints](#rest-api-endpoints)
3. [WebSocket Protocol](#websocket-protocol)
4. [Message Types](#message-types)
5. [Error Handling](#error-handling)

---

## Authentication Flow

### Overview

Pocket Server uses a secure multi-step authentication flow:

1. **Pairing**: Device pairs with server using a time-limited PIN (local or remote)
2. **Challenge/Response**: Device proves ownership of the secret via signature
3. **Token Exchange**: Short-lived access tokens (15 minutes) for API calls

### Step 1: Check Pairing Status

Check if the pairing window is currently active.

**Endpoint**: `GET /auth/pair/status`

**Auth Required**: No

**Response**:
```json
{
  "active": true,
  "mode": "local" | "remote",
  "expiresAt": "2025-11-02T13:52:59.158Z",
  "secondsLeft": 45
}
```

**Fields**:
- `active` (boolean): Whether pairing window is currently open
- `mode` (string): "local" for LAN-only, "remote" for internet pairing
- `expiresAt` (string, nullable): ISO timestamp when window closes
- `secondsLeft` (number): Countdown in seconds

### Step 2: Check Device Status

Check if a device is already registered with the server.

**Endpoint**: `GET /auth/device/status?deviceId={deviceId}`

**Auth Required**: No

**Query Parameters**:
- `deviceId` (string, required): Unique device identifier (UUID recommended)

**Response**:
```json
{
  "registered": true | false
}
```

### Step 3: Pair Device

Pair a new device or reset an existing device's secret.

**Endpoint**: `POST /auth/pair`

**Auth Required**: No (but pairing window must be active)

**Request Body**:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "pin": "123456",
  "platform": "ios",
  "name": "John's iPhone",
  "reset": false,
  "pairToken": "optional-for-remote-pairing"
}
```

**Fields**:
- `deviceId` (string, required): Unique device identifier (UUID)
- `pin` (string, required): 6-digit PIN displayed in terminal
- `platform` (string, optional): "ios" or "android"
- `name` (string, optional): Human-readable device name
- `reset` (boolean, optional): If true, rotate secret for existing device
- `pairToken` (string, optional): Required when mode is "remote"

**Response (Success - New Pairing)**:
```json
{
  "success": true,
  "alreadyPaired": false,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "secret": "a1b2c3d4e5f6...64-character-hex-string"
  }
}
```

**Response (Already Paired)**:
```json
{
  "success": true,
  "alreadyPaired": true
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": "pairing_not_active" | "invalid_pin" | "pairing_denied" | "pairing_not_local" | "invalid_input"
}
```

**Error Codes**:
- `pairing_not_active`: Pairing window is closed (start with `pocket-server pair`)
- `invalid_pin`: PIN doesn't match the one displayed in terminal
- `pairing_denied`: Invalid remote pair token or too many failed attempts
- `pairing_not_local`: Remote pairing attempted without remote mode enabled
- `invalid_input`: Missing deviceId or pin

**⚠️ Security**: Store the `secret` in platform secure storage immediately:
- iOS: Keychain (`expo-secure-store` or `react-native-keychain`)
- Android: EncryptedSharedPreferences or Android Keystore
- **Never** store in AsyncStorage or any unencrypted storage

### Step 4: Request Challenge

Request a nonce for signature-based token authentication.

**Endpoint**: `POST /auth/challenge`

**Auth Required**: No

**Request Body**:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Success)**:
```json
{
  "nonce": "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhc",
  "expiresAt": "2025-11-02T13:53:59.158Z"
}
```

**Fields**:
- `nonce` (string): Base64url-encoded random nonce (24 bytes)
- `expiresAt` (string): ISO timestamp (1 minute from now)

**Response (Error)**:
```json
{
  "error": "invalid_input" | "device_unregistered"
}
```

### Step 5: Exchange for Access Token

Exchange the signed challenge for a short-lived access token.

**Endpoint**: `POST /auth/token`

**Auth Required**: No

**Request Body**:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "nonce": "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhc",
  "signature": "a3f2c1b0...hex-encoded-sha256"
}
```

**Signature Calculation**:
```typescript
import crypto from 'crypto'; // or use WebCrypto / platform crypto

// Construct message
const message = `${secret}\n${deviceId}\n${nonce}`;

// Calculate SHA-256 hash
const signature = crypto
  .createHash('sha256')
  .update(message)
  .digest('hex');
```

**React Native Example**:
```typescript
import { sha256 } from 'react-native-sha256';

const message = `${secret}\n${deviceId}\n${nonce}`;
const signature = await sha256(message);
```

**Response (Success)**:
```json
{
  "token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-11-02T14:07:59.158Z"
}
```

**Token Lifetime**: 15 minutes

**Response (Error)**:
```json
{
  "error": "invalid_input" | "device_unregistered" | "invalid_signature"
}
```

**Error Codes**:
- `invalid_input`: Missing required fields
- `device_unregistered`: Device not paired (call POST /auth/pair first)
- `invalid_signature`: Signature verification failed (check secret and hash algo)

### Token Usage

Include the access token in all authenticated requests:

**HTTP Headers**:
```
Authorization: Pocket <token>
```

**Example**:
```typescript
const headers = {
  'Authorization': `Pocket ${token}`,
  'Content-Type': 'application/json'
};

const response = await fetch('https://server:3000/agent/sessions', {
  headers
});
```

**WebSocket Connection**:
```
wss://server-host:3000/ws?token=<token>
```

**Example**:
```typescript
const ws = new WebSocket(`wss://${serverHost}/ws?token=${encodeURIComponent(token)}`);
```

**Token Refresh Strategy**:

Tokens expire after 15 minutes. Refresh proactively:

```typescript
// Check expiry and refresh if within 1 minute of expiration
const expiresAt = new Date(tokenExpiresAt);
const now = new Date();
const timeLeft = expiresAt.getTime() - now.getTime();

if (timeLeft < 60000) { // Less than 1 minute left
  await refreshToken(); // Repeat steps 4-5
}
```

---

## REST API Endpoints

All authenticated endpoints require `Authorization: Pocket <token>` header.

### Health & Stats

#### GET /health

Check server health status (no auth required).

**Auth Required**: No

**Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-11-02T13:52:59.158Z",
  "uptime": 3600.5
}
```

**Fields**:
- `status` (string): "healthy" if server is running
- `version` (string): Server version number
- `timestamp` (string): Current server time (ISO)
- `uptime` (number): Server uptime in seconds

#### GET /stats

Get server statistics.

**Auth Required**: Yes

**Response**:
```json
{
  "uptime": 3600.5,
  "memory": {
    "used": 123456789,
    "total": 234567890
  },
  "connections": 3,
  "terminals": 5
}
```

**Fields**:
- `uptime` (number): Server uptime in seconds
- `memory.used` (number): Heap memory used in bytes
- `memory.total` (number): Total heap memory in bytes
- `connections` (number): Active WebSocket connections
- `terminals` (number): Active terminal sessions

#### GET /cloud/public-base-url

Get the public base URL if server is running with remote access (no auth required).

**Auth Required**: No

**Response**:
```json
{
  "url": "https://tunnel-subdomain.trycloudflare.com"
}
```

or

```json
{
  "url": null
}
```

**Usage**: Display this URL to users or use for QR code generation.

### Agent Session Management

#### GET /agent/sessions

List all agent sessions for the current user.

**Auth Required**: Yes

**Response**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Fix authentication bug",
    "createdAt": "2025-11-02T13:00:00.000Z",
    "lastActivity": "2025-11-02T13:52:59.158Z",
    "messageCount": 15,
    "workingDir": "/home/user/project",
    "maxMode": false,
    "phase": "active"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Implement new feature",
    "createdAt": "2025-11-01T10:00:00.000Z",
    "lastActivity": "2025-11-01T11:30:00.000Z",
    "messageCount": 8,
    "workingDir": "/home/user/other-project",
    "maxMode": true,
    "phase": "completed"
  }
]
```

**Fields**:
- `id` (string): Session UUID
- `title` (string): Session title (auto-generated or user-set)
- `createdAt` (string): ISO timestamp
- `lastActivity` (string): ISO timestamp of last message
- `messageCount` (number): Number of messages in conversation
- `workingDir` (string): File system working directory
- `maxMode` (boolean): Whether auto-approval is enabled for tools
- `phase` (string): "created", "active", "completed", etc.

#### POST /agent/session

Create a new agent session.

**Auth Required**: Yes

**Request Body**:
```json
{
  "id": "optional-custom-uuid",
  "workingDir": "/home/user/project",
  "maxMode": false,
  "title": "Optional initial title"
}
```

**Fields** (all optional):
- `id` (string): Custom session ID (defaults to generated UUID)
- `workingDir` (string): Working directory for agent tools (defaults to server CWD)
- `maxMode` (boolean): Enable auto-approval for tools (default: false)
- `title` (string): Initial session title (default: "New Chat")

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### GET /agent/session?id={sessionId}

Get details of a specific session.

**Auth Required**: Yes

**Query Parameters**:
- `id` (string, required): Session UUID

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Fix authentication bug",
  "createdAt": "2025-11-02T13:00:00.000Z",
  "lastActivity": "2025-11-02T13:52:59.158Z",
  "messageCount": 15,
  "workingDir": "/home/user/project",
  "maxMode": false
}
```

#### DELETE /agent/session?id={sessionId}

Delete a session and all its data.

**Auth Required**: Yes

**Query Parameters**:
- `id` (string, required): Session UUID

**Response**:
```json
{
  "success": true
}
```

#### GET /agent/session/snapshot?id={sessionId}

Get the complete session snapshot including conversation history.

**Auth Required**: Yes

**Query Parameters**:
- `id` (string, required): Session UUID

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Fix authentication bug",
  "createdAt": "2025-11-02T13:00:00.000Z",
  "lastActivity": "2025-11-02T13:52:59.158Z",
  "messageCount": 15,
  "workingDir": "/home/user/project",
  "maxMode": false,
  "phase": "active",
  "conversation": {
    "messages": [
      {
        "role": "user",
        "content": "Fix the login bug"
      },
      {
        "role": "assistant",
        "content": [
          { "type": "text", "text": "I'll help fix the login bug..." },
          {
            "type": "tool_use",
            "id": "tool_uuid",
            "name": "bash",
            "input": { "command": "cat src/auth/login.ts" }
          }
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "type": "tool_result",
            "tool_use_id": "tool_uuid",
            "content": "file contents..."
          }
        ]
      }
    ]
  }
}
```

#### PUT /agent/session/title

Update session title.

**Auth Required**: Yes

**Request Body**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "New title"
}
```

**Response**:
```json
{
  "success": true
}
```

#### GET /agent/session/asset

Get an asset (image) from a session.

**Auth Required**: Yes (via query parameter)

**Query Parameters**:
- `id` (string, required): Session ID
- `file` (string, required): Asset filename (basename only, no path)
- `token` (string, required): Access token (for image components that can't set headers)

**Response**: Binary image data with appropriate `Content-Type` (image/png, image/jpeg, etc.)

**Example URL**:
```
https://server:3000/agent/session/asset?id=550e8400&file=screenshot.png&token=eyJ...
```

### File System Operations

All file system operations are scoped to the server's `HOME_DIR` for security.

#### GET /fs/home

Get the user's home directory path.

**Auth Required**: Yes

**Response**:
```json
{
  "path": "/home/username"
}
```

#### GET /fs/list?path={path}

List directory contents.

**Auth Required**: Yes

**Query Parameters**:
- `path` (string, required): Directory path to list

**Response**:
```json
{
  "path": "/home/username/project",
  "entries": [
    {
      "name": "README.md",
      "path": "/home/username/project/README.md",
      "type": "file",
      "size": 1234,
      "lastModified": "2025-11-02T13:00:00.000Z",
      "permissions": "rw-r--r--"
    },
    {
      "name": "src",
      "path": "/home/username/project/src",
      "type": "directory",
      "lastModified": "2025-11-02T12:00:00.000Z",
      "permissions": "rwxr-xr-x"
    },
    {
      "name": "node_modules",
      "path": "/home/username/project/node_modules",
      "type": "symlink",
      "lastModified": "2025-11-01T10:00:00.000Z"
    }
  ]
}
```

**Entry Fields**:
- `name` (string): File/directory name
- `path` (string): Full absolute path
- `type` (string): "file", "directory", or "symlink"
- `size` (number, optional): File size in bytes (files only)
- `lastModified` (string): ISO timestamp
- `permissions` (string): Unix permissions string

#### GET /fs/read?path={path}

Read file contents.

**Auth Required**: Yes

**Query Parameters**:
- `path` (string, required): File path to read

**Response**:
```json
{
  "path": "/home/username/project/README.md",
  "content": "# My Project\n\nThis is my project...",
  "encoding": "utf8",
  "size": 1234
}
```

**Error** (file too large, binary, etc.):
```json
{
  "error": "File is binary or too large"
}
```

#### POST /fs/write

Write file contents (creates or overwrites).

**Auth Required**: Yes

**Request Body**:
```json
{
  "path": "/home/username/project/newfile.txt",
  "content": "Hello, World!",
  "encoding": "utf8"
}
```

**Fields**:
- `path` (string, required): File path to write
- `content` (string, required): File contents
- `encoding` (string, optional): Default "utf8"

**Response**:
```json
{
  "success": true,
  "path": "/home/username/project/newfile.txt",
  "size": 13
}
```

#### DELETE /fs/delete?path={path}&recursive={boolean}

Delete a file or directory.

**Auth Required**: Yes

**Query Parameters**:
- `path` (string, required): Path to delete
- `recursive` (boolean, optional): Delete directories recursively (default: false)

**Response**:
```json
{
  "success": true
}
```

**Error** (directory not empty and recursive=false):
```json
{
  "error": "Directory not empty"
}
```

#### GET /fs/search?query={query}&path={path}&limit={n}

Search for files by name pattern.

**Auth Required**: Yes

**Query Parameters**:
- `query` (string, required): Search pattern (glob or regex)
- `path` (string, optional): Root directory to search (default: current working dir)
- `limit` (number, optional): Max results (default: 100)

**Response**:
```json
{
  "results": [
    {
      "path": "/home/username/project/src/auth.ts",
      "line": 0,
      "column": 0,
      "match": "auth.ts",
      "preview": ""
    },
    {
      "path": "/home/username/project/tests/auth.test.ts",
      "line": 0,
      "column": 0,
      "match": "auth.test.ts",
      "preview": ""
    }
  ]
}
```

#### GET /fs/telescope?query={query}&path={path}&limit={n}

Fuzzy search for files (fast telescopic search).

**Auth Required**: Yes

**Query Parameters**:
- `query` (string, required): Fuzzy search query
- `path` (string, optional): Root directory (default: current working dir)
- `limit` (number, optional): Max results (default: 50)

**Response**:
```json
{
  "results": [
    {
      "path": "src/auth/middleware.ts",
      "score": 0.95,
      "highlight": "src/auth/<b>middleware</b>.ts"
    },
    {
      "path": "src/auth/routes.ts",
      "score": 0.72,
      "highlight": "src/<b>auth</b>/routes.ts"
    }
  ]
}
```

**Note**: Results are sorted by relevance score (0-1, higher is better).

#### GET /fs/metadata?path={path}

Get file/directory metadata.

**Auth Required**: Yes

**Query Parameters**:
- `path` (string, required): File or directory path

**Response**:
```json
{
  "name": "README.md",
  "path": "/home/username/project/README.md",
  "type": "file",
  "size": 1234,
  "lastModified": "2025-11-02T13:00:00.000Z",
  "permissions": "rw-r--r--",
  "isReadable": true,
  "isWritable": true,
  "isExecutable": false
}
```

#### POST /fs/terminal

Execute a terminal command (one-shot, not interactive).

**Auth Required**: Yes

**Request Body**:
```json
{
  "command": "ls -la",
  "cwd": "/home/username/project",
  "timeout": 30000
}
```

**Fields**:
- `command` (string, required): Shell command to execute
- `cwd` (string, optional): Working directory (default: server CWD)
- `timeout` (number, optional): Timeout in milliseconds (default: 30000)

**Response**:
```json
{
  "stdout": "total 8\ndrwxr-xr-x 2 user user 4096 Nov  2 13:00 .\ndrwxr-xr-x 3 user user 4096 Nov  2 12:00 ..\n",
  "stderr": "",
  "exitCode": 0,
  "duration": 123
}
```

**Fields**:
- `stdout` (string): Standard output
- `stderr` (string): Standard error
- `exitCode` (number): Process exit code
- `duration` (number): Execution time in milliseconds

### Terminal Sessions

#### GET /terminal/sessions?json={boolean}

List active terminal sessions.

**Auth Required**: Yes

**Query Parameters**:
- `json` (boolean, optional): Return JSON format (default: false returns text)

**Response (json=true)**:
```json
{
  "sessions": [
    {
      "id": "term:/home/user/project#1",
      "title": "Main Terminal",
      "cwd": "/home/user/project",
      "createdAt": 1698765432000,
      "cols": 80,
      "rows": 24,
      "active": true,
      "ownerClientId": "client-uuid",
      "ownerDeviceId": "device-uuid",
      "lastAttachedAt": 1698765500000
    }
  ]
}
```

**Fields**:
- `id` (string): Terminal session ID
- `title` (string, optional): User-set terminal title
- `cwd` (string): Working directory
- `createdAt` (number): Unix timestamp in milliseconds
- `cols` (number): Terminal width in columns
- `rows` (number): Terminal height in rows
- `active` (boolean): Whether PTY process is still running
- `ownerClientId` (string, optional): Current WebSocket client ID
- `ownerDeviceId` (string, optional): Device ID that owns this terminal
- `lastAttachedAt` (number, optional): Last attach time in milliseconds

### Notifications

#### POST /notifications/register

Register device for push notifications.

**Auth Required**: Yes

**Request Body**:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios",
  "subscriptions": ["agent-updates", "cloud-agents"]
}
```

**Fields**:
- `deviceId` (string, required): Device UUID (same as auth deviceId)
- `expoPushToken` (string, required): Expo push notification token
- `platform` (string, required): "ios" or "android"
- `subscriptions` (array, optional): List of notification types to receive

**Response**:
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "platform": "ios",
    "subscriptions": ["agent-updates", "cloud-agents"],
    "lastSeen": "2025-11-02T13:52:59.158Z"
  }
}
```

**Error** (invalid token format):
```json
{
  "success": false,
  "error": "invalid_input"
}
```

#### DELETE /notifications/register

Unregister device from push notifications.

**Auth Required**: Yes

**Request Body**:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "removed": true
  }
}
```

---

## WebSocket Protocol

### Connection

**URL**: `wss://<host>:<port>/ws?token=<access-token>`

**Alternative (CLI local access only)**:
```
wss://<host>:<port>/ws?local=<local-secret>
```

The local secret is stored at `~/.pocket-server/data/runtime/local-ws.key` and is only available on the same machine as the server.

### Message Envelope

All WebSocket messages (both directions) follow this standard envelope:

```typescript
interface WebSocketMessage<T = any> {
  v: number;              // Protocol version (currently 1)
  id: string;             // Unique message ID (UUID)
  correlationId?: string; // Optional: links request/response
  sessionId: string;      // Session or client ID
  ts: string;             // ISO 8601 timestamp
  type: string;           // Message type (see types below)
  payload: T;             // Type-specific payload
  timestamp: number;      // Unix timestamp in milliseconds
}
```

### Connection Lifecycle

#### On Connect (Server → Client)

When WebSocket connection is established and authenticated successfully:

```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "client-uuid",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "connected",
  "payload": {
    "clientId": "client-uuid",
    "publicBaseUrl": "https://tunnel-subdomain.trycloudflare.com"
  },
  "timestamp": 1698765479158
}
```

#### Authentication Failure

If token is invalid or expired, connection closes immediately:

```
Close Code: 4401
Close Reason: "invalid_token"
```

Client should:
1. Clear cached token
2. Request new token (steps 4-5 of auth flow)
3. Reconnect with new token

#### Heartbeat (Client → Server)

Send ping every 20-30 seconds to keep connection alive:

```json
{
  "type": "ping",
  "ts": 1698765479158
}
```

**Note**: No envelope required for ping messages (simplified format).

#### Heartbeat Response (Server → Client)

Server responds with pong:

```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "client-uuid",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "pong",
  "payload": null,
  "timestamp": 1698765479158
}
```

#### Reconnection Strategy

When connection is lost (network interruption, server restart, etc.):

```typescript
let reconnectAttempts = 0;
const maxDelay = 30000; // 30 seconds

function scheduleReconnect() {
  reconnectAttempts++;
  const delay = Math.min(maxDelay, 1000 * Math.pow(2, reconnectAttempts));
  
  setTimeout(() => {
    connect(token);
  }, delay);
}

function onConnect() {
  reconnectAttempts = 0; // Reset on success
  startHeartbeat();
}

function onError() {
  scheduleReconnect();
}

function onClose() {
  scheduleReconnect();
}
```

---

## Message Types

### Terminal Messages (term:*)

All terminal messages relate to PTY (pseudo-terminal) sessions.

#### term:open_or_attach (Client → Server)

Open a new terminal or attach to existing one if it exists.

**Message**:
```json
{
  "type": "term:open_or_attach",
  "payload": {
    "id": "term:/home/user/project#1",
    "cwd": "/home/user/project",
    "rows": 24,
    "cols": 80,
    "title": "Main Terminal"
  }
}
```

**Payload Fields**:
- `id` (string, required): Terminal session ID (should be unique per tab)
- `cwd` (string, optional): Working directory (default: server CWD)
- `rows` (number, optional): Terminal height (default: 24)
- `cols` (number, optional): Terminal width (default: 80)
- `title` (string, optional): Human-friendly terminal title

**Server Response**: `term:opened` (see below)

#### term:open (Client → Server)

Force open a new terminal session (closes existing if ID matches).

**Message**:
```json
{
  "type": "term:open",
  "payload": {
    "id": "term:/home/user/project#1",
    "cwd": "/home/user/project",
    "rows": 24,
    "cols": 80
  }
}
```

**Server Response**: `term:opened`

#### term:attach (Client → Server)

Attach to an existing terminal session (receive output from existing PTY).

**Message**:
```json
{
  "type": "term:attach",
  "payload": {
    "id": "term:/home/user/project#1"
  }
}
```

**Server Behavior**:
1. Sends any buffered backlog (up to 1MB of recent output)
2. Sends `term:opened` confirmation
3. Streams future output via `term:frame` messages

#### term:opened (Server → Client)

Confirmation that terminal is opened or attached.

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "client-uuid",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "term:opened",
  "payload": {
    "id": "term:/home/user/project#1",
    "cols": 80,
    "rows": 24
  },
  "timestamp": 1698765479158
}
```

#### term:input (Client → Server)

Send keyboard input to terminal.

**Message**:
```json
{
  "type": "term:input",
  "payload": {
    "id": "term:/home/user/project#1",
    "data": "ls -la\r",
    "seq": 1
  }
}
```

**Payload Fields**:
- `id` (string, required): Terminal session ID
- `data` (string, required): Raw input string (use "\r" for Enter, "\u0003" for Ctrl+C, etc.)
- `seq` (number, optional): Sequence number for deduplication (increment per input)

**Input Deduplication**: Server tracks last received `seq` per terminal. Duplicate or out-of-order inputs are dropped.

#### term:frame (Server → Client)

Terminal output data frame (aggregated).

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "client-uuid",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "term:frame",
  "payload": {
    "id": "term:/home/user/project#1",
    "seq": 42,
    "ts": 1698765479158,
    "data": "total 8\ndrwxr-xr-x 2 user user 4096 Nov  2 13:00 .\ndrwxr-xr-x 3 user user 4096 Nov  2 12:00 ..\n-rw-r--r-- 1 user user 1234 Nov  2 13:00 README.md\n"
  },
  "timestamp": 1698765479158
}
```

**Payload Fields**:
- `id` (string): Terminal session ID
- `seq` (number): Frame sequence number (increments per frame)
- `ts` (number): Server timestamp in milliseconds
- `data` (string): Raw UTF-8 terminal output (may contain ANSI escape codes)

**Frame Aggregation**: Server aggregates output every ~8ms or when frame reaches 32KB for optimal performance.

#### term:resize (Client → Server)

Resize terminal dimensions.

**Message**:
```json
{
  "type": "term:resize",
  "payload": {
    "id": "term:/home/user/project#1",
    "cols": 100,
    "rows": 30,
    "seq": 1
  }
}
```

**Payload Fields**:
- `id` (string, required): Terminal session ID
- `cols` (number, required): New width in columns
- `rows` (number, required): New height in rows
- `seq` (number, optional): Sequence number (echoed in response)

**Server Response**: `term:resized`

#### term:resized (Server → Client)

Confirmation of terminal resize.

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "client-uuid",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "term:resized",
  "payload": {
    "id": "term:/home/user/project#1",
    "cols": 100,
    "rows": 30,
    "seq": 1
  },
  "timestamp": 1698765479158
}
```

#### term:title (Client → Server)

Set terminal tab title.

**Message**:
```json
{
  "type": "term:title",
  "payload": {
    "id": "term:/home/user/project#1",
    "title": "Build Terminal"
  }
}
```

**Note**: No server response (fire-and-forget). Title is persisted in terminal registry.

#### term:close (Client → Server)

Close terminal session and kill PTY process.

**Message**:
```json
{
  "type": "term:close",
  "payload": {
    "id": "term:/home/user/project#1"
  }
}
```

**Note**: No server response. PTY process is killed gracefully.

#### term:exit (Server → Client)

Terminal process exited (either due to close or natural termination).

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "client-uuid",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "term:exit",
  "payload": {
    "id": "term:/home/user/project#1",
    "code": 0
  },
  "timestamp": 1698765479158
}
```

**Payload Fields**:
- `id` (string): Terminal session ID
- `code` (number): Exit code (0 = success, non-zero = error)

### Agent Messages (agent:*)

Agent messages are exchanged for AI agent interactions.

#### agent:message (Client → Server)

Send a user message to the agent.

**Message**:
```json
{
  "type": "agent:message",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "openai",
  "payload": {
    "content": "Fix the login bug in src/auth/login.ts",
    "workingDir": "/home/user/project",
    "maxMode": false
  },
  "apiKey": "sk-..."
}
```

**Fields**:
- `sessionId` (string, required): Agent session ID
- `provider` (string, optional): "openai" (default) or "anthropic"
- `payload.content` (string, required): User message text
- `payload.workingDir` (string, optional): Working directory for tools
- `payload.maxMode` (boolean, optional): Enable auto-approval for tools
- `apiKey` (string, optional): Override API key (defaults to server env var)

**Server Responses**: Multiple messages as agent processes:
- `agent:stream` - Text chunks
- `agent:tool_use` - Tool invocations
- `agent:tool_result` - Tool results
- `agent:complete` - Final completion
- `agent:error` - Errors

#### agent:stop (Client → Server)

Request to stop agent execution.

**Message**:
```json
{
  "type": "agent:stop",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### agent:stream (Server → Client)

Streaming agent response text chunks.

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "agent:stream",
  "payload": {
    "delta": "I'll help you fix the login bug. Let me examine the code first.",
    "messageId": "msg-uuid",
    "event": "text_delta"
  },
  "timestamp": 1698765479158
}
```

**Payload Fields**:
- `delta` (string): Text chunk to append
- `messageId` (string): Message ID for correlation
- `event` (string): Stream event type

#### agent:tool_use (Server → Client)

Agent is invoking a tool.

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "agent:tool_use",
  "payload": {
    "toolId": "tool-uuid",
    "toolName": "bash",
    "toolInput": {
      "command": "cat src/auth/login.ts"
    },
    "requiresApproval": true
  },
  "timestamp": 1698765479158
}
```

**Payload Fields**:
- `toolId` (string): Unique tool invocation ID
- `toolName` (string): Tool name (bash, str_replace_based_edit_tool, etc.)
- `toolInput` (object): Tool-specific parameters
- `requiresApproval` (boolean): Whether user approval is needed (false in maxMode)

#### agent:tool_result (Server → Client)

Tool execution result.

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "agent:tool_result",
  "payload": {
    "toolId": "tool-uuid",
    "toolName": "bash",
    "success": true,
    "output": "import { validateCredentials } from './utils';\n\nexport function login(username, password) {\n  // Bug: missing await\n  const valid = validateCredentials(username, password);\n  ...\n}"
  },
  "timestamp": 1698765479158
}
```

**Payload Fields**:
- `toolId` (string): Tool invocation ID (matches tool_use)
- `toolName` (string): Tool name
- `success` (boolean): Whether tool execution succeeded
- `output` (string): Tool output or error message

#### agent:complete (Server → Client)

Agent finished processing the message.

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "agent:complete",
  "payload": {
    "messageId": "msg-uuid",
    "stopReason": "end_turn"
  },
  "timestamp": 1698765479158
}
```

**Payload Fields**:
- `messageId` (string): Message ID
- `stopReason` (string): "end_turn", "max_tokens", "tool_use", "stop_sequence"

#### agent:error (Server → Client)

Agent encountered an error.

**Message**:
```json
{
  "v": 1,
  "id": "msg-uuid",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2025-11-02T13:52:59.158Z",
  "type": "agent:error",
  "payload": {
    "error": "API rate limit exceeded. Please try again in 60 seconds.",
    "code": "RATE_LIMIT",
    "retryable": true
  },
  "timestamp": 1698765479158
}
```

**Payload Fields**:
- `error` (string): Human-readable error message
- `code` (string, optional): Error code
- `retryable` (boolean, optional): Whether the error is retryable

---

## Error Handling

### HTTP Error Responses

All HTTP errors follow this format:

```json
{
  "error": "error_code_string",
  "message": "Human-readable error message",
  "details": {}
}
```

**Note**: Some endpoints may return simplified `{ error: "..." }` format.

### Common HTTP Status Codes

- `200 OK`: Request succeeded
- `400 Bad Request`: Invalid input parameters or request body
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Authenticated but not authorized (e.g., pairing window closed)
- `404 Not Found`: Resource doesn't exist (session, file, etc.)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error (check logs)

### WebSocket Close Codes

- `1000`: Normal closure (client or server initiated graceful close)
- `1001`: Going away (server shutdown or client navigating away)
- `1006`: Abnormal closure (connection lost, no close frame received)
- `4401`: Invalid or expired token (custom code)

### Common Error Codes

#### Authentication Errors

- `invalid_input`: Missing required fields in request
- `device_unregistered`: Device not paired (call POST /auth/pair first)
- `invalid_signature`: Signature verification failed (check secret and hash algorithm)
- `invalid_token`: Token is invalid, expired, or malformed
- `pairing_not_active`: Pairing window is closed (start with `pocket-server pair`)
- `invalid_pin`: PIN doesn't match the one displayed in terminal
- `pairing_denied`: Remote pairing token invalid or too many failed attempts
- `pairing_not_local`: Remote pairing attempted without remote mode enabled

#### Agent Errors

- `session_not_found`: Agent session ID doesn't exist
- `invalid_provider`: Unknown provider specified (must be "openai" or "anthropic")
- `api_key_missing`: AI provider API key not configured in server or request
- `rate_limit`: AI provider API rate limit exceeded
- `max_tokens`: Response exceeded maximum token limit

#### File System Errors

- `path_not_found`: File or directory doesn't exist
- `permission_denied`: Insufficient permissions to read/write/delete
- `not_a_file`: Expected file but got directory
- `not_a_directory`: Expected directory but got file
- `path_traversal`: Path escapes allowed directory (security violation)

#### Terminal Errors

- `session_not_found`: Terminal session doesn't exist
- `pty_spawn_failed`: Failed to spawn PTY process

### Error Handling Best Practices

1. **Check Status Codes**: Always check HTTP status code before parsing response
2. **Parse Error Bodies**: Extract error codes for programmatic handling
3. **User-Friendly Messages**: Display error.message or custom messages to users
4. **Retry Logic**: Implement exponential backoff for retryable errors (rate limits, network)
5. **Token Refresh**: On 401, try refreshing token once before prompting re-login
6. **Graceful Degradation**: Handle missing features gracefully (e.g., if notifications fail)

### Retry Strategy Example

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry on 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      
      // Retry on 5xx or 429
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

---

## Additional Notes

### Binary Data

Currently, all WebSocket messages use JSON text format. Binary frames are not used. File uploads/downloads use HTTP multipart or streaming responses.

### Rate Limiting

- **Authentication endpoints**: ~10 requests per minute per IP
- **API endpoints**: ~100 requests per minute per device
- **WebSocket messages**: No hard limit, but abuse may trigger throttling

### Protocol Versioning

The `v` field in WebSocket messages allows for future protocol evolution. Current version is `1`. Clients should:
- Check version field in received messages
- Handle unknown message types gracefully (log and ignore)
- Fail gracefully if server requires a newer protocol version

### Backward Compatibility

Server maintains backward compatibility within major versions. Breaking changes will increment protocol version.

### TLS/SSL Requirements

**Production**: HTTPS and WSS required. Clients should reject plain HTTP/WS connections.

**Development**: For local development, allow HTTP/WS connections to localhost only.

### Token Lifetime and Refresh

Tokens expire after 15 minutes. Clients should:
1. Store token and expiry time together
2. Check expiry before each request
3. Refresh proactively (1 minute before expiry)
4. Handle 401 responses by refreshing once, then retry

### Path Security

All file system paths are validated and restricted to `HOME_DIR`. Attempts to escape (e.g., via `../`) are rejected with `path_traversal` error.

### WebSocket Message Ordering

Server guarantees FIFO ordering per client. Messages from the same client are processed in order, but messages from different clients may interleave.

### Session Persistence

All agent sessions and terminal sessions are persisted on the server. Clients are stateless and can reconnect to existing sessions at any time.

---

## Quick Reference

### Authentication Headers

```
Authorization: Pocket <token>
```

### WebSocket URL

```
wss://<host>:<port>/ws?token=<token>
```

### Essential Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Server health check |
| GET | `/auth/pair/status` | Check pairing window status |
| POST | `/auth/pair` | Pair device |
| POST | `/auth/challenge` | Request challenge nonce |
| POST | `/auth/token` | Exchange for access token |
| GET | `/agent/sessions` | List agent sessions |
| POST | `/agent/session` | Create agent session |
| GET | `/fs/list?path=...` | List directory |
| GET | `/fs/read?path=...` | Read file |
| POST | `/fs/write` | Write file |
| GET | `/terminal/sessions` | List terminal sessions |
| POST | `/notifications/register` | Register for push notifications |

### Essential WebSocket Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `ping` | Client → Server | Heartbeat |
| `pong` | Server → Client | Heartbeat response |
| `connected` | Server → Client | Connection established |
| `term:open_or_attach` | Client → Server | Open/attach terminal |
| `term:input` | Client → Server | Send keyboard input |
| `term:frame` | Server → Client | Terminal output |
| `term:exit` | Server → Client | Terminal exited |
| `agent:message` | Client → Server | Send message to agent |
| `agent:stream` | Server → Client | Agent text stream |
| `agent:complete` | Server → Client | Agent finished |

---

## Support

For issues, questions, or contributions:
- **Repository**: https://github.com/yayasoumah/pocket-server
- **Issues**: https://github.com/yayasoumah/pocket-server/issues

## License

Apache 2.0 - See [LICENSE](../../LICENSE)
