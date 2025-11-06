import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { AuthService } from '../services/AuthService';
import { WebSocketService } from '../services/WebSocketService';
import type { TermFramePayload } from '../types/api-types';

interface Props {
  navigation: any;
  authService: AuthService;
}

export default function TerminalScreen({ navigation, authService }: Props) {
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const terminalId = 'term:/home#mobile';
  const inputSeqRef = useRef(0);

  useEffect(() => {
    initWebSocket();
    return () => {
      if (wsService) {
        wsService.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (isConnected && isTerminalReady && wsService) {
      // Open terminal when both WS and terminal UI are ready
      wsService.send('term:open_or_attach', {
        id: terminalId,
        cwd: '/home',
        cols: 80,
        rows: 24,
      });
    }
  }, [isConnected, isTerminalReady, wsService]);

  const initWebSocket = async () => {
    try {
      const token = await authService.getAccessToken();
      const serverUrl = authService.getServerUrl();

      const service = new WebSocketService({
        url: serverUrl,
        token,
        onConnect: () => {
          console.log('Terminal WebSocket connected');
          setIsConnected(true);
        },
        onDisconnect: () => {
          console.log('Terminal WebSocket disconnected');
          setIsConnected(false);
        },
        onError: (error) => {
          console.error('Terminal WebSocket error:', error);
          Alert.alert('Connection Error', 'Failed to connect to server');
        },
      });

      // Subscribe to terminal frames
      service.onMessageType('term:frame', (message) => {
        const payload = message.payload as TermFramePayload;
        if (payload.id === terminalId && webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'data',
            data: payload.data,
          }));
        }
      });

      // Subscribe to terminal opened event
      service.onMessageType('term:opened', (message) => {
        if (message.payload.id === terminalId) {
          console.log('Terminal opened:', message.payload);
        }
      });

      // Subscribe to terminal exit event
      service.onMessageType('term:exit', (message) => {
        if (message.payload.id === terminalId) {
          console.log('Terminal exited:', message.payload.code);
          Alert.alert('Terminal Exited', `Exit code: ${message.payload.code}`);
        }
      });

      service.connect();
      setWsService(service);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'ready':
          console.log('Terminal ready:', message.cols, 'x', message.rows);
          setIsTerminalReady(true);
          break;

        case 'input':
          if (wsService && isConnected) {
            inputSeqRef.current += 1;
            wsService.send('term:input', {
              id: terminalId,
              data: message.data,
              seq: inputSeqRef.current,
            });
          }
          break;

        case 'resize':
          if (wsService && isConnected) {
            wsService.send('term:resize', {
              id: terminalId,
              cols: message.cols,
              rows: message.rows,
            });
          }
          break;
      }
    } catch (error) {
      console.error('Failed to handle WebView message:', error);
    }
  };

  const terminalHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #000;
    }
    #terminal {
      width: 100%;
      height: 100%;
    }
    .xterm {
      height: 100%;
      padding: 5px;
    }
    .xterm-viewport {
      overflow-y: auto !important;
    }
  </style>
</head>
<body>
  <div id="terminal"></div>
  
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
  
  <script>
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });
    
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(document.getElementById('terminal'));
    
    function fit() {
      try {
        fitAddon.fit();
        const dims = { cols: term.cols, rows: term.rows };
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'resize',
          ...dims,
        }));
      } catch (e) {
        console.error('Fit error:', e);
      }
    }
    
    setTimeout(fit, 100);
    window.addEventListener('resize', () => setTimeout(fit, 100));
    
    term.onData((data) => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'input',
        data: data,
      }));
    });
    
    window.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'data') {
          term.write(msg.data);
        } else if (msg.type === 'clear') {
          term.clear();
        } else if (msg.type === 'reset') {
          term.reset();
        }
      } catch (e) {
        console.error('Message parse error:', e);
      }
    });
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ready',
      cols: term.cols,
      rows: term.rows,
    }));
  </script>
</body>
</html>
  `;

  if (!isConnected) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#58a6ff" />
        <Text style={styles.loadingText}>Connecting to server...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: terminalHTML }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1117',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8b949e',
  },
});
