import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { AuthService } from '../services/AuthService';

interface Props {
  navigation: any;
  authService: AuthService;
  onPaired: () => void;
}

export default function ServerConfigScreen({ navigation, authService, onPaired }: Props) {
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePair = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter a server URL');
      return;
    }

    if (!pin.trim() || pin.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit PIN');
      return;
    }

    setIsLoading(true);

    try {
      // Update server URL
      authService.setServerUrl(serverUrl);

      // Attempt pairing
      const result = await authService.pair(pin, {
        platform: Platform.OS as 'ios' | 'android',
        deviceName: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} Device`,
      });

      if (result.success) {
        Alert.alert(
          'Success',
          result.alreadyPaired
            ? 'Device already paired'
            : 'Device paired successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                onPaired();
                navigation.replace('Home');
              },
            },
          ]
        );
      } else {
        Alert.alert('Pairing Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Connect to Pocket Server</Text>
        <Text style={styles.subtitle}>
          Enter your server URL and the PIN from{'\n'}
          <Text style={styles.code}>pocket-server pair</Text>
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.100:3000"
            placeholderTextColor="#666"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>PIN (6 digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor="#666"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handlePair}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Pair Device</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.help}>
          <Text style={styles.helpTitle}>Need help?</Text>
          <Text style={styles.helpText}>
            1. Run <Text style={styles.code}>pocket-server pair</Text> on your computer
          </Text>
          <Text style={styles.helpText}>
            2. Note the 6-digit PIN displayed
          </Text>
          <Text style={styles.helpText}>
            3. If on the same network, use your computer's IP address
          </Text>
          <Text style={styles.helpText}>
            4. For remote access, use the public URL from{' '}
            <Text style={styles.code}>pocket-server pair --remote</Text>
          </Text>
        </View>
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
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#58a6ff',
  },
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#238636',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#1a4d2e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  help: {
    padding: 16,
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 13,
    color: '#8b949e',
    marginBottom: 6,
    lineHeight: 18,
  },
});
