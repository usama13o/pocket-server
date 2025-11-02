# Mobile Client Architecture Guide

This document describes the recommended architecture and design patterns for React Native mobile clients connecting to pocket-server.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      React Native App                        │
├─────────────────────────────────────────────────────────────┤
│  UI Layer                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Screens │  │Components│  │  Hooks   │  │Navigation│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
├───────┼─────────────┼──────────────┼─────────────┼──────────┤
│  Business Logic Layer                                        │
│  ┌────▼─────┐  ┌───▼──────┐  ┌───▼──────┐  ┌──▼───────┐   │
│  │ State    │  │ Services │  │  Utils   │  │Validation│   │
│  │Management│  │  Layer   │  │          │  │          │   │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └──────────┘   │
│       │             │                                        │
├───────┼─────────────┼────────────────────────────────────────┤
│  Services Layer                                              │
│  ┌────▼─────┐  ┌───▼──────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │WebSocket │  │   API    │  │  Storage │   │
│  │ Service  │  │ Service  │  │  Client  │  │ Service  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
├───────┼─────────────┼──────────────┼─────────────┼──────────┤
│  Platform Layer                                              │
│  ┌────▼─────┐  ┌───▼──────┐  ┌───▼──────┐  ┌──▼───────┐   │
│  │ Secure   │  │WebSocket │  │  HTTP    │  │AsyncStore│   │
│  │ Storage  │  │   API    │  │(fetch/ax)│  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────┐
         │      Pocket Server (Node.js)     │
         │  ┌──────────┐  ┌──────────────┐  │
         │  │   REST   │  │  WebSocket   │  │
         │  │    API   │  │     /ws      │  │
         │  └──────────┘  └──────────────┘  │
         └──────────────────────────────────┘
```

## Core Design Principles

### 1. Server-Authoritative State

The mobile client is **stateless** and **thin**. All conversation history, terminal sessions, and file state lives on the server.

**Why?**
- Simpler client logic
- No sync conflicts
- Easy to switch devices
- Faster reconnection

**Implementation:**
```typescript
// DON'T store conversation locally
const [messages, setMessages] = useState([]); // ❌

// DO fetch from server on mount
const { data: snapshot } = useQuery(['session', sessionId], 
  () => apiClient.getAgentSessionSnapshot(sessionId)
);
```

### 2. Event-Driven UI

The UI reacts to server events via WebSocket. State updates flow from server → WebSocket → UI.

**Flow:**
```
User Action → WebSocket Message → Server Processing → 
Server Events → WebSocket Handler → State Update → UI Render
```

**Example:**
```typescript
// Terminal output flow
wsService.send('term:input', { id, data: 'ls\r' });
// Server processes and emits:
// term:frame → handler updates buffer → UI renders
```

### 3. Separation of Concerns

**Services Layer:**
- `AuthService`: Authentication, token management, secure storage
- `WebSocketService`: Connection, reconnection, message routing
- `ApiClient`: HTTP requests, auth headers, retries

**State Layer:**
- React Query for server state caching
- Zustand/Recoil for UI state (theme, navigation, etc.)
- No business logic in components

**UI Layer:**
- Dumb components (receive props, emit callbacks)
- Smart screens (use hooks to connect to services)
- Navigation handled separately

### 4. Type Safety

Use TypeScript throughout with strict mode enabled:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

Import types from `api-types.ts` to match server contracts exactly.

### 5. Error Handling

**Three levels:**
1. **Network errors**: Retry with exponential backoff
2. **Server errors**: Show user-friendly messages
3. **Application errors**: Log and fallback gracefully

```typescript
try {
  await apiClient.createAgentSession(params);
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      // Auth error - redirect to login
      navigation.navigate('Login');
    } else if (error.response?.status >= 500) {
      // Server error - show retry
      showError('Server error, please try again');
    } else {
      // Client error - show specific message
      showError(error.response?.data?.error || 'Request failed');
    }
  } else {
    // Network error - check connectivity
    showError('Network error, check your connection');
  }
}
```

## Service Layer Design

### AuthService

**Responsibilities:**
- Manage device pairing flow
- Store and retrieve device secret securely
- Generate and refresh access tokens
- Provide auth header for HTTP requests

**Key Methods:**
```typescript
interface AuthService {
  init(): Promise<void>;
  isPaired(): Promise<boolean>;
  pair(pin: string, options?: PairOptions): Promise<PairResult>;
  getAccessToken(): Promise<string>;
  getAuthHeader(): Promise<string>;
  logout(): Promise<void>;
}
```

**State:**
- Device ID (persistent, insecure storage OK)
- Device secret (secure storage required)
- Access token (memory + secure storage)
- Token expiry (memory + secure storage)

### WebSocketService

**Responsibilities:**
- Establish and maintain WebSocket connection
- Implement heartbeat (ping/pong every 20s)
- Reconnect with exponential backoff on disconnect
- Route messages to type-specific handlers
- Provide send API with message envelope

**Key Methods:**
```typescript
interface WebSocketService {
  connect(): void;
  disconnect(): void;
  send<T>(type: MessageType, payload: T, sessionId?: string): void;
  onMessage(handler: MessageHandler): UnsubscribeFn;
  onMessageType(type: MessageType, handler: MessageHandler): UnsubscribeFn;
  isConnected(): boolean;
  updateToken(token: string): void;
}
```

**State:**
- WebSocket instance
- Connection status
- Reconnect attempt count
- Message handlers (Map<type, Set<handler>>)
- Heartbeat timer

### ApiClient

**Responsibilities:**
- Make authenticated HTTP requests
- Inject auth token in headers
- Handle token refresh on 401
- Retry transient errors
- Provide typed methods for all endpoints

**Key Methods:**
```typescript
interface ApiClient {
  // Agent
  listAgentSessions(): Promise<AgentSessionSummary[]>;
  createAgentSession(params?: CreateSessionRequest): Promise<{id: string}>;
  getAgentSession(id: string): Promise<AgentSessionSnapshot>;
  
  // File System
  listDirectory(path: string): Promise<DirectoryListing>;
  readFile(path: string): Promise<FileContent>;
  writeFile(params: WriteFileRequest): Promise<WriteFileResponse>;
  
  // Terminal
  listTerminalSessions(): Promise<TerminalSessionsResponse>;
  
  // Notifications
  registerPushNotifications(params: RegisterPushRequest): Promise<RegisterPushResponse>;
}
```

**State:**
- Axios instance with interceptors
- Base URL
- Token getter function

## State Management Strategy

### Server State (React Query)

Use React Query for all server data:

```typescript
// List sessions
const { data: sessions, isLoading, error, refetch } = useQuery(
  ['agent-sessions'],
  () => apiClient.listAgentSessions(),
  {
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
  }
);

// Create session (mutation)
const createMutation = useMutation(
  (params: CreateSessionRequest) => apiClient.createAgentSession(params),
  {
    onSuccess: () => {
      queryClient.invalidateQueries(['agent-sessions']);
    },
  }
);
```

**Benefits:**
- Automatic caching and background refetching
- Loading and error states built-in
- Optimistic updates
- Pagination support

### UI State (Zustand)

Use Zustand for lightweight UI state:

```typescript
interface UIStore {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  activeSessionId: string | null;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setActiveSession: (id: string | null) => void;
}

const useUIStore = create<UIStore>((set) => ({
  theme: 'dark',
  sidebarOpen: false,
  activeSessionId: null,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveSession: (id) => set({ activeSessionId: id }),
}));
```

### WebSocket State (Custom Hooks)

Use custom hooks to connect WebSocket messages to React state:

```typescript
function useTerminalOutput(terminalId: string, wsService: WebSocketService) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    const unsubscribe = wsService.onMessageType('term:frame', (msg) => {
      if (msg.payload.id === terminalId) {
        setOutput(prev => prev + msg.payload.data);
      }
    });
    return unsubscribe;
  }, [terminalId, wsService]);

  return output;
}
```

## Component Architecture

### Container/Presentational Pattern

**Container (Smart):**
- Uses hooks to fetch data
- Manages local state
- Handles events
- Passes data to presentational components

**Presentational (Dumb):**
- Receives props
- Renders UI
- Emits callbacks
- No business logic

**Example:**

```typescript
// AgentChatScreen.tsx (Container)
const AgentChatScreen = ({ route }) => {
  const { sessionId } = route.params;
  const { data: snapshot } = useQuery(['session', sessionId], 
    () => apiClient.getAgentSessionSnapshot(sessionId)
  );
  const { wsService } = useWebSocket(authService);
  
  const handleSendMessage = (content: string) => {
    wsService.send('agent:message', { content }, sessionId);
  };
  
  return (
    <ChatView 
      messages={snapshot?.conversation.messages || []}
      onSendMessage={handleSendMessage}
    />
  );
};

// ChatView.tsx (Presentational)
interface ChatViewProps {
  messages: ConversationMessage[];
  onSendMessage: (content: string) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  
  return (
    <View>
      <FlatList
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />
      <MessageInput 
        value={input}
        onChange={setInput}
        onSubmit={() => {
          onSendMessage(input);
          setInput('');
        }}
      />
    </View>
  );
};
```

### Composition Over Inheritance

Build complex UIs by composing simple components:

```typescript
// Good
<Screen>
  <Header title="Chat" />
  <ChatView messages={messages} />
  <InputBar onSubmit={handleSubmit} />
</Screen>

// Avoid
class ChatScreen extends BaseScreen {
  // Heavy inheritance
}
```

## Performance Optimization

### 1. Memoization

Use `React.memo` for expensive components:

```typescript
const MessageBubble = React.memo<MessageBubbleProps>(({ message }) => {
  return <View>{/* render message */}</View>;
}, (prev, next) => prev.message.id === next.message.id);
```

### 2. Virtual Lists

Use `FlatList` for long lists (chat messages, file listings):

```typescript
<FlatList
  data={messages}
  keyExtractor={item => item.id}
  renderItem={({ item }) => <MessageBubble message={item} />}
  initialNumToRender={20}
  maxToRenderPerBatch={10}
  windowSize={21}
/>
```

### 3. Debounce Input

Debounce expensive operations:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback(
  (query: string) => {
    apiClient.telescopeSearch(query);
  },
  300 // 300ms delay
);
```

### 4. WebSocket Message Throttling

Throttle high-frequency messages (terminal frames):

```typescript
const throttledWrite = useRef(
  throttle((data: string) => {
    // Write to terminal UI
  }, 16) // ~60 FPS
).current;

wsService.onMessageType('term:frame', (msg) => {
  throttledWrite(msg.payload.data);
});
```

## Security Architecture

### 1. Secure Storage

```
┌─────────────────────────────────────┐
│         Secure Storage              │
│  ┌───────────────────────────────┐  │
│  │ iOS Keychain / Android Keystore│ │
│  │  - Device Secret (32 bytes)    │  │
│  │  - Access Token (JWT)          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│      Insecure Storage (OK)          │
│  ┌───────────────────────────────┐  │
│  │      AsyncStorage              │  │
│  │  - Device ID (UUID)            │  │
│  │  - Server URL                  │  │
│  │  - UI Preferences              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 2. Network Security

**Production:**
- TLS 1.2+ required
- Certificate pinning (optional)
- Reject self-signed certs
- Use HTTPS/WSS only

**Development:**
- Allow localhost HTTP/WS
- Trust development certificates
- Clear separation from production

### 3. Input Validation

Validate all user inputs before sending to server:

```typescript
function validateServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function validatePin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
```

## Testing Strategy

### Unit Tests

Test services in isolation:

```typescript
describe('AuthService', () => {
  it('should store device secret securely', async () => {
    const authService = new AuthService({ serverUrl: 'https://test.com' });
    const result = await authService.pair('123456');
    
    expect(result.success).toBe(true);
    // Verify SecureStore was called
  });
  
  it('should refresh token before expiry', async () => {
    // Mock token near expiry
    // Call getAccessToken
    // Verify refresh was triggered
  });
});
```

### Integration Tests

Test service interactions:

```typescript
describe('WebSocket + Auth Integration', () => {
  it('should reconnect with new token after 401', async () => {
    const authService = new AuthService({ serverUrl });
    const wsService = new WebSocketService({ url, token, getAuthToken: () => authService.getAccessToken() });
    
    // Simulate 401 error
    // Verify token refresh
    // Verify reconnection
  });
});
```

### E2E Tests (Detox/Appium)

Test full user flows:

```typescript
describe('Pairing Flow', () => {
  it('should pair device and connect', async () => {
    await element(by.id('server-url-input')).typeText('http://localhost:3000');
    await element(by.id('pin-input')).typeText('123456');
    await element(by.id('pair-button')).tap();
    
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(5000);
  });
});
```

## Deployment Checklist

### Pre-Release

- [ ] Enable strict TypeScript
- [ ] Run linter with zero warnings
- [ ] All tests passing
- [ ] Security audit (no secrets in code)
- [ ] Performance profiling (no memory leaks)
- [ ] Accessibility audit
- [ ] Test on both iOS and Android
- [ ] Test on slow networks
- [ ] Test reconnection scenarios
- [ ] Test with expired tokens

### Release

- [ ] Version bump
- [ ] Update changelog
- [ ] Build production bundles
- [ ] Test production build
- [ ] Submit to app stores
- [ ] Monitor crash reports
- [ ] Track key metrics

## Monitoring & Analytics

### Key Metrics

1. **Connection Health**
   - WebSocket connection uptime
   - Reconnection frequency
   - Token refresh success rate

2. **Performance**
   - Time to first render
   - API response times
   - Terminal input latency

3. **Errors**
   - Network errors
   - Auth failures
   - Crash rate

### Implementation

```typescript
import * as Sentry from '@sentry/react-native';

// Initialize Sentry
Sentry.init({
  dsn: 'your-dsn',
  environment: __DEV__ ? 'development' : 'production',
});

// Track custom events
Sentry.addBreadcrumb({
  category: 'websocket',
  message: 'Connection established',
  level: 'info',
});

// Capture errors
try {
  await apiClient.createSession();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

## Future Enhancements

### Offline Support

```typescript
// Queue messages while offline
const offlineQueue = [];

if (!isOnline) {
  offlineQueue.push({ type: 'agent:message', payload });
} else {
  wsService.send(type, payload);
}

// Flush queue when back online
NetInfo.addEventListener(state => {
  if (state.isConnected && offlineQueue.length > 0) {
    offlineQueue.forEach(msg => wsService.send(msg.type, msg.payload));
    offlineQueue.length = 0;
  }
});
```

### Background Sync

```typescript
import BackgroundFetch from 'react-native-background-fetch';

BackgroundFetch.configure({
  minimumFetchInterval: 15, // 15 minutes
}, async (taskId) => {
  // Sync notifications, session updates, etc.
  await syncData();
  BackgroundFetch.finish(taskId);
});
```

### Voice Input

```typescript
import Voice from '@react-native-voice/voice';

Voice.onSpeechResults = (e) => {
  const text = e.value[0];
  // Send to terminal or agent
  wsService.send('term:input', { id, data: text });
};

await Voice.start('en-US');
```

## Resources

- [React Native Best Practices](https://github.com/invertase/react-native-firebase/blob/main/docs/best-practices.md)
- [React Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [Security Best Practices](https://reactnative.dev/docs/security)

## Conclusion

This architecture provides:
- ✅ Clean separation of concerns
- ✅ Type safety throughout
- ✅ Proper error handling
- ✅ Performance optimization
- ✅ Security best practices
- ✅ Testability
- ✅ Scalability

Follow these patterns to build a robust, maintainable mobile client for pocket-server.
