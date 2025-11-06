/**
 * Authentication Service Example for React Native
 * 
 * Handles device pairing, token generation, and secure storage.
 * Uses expo-secure-store for iOS/Android secure storage.
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Storage keys
const STORAGE_KEYS = {
  DEVICE_ID: 'pocket_device_id',
  DEVICE_SECRET: 'pocket_device_secret',
  ACCESS_TOKEN: 'pocket_access_token',
  TOKEN_EXPIRES_AT: 'pocket_token_expires_at',
  SERVER_URL: 'pocket_server_url',
};

export interface AuthConfig {
  serverUrl: string;
}

export interface PairResult {
  success: boolean;
  alreadyPaired?: boolean;
  error?: string;
}

export interface TokenInfo {
  token: string;
  expiresAt: Date;
}

export class AuthService {
  private serverUrl: string;
  private deviceId: string | null = null;
  private deviceSecret: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: AuthConfig) {
    this.serverUrl = config.serverUrl;
  }

  /**
   * Initialize: Load stored credentials
   */
  async init(): Promise<void> {
    this.deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
    this.deviceSecret = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_SECRET);
    this.accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    
    const expiresAtStr = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    if (expiresAtStr) {
      this.tokenExpiresAt = new Date(expiresAtStr);
    }
  }

  /**
   * Check if device is paired
   */
  async isPaired(): Promise<boolean> {
    if (!this.deviceId || !this.deviceSecret) {
      await this.init();
    }
    return !!(this.deviceId && this.deviceSecret);
  }

  /**
   * Get or generate device ID
   */
  async getDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
      if (!this.deviceId) {
        this.deviceId = this.generateUUID();
        await SecureStore.setItemAsync(STORAGE_KEYS.DEVICE_ID, this.deviceId);
      }
    }
    return this.deviceId;
  }

  /**
   * Check pairing status on server
   */
  async checkPairingStatus(): Promise<{
    active: boolean;
    mode: 'local' | 'remote';
    secondsLeft: number;
  }> {
    const response = await fetch(`${this.serverUrl}/auth/pair/status`);
    if (!response.ok) {
      throw new Error('Failed to check pairing status');
    }
    return response.json();
  }

  /**
   * Check if this device is registered on server
   */
  async checkDeviceStatus(): Promise<boolean> {
    const deviceId = await this.getDeviceId();
    const response = await fetch(
      `${this.serverUrl}/auth/device/status?deviceId=${encodeURIComponent(deviceId)}`
    );
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.registered === true;
  }

  /**
   * Pair device with server using PIN
   */
  async pair(pin: string, options?: {
    platform?: 'ios' | 'android';
    deviceName?: string;
    pairToken?: string;
  }): Promise<PairResult> {
    const deviceId = await this.getDeviceId();
    
    const body = {
      deviceId,
      pin,
      platform: options?.platform,
      name: options?.deviceName,
      pairToken: options?.pairToken,
    };

    const response = await fetch(`${this.serverUrl}/auth/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Pairing failed',
      };
    }

    if (data.alreadyPaired) {
      return {
        success: true,
        alreadyPaired: true,
      };
    }

    // Store secret securely
    if (data.data?.secret) {
      this.deviceSecret = data.data.secret;
      await SecureStore.setItemAsync(STORAGE_KEYS.DEVICE_SECRET, data.data.secret);
    }

    return {
      success: true,
      alreadyPaired: false,
    };
  }

  /**
   * Get valid access token (refreshes if needed)
   */
  async getAccessToken(): Promise<string> {
    // Check if current token is still valid (with 1 minute buffer)
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const timeLeft = this.tokenExpiresAt.getTime() - now.getTime();
      if (timeLeft > 60000) { // More than 1 minute left
        return this.accessToken;
      }
    }

    // Need to refresh token
    await this.refreshToken();
    
    if (!this.accessToken) {
      throw new Error('Failed to obtain access token');
    }

    return this.accessToken;
  }

  /**
   * Refresh access token using challenge-response flow
   */
  private async refreshToken(): Promise<void> {
    if (!this.deviceId || !this.deviceSecret) {
      throw new Error('Device not paired. Call pair() first.');
    }

    // Step 1: Request challenge
    const challengeResponse = await fetch(`${this.serverUrl}/auth/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
      }),
    });

    if (!challengeResponse.ok) {
      throw new Error('Failed to get challenge');
    }

    const challengeData = await challengeResponse.json();
    if (challengeData.error) {
      throw new Error(challengeData.error);
    }

    const { nonce } = challengeData;

    // Step 2: Sign challenge
    const signature = await this.signChallenge(this.deviceSecret, this.deviceId, nonce);

    // Step 3: Exchange for token
    const tokenResponse = await fetch(`${this.serverUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
        nonce,
        signature,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      throw new Error(tokenData.error);
    }

    // Store token
    this.accessToken = tokenData.token;
    this.tokenExpiresAt = new Date(tokenData.expiresAt);

    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokenData.token);
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_EXPIRES_AT, tokenData.expiresAt);
  }

  /**
   * Sign challenge with device secret
   */
  private async signChallenge(secret: string, deviceId: string, nonce: string): Promise<string> {
    // Construct message: secret\ndeviceId\nnonce
    const message = `${secret}\n${deviceId}\n${nonce}`;
    
    // Calculate SHA-256 hash
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      message,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    return digest;
  }

  /**
   * Logout: Clear all stored credentials
   */
  async logout(): Promise<void> {
    this.deviceId = null;
    this.deviceSecret = null;
    this.accessToken = null;
    this.tokenExpiresAt = null;

    await SecureStore.deleteItemAsync(STORAGE_KEYS.DEVICE_SECRET);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    // Keep device ID for re-pairing
  }

  /**
   * Reset device: Clear device ID and all credentials
   */
  async reset(): Promise<void> {
    await this.logout();
    await SecureStore.deleteItemAsync(STORAGE_KEYS.DEVICE_ID);
  }

  /**
   * Get authorization header value
   */
  async getAuthHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `Pocket ${token}`;
  }

  /**
   * Get current server URL
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Update server URL
   */
  setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  /**
   * Generate UUID v4
   */
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

// Initialize
const authService = new AuthService({
  serverUrl: 'https://your-server.com',
});

await authService.init();

// Check if paired
const isPaired = await authService.isPaired();

if (!isPaired) {
  // Wait for user to enter PIN from terminal
  const pin = '123456'; // From user input
  
  const result = await authService.pair(pin, {
    platform: Platform.OS as 'ios' | 'android',
    deviceName: `${Platform.OS} Device`,
  });
  
  if (!result.success) {
    console.error('Pairing failed:', result.error);
  }
}

// Get access token for API calls
const token = await authService.getAccessToken();

// Use in API call
const response = await fetch(`${authService.getServerUrl()}/agent/sessions`, {
  headers: {
    'Authorization': await authService.getAuthHeader(),
  },
});

// Logout
await authService.logout();

*/
