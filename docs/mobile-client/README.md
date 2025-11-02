# React Native Mobile Client - Implementation Guide

This directory contains comprehensive documentation and reference materials for building React Native mobile clients that connect to pocket-server.

## 📚 Documentation

### Core Documentation
- **[API-REFERENCE.md](./API-REFERENCE.md)** - Complete REST and WebSocket API reference
- **[GETTING-STARTED.md](./GETTING-STARTED.md)** - Quick start guide for mobile developers
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Client architecture and design patterns

### Code Examples
- **[examples/](./examples/)** - TypeScript code examples for React Native
  - Authentication service
  - WebSocket service with reconnection
  - API client with auth interceptors
  - Terminal integration with xterm.js
  - File upload/download

### Type Definitions
- **[types/](./types/)** - TypeScript type definitions matching server APIs

## 🚀 Quick Start

1. **Read the API Reference** - Understand the authentication flow and available endpoints
2. **Review Code Examples** - See working implementations of key features
3. **Use Type Definitions** - Import TypeScript types for type-safe development
4. **Follow Best Practices** - Security, reconnection, and error handling

## 🏗️ Recommended Stack

### Framework
- **React Native** with TypeScript
- **Expo** (managed workflow) for rapid development
- Migration path to bare React Native if needed

### Key Libraries
- **State Management**: React Query + Zustand
- **HTTP Client**: axios with auth interceptors
- **WebSocket**: Native WebSocket with reconnection logic
- **Secure Storage**: expo-secure-store or react-native-keychain
- **Terminal UI**: react-native-webview + xterm.js
- **File Picker**: react-native-document-picker
- **Notifications**: @react-native-firebase/messaging

## 📋 Features Covered

### Core Features (MVP)
- ✅ Server configuration (manual URL entry + QR code scanning)
- ✅ Pairing and authentication with secure token storage
- ✅ REST API calls for agent CRUD and file operations
- ✅ WebSocket connection for PTY, logs, and events
- ✅ Terminal UI with xterm.js in WebView
- ✅ File upload/download
- ✅ Reconnection and heartbeat handling
- ✅ Push notifications integration

### Agent Features
- ✅ Create and list agent sessions
- ✅ Send messages to agents
- ✅ Stream agent responses in real-time
- ✅ Handle tool use and approvals
- ✅ Display work plans and progress

### Terminal Features
- ✅ Open/attach to terminal sessions
- ✅ Send keyboard input with sequence deduplication
- ✅ Receive and display PTY output frames
- ✅ Handle terminal resize
- ✅ Set terminal titles
- ✅ Handle terminal exit events

### File System Features
- ✅ Browse directories
- ✅ Read file contents
- ✅ Write files
- ✅ Search files (fuzzy and pattern-based)
- ✅ Upload and download files

## 🔒 Security Best Practices

1. **TLS Only** - Use HTTPS/WSS in production, reject HTTP/WS
2. **Secure Storage** - Store device secrets in Keychain/Keystore, never in AsyncStorage
3. **Token Management** - Refresh tokens before 15-minute expiry
4. **Input Validation** - Validate all server URLs and user inputs
5. **Logout Flow** - Clear all tokens and secrets on logout

## 🔄 Connection Flow

```
1. User enters server URL or scans QR code
2. App checks pairing status (GET /auth/pair/status)
3. User enters PIN displayed in terminal
4. App pairs device (POST /auth/pair) and stores secret securely
5. For subsequent connections:
   a. Request challenge (POST /auth/challenge)
   b. Sign challenge with secret
   c. Exchange for access token (POST /auth/token)
   d. Use token for HTTP (Authorization: Pocket <token>)
   e. Connect WebSocket (wss://host/ws?token=<token>)
6. Refresh token every ~14 minutes (before 15min expiry)
```

## 📡 WebSocket Protocol

All WebSocket messages use a standard envelope:

```typescript
interface WebSocketMessage<T = any> {
  v: number;              // Protocol version (1)
  id: string;             // Message UUID
  correlationId?: string; // Request/response linking
  sessionId: string;      // Session/client ID
  ts: string;             // ISO timestamp
  type: string;           // Message type (term:*, agent:*, etc.)
  payload: T;             // Type-specific payload
  timestamp: number;      // Unix ms
}
```

### Message Types

#### Terminal (`term:*`)
- `term:open_or_attach` - Open new or attach to existing terminal
- `term:open` - Force open new terminal
- `term:attach` - Attach to existing terminal
- `term:input` - Send keyboard input
- `term:resize` - Resize terminal dimensions
- `term:title` - Set terminal tab title
- `term:close` - Close terminal
- `term:opened` - Server confirms terminal opened (Server → Client)
- `term:frame` - PTY output data (Server → Client)
- `term:resized` - Server confirms resize (Server → Client)
- `term:exit` - Terminal process exited (Server → Client)

#### Agent (`agent:*`)
- `agent:message` - Send user message to agent
- `agent:stop` - Stop agent execution
- `agent:stream` - Streaming agent response (Server → Client)
- `agent:tool_use` - Agent using a tool (Server → Client)
- `agent:tool_result` - Tool execution result (Server → Client)
- `agent:complete` - Agent finished processing (Server → Client)
- `agent:error` - Agent error (Server → Client)

#### Heartbeat
- `ping` - Client heartbeat (every 20-30s)
- `pong` - Server heartbeat response

## 🧪 Testing

### Local Development
```bash
# Terminal 1: Start pocket-server
cd pocket-server
npm run dev

# Terminal 2: Open pairing window
pocket-server pair

# Terminal 3: Test with curl/wscat
curl http://localhost:3000/health
wscat -c ws://localhost:3000/ws?token=<your-token>
```

### Testing Tools
- **curl** - Test REST endpoints
- **wscat** - Test WebSocket connection
- **Postman** - API collection for comprehensive testing
- **React Native Debugger** - Debug mobile app network traffic

## 📱 Platform-Specific Notes

### iOS
- Use Keychain for secure storage
- Request proper permissions for file access
- Handle App Transport Security for local dev (allow localhost)
- Use Expo Push Notifications for FCM

### Android
- Use EncryptedSharedPreferences or Keystore
- Request file and notification permissions
- Handle cleartext traffic for local dev
- Configure FCM properly in google-services.json

## 🔍 Troubleshooting

### Common Issues

**Cannot connect to server**
- Check firewall allows port 3000
- Ensure phone and server on same network (local mode)
- Try `pocket-server start --remote` for public URL

**Authentication fails**
- Verify pairing window is active
- Check PIN is entered correctly
- For remote pairing, ensure token is included

**WebSocket disconnects frequently**
- Implement ping/pong heartbeat every 20-30s
- Add reconnection with exponential backoff
- Check network stability

**Terminal output delayed**
- Server aggregates frames every 8ms or 32KB
- Ensure WebSocket messages processed quickly
- Check xterm.js rendering performance

## 📖 Additional Resources

- [Pocket Server README](../../README.md)
- [CLAUDE.md](../../CLAUDE.md) - Server architecture guide
- [Repository](https://github.com/yayasoumah/pocket-server)

## 🤝 Contributing

Found an issue or want to improve the documentation? Please open an issue or PR in the main repository.

## 📄 License

Apache 2.0 - See [LICENSE](../../LICENSE)
