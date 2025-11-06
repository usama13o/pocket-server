/**
 * WebSocket Service Example for React Native
 * 
 * Manages WebSocket connection with automatic reconnection,
 * heartbeat, and message handling.
 */

import type {
  WebSocketMessage,
  TypedWebSocketMessage,
  MessageType,
} from '../types/api-types';

export interface WebSocketConfig {
  url: string;
  token: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export type MessageHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs = 20000; // 20 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private globalHandlers: Set<MessageHandler> = new Set();
  private isIntentionalClose = false;

  // Callbacks
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(config: WebSocketConfig) {
    this.url = config.url;
    this.token = config.token;
    this.onConnectCallback = config.onConnect;
    this.onDisconnectCallback = config.onDisconnect;
    this.onErrorCallback = config.onError;

    if (config.onMessage) {
      this.onMessage(config.onMessage);
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    this.isIntentionalClose = false;
    const wsUrl = this.buildWebSocketUrl(this.url, this.token);

    console.log('[WS] Connecting to:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onclose = (event) => this.handleClose(event);
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    this.cancelReconnect();

    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect');
      } catch (error) {
        console.error('[WS] Error closing connection:', error);
      }
      this.ws = null;
    }
  }

  /**
   * Send a message to the server
   */
  send<T = any>(type: MessageType, payload: T, sessionId: string = 'system'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot send message: not connected');
      throw new Error('WebSocket not connected');
    }

    const message: WebSocketMessage<T> = {
      v: 1,
      id: this.generateUUID(),
      sessionId,
      ts: new Date().toISOString(),
      type,
      payload,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send raw message object (for simple ping)
   */
  sendRaw(obj: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(obj));
  }

  /**
   * Register a global message handler (receives all messages)
   */
  onMessage(handler: MessageHandler): () => void {
    this.globalHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Register a handler for specific message type
   */
  onMessageType(type: MessageType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Update token (e.g., after refresh)
   */
  updateToken(newToken: string): void {
    this.token = newToken;
    // Reconnect with new token
    if (this.isConnected()) {
      this.disconnect();
      this.connect();
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private handleOpen(): void {
    console.log('[WS] Connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    
    if (this.onConnectCallback) {
      this.onConnectCallback();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Log for debugging (exclude frequent frame messages)
      if (!message.type.startsWith('term:frame')) {
        console.log('[WS] Received:', message.type);
      }

      // Handle pong responses
      if (message.type === 'pong') {
        // Heartbeat acknowledged
        return;
      }

      // Dispatch to type-specific handlers
      const typeHandlers = this.messageHandlers.get(message.type);
      if (typeHandlers) {
        typeHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('[WS] Handler error:', error);
          }
        });
      }

      // Dispatch to global handlers
      this.globalHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('[WS] Global handler error:', error);
        }
      });
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
    }
  }

  private handleError(error: Event): void {
    console.error('[WS] Connection error:', error);
    
    if (this.onErrorCallback) {
      this.onErrorCallback(new Error('WebSocket error'));
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('[WS] Disconnected:', event.code, event.reason);
    
    this.stopHeartbeat();
    this.ws = null;

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }

    // Handle authentication failures
    if (event.code === 4401) {
      console.error('[WS] Authentication failed: invalid token');
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error('Authentication failed'));
      }
      return; // Don't reconnect on auth failure
    }

    // Reconnect if not intentional close
    if (!this.isIntentionalClose) {
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        try {
          // Send simple ping message
          this.sendRaw({ type: 'ping', ts: Date.now() });
        } catch (error) {
          console.error('[WS] Failed to send heartbeat:', error);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.cancelReconnect();
    
    this.reconnectAttempts++;
    
    // Exponential backoff with max delay
    const delay = Math.min(
      this.maxReconnectDelay,
      1000 * Math.pow(2, this.reconnectAttempts)
    );
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('[WS] Attempting reconnection...');
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private buildWebSocketUrl(serverUrl: string, token: string): string {
    // Parse server URL
    const url = new URL(serverUrl);
    
    // Convert to WebSocket protocol
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Build WebSocket URL with token
    return `${wsProtocol}//${url.host}/ws?token=${encodeURIComponent(token)}`;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// ============================================================================
// Usage Example
// ============================================================================

/*

import { AuthService } from './AuthService';
import { WebSocketService } from './WebSocketService';

// Initialize auth service
const authService = new AuthService({
  serverUrl: 'https://your-server.com',
});

await authService.init();
const token = await authService.getAccessToken();

// Initialize WebSocket service
const wsService = new WebSocketService({
  url: authService.getServerUrl(),
  token,
  onConnect: () => {
    console.log('WebSocket connected!');
  },
  onDisconnect: () => {
    console.log('WebSocket disconnected');
  },
  onError: (error) => {
    console.error('WebSocket error:', error);
  },
});

// Connect
wsService.connect();

// Listen for specific message types
const unsubscribe = wsService.onMessageType('term:frame', (message) => {
  const payload = message.payload as TermFramePayload;
  console.log('Terminal output:', payload.data);
});

// Send terminal input
wsService.send('term:input', {
  id: 'term:/home/user/project#1',
  data: 'ls -la\r',
  seq: 1,
}, 'system');

// Send agent message
wsService.send('agent:message', {
  content: 'Fix the bug in login.ts',
  workingDir: '/home/user/project',
  maxMode: false,
}, 'session-uuid');

// Cleanup
unsubscribe();
wsService.disconnect();

*/

// ============================================================================
// React Hook Example
// ============================================================================

/*

import { useEffect, useState, useCallback } from 'react';
import { WebSocketService } from './WebSocketService';
import type { WebSocketMessage } from '../types/api-types';

export function useWebSocket(url: string, token: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    const service = new WebSocketService({
      url,
      token,
      onConnect: () => setIsConnected(true),
      onDisconnect: () => setIsConnected(false),
      onMessage: (msg) => setLastMessage(msg),
    });

    service.connect();
    setWsService(service);

    return () => {
      service.disconnect();
    };
  }, [url, token]);

  const send = useCallback(<T = any>(
    type: string,
    payload: T,
    sessionId?: string
  ) => {
    if (wsService) {
      wsService.send(type, payload, sessionId);
    }
  }, [wsService]);

  const onMessageType = useCallback((
    type: string,
    handler: (msg: WebSocketMessage) => void
  ) => {
    if (wsService) {
      return wsService.onMessageType(type, handler);
    }
    return () => {};
  }, [wsService]);

  return {
    isConnected,
    lastMessage,
    send,
    onMessageType,
    wsService,
  };
}

// Usage in component:
const MyComponent = () => {
  const { isConnected, send, onMessageType } = useWebSocket(serverUrl, token);

  useEffect(() => {
    const unsubscribe = onMessageType('term:frame', (msg) => {
      console.log('Terminal output:', msg.payload);
    });
    return unsubscribe;
  }, [onMessageType]);

  const sendCommand = () => {
    send('term:input', {
      id: 'term:/path#1',
      data: 'ls\r',
    });
  };

  return (
    <View>
      <Text>Status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
      <Button title="Run ls" onPress={sendCommand} />
    </View>
  );
};

*/
