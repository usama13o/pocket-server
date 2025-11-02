# Getting Started - React Native Mobile Client

This guide will help you build a React Native mobile client that connects to pocket-server from scratch.

## Prerequisites

- Node.js 18+ and npm
- React Native development environment set up
- Basic knowledge of React Native and TypeScript
- A running pocket-server instance (local or remote)

## Step 1: Create React Native Project

### Using Expo (Recommended for MVP)

```bash
# Create new Expo project with TypeScript
npx create-expo-app@latest pocket-mobile --template expo-template-blank-typescript

cd pocket-mobile
```

### Using React Native CLI (Bare Workflow)

```bash
# Create new React Native project
npx react-native@latest init PocketMobile --template react-native-template-typescript

cd PocketMobile
```

## Step 2: Install Dependencies

### Core Dependencies

```bash
# State management and data fetching
npm install @tanstack/react-query zustand

# HTTP client
npm install axios

# Secure storage
npm install expo-secure-store
# OR for bare React Native:
# npm install react-native-keychain

# WebView for terminal
npm install react-native-webview

# Crypto utilities
npm install expo-crypto
# OR for bare React Native:
# npm install react-native-sha256

# Navigation (optional but recommended)
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# QR code scanner (optional)
npm install expo-camera expo-barcode-scanner

# File picker (for file uploads)
npm install expo-document-picker

# Push notifications (optional)
npm install expo-notifications
# OR for bare React Native:
# npm install @react-native-firebase/app @react-native-firebase/messaging
```

### Development Dependencies

```bash
npm install --save-dev @types/react @types/react-native
```

## Step 3: Copy Type Definitions

Copy the type definitions from this repository:

```bash
# Create types directory
mkdir -p src/types

# Copy api-types.ts from docs/mobile-client/types/api-types.ts
curl -o src/types/api-types.ts \
  https://raw.githubusercontent.com/yayasoumah/pocket-server/main/docs/mobile-client/types/api-types.ts
```

## Step 4: Copy Service Examples

Copy the service examples and adapt them to your needs:

```bash
# Create services directory
mkdir -p src/services

# Copy services (or implement your own based on these examples)
# - AuthService.ts
# - WebSocketService.ts
# - ApiClient.ts

# Create components directory for Terminal
mkdir -p src/components
# - TerminalIntegration.tsx
```

## Step 5: Project Structure

Organize your project like this:

```
src/
├── types/
│   └── api-types.ts           # Server API types
├── services/
│   ├── AuthService.ts         # Authentication logic
│   ├── WebSocketService.ts    # WebSocket management
│   └── ApiClient.ts           # HTTP API client
├── components/
│   ├── Terminal.tsx           # Terminal component
│   ├── AgentChat.tsx          # Agent chat interface
│   └── FileBrowser.tsx        # File browser
├── screens/
│   ├── ServerConfigScreen.tsx # Server URL & pairing
│   ├── AgentListScreen.tsx    # List of agent sessions
│   ├── TerminalScreen.tsx     # Terminal interface
│   └── FilesScreen.tsx        # File browser
├── hooks/
│   ├── useAuth.ts             # Auth hook
│   ├── useWebSocket.ts        # WebSocket hook
│   └── useAgent.ts            # Agent operations hook
├── utils/
│   ├── storage.ts             # Storage utilities
│   └── validation.ts          # Input validation
└── App.tsx                    # Main app component
```

## Step 6: Implement Authentication

### Create Storage Utilities

```typescript
// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },
  
  async set(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  },
  
  async remove(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  },
};
```

### Implement Auth Hook

```typescript
// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/AuthService';

export function useAuth(serverUrl: string) {
  const [authService] = useState(() => new AuthService({ serverUrl }));
  const [isPaired, setIsPaired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.init().then(() => {
      authService.isPaired().then(setIsPaired);
      setIsLoading(false);
    });
  }, [authService]);

  const pair = useCallback(async (pin: string, options?: any) => {
    const result = await authService.pair(pin, options);
    if (result.success) {
      setIsPaired(true);
    }
    return result;
  }, [authService]);

  const logout = useCallback(async () => {
    await authService.logout();
    setIsPaired(false);
  }, [authService]);

  return {
    authService,
    isPaired,
    isLoading,
    pair,
    logout,
  };
}
```

## Step 7: Create Server Configuration Screen

```typescript
// src/screens/ServerConfigScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export const ServerConfigScreen = ({ navigation }) => {
  const [serverUrl, setServerUrl] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { pair } = useAuth(serverUrl);

  const handlePair = async () => {
    try {
      const result = await pair(pin, {
        platform: Platform.OS,
        deviceName: `${Platform.OS} Device`,
      });
      
      if (result.success) {
        navigation.navigate('Home');
      } else {
        setError(result.error || 'Pairing failed');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to Pocket Server</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Server URL (e.g., https://server:3000)"
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <TextInput
        style={styles.input}
        placeholder="PIN (from pocket-server pair)"
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        maxLength={6}
      />
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      <Button title="Pair Device" onPress={handlePair} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  error: {
    color: 'red',
    marginBottom: 12,
    textAlign: 'center',
  },
});
```

## Step 8: Set Up WebSocket Connection

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useState } from 'react';
import { WebSocketService } from '../services/WebSocketService';
import { AuthService } from '../services/AuthService';

export function useWebSocket(authService: AuthService) {
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let service: WebSocketService | null = null;

    const init = async () => {
      const token = await authService.getAccessToken();
      const serverUrl = authService.getServerUrl();

      service = new WebSocketService({
        url: serverUrl,
        token,
        onConnect: () => setIsConnected(true),
        onDisconnect: () => setIsConnected(false),
        onError: (error) => console.error('WS Error:', error),
      });

      service.connect();
      setWsService(service);
    };

    init();

    return () => {
      service?.disconnect();
    };
  }, [authService]);

  return { wsService, isConnected };
}
```

## Step 9: Create Agent Chat Interface

```typescript
// src/screens/AgentChatScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet } from 'react-native';
import { useWebSocket } from '../hooks/useWebSocket';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AgentChatScreen = ({ route, authService }) => {
  const { sessionId } = route.params;
  const { wsService } = useWebSocket(authService);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!wsService) return;

    const unsubscribe = wsService.onMessageType('agent:stream', (msg) => {
      // Append streaming text to last message
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + msg.payload.delta },
          ];
        } else {
          return [
            ...prev,
            { id: msg.id, role: 'assistant', content: msg.payload.delta },
          ];
        }
      });
    });

    return unsubscribe;
  }, [wsService]);

  const sendMessage = () => {
    if (!input.trim() || !wsService) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages(prev => [...prev, userMsg]);

    // Send to agent
    wsService.send('agent:message', {
      content: input,
      workingDir: '/home/user/project',
      maxMode: false,
    }, sessionId);

    setInput('');
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.message,
            item.role === 'user' ? styles.userMessage : styles.assistantMessage,
          ]}>
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        )}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          multiline
        />
        <Button title="Send" onPress={sendMessage} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  message: {
    margin: 8,
    padding: 12,
    borderRadius: 8,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    maxHeight: 100,
  },
});
```

## Step 10: Testing

### Start Pocket Server Locally

```bash
# Terminal 1: Start pocket-server
cd pocket-server
npm run dev

# Terminal 2: Open pairing window
pocket-server pair
```

Note the PIN displayed in the terminal.

### Run Your App

```bash
# Run on iOS
npm run ios

# Run on Android
npm run android

# Or use Expo
npx expo start
```

### Test the Flow

1. Enter server URL: `http://localhost:3000` (or your machine's IP)
2. Enter the PIN from the terminal
3. Tap "Pair Device"
4. Navigate to agent chat or terminal
5. Test sending messages and commands

## Step 11: Production Deployment

### Enable Remote Access

When deploying to production or testing over the internet:

```bash
# Start server with Cloudflare tunnel
pocket-server start --remote
```

This will print a public HTTPS URL you can use in the mobile app.

### Security Checklist

- [ ] Always use HTTPS/WSS in production
- [ ] Store device secret in secure storage (Keychain/Keystore)
- [ ] Implement token refresh logic
- [ ] Add input validation on all user inputs
- [ ] Handle network errors gracefully
- [ ] Implement proper logout flow
- [ ] Add rate limiting awareness
- [ ] Test on both iOS and Android
- [ ] Test with poor network conditions
- [ ] Test reconnection scenarios

## Step 12: Optional Enhancements

### QR Code Pairing

```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';

const ScanQRScreen = () => {
  const handleBarCodeScanned = ({ data }) => {
    const config = JSON.parse(data);
    // config contains { restUrl, wsUrl, token? }
    // Use this to configure the app
  };

  return (
    <BarCodeScanner
      onBarCodeScanned={handleBarCodeScanned}
      style={StyleSheet.absoluteFillObject}
    />
  );
};
```

### Push Notifications

```typescript
import * as Notifications from 'expo-notifications';

// Register for push notifications
const registerForPushNotifications = async (apiClient, deviceId) => {
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  await apiClient.registerPushNotifications({
    deviceId,
    expoPushToken: token,
    platform: Platform.OS,
  });
};
```

### Offline Support

```typescript
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return unsubscribe;
  }, []);

  return isConnected;
}
```

## Troubleshooting

### Cannot connect to localhost on Android

Android emulator cannot access `localhost` of the host machine. Use:

```
http://10.0.2.2:3000  # Android emulator
```

Or find your machine's IP address:

```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

Then use `http://192.168.x.x:3000` in the app.

### WebSocket connection fails

- Check that server is running: `curl http://localhost:3000/health`
- Verify token is valid (not expired)
- Check firewall allows port 3000
- For production, ensure WSS (not WS) is used

### Terminal input not working

- Verify WebSocket is connected
- Check that terminal ID matches between open and input messages
- Ensure sequence numbers are incrementing
- Check server logs for errors

## Next Steps

1. Read the [API Reference](./API-REFERENCE.md) for complete endpoint documentation
2. Review [code examples](./examples/) for advanced patterns
3. Check [TypeScript types](./types/api-types.ts) for API contracts
4. Join the community and contribute!

## Resources

- [Pocket Server Repository](https://github.com/yayasoumah/pocket-server)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [xterm.js Documentation](https://xtermjs.org/)

## Support

For issues or questions:
- Open an issue: https://github.com/yayasoumah/pocket-server/issues
- Check existing documentation
- Review code examples in this directory
