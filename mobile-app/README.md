# Pocket Mobile App

The official React Native mobile application for Pocket Server.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android emulator
- A running pocket-server instance

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platform
npm run ios      # iOS Simulator
npm run android  # Android Emulator  
npm run web      # Web browser (limited features)
```

### First Time Setup

1. **Start Pocket Server**
   ```bash
   pocket-server start
   ```

2. **Open Pairing Window**
   ```bash
   pocket-server pair
   # Note the 6-digit PIN
   ```

3. **Launch the App**
   ```bash
   npm start
   # Press 'i' for iOS or 'a' for Android
   ```

4. **Connect to Server**
   - Enter server URL (e.g., `http://192.168.1.X:3000`)
   - Enter the 6-digit PIN
   - Tap "Pair Device"

## 📱 Current Features

### ✅ Implemented
- **Authentication** - PIN-based device pairing with secure storage
- **WebSocket Connection** - Real-time bidirectional communication
- **Terminal** - Full PTY terminal with xterm.js
- **Secure Token Storage** - Keychain (iOS) / Keystore (Android)
- **Auto-Reconnection** - Exponential backoff strategy
- **Token Refresh** - Automatic before expiry

### 🚧 In Progress
- Agent Chat Interface
- File Browser
- Push Notifications
- Settings Screen

### 📋 Planned
- Multiple Terminal Tabs
- Agent Session Management
- File Upload/Download
- Dark/Light Theme Toggle
- Offline Mode

## 🏗️ Project Structure

```
mobile-app/
├── App.tsx                          # Main app entry point
├── app.json                         # Expo configuration
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── babel.config.js                  # Babel config
│
├── src/
│   ├── screens/                     # Screen components
│   │   ├── ServerConfigScreen.tsx  # Server URL & PIN pairing
│   │   ├── HomeScreen.tsx          # Dashboard
│   │   └── TerminalScreen.tsx      # Terminal interface
│   │
│   ├── services/                    # Backend services
│   │   ├── AuthService.ts          # Authentication & token management
│   │   └── WebSocketService.ts     # WebSocket connection
│   │
│   ├── components/                  # Reusable components
│   │   └── (add components here)
│   │
│   ├── hooks/                       # Custom React hooks
│   │   └── (add hooks here)
│   │
│   ├── types/                       # TypeScript types
│   │   └── api-types.ts            # Server API types
│   │
│   └── utils/                       # Utility functions
│       └── (add utilities here)
│
└── assets/                          # Images, fonts, etc.
    └── (add assets here)
```

## 🔧 Development

### Running the App

**Development Mode:**
```bash
npm start
```

This opens the Expo DevTools. From there:
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Press `w` to open in web browser
- Scan QR code with Expo Go app for physical device

**Platform-Specific:**
```bash
npm run ios       # Run on iOS
npm run android   # Run on Android
npm run web       # Run on web
```

### Connecting to Server

**Local Development (Same Network):**
```
http://YOUR_COMPUTER_IP:3000
```

Find your IP:
- macOS/Linux: `ifconfig | grep "inet "`
- Windows: `ipconfig`

**Android Emulator:**
```
http://10.0.2.2:3000
```

**iOS Simulator:**
```
http://localhost:3000
```

**Remote Server:**
```
https://your-tunnel-url.trycloudflare.com
```

### Debugging

**Enable Remote Debugging:**
1. Shake device/simulator
2. Tap "Debug Remote JS"
3. Opens Chrome DevTools

**View Logs:**
```bash
# React Native logs
npx react-native log-ios
npx react-native log-android

# Or view in terminal where you ran npm start
```

**React Native Debugger:**
```bash
# Install
brew install --cask react-native-debugger

# Use instead of Chrome DevTools
```

### Code Style

- TypeScript strict mode enabled
- Functional components with hooks
- StyleSheet for styling (no external UI libraries)
- GitHub dark theme colors (#0d1117 background)

## 📦 Adding Features

### Adding a New Screen

1. Create screen component in `src/screens/`:
```tsx
// src/screens/MyNewScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MyNewScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>My New Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  text: {
    color: '#fff',
  },
});
```

2. Add to navigation in `App.tsx`:
```tsx
<Stack.Screen
  name="MyNewScreen"
  component={MyNewScreen}
  options={{ title: 'My Screen' }}
/>
```

### Adding a Service

1. Create service in `src/services/`:
```tsx
// src/services/MyService.ts
export class MyService {
  // Service implementation
}
```

2. Use in components via hooks or context

### Adding API Calls

See the existing services for patterns:
- `AuthService.ts` - HTTP requests with token management
- `WebSocketService.ts` - WebSocket with reconnection

## 🧪 Testing

### Manual Testing

1. Test authentication flow
2. Test WebSocket connection/disconnection
3. Test terminal input/output
4. Test on both iOS and Android
5. Test with poor network conditions

### Unit Tests (TODO)

```bash
npm test
```

### E2E Tests (TODO)

Using Detox or Appium

## 🚀 Building for Production

### iOS

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios
```

### Android

```bash
# Build APK for testing
eas build --platform android --profile preview

# Build AAB for Play Store
eas build --platform android --profile production
```

## 🔒 Security

### Best Practices Implemented

✅ Device secrets stored in secure storage (Keychain/Keystore)  
✅ Tokens auto-refresh before expiry  
✅ TLS/WSS enforced in production  
✅ Input validation on all forms  
✅ No sensitive data in logs  

### Security Checklist

- [ ] Enable certificate pinning (production)
- [ ] Add biometric authentication
- [ ] Implement session timeout
- [ ] Add security audit logging
- [ ] Review third-party dependencies

## 📖 Documentation

- [API Reference](../docs/mobile-client/API-REFERENCE.md)
- [Getting Started Guide](../docs/mobile-client/GETTING-STARTED.md)
- [Architecture Guide](../docs/mobile-client/ARCHITECTURE.md)
- [Server Documentation](../README.md)

## 🐛 Troubleshooting

### "Cannot connect to server"

**Check:**
- Server is running: `curl http://localhost:3000/health`
- Firewall allows port 3000
- Using correct IP address
- For Android emulator: use `10.0.2.2:3000`

### "Invalid PIN"

**Check:**
- Pairing window is active (`pocket-server pair`)
- PIN is correct (6 digits)
- PIN hasn't expired (60 seconds default)

### "WebSocket disconnected"

**Check:**
- Token hasn't expired (15-minute lifetime)
- Network connection is stable
- Server is still running
- Check server logs for errors

### Terminal not responding

**Check:**
- WebSocket connection is active (green dot on Home)
- Terminal session exists (check server logs)
- Browser WebView is working properly

## 🤝 Contributing

### Development Workflow

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit PR

### Code Standards

- Use TypeScript
- Follow existing patterns
- Add JSDoc comments for complex functions
- Keep components focused and small
- Use hooks over classes

## 📄 License

Apache-2.0 (same as pocket-server)

## 🔗 Links

- [Pocket Server Repo](https://github.com/yayasoumah/pocket-server)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [xterm.js Docs](https://xtermjs.org/)

## 💡 Tips

- Use `Cmd+D` (iOS) or `Cmd+M` (Android) to open dev menu
- Enable Fast Refresh for instant updates
- Use React DevTools for component inspection
- Keep Expo SDK version updated
- Test on physical devices before release

## 🎯 Roadmap

### v1.1 (Next Release)
- [ ] Agent chat interface
- [ ] File browser
- [ ] Settings screen
- [ ] Push notifications

### v1.2
- [ ] Multiple terminal tabs
- [ ] Agent session history
- [ ] File upload/download
- [ ] Offline mode

### v2.0
- [ ] iPad support
- [ ] Widgets
- [ ] Shortcuts
- [ ] Background execution
