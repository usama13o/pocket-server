import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { AuthService } from '../services/AuthService';
import { WebSocketService } from '../services/WebSocketService';

interface Props {
  navigation: any;
  authService: AuthService;
}

export default function HomeScreen({ navigation, authService }: Props) {
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);

  useEffect(() => {
    initWebSocket();
    fetchServerInfo();
  }, []);

  const initWebSocket = async () => {
    try {
      const token = await authService.getAccessToken();
      const serverUrl = authService.getServerUrl();

      const service = new WebSocketService({
        url: serverUrl,
        token,
        onConnect: () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        },
        onDisconnect: () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
        },
        onError: (error) => {
          console.error('WebSocket error:', error);
        },
      });

      service.connect();
      setWsService(service);
    } catch (error: any) {
      Alert.alert('Connection Error', error.message);
    }
  };

  const fetchServerInfo = async () => {
    try {
      const serverUrl = authService.getServerUrl();
      const response = await fetch(`${serverUrl}/health`);
      const data = await response.json();
      setServerInfo(data);
    } catch (error) {
      console.error('Failed to fetch server info:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            if (wsService) {
              wsService.disconnect();
            }
            await authService.logout();
            navigation.replace('ServerConfig');
          },
        },
      ]
    );
  };

  const openTerminal = () => {
    navigation.navigate('Terminal');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Server</Text>
              <Text style={styles.statusValue}>
                {authService.getServerUrl()}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>WebSocket</Text>
              <View style={[styles.statusDot, isConnected && styles.statusDotConnected]} />
              <Text style={[styles.statusValue, isConnected && styles.statusConnected]}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            {serverInfo && (
              <>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Version</Text>
                  <Text style={styles.statusValue}>{serverInfo.version}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Uptime</Text>
                  <Text style={styles.statusValue}>
                    {Math.floor(serverInfo.uptime / 60)}m
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={openTerminal}
            disabled={!isConnected}
          >
            <Text style={styles.actionIcon}>💻</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Terminal</Text>
              <Text style={styles.actionDescription}>
                Open a new terminal session
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardDisabled]}
            disabled
          >
            <Text style={styles.actionIcon}>🤖</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Agent Chat</Text>
              <Text style={styles.actionDescription}>
                Start a new agent session
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardDisabled]}
            disabled
          >
            <Text style={styles.actionIcon}>📁</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Files</Text>
              <Text style={styles.actionDescription}>
                Browse and manage files
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#8b949e',
    width: 100,
  },
  statusValue: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6e7681',
    marginRight: 8,
  },
  statusDotConnected: {
    backgroundColor: '#3fb950',
  },
  statusConnected: {
    color: '#3fb950',
  },
  actionCard: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: '#8b949e',
  },
  actionArrow: {
    fontSize: 24,
    color: '#8b949e',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#30363d',
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#da3633',
    alignItems: 'center',
  },
  logoutText: {
    color: '#da3633',
    fontSize: 16,
    fontWeight: '600',
  },
});
