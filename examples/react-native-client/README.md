# Pocket Mobile - React Native Example App

A complete, working React Native Expo app that connects to pocket-server.

## Features

✅ **Authentication**
- Device pairing with PIN
- Secure token storage (Keychain/Keystore)
- Automatic token refresh

✅ **WebSocket Connection**
- Real-time bidirectional communication
- Automatic reconnection with exponential backoff
- Heartbeat/ping-pong

✅ **Terminal**
- Full PTY terminal with xterm.js in WebView
- Keyboard input support
- ANSI color support
- Auto-resize

🚧 **Coming Soon**
- Agent chat interface
- File browser
- Push notifications

## Prerequisites

- Node.js 18+ installed
- Expo CLI installed (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android emulator
- A running pocket-server instance

## Quick Start

### 1. Install Dependencies

```bash
cd examples/react-native-client
npm install
```

### 2. Start Pocket Server

In a separate terminal:

```bash
# Start pocket-server
pocket-server start

# Or with remote access
pocket-server start --remote
```

### 3. Open Pairing Window

In another terminal:

```bash
pocket-server pair

# Note the 6-digit PIN displayed
```

### 4. Run the App

```bash
# Start Expo
npm start

# Then press:
# i - for iOS simulator
# a - for Android emulator
# w - for web (limited functionality)
```

### 5. Connect to Server

1. **Enter Server URL**:
   - Local (same network): `http://192.168.1.X:3000` (your computer's IP)
   - Android emulator: `http://10.0.2.2:3000`
   - iOS simulator: `http://localhost:3000`
   - Remote: Use the URL from `pocket-server start --remote`

2. **Enter PIN**: The 6-digit PIN from `pocket-server pair`

3. **Tap "Pair Device"**

4. You're connected! 🎉

## Project Structure

```
src/
├── services/
│   ├── AuthService.ts          # Authentication & pairing
│   └── WebSocketService.ts     # WebSocket with reconnection
├── screens/
│   ├── ServerConfigScreen.tsx  # Server URL & PIN entry
│   ├── HomeScreen.tsx          # Dashboard with quick actions
│   └── TerminalScreen.tsx      # xterm.js terminal
├── types/
│   └── api-types.ts            # TypeScript types from server
└── hooks/                      # (Future) Custom React hooks

App.tsx                         # Main app with navigation
```

## How It Works

### Authentication Flow

```
1. User enters server URL and PIN
2. App calls AuthService.pair(pin)
3. Server validates PIN and returns device secret
4. Secret stored in secure storage (Keychain/Keystore)
5. For API calls:
   - Request challenge (POST /auth/challenge)
   - Sign with secret: sha256(secret + deviceId + nonce)
   - Exchange for token (POST /auth/token)
6. Token used for HTTP (Authorization: Pocket <token>) and WebSocket (?token=<token>)
```

### WebSocket Connection

```
1. Get access token from AuthService
2. Connect to wss://server/ws?token=<token>
3. Send ping every 20 seconds
4. On disconnect: exponential backoff reconnection
5. Subscribe to message types (term:frame, agent:stream, etc.)
```

### Terminal

```
1. WebView loads HTML with xterm.js
2. Terminal sends 'ready' message to React Native
3. React Native sends term:open_or_attach via WebSocket
4. Server sends term:frame messages with PTY output
5. React Native forwards data to WebView via postMessage
6. xterm.js renders the output
7. User types → xterm onData → postMessage to React Native → term:input to server
```

## Configuration

### Change Default Server URL

Edit `App.tsx`:

```typescript
const service = new AuthService({
  serverUrl: 'https://your-server.com', // Change this
});
```

### Customize Terminal Theme

Edit `TerminalScreen.tsx`, find the `theme` object in `terminalHTML`.

## Development Tips

### Debugging

1. **Enable Remote Debugging**:
   - Shake device/simulator
   - Tap "Debug Remote JS"

2. **View Logs**:
   ```bash
   # React Native logs
   npx react-native log-ios
   npx react-native log-android
   
   # Expo logs (in terminal where you ran npm start)
   ```

3. **Inspect Network**:
   - Use React Native Debugger
   - Or Chrome DevTools (Network tab)

### Testing on Real Device

#### iOS

1. Install Expo Go from App Store
2. Scan QR code from `npm start`
3. For local server, ensure phone and computer on same WiFi
4. Use computer's IP address (not localhost)

#### Android

1. Install Expo Go from Play Store
2. Scan QR code from `npm start`
3. For local server, use computer's IP address
4. May need to enable "Allow from other sources" in network settings

### Finding Your Computer's IP

**macOS/Linux**:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows**:
```cmd
ipconfig
```

Look for your WiFi adapter's IPv4 address (usually 192.168.x.x).

## Common Issues

### "Unable to connect to server"

**Solution**:
1. Check server is running: `curl http://localhost:3000/health`
2. Verify firewall allows port 3000
3. Use correct IP address (not localhost for physical devices)
4. For Android emulator, use `10.0.2.2:3000`

### "Invalid PIN"

**Solution**:
1. Ensure pairing window is open (`pocket-server pair`)
2. Check PIN is correct (case-sensitive)
3. PIN expires after 60 seconds by default

### "WebSocket connection failed"

**Solution**:
1. Check token is valid (not expired)
2. Ensure using ws:// for http:// and wss:// for https://
3. For production, TLS/WSS is required

### Terminal not showing output

**Solution**:
1. Check WebSocket is connected (green dot on Home screen)
2. Verify terminal ID matches in logs
3. Try closing and reopening terminal
4. Check server logs for errors

## Building for Production

### iOS

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build
eas build --platform ios
```

### Android

```bash
# Build APK
eas build --platform android

# Or AAB for Play Store
eas build --platform android --profile production
```

## Next Steps

1. **Add Agent Chat**: Implement streaming agent responses
2. **Add File Browser**: List, read, write files
3. **Add Settings**: Server URL management, theme selection
4. **Add Notifications**: Push notifications for agent updates
5. **Add Multiple Terminals**: Tab-based terminal sessions

## Contributing

This is an example app. For the full mobile app, see the main Pocket repository.

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Styled with StyleSheet (no external UI libraries)
- GitHub dark theme colors

## Resources

- [Pocket Server Docs](../../docs/mobile-client/)
- [API Reference](../../docs/mobile-client/API-REFERENCE.md)
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [xterm.js Docs](https://xtermjs.org/)

## License

Apache-2.0 (same as pocket-server)
