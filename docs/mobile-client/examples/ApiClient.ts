/**
 * API Client Example for React Native
 * 
 * HTTP client with authentication, retry logic, and type-safe endpoints.
 * Uses axios for cleaner API and interceptors.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import type {
  AgentSessionSummary,
  AgentSessionSnapshot,
  CreateSessionRequest,
  DirectoryListingResponse,
  FileContentResponse,
  WriteFileRequest,
  WriteFileResponse,
  ExecuteCommandRequest,
  ExecuteCommandResponse,
  TerminalSessionsResponse,
  RegisterPushRequest,
  RegisterPushResponse,
  HealthResponse,
  StatsResponse,
  PublicBaseUrlResponse,
} from '../types/api-types';

export interface ApiClientConfig {
  baseURL: string;
  getAuthToken: () => Promise<string>;
  onAuthError?: () => void;
}

export class ApiClient {
  private client: AxiosInstance;
  private getAuthToken: () => Promise<string>;
  private onAuthError?: () => void;

  constructor(config: ApiClientConfig) {
    this.getAuthToken = config.getAuthToken;
    this.onAuthError = config.onAuthError;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: Add auth token
    this.client.interceptors.request.use(
      async (config) => {
        // Skip auth for public endpoints
        const publicEndpoints = ['/health', '/auth/pair/status', '/auth/pair', '/auth/challenge', '/auth/token', '/auth/device/status', '/cloud/public-base-url'];
        const isPublic = publicEndpoints.some(ep => config.url?.startsWith(ep));

        if (!isPublic) {
          try {
            const token = await this.getAuthToken();
            config.headers.Authorization = `Pocket ${token}`;
          } catch (error) {
            console.error('[API] Failed to get auth token:', error);
            throw error;
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          console.error('[API] Authentication error');
          if (this.onAuthError) {
            this.onAuthError();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ========================================================================
  // Health & Status
  // ========================================================================

  async getHealth(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health');
    return response.data;
  }

  async getStats(): Promise<StatsResponse> {
    const response = await this.client.get<StatsResponse>('/stats');
    return response.data;
  }

  async getPublicBaseUrl(): Promise<string | null> {
    const response = await this.client.get<PublicBaseUrlResponse>('/cloud/public-base-url');
    return response.data.url;
  }

  // ========================================================================
  // Agent Sessions
  // ========================================================================

  async listAgentSessions(): Promise<AgentSessionSummary[]> {
    const response = await this.client.get<AgentSessionSummary[]>('/agent/sessions');
    return response.data;
  }

  async createAgentSession(params?: CreateSessionRequest): Promise<{ id: string }> {
    const response = await this.client.post<{ id: string }>('/agent/session', params || {});
    return response.data;
  }

  async getAgentSession(sessionId: string): Promise<AgentSessionSnapshot> {
    const response = await this.client.get<AgentSessionSnapshot>('/agent/session', {
      params: { id: sessionId },
    });
    return response.data;
  }

  async getAgentSessionSnapshot(sessionId: string): Promise<AgentSessionSnapshot> {
    const response = await this.client.get<AgentSessionSnapshot>('/agent/session/snapshot', {
      params: { id: sessionId },
    });
    return response.data;
  }

  async deleteAgentSession(sessionId: string): Promise<void> {
    await this.client.delete('/agent/session', {
      params: { id: sessionId },
    });
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.client.put('/agent/session/title', {
      id: sessionId,
      title,
    });
  }

  // ========================================================================
  // File System
  // ========================================================================

  async getHomeDirectory(): Promise<string> {
    const response = await this.client.get<{ path: string }>('/fs/home');
    return response.data.path;
  }

  async listDirectory(path: string): Promise<DirectoryListingResponse> {
    const response = await this.client.get<DirectoryListingResponse>('/fs/list', {
      params: { path },
    });
    return response.data;
  }

  async readFile(path: string): Promise<FileContentResponse> {
    const response = await this.client.get<FileContentResponse>('/fs/read', {
      params: { path },
    });
    return response.data;
  }

  async writeFile(params: WriteFileRequest): Promise<WriteFileResponse> {
    const response = await this.client.post<WriteFileResponse>('/fs/write', params);
    return response.data;
  }

  async deleteFile(path: string, recursive = false): Promise<void> {
    await this.client.delete('/fs/delete', {
      params: { path, recursive },
    });
  }

  async searchFiles(query: string, path?: string, limit = 100): Promise<any> {
    const response = await this.client.get('/fs/search', {
      params: { query, path, limit },
    });
    return response.data;
  }

  async telescopeSearch(query: string, path?: string, limit = 50): Promise<any> {
    const response = await this.client.get('/fs/telescope', {
      params: { query, path, limit },
    });
    return response.data;
  }

  async getFileMetadata(path: string): Promise<any> {
    const response = await this.client.get('/fs/metadata', {
      params: { path },
    });
    return response.data;
  }

  async executeCommand(params: ExecuteCommandRequest): Promise<ExecuteCommandResponse> {
    const response = await this.client.post<ExecuteCommandResponse>('/fs/terminal', params);
    return response.data;
  }

  // ========================================================================
  // Terminal Sessions
  // ========================================================================

  async listTerminalSessions(): Promise<TerminalSessionsResponse> {
    const response = await this.client.get<TerminalSessionsResponse>('/terminal/sessions', {
      params: { json: true },
    });
    return response.data;
  }

  // ========================================================================
  // Notifications
  // ========================================================================

  async registerPushNotifications(params: RegisterPushRequest): Promise<RegisterPushResponse> {
    const response = await this.client.post<RegisterPushResponse>('/notifications/register', params);
    return response.data;
  }

  async unregisterPushNotifications(deviceId: string): Promise<void> {
    await this.client.delete('/notifications/register', {
      data: { deviceId },
    });
  }

  // ========================================================================
  // File Upload/Download Helpers
  // ========================================================================

  /**
   * Upload file using FormData (for future multipart upload support)
   */
  async uploadFile(file: {
    uri: string;
    name: string;
    type: string;
  }, destinationPath: string): Promise<void> {
    // Note: Server doesn't currently have multipart upload endpoint
    // This is a placeholder for future implementation
    
    // Read file contents
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const content = reader.result as string;
          await this.writeFile({
            path: destinationPath,
            content,
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  }

  /**
   * Download file as blob
   */
  async downloadFile(path: string): Promise<Blob> {
    const response = await this.client.get('/fs/read', {
      params: { path },
      responseType: 'blob',
    });
    return response.data;
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  /**
   * Update base URL (e.g., when switching servers)
   */
  setBaseURL(url: string): void {
    this.client.defaults.baseURL = url;
  }

  /**
   * Get current base URL
   */
  getBaseURL(): string {
    return this.client.defaults.baseURL || '';
  }
}

// ============================================================================
// Usage Example
// ============================================================================

/*

import { ApiClient } from './ApiClient';
import { AuthService } from './AuthService';

// Initialize auth service
const authService = new AuthService({
  serverUrl: 'https://your-server.com',
});

await authService.init();

// Initialize API client
const apiClient = new ApiClient({
  baseURL: authService.getServerUrl(),
  getAuthToken: () => authService.getAccessToken(),
  onAuthError: () => {
    // Handle auth error (e.g., navigate to login screen)
    console.log('Auth error, please log in again');
  },
});

// Use the client
try {
  // Check health
  const health = await apiClient.getHealth();
  console.log('Server version:', health.version);

  // List agent sessions
  const sessions = await apiClient.listAgentSessions();
  console.log('Found sessions:', sessions.length);

  // Create new session
  const newSession = await apiClient.createAgentSession({
    workingDir: '/home/user/project',
    maxMode: false,
  });
  console.log('Created session:', newSession.id);

  // List directory
  const listing = await apiClient.listDirectory('/home/user/project');
  console.log('Files:', listing.entries.map(e => e.name));

  // Read file
  const file = await apiClient.readFile('/home/user/project/README.md');
  console.log('File contents:', file.content);

  // Write file
  await apiClient.writeFile({
    path: '/home/user/project/test.txt',
    content: 'Hello, World!',
  });

  // Execute command
  const result = await apiClient.executeCommand({
    command: 'ls -la',
    cwd: '/home/user/project',
  });
  console.log('Command output:', result.stdout);

  // Register for notifications
  await apiClient.registerPushNotifications({
    deviceId: await authService.getDeviceId(),
    expoPushToken: 'ExponentPushToken[...]',
    platform: 'ios',
  });

} catch (error) {
  console.error('API error:', error);
}

*/

// ============================================================================
// React Hook Example
// ============================================================================

/*

import { useEffect, useState, useCallback } from 'react';
import { ApiClient } from './ApiClient';
import { AgentSessionSummary } from '../types/api-types';

export function useAgentSessions(apiClient: ApiClient) {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listAgentSessions();
      setSessions(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(async (params?: CreateSessionRequest) => {
    try {
      const newSession = await apiClient.createAgentSession(params);
      await loadSessions(); // Refresh list
      return newSession;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [apiClient, loadSessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiClient.deleteAgentSession(sessionId);
      await loadSessions(); // Refresh list
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [apiClient, loadSessions]);

  return {
    sessions,
    loading,
    error,
    refresh: loadSessions,
    createSession,
    deleteSession,
  };
}

// Usage in component:
const MyComponent = () => {
  const { sessions, loading, error, createSession } = useAgentSessions(apiClient);

  const handleCreate = async () => {
    try {
      const session = await createSession({
        workingDir: '/home/user/project',
        maxMode: false,
      });
      console.log('Created:', session.id);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <View>
      {sessions.map(session => (
        <Text key={session.id}>{session.title}</Text>
      ))}
      <Button title="New Session" onPress={handleCreate} />
    </View>
  );
};

*/
