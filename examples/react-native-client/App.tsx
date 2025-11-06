import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import ServerConfigScreen from './src/screens/ServerConfigScreen';
import HomeScreen from './src/screens/HomeScreen';
import TerminalScreen from './src/screens/TerminalScreen';
import { AuthService } from './src/services/AuthService';

const Stack = createStackNavigator();
const queryClient = new QueryClient();

export default function App() {
  const [authService, setAuthService] = useState<AuthService | null>(null);
  const [isPaired, setIsPaired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize with default server URL (can be changed in settings)
    const service = new AuthService({
      serverUrl: 'http://localhost:3000',
    });

    service.init().then(async () => {
      const paired = await service.isPaired();
      setIsPaired(paired);
      setAuthService(service);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={isPaired ? 'Home' : 'ServerConfig'}
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1e1e1e',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="ServerConfig"
            options={{ title: 'Connect to Server' }}
          >
            {(props) => (
              <ServerConfigScreen
                {...props}
                authService={authService!}
                onPaired={() => setIsPaired(true)}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Home"
            options={{ title: 'Pocket Server' }}
          >
            {(props) => (
              <HomeScreen
                {...props}
                authService={authService!}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Terminal"
            options={{ title: 'Terminal' }}
          >
            {(props) => (
              <TerminalScreen
                {...props}
                authService={authService!}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
        <StatusBar style="light" />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
