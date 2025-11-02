/**
 * Terminal Integration Example for React Native
 * 
 * Integrates xterm.js in a WebView for full terminal emulation.
 * Handles PTY I/O, keyboard input, and resize events.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebSocketService } from './WebSocketService';
import type { TermFramePayload } from '../types/api-types';

export interface TerminalProps {
  terminalId: string;
  wsService: WebSocketService;
  cwd?: string;
  initialCols?: number;
  initialRows?: number;
  onExit?: (code: number) => void;
}

export const Terminal: React.FC<TerminalProps> = ({
  terminalId,
  wsService,
  cwd,
  initialCols = 80,
  initialRows = 24,
  onExit,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const inputSeqRef = useRef(0);

  // Terminal HTML with xterm.js
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
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.js"></script>
  
  <script>
    // Initialize xterm.js
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
    
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(webLinksAddon);
    
    term.open(document.getElementById('terminal'));
    
    // Fit terminal to container
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
    
    // Initial fit
    setTimeout(fit, 100);
    
    // Resize on orientation change
    window.addEventListener('resize', () => {
      setTimeout(fit, 100);
    });
    
    // Handle keyboard input
    term.onData((data) => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'input',
        data: data,
      }));
    });
    
    // Receive data from React Native
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
    
    // Signal ready
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ready',
      cols: term.cols,
      rows: term.rows,
    }));
  </script>
</body>
</html>
  `;

  useEffect(() => {
    // Open or attach to terminal when ready
    if (isReady && wsService.isConnected()) {
      wsService.send('term:open_or_attach', {
        id: terminalId,
        cwd: cwd || '/home',
        cols: initialCols,
        rows: initialRows,
      });
    }
  }, [isReady, terminalId, wsService, cwd, initialCols, initialRows]);

  useEffect(() => {
    // Subscribe to terminal frames
    const unsubscribeFrame = wsService.onMessageType('term:frame', (message) => {
      const payload = message.payload as TermFramePayload;
      
      if (payload.id === terminalId) {
        // Send data to WebView
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'data',
            data: payload.data,
          }));
        }
      }
    });

    // Subscribe to terminal opened event
    const unsubscribeOpened = wsService.onMessageType('term:opened', (message) => {
      if (message.payload.id === terminalId) {
        console.log('Terminal opened:', message.payload);
      }
    });

    // Subscribe to terminal exit event
    const unsubscribeExit = wsService.onMessageType('term:exit', (message) => {
      if (message.payload.id === terminalId) {
        console.log('Terminal exited:', message.payload.code);
        if (onExit) {
          onExit(message.payload.code);
        }
      }
    });

    // Subscribe to resize confirmation
    const unsubscribeResized = wsService.onMessageType('term:resized', (message) => {
      if (message.payload.id === terminalId) {
        console.log('Terminal resized:', message.payload);
      }
    });

    return () => {
      unsubscribeFrame();
      unsubscribeOpened();
      unsubscribeExit();
      unsubscribeResized();
    };
  }, [wsService, terminalId, onExit]);

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'ready':
          console.log('Terminal ready:', message.cols, 'x', message.rows);
          setIsReady(true);
          break;
          
        case 'input':
          // Send input to server with sequence number
          inputSeqRef.current += 1;
          wsService.send('term:input', {
            id: terminalId,
            data: message.data,
            seq: inputSeqRef.current,
          });
          break;
          
        case 'resize':
          // Send resize to server
          wsService.send('term:resize', {
            id: terminalId,
            cols: message.cols,
            rows: message.rows,
          });
          break;
      }
    } catch (error) {
      console.error('Failed to handle WebView message:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: terminalHTML }}
        style={styles.webview}
        onMessage={handleMessage}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

// ============================================================================
// Usage Example in a Screen
// ============================================================================

/*

import React, { useState } from 'react';
import { View, Button, SafeAreaView, StyleSheet } from 'react-native';
import { Terminal } from './TerminalIntegration';
import { useWebSocket } from './WebSocketService';

const TerminalScreen = () => {
  const [terminalId, setTerminalId] = useState('term:/home/user/project#1');
  const { wsService, isConnected } = useWebSocket(serverUrl, token);

  const handleExit = (code: number) => {
    console.log('Terminal exited with code:', code);
    // Optionally show a message or create a new terminal
  };

  if (!isConnected) {
    return (
      <View style={styles.center}>
        <Text>Connecting to server...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Terminal
        terminalId={terminalId}
        wsService={wsService!}
        cwd="/home/user/project"
        initialCols={80}
        initialRows={24}
        onExit={handleExit}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TerminalScreen;

*/

// ============================================================================
// Multi-Tab Terminal Example
// ============================================================================

/*

import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react';
import { Terminal } from './TerminalIntegration';

interface TerminalTab {
  id: string;
  title: string;
  cwd: string;
}

const MultiTerminalScreen = ({ wsService }: { wsService: WebSocketService }) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term:#1', title: 'Terminal 1', cwd: '/home/user' },
  ]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const addTab = () => {
    const newTab: TerminalTab = {
      id: `term:#${tabs.length + 1}`,
      title: `Terminal ${tabs.length + 1}`,
      cwd: tabs[activeTabIndex]?.cwd || '/home/user',
    };
    setTabs([...tabs, newTab]);
    setActiveTabIndex(tabs.length);
  };

  const closeTab = (index: number) => {
    if (tabs.length === 1) return; // Keep at least one tab
    
    // Send close message to server
    wsService.send('term:close', {
      id: tabs[index].id,
    });
    
    const newTabs = tabs.filter((_, i) => i !== index);
    setTabs(newTabs);
    setActiveTabIndex(Math.max(0, Math.min(activeTabIndex, newTabs.length - 1)));
  };

  const setTabTitle = (index: number, title: string) => {
    const newTabs = [...tabs];
    newTabs[index].title = title;
    setTabs(newTabs);
    
    // Send title to server
    wsService.send('term:title', {
      id: newTabs[index].id,
      title,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        style={styles.tabBar}
        showsHorizontalScrollIndicator={false}
      >
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              index === activeTabIndex && styles.activeTab,
            ]}
            onPress={() => setActiveTabIndex(index)}
            onLongPress={() => {
              // Show rename dialog
              const newTitle = prompt('Enter new title:', tab.title);
              if (newTitle) {
                setTabTitle(index, newTitle);
              }
            }}
          >
            <Text style={styles.tabText}>{tab.title}</Text>
            {tabs.length > 1 && (
              <TouchableOpacity
                onPress={() => closeTab(index)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addTabButton} onPress={addTab}>
          <Text style={styles.addTabText}>+</Text>
        </TouchableOpacity>
      </ScrollView>
      
      <View style={styles.terminalContainer}>
        {tabs.map((tab, index) => (
          <View
            key={tab.id}
            style={[
              styles.terminal,
              index !== activeTabIndex && styles.hiddenTerminal,
            ]}
          >
            <Terminal
              terminalId={tab.id}
              wsService={wsService}
              cwd={tab.cwd}
              onExit={(code) => {
                console.log(`Terminal ${tab.id} exited with code ${code}`);
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  tabBar: {
    flexGrow: 0,
    backgroundColor: '#252526',
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#3e3e42',
  },
  activeTab: {
    backgroundColor: '#1e1e1e',
  },
  tabText: {
    color: '#cccccc',
    fontSize: 14,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
  closeText: {
    color: '#cccccc',
    fontSize: 18,
  },
  addTabButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTabText: {
    color: '#cccccc',
    fontSize: 18,
  },
  terminalContainer: {
    flex: 1,
  },
  terminal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hiddenTerminal: {
    display: 'none',
  },
});

*/
